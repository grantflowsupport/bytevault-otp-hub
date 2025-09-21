import { Router } from 'express';
import { requireUser, AuthenticatedRequest } from './auth.js';
import { supabaseAdmin } from './db.js';
import { decrypt } from './crypto.js';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

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

router.post('/get-otp/:slug', requireUser, async (req: AuthenticatedRequest, res) => {
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

    // Get ranked accounts for this product
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .rpc('get_ranked_accounts', { p_product_id: product.id });

    if (accountsError || !accounts || accounts.length === 0) {
      await logOTP(userId, product.id, null, 'no_accounts', 'No active accounts configured');
      return res.status(404).json({ error: 'no_accounts' });
    }

    const EMAIL_FETCH_LIMIT = parseInt(process.env.EMAIL_FETCH_LIMIT || '20');
    const DEFAULT_OTP_REGEX = process.env.DEFAULT_OTP_REGEX || '\\b\\d{6}\\b';

    // Try each account in order
    for (const account of accounts) {
      try {
        // Decrypt IMAP password
        const imapPassword = decrypt(account.imap_password_enc);
        
        // Determine sender filter and regex
        const senderFilter = account.sender_override || account.fetch_from_filter;
        const otpRegex = new RegExp(account.otp_regex_override || account.otp_regex || DEFAULT_OTP_REGEX);

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

        await client.connect();

        try {
          await client.selectMailbox('INBOX');

          // Search for emails from the last 24 hours
          const since = new Date();
          since.setDate(since.getDate() - 1);

          let searchCriteria: any = { since };
          if (senderFilter) {
            searchCriteria.from = senderFilter;
          }

          const messages = await client.search(searchCriteria, { uid: true });
          
          if (messages.length === 0) {
            await client.logout();
            continue;
          }

          // Fetch the latest messages (up to EMAIL_FETCH_LIMIT)
          const messagesToFetch = messages.slice(-EMAIL_FETCH_LIMIT);
          
          for (const uid of messagesToFetch.reverse()) {
            const { content } = await client.download(uid);
            const parsed = await simpleParser(content);

            // Search for OTP in subject and text content
            const searchText = `${parsed.subject || ''} ${parsed.text || ''} ${parsed.html || ''}`;
            const otpMatch = searchText.match(otpRegex);

            if (otpMatch) {
              // Found OTP! Update last_used_at and log success
              await supabaseAdmin
                .from('accounts')
                .update({ last_used_at: new Date().toISOString() })
                .eq('id', account.account_id);

              await logOTP(userId, product.id, account.account_id, 'success', `OTP found: ${otpMatch[0]}`);
              await client.logout();

              return res.json({
                otp: otpMatch[0],
                from: parsed.from?.text || 'Unknown',
                subject: parsed.subject || '',
                fetched_at: new Date().toISOString(),
              });
            }
          }

          await client.logout();
        } catch (imapError) {
          await client.logout();
          await logOTP(userId, product.id, account.account_id, 'error', `IMAP error: ${imapError.message}`);
          continue;
        }
      } catch (error) {
        await logOTP(userId, product.id, account.account_id, 'error', `Connection error: ${error.message}`);
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

export default router;
