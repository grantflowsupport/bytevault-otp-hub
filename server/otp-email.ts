import { Router } from 'express';
import { requireUser, AuthenticatedRequest } from './auth.js';
import { supabaseAdmin } from './db.js';
import { decrypt } from './crypto.js';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { TotpService } from './totp.js';

console.log('🚀 OTP Email Router v2.1 – using fetchOne API loaded successfully');

const router = Router();

// Rate limiting - simple in-memory store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(userId: string, productId: string): boolean {
  const key = `${userId}:${productId}`;
  const now = Date.now();
  const userLimit = rateLimitStore.get(key);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }

  userLimit.count++;
  return true;
}

async function logOTP(userId: string, productId: string, accountId: string | null, status: string, detail?: string) {
  await supabaseAdmin.from('otp_logs').insert({
    user_id: userId,
    product_id: productId,
    account_id: accountId,
    status,
    detail,
  });
}

interface FilterConfig {
  senderWhitelist: string[];
  senderBlacklist: string[];
  otpPatterns: RegExp[];
  subjectFilters: string[];
  timeWindow: number; // hours
}

async function getAdvancedFilterConfig(account: any): Promise<FilterConfig> {
  const DEFAULT_OTP_REGEX = process.env.DEFAULT_OTP_REGEX || '\\b\\d{6}\\b';
  
  // Parse sender filters (support comma-separated values)
  const senderOverride = account.sender_override || '';
  const fetchFromFilter = account.fetch_from_filter || '';
  
  // Combine and parse sender whitelist
  const senderWhitelist = [senderOverride, fetchFromFilter]
    .filter(Boolean)
    .flatMap((filter: string) => filter.split(',').map((s: string) => s.trim()))
    .filter(Boolean);
  
  // For now, blacklist is empty (can be enhanced later with new schema fields)
  const senderBlacklist: string[] = [];
  
  // Parse OTP regex patterns with error handling
  const regexPattern = account.otp_regex_override || account.otp_regex || DEFAULT_OTP_REGEX;
  const otpPatterns: RegExp[] = [];
  
  // Safely create main pattern
  try {
    otpPatterns.push(new RegExp(regexPattern, 'g'));
  } catch (error) {
    // Fallback to default if pattern is invalid
    otpPatterns.push(new RegExp(DEFAULT_OTP_REGEX, 'g'));
  }
  
  // Enhanced patterns for common OTP formats (tightened to avoid false positives)
  const enhancedPatterns = [
    /(?:\b(?:code|otp|verification|authenticate|passcode)\b)[:\s-]*([0-9]{4,8})/g, // Strict numeric OTP patterns
    /(?:\b(?:code|otp|verification|authenticate|passcode)\b)[:\s-]*([A-Z0-9]{4,8})/g, // Strict alphanumeric patterns  
    /\bPIN\b[:\s-]*([0-9]{4,8})/g, // Explicit PIN only for numeric codes
  ];
  
  otpPatterns.push(...enhancedPatterns);
  
  // Subject filters (common OTP-related keywords)
  const subjectFilters = [
    'verification', 'code', 'otp', 'authenticate', 'login', 'signin',
    'security', 'access', 'confirm', 'activate', 'reset'
  ];
  
  // Default time window of 24 hours
  const timeWindow = 24;
  
  return {
    senderWhitelist,
    senderBlacklist,
    otpPatterns,
    subjectFilters,
    timeWindow
  };
}

router.post('/get-otp/:slug', requireUser, async (req: AuthenticatedRequest, res) => {
  console.log('🚀 OTP ENDPOINT CALLED FOR SLUG:', req.params.slug);
  try {
    const { slug } = req.params;
    const userId = req.user!.id;

    // Check rate limit
    if (!checkRateLimit(userId, slug)) {
      await logOTP(userId, slug, null, 'rate_limited', 'Rate limit exceeded');
      return res.status(429).json({ error: 'rate_limited', message: 'Rate limit exceeded. Please try again in a moment.' });
    }

    // Get product by slug
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (productError || !product) {
      return res.status(404).json({ error: 'product_not_found' });
    }

    // Check user access
    const { data: access, error: accessError } = await supabaseAdmin
      .from('user_access')
      .select('*')
      .eq('user_id', userId)
      .eq('product_id', product.id)
      .single();

    if (accessError || !access) {
      return res.status(403).json({ error: 'no_access' });
    }

    // Check if access has expired
    if (access.expires_at && new Date(access.expires_at) < new Date()) {
      return res.status(403).json({ error: 'access_expired' });
    }

    // Get ranked accounts for this product using Supabase direct queries
    console.log('Searching for accounts for product:', { productId: product.id, productSlug: product.slug });
    
    const { data: accountMappings, error: accountsError } = await supabaseAdmin
      .from('product_accounts')
      .select(`
        weight,
        sender_override,
        otp_regex_override,
        accounts!inner (
          id,
          label,
          imap_host,
          imap_port,
          imap_user,
          imap_password_enc,
          otp_regex,
          fetch_from_filter,
          priority
        )
      `)
      .eq('product_id', product.id)
      .eq('is_active', true)
      .eq('accounts.is_active', true)
      .order('weight', { ascending: false });

    // Transform the data to match expected format
    const accounts = accountMappings?.map((mapping: any) => ({
      ...mapping.accounts,
      weight: mapping.weight,
      sender_override: mapping.sender_override,
      otp_regex_override: mapping.otp_regex_override,
    })) || [];

    console.log('Supabase accounts query result:', { 
      accounts, 
      accountsError, 
      accountsLength: accounts?.length,
      errorCode: accountsError?.code,
      errorMessage: accountsError?.message 
    });

    if (accountsError || !accounts || accounts.length === 0) {
      console.log('No accounts found - logging no_accounts error');
      await logOTP(userId, product.id, null, 'no_accounts', 'No active accounts configured');
      return res.status(404).json({ error: 'no_accounts' });
    }

    const EMAIL_FETCH_LIMIT = parseInt(process.env.EMAIL_FETCH_LIMIT || '20');
    const DEFAULT_OTP_REGEX = process.env.DEFAULT_OTP_REGEX || '\\b\\d{6}\\b';

    // Try each account in order
    for (const account of accounts) {
      try {
        console.log('Processing account:', {
          accountId: account.id,
          accountLabel: account.label,
          imapHost: account.imap_host,
          imapUser: account.imap_user
        });
        
        // Decrypt IMAP password
        const imapPassword = decrypt(account.imap_password_enc);
        
        // Advanced filtering configuration
        const filterConfig = await getAdvancedFilterConfig(account);
        const { senderWhitelist, senderBlacklist, otpPatterns, subjectFilters, timeWindow } = filterConfig;

        // Connect to IMAP
        const client = new ImapFlow({
          host: account.imap_host,
          port: account.imap_port,
          secure: true,
          auth: {
            user: account.imap_user,
            pass: imapPassword,
          },
        });

        console.log('Connecting to IMAP...');
        await client.connect();
        console.log('IMAP connection established');

        let lock;
        try {
          console.log('Acquiring mailbox lock...');
          lock = await client.getMailboxLock('INBOX');
          console.log('Mailbox lock acquired');

          // Search for emails within the configured time window
          const since = new Date();
          since.setTime(since.getTime() - (timeWindow * 60 * 60 * 1000));
          
          console.log('Email search configuration:', {
            timeWindow,
            sinceTime: since.toISOString(),
            senderWhitelistLength: senderWhitelist.length,
            senderBlacklistLength: senderBlacklist.length,
            otpPatternsLength: otpPatterns.length
          });

          // Search for emails within time window
          let messages: any[] = [];
          
          console.log('Starting email search with config:', {
            timeWindow,
            senderWhitelistLength: senderWhitelist.length,
            accountLabel: account.label
          });
          
          if (senderWhitelist.length > 0) {
            // Search each sender separately and combine results
            for (const sender of senderWhitelist) {
              try {
                const senderMessages = await client.search({ since, from: sender }, { uid: true });
                if (senderMessages && Array.isArray(senderMessages)) {
                  messages.push(...senderMessages);
                }
              } catch (error) {
                // Continue with other senders if one fails
                continue;
              }
            }
            // Remove duplicates and sort
            messages = Array.from(new Set(messages)).sort((a, b) => a - b);
          } else {
            // Search all emails if no whitelist
            console.log('Searching all emails since:', since.toISOString());
            const allMessages = await client.search({ since }, { uid: true });
            console.log('Raw search result:', allMessages);
            messages = Array.isArray(allMessages) ? allMessages : [];
            console.log('Processed messages array:', messages);
          }
          
          if (!messages || messages.length === 0) {
            lock.release();
            await client.logout();
            continue;
          }

          // Fetch all messages (process from newest to oldest)
          const messagesToFetch = Array.isArray(messages) ? messages : [];
          
          console.log('Messages to fetch:', {
            totalFound: messages.length,
            messagesToFetch: messagesToFetch,
            fetchLimit: EMAIL_FETCH_LIMIT
          });
          
          console.log('TEST_LOG_EXECUTION_CONTINUES');
          
          try {
            for (const uid of messagesToFetch.reverse()) {
            console.log('🔄 Fetching email UID:', uid);
            
            // Use correct ImapFlow API - fetchOne with source stream
            const msg = await client.fetchOne(uid, { source: true, uid: true });
            const source = msg?.source;
            
            if (!source) {
              console.log('❌ No source stream for UID:', uid);
              continue;
            }
            
            console.log('✅ Source stream obtained for UID:', uid);
            const parsed = await simpleParser(source);
            console.log('✅ Parsed email UID:', uid);

            console.log('Processing email:', {
              uid,
              subject: parsed.subject,
              from: parsed.from?.text,
              hasText: !!parsed.text,
              hasHtml: !!parsed.html,
              textLength: typeof parsed.text === 'string' ? parsed.text.length : 0,
              htmlLength: typeof parsed.html === 'string' ? parsed.html.length : 0
            });

            // Advanced sender filtering
            const fromAddress = parsed.from?.text || '';
            
            // Check sender blacklist
            if (senderBlacklist.some(blocked => fromAddress.includes(blocked))) {
              continue;
            }
            
            // If whitelist is configured, ensure sender matches
            if (senderWhitelist.length > 0 && !senderWhitelist.some(allowed => fromAddress.includes(allowed))) {
              continue;
            }

            // Enhanced subject filtering for OTP relevance
            const subject = (parsed.subject || '').toLowerCase();
            const isOtpRelated = subjectFilters.some(filter => subject.includes(filter));
            
            // Search for OTP in subject and text content
            const searchText = `${parsed.subject || ''} ${parsed.text || ''} ${parsed.html || ''}`;
            
            console.log('Email content for OTP search:', {
              subject: parsed.subject,
              textPreview: typeof parsed.text === 'string' ? parsed.text.substring(0, 200) : 'No text',
              htmlPreview: typeof parsed.html === 'string' ? parsed.html.substring(0, 200) : 'No HTML',
              searchTextLength: searchText.length,
              otpPatternsCount: otpPatterns.length
            });
            
            let foundOtp: string | null = null;
            let matchPattern: string = '';
            
            // Try each OTP pattern until we find a match (with timeout protection)
            for (const pattern of otpPatterns) {
              pattern.lastIndex = 0; // Reset regex
              
              try {
                // Limit search text size to prevent ReDoS
                const limitedText = searchText.substring(0, 10000); // Max 10KB
                const startTime = Date.now();
                
                const matches = Array.from(limitedText.matchAll(pattern));
                
                console.log('Pattern test result:', {
                  pattern: pattern.source,
                  matchesFound: matches.length,
                  matches: matches.map(m => m[0])
                });
                
                // Timeout check (prevent long-running regex)
                if (Date.now() - startTime > 500) { // 500ms max
                  continue;
                }
                
                if (matches.length > 0) {
                  // Prefer matches from OTP-related emails
                  const bestMatch = isOtpRelated ? matches[0] : matches[matches.length - 1];
                  foundOtp = bestMatch[1] || bestMatch[0]; // Use capture group if available
                  matchPattern = pattern.source;
                  break;
                }
              } catch (error) {
                // Skip pattern if it fails
                continue;
              }
            }

            if (foundOtp) {
              // Validate OTP format (basic sanity check)
              if (foundOtp.length >= 4 && foundOtp.length <= 12) {
                // Helper to detect trivial/placeholder OTPs
                const isTrivialOTP = (otp: string): boolean => {
                  // Repeated digits (000000, 111111, etc.)
                  if (/(\d)\1{5}/.test(otp)) return true;
                  // Common sequences
                  const sequences = ['123456', '654321', '123123', '000000', '111111', '222222'];
                  return sequences.includes(otp);
                };
                
                // Check if sender is whitelisted
                const fromAddress = parsed.from?.text || '';
                const senderWhitelisted = senderWhitelist.length > 0 && senderWhitelist.some(allowed => fromAddress.includes(allowed));
                
                // Extract context around the match for additional validation
                const otpIndex = searchText.indexOf(foundOtp);
                const contextStart = Math.max(0, otpIndex - 60);
                const contextEnd = Math.min(searchText.length, otpIndex + foundOtp.length + 60);
                const contextWindow = searchText.substring(contextStart, contextEnd);
                const hasContextNearMatch = /(otp|code|verify|verification|login|sign\s?in|two[-\s]?factor|authentication|passcode)/i.test(contextWindow);
                
                // Check confidence - reject trivial OTPs and require context/trust
                const isStrictSixDigit = /^\d{6}$/.test(foundOtp);
                const isTrivial = isTrivialOTP(foundOtp);
                const isHighConfidence = !isTrivial && (senderWhitelisted || isOtpRelated || hasContextNearMatch);
                
                if (isHighConfidence) {
                  // Found high-confidence OTP! Update last_used_at and log success
                  await supabaseAdmin
                    .from('accounts')
                    .update({ last_used_at: new Date().toISOString() })
                    .eq('id', account.id);

                  await logOTP(userId, product.id, account.id, 'success', 
                    `OTP extracted (pattern: ${matchPattern}, relevance: ${isOtpRelated ? 'high' : 'low'}, confidence: high, length: ${foundOtp.length})`);
                  
                  lock.release();
                  await client.logout();

                  return res.json({
                    otp: foundOtp,
                    from: parsed.from?.text || 'Unknown',
                    subject: parsed.subject || '',
                    fetched_at: new Date().toISOString(),
                    relevance: isOtpRelated ? 'high' : 'low',
                    pattern: matchPattern,
                    account_label: account.label
                  });
                } else {
                  // Low confidence match - log and continue scanning more emails
                  console.log(`⚠️ Low confidence OTP candidate "${foundOtp}" from ${parsed.from?.text} (trivial: ${isTrivial}, context: ${hasContextNearMatch}, sender: ${senderWhitelisted}, subject: ${isOtpRelated}) - continuing search...`);
                  foundOtp = null; // Reset to continue searching
                }
              }
            }
          }
          } catch (loopError) {
            console.error('💥 EMAIL PROCESSING LOOP ERROR:', {
              error: loopError.message,
              stack: loopError.stack,
              messagesToFetchLength: messagesToFetch.length,
              messagesToFetch: messagesToFetch.slice(0, 5) // First 5 UIDs
            });
          }

          lock.release();
          await client.logout();
        } catch (imapError: any) {
          if (lock) lock.release();
          await client.logout();
          await logOTP(userId, product.id, account.id, 'error', `IMAP error: ${imapError?.message || String(imapError)}`);
          continue;
        }
      } catch (error: any) {
        console.error('Error processing account:', {
          accountId: account.id,
          accountLabel: account.label,
          error: error?.message || String(error),
          stack: error?.stack
        });
        await logOTP(userId, product.id, account.id, 'error', `Connection error: ${error?.message || String(error)}`);
        continue;
      }
    }

    // No OTP found in any account
    await logOTP(userId, product.id, null, 'otp_not_found', 'No OTP found in configured accounts');
    return res.status(404).json({ error: 'otp_not_found', message: 'No OTP found in recent emails' });

  } catch (error) {
    console.error('OTP fetch error:', error);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// Get TOTP code for a product
router.post('/get-totp/:slug', requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    // Check rate limit (reuse same limiter as email OTP)
    if (!checkRateLimit(userId, slug)) {
      await logOTP(userId, slug, null, 'rate_limited', 'TOTP request rate limit exceeded');
      return res.status(429).json({ error: 'rate_limited', message: 'Too many requests' });
    }

    // 1. Get the product by slug
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('id, slug, title, is_active')
      .eq('slug', slug)
      .single();

    if (productError || !product) {
      await logOTP(userId, slug, null, 'product_not_found', 'Product not found');
      return res.status(404).json({ error: 'product_not_found' });
    }

    if (!product.is_active) {
      await logOTP(userId, product.id, null, 'product_inactive', 'Product is inactive');
      return res.status(403).json({ error: 'product_inactive' });
    }

    // 2. Validate user has active access to this product
    const { data: userAccess, error: accessError } = await supabaseAdmin
      .from('user_access')
      .select('expires_at')
      .eq('user_id', userId)
      .eq('product_id', product.id)
      .single();

    if (accessError || !userAccess) {
      await logOTP(userId, product.id, null, 'access_denied', 'User does not have access to this product');
      return res.status(403).json({ error: 'access_denied' });
    }

    // Check if access has expired
    if (userAccess.expires_at && new Date(userAccess.expires_at) < new Date()) {
      await logOTP(userId, product.id, null, 'access_expired', 'User access has expired');
      return res.status(403).json({ error: 'access_expired' });
    }

    // 3. Load TOTP config from product description (workaround for PostgREST cache)
    const { data: productData, error: productFetchError } = await supabaseAdmin
      .from('products')
      .select('description')
      .eq('id', product.id)
      .single();

    if (productFetchError || !productData) {
      await logOTP(userId, product.id, null, 'product_fetch_failed', 'Failed to fetch product data');
      return res.status(500).json({ error: 'product_fetch_failed' });
    }

    // Parse TOTP metadata from description
    let totpConfig = null;
    try {
      if (productData.description && productData.description.includes('TOTP configured|')) {
        const metadataJson = productData.description.split('TOTP configured|')[1];
        const metadata = JSON.parse(metadataJson);
        
        if (metadata.totp_configured && metadata.secret_enc) {
          totpConfig = {
            id: `totp-${product.id}`,
            secret_enc: metadata.secret_enc,
            issuer: metadata.issuer,
            account_label: metadata.account_label,
            digits: metadata.digits,
            period: metadata.period,
            algorithm: metadata.algorithm,
          };
        }
      }
    } catch (parseError) {
      console.error('TOTP metadata parsing error:', parseError);
    }

    if (!totpConfig) {
      await logOTP(userId, product.id, null, 'totp_not_configured', 'TOTP not configured for this product');
      return res.status(404).json({ error: 'totp_not_configured' });
    }

    // 4. Generate TOTP code
    try {
      const { code, valid_for_seconds } = TotpService.generateCode({
        secret_enc: totpConfig.secret_enc,
        digits: totpConfig.digits,
        period: totpConfig.period,
        algorithm: totpConfig.algorithm,
      });

      // 5. Log successful TOTP generation
      await logOTP(userId, product.id, totpConfig.id, 'totp_success', 
        `TOTP generated (${totpConfig.digits} digits, ${totpConfig.period}s period)`);

      return res.json({
        code,
        valid_for_seconds,
        issuer: totpConfig.issuer,
        account_label: totpConfig.account_label,
        fetched_at: new Date().toISOString(),
      });

    } catch (totpError: any) {
      await logOTP(userId, product.id, totpConfig.id, 'totp_error', 
        `TOTP generation failed: ${totpError.message}`);
      return res.status(500).json({ error: 'totp_generation_failed' });
    }

  } catch (error: any) {
    console.error('TOTP fetch error:', error);
    await logOTP(req.user?.id || 'unknown', req.params.slug, null, 'error', 
      `TOTP endpoint error: ${error.message}`);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
