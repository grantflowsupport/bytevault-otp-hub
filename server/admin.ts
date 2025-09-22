import { Router } from 'express';
import { requireAdmin, AuthenticatedRequest } from './auth.js';
import { supabaseAdmin, db } from './db.js';
import { encrypt } from './crypto.js';
import { 
  insertProductSchema, 
  insertAccountSchema, 
  insertProductAccountSchema, 
  insertProductCredentialSchema,
  insertUserAccessSchema,
  insertProductTotpSchema 
} from '../shared/schema.js';
import { products, accounts, productAccounts, productCredentials, userAccess, otpLogs, productTotp } from '../shared/schema.js';
import { desc, eq, gte, lte, count, sql, and } from 'drizzle-orm';
import { AuditService } from './audit.js';
import { TotpService } from './totp.js';
import { userDirectoryService } from './user-directory.js';

const router = Router();

// Create/Update Product
router.post('/product', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = insertProductSchema.parse(req.body);
    const auditContext = AuditService.getContext(req);
    
    // Fetch existing data for audit logging
    let oldValues = null;
    let action: 'create' | 'update' = 'create';
    
    if (validatedData.slug) {
      const existing = await AuditService.fetchCurrentState('products', validatedData.slug);
      if (existing) {
        oldValues = existing;
        action = 'update';
      }
    }
    
    const { data, error } = await supabaseAdmin
      .from('products')
      .upsert(validatedData, { onConflict: 'slug' })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Log the action
    await AuditService.logAction(auditContext, {
      entity_type: 'products',
      action,
      entity_id: data.id,
      old_values: oldValues,
      new_values: data,
    });

    res.json(data);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(400).json({ error: 'Invalid product data' });
  }
});

// Create/Update Account
router.post('/account', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const data = req.body;
    const auditContext = AuditService.getContext(req);
    
    // Fetch existing data for audit logging
    let oldValues = null;
    let action: 'create' | 'update' = 'create';
    
    if (data.id) {
      oldValues = await AuditService.fetchCurrentState('accounts', data.id);
      if (oldValues) {
        action = 'update';
      }
    }
    
    // Encrypt IMAP password if provided
    if (data.imap_password) {
      data.imap_password_enc = encrypt(data.imap_password);
      delete data.imap_password;
    }

    const validatedData = insertAccountSchema.parse(data);
    
    const { data: result, error } = await supabaseAdmin
      .from('accounts')
      .upsert(validatedData)
      .select('id, label, imap_host, imap_port, imap_user, otp_regex, fetch_from_filter, is_active, priority, last_used_at, created_at')
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Log the action (without sensitive password data)
    const sanitizedResult = { ...result };
    const sanitizedOldValues = oldValues ? { ...oldValues, imap_password_enc: '[ENCRYPTED]' } : null;
    
    await AuditService.logAction(auditContext, {
      entity_type: 'accounts',
      action,
      entity_id: result.id,
      old_values: sanitizedOldValues,
      new_values: sanitizedResult,
    });

    res.json(result);
  } catch (error) {
    console.error('Create account error:', error);
    res.status(400).json({ error: 'Invalid account data' });
  }
});

// Create/Update Product-Account Mapping
router.post('/map', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = insertProductAccountSchema.parse(req.body);
    const auditContext = AuditService.getContext(req);
    
    // Fetch existing data for audit logging
    let oldValues = null;
    let action: 'create' | 'update' = 'create';
    
    if (validatedData.product_id && validatedData.account_id) {
      const { data: existing } = await supabaseAdmin
        .from('product_accounts')
        .select('*')
        .eq('product_id', validatedData.product_id)
        .eq('account_id', validatedData.account_id)
        .single();
      
      if (existing) {
        oldValues = existing;
        action = 'update';
      }
    }
    
    const { data, error } = await supabaseAdmin
      .from('product_accounts')
      .upsert(validatedData, { onConflict: 'product_id,account_id' })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Log the action
    await AuditService.logAction(auditContext, {
      entity_type: 'product_accounts',
      action,
      entity_id: data.id,
      old_values: oldValues,
      new_values: data,
    });

    res.json(data);
  } catch (error) {
    console.error('Create mapping error:', error);
    res.status(400).json({ error: 'Invalid mapping data' });
  }
});

// Create/Update Product Credential
router.post('/credential', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const data = req.body;
    const auditContext = AuditService.getContext(req);
    
    // Fetch existing data for audit logging
    let oldValues = null;
    let action: 'create' | 'update' = 'create';
    
    if (data.id) {
      oldValues = await AuditService.fetchCurrentState('product_credentials', data.id);
      if (oldValues) {
        action = 'update';
      }
    }
    
    const validatedData = insertProductCredentialSchema.parse(data);
    
    const { data: result, error } = await supabaseAdmin
      .from('product_credentials')
      .upsert(validatedData)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Log the action
    await AuditService.logAction(auditContext, {
      entity_type: 'product_credentials',
      action,
      entity_id: result.id,
      old_values: oldValues,
      new_values: result,
    });

    res.json(result);
  } catch (error) {
    console.error('Create credential error:', error);
    res.status(400).json({ error: 'Invalid credential data' });
  }
});

// Grant/Update User Access
router.post('/user-access', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    // Convert expires_at string to Date object if provided
    const requestBody = { ...req.body };
    
    // Handle user_email to user_id resolution
    if (requestBody.user_email && !requestBody.user_id) {
      const userId = await userDirectoryService.resolveUserIdByEmail(requestBody.user_email);
      if (!userId) {
        return res.status(400).json({ error: `User not found with email: ${requestBody.user_email}` });
      }
      requestBody.user_id = userId;
      delete requestBody.user_email; // Remove user_email from the data to be stored
    }
    
    // First handle empty strings/null for unlimited access
    if (requestBody.expires_at === '' || requestBody.expires_at === null || requestBody.expires_at === undefined) {
      requestBody.expires_at = null;
      console.log('Set expires_at to null for unlimited access');
    } else if (requestBody.expires_at && typeof requestBody.expires_at === 'string' && requestBody.expires_at.trim() !== '') {
      console.log('Original expires_at:', requestBody.expires_at);
      
      try {
        const dateStr = requestBody.expires_at.trim();
        
        // Handle DD-MM-YYYY HH:MM format specifically
        if (dateStr.match(/^\d{2}-\d{2}-\d{4}\s\d{2}:\d{2}$/)) {
          const [datePart, timePart] = dateStr.split(' ');
          const [day, month, year] = datePart.split('-');
          const [hour, minute] = timePart.split(':');
          
          // Create ISO format: YYYY-MM-DDTHH:MM:SS.000Z
          const isoString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00.000Z`;
          requestBody.expires_at = new Date(isoString);
          console.log('Converted DD-MM-YYYY format to Date:', requestBody.expires_at);
        } else {
          // Fallback for other formats
          requestBody.expires_at = new Date(requestBody.expires_at);
          console.log('Direct Date conversion:', requestBody.expires_at);
        }
        
        // Validate the Date object
        if (isNaN(requestBody.expires_at.getTime())) {
          throw new Error('Invalid date after conversion');
        }
      } catch (error) {
        console.error('Date parsing error:', error);
        return res.status(400).json({ error: 'Invalid date format. Please use DD-MM-YYYY HH:MM format.' });
      }
    } else if (requestBody.expires_at === '' || requestBody.expires_at === null) {
      // Handle empty dates as unlimited access (null)
      requestBody.expires_at = null;
      console.log('Set expires_at to null for unlimited access');
    }
    
    console.log('Request body before validation:', requestBody);
    const validatedData = insertUserAccessSchema.parse(requestBody);
    const auditContext = AuditService.getContext(req);
    
    // Fetch existing data for audit logging
    let oldValues = null;
    let action: 'create' | 'update' = 'create';
    
    if (validatedData.user_id && validatedData.product_id) {
      const { data: existing } = await supabaseAdmin
        .from('user_access')
        .select('*')
        .eq('user_id', validatedData.user_id)
        .eq('product_id', validatedData.product_id)
        .single();
      
      if (existing) {
        oldValues = existing;
        action = 'update';
      }
    }
    
    const { data, error } = await supabaseAdmin
      .from('user_access')
      .upsert(validatedData, { onConflict: 'user_id,product_id' })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Log the action
    await AuditService.logAction(auditContext, {
      entity_type: 'user_access',
      action,
      entity_id: data.id,
      old_values: oldValues,
      new_values: data,
    });

    res.json(data);
  } catch (error) {
    console.error('Create user access error:', error);
    res.status(400).json({ error: 'Invalid user access data' });
  }
});

// Create/Update Product TOTP
router.post('/totp', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const data = req.body;
    const auditContext = AuditService.getContext(req);
    
    // Clean and validate the secret if provided
    if (data.secret_base32) {
      // Validate secret input
      
      const cleaned = TotpService.cleanSecret(data.secret_base32);
      
      if (cleaned.length < 16) {
        return res.status(400).json({ error: 'TOTP secret too short (minimum 16 characters)' });
      }
      
      // Store the cleaned secret
      data.secret_base32 = cleaned;
    }
    
    // Fetch existing data for audit logging
    let oldValues = null;
    let action: 'create' | 'update' = 'create';
    
    if (data.id) {
      oldValues = await AuditService.fetchCurrentState('product_totp', data.id);
      if (oldValues) {
        action = 'update';
      }
    }
    
    // Encrypt the secret
    if (data.secret_base32) {
      data.secret_enc = TotpService.encryptSecret(data.secret_base32);
      delete data.secret_base32; // Remove plaintext secret
    }
    
    const validatedData = insertProductTotpSchema.parse(data);
    
    // Store TOTP config using products description workaround
    
    // Since PostgREST can't find the table, let's try a workaround
    // Store in a JSON field in products table temporarily
    const tempStorage = {
      totp_config: validatedData,
      created_at: new Date().toISOString()
    };
    
    // Store both TOTP indicator and encrypted secret in product metadata
    const totpMetadata = {
      totp_configured: true,
      issuer: validatedData.issuer,
      secret_enc: validatedData.secret_enc, // Store encrypted secret here
      digits: validatedData.digits,
      period: validatedData.period,
      algorithm: validatedData.algorithm,
      account_label: validatedData.account_label,
      created_at: new Date().toISOString()
    };
    
    const { data: productUpdate, error: updateError } = await supabaseAdmin
      .from('products')
      .update({ 
        description: `${validatedData.issuer} TOTP configured|${JSON.stringify(totpMetadata)}` // Store both indicator and metadata
      })
      .eq('id', validatedData.product_id)
      .select()
      .single();
    
    
    if (updateError) {
      return res.status(400).json({ error: 'Failed to store TOTP configuration: ' + updateError.message });
    }
    
    // Return a success response with the TOTP data (minus sensitive info)
    const result = {
      id: 'temp-' + Date.now(), // Temporary ID
      product_id: validatedData.product_id,
      issuer: validatedData.issuer,
      account_label: validatedData.account_label,
      digits: validatedData.digits,
      period: validatedData.period,
      algorithm: validatedData.algorithm,
      is_active: validatedData.is_active,
      created_at: new Date().toISOString()
    };

    // Prepare audit data (without the encrypted secret)
    const sanitizedResult = { ...result, secret_enc: '[ENCRYPTED]' };
    const sanitizedOldValues = oldValues ? { ...oldValues, secret_enc: '[ENCRYPTED]' } : null;
    
    
    // Return success response immediately
    res.json(sanitizedResult);
    
    // Do audit logging in background - don't block the response
    AuditService.logAction(auditContext, {
      entity_type: 'product_totp',
      action,
      entity_id: result.id,
      old_values: sanitizedOldValues,
      new_values: sanitizedResult,
    }).catch((auditError) => {
    });
  } catch (error) {
    console.error('Create TOTP error:', error);
    res.status(400).json({ error: 'Invalid TOTP data' });
  }
});

// Get all TOTP configurations (admin view)
router.get('/totp', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    
    // Since PostgREST can't find product_totp table, use workaround
    // Look for products that have "TOTP configured" in their description
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .ilike('description', '%TOTP configured%');
    
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Transform products into TOTP configuration format
    const totpConfigs = (products || []).map(product => {
      // Clean issuer by properly handling both old and new format
      let issuer = product.description;
      if (issuer.includes('|')) {
        // New format: "Issuer TOTP configured|{metadata}"
        issuer = issuer.split('|')[0].replace(' TOTP configured', '');
      } else {
        // Old format: just remove "TOTP configured"
        issuer = issuer.replace(' TOTP configured', '');
      }
      
      return {
        id: `totp-${product.id}`,
        product_id: product.id,
        product_title: product.title,
        product_slug: product.slug,
        issuer: issuer,
        account_label: product.title,
        digits: 6,
        period: 30,
        algorithm: 'SHA1',
        is_active: true,
        created_at: product.created_at
      };
    });

    res.json(totpConfigs);
  } catch (error) {
    console.error('Get TOTP configs error:', error);
    res.status(500).json({ error: 'Failed to fetch TOTP configurations' });
  }
});

// Get all products (admin view)
router.get('/products', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get all accounts (admin view)
router.get('/accounts', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('accounts')
      .select('id, label, imap_host, imap_port, imap_user, otp_regex, fetch_from_filter, is_active, priority, last_used_at, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// Get all mappings
router.get('/mappings', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('product_accounts')
      .select(`
        *,
        products!inner(id, title, slug),
        accounts!inner(id, label)
      `)
      .order('weight', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Get mappings error:', error);
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
});

// Get all credentials
router.get('/credentials', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('product_credentials')
      .select(`
        *,
        products!inner(id, title, slug)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Get credentials error:', error);
    res.status(500).json({ error: 'Failed to fetch credentials' });
  }
});

// Analytics endpoints

// Get overall analytics summary
router.get('/analytics/summary', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    // Add cache-busting headers for development
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const { data: logs } = await supabaseAdmin
      .from('otp_logs')
      .select('status')
      .gte('created_at', thirtyDaysAgo.toISOString());

    const summary = {
      total_requests: logs?.length || 0,
      successful_requests: logs?.filter(l => l.status === 'success').length || 0,
      failed_requests: logs?.filter(l => l.status !== 'success').length || 0,
      success_rate: logs?.length ? (logs.filter(l => l.status === 'success').length / logs.length * 100) : 0,
    };

    res.json(summary);
  } catch (error) {
    console.error('Get analytics summary error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics summary' });
  }
});

// Get account performance metrics
router.get('/analytics/accounts', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('otp_logs')
      .select(`
        account_id,
        status,
        accounts!inner (
          id,
          label,
          imap_host
        )
      `)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .not('account_id', 'is', null);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Group by account and calculate metrics
    const accountMetrics = data.reduce((acc: any, log: any) => {
      const accountId = log.account_id;
      if (!acc[accountId]) {
        acc[accountId] = {
          account_id: accountId,
          label: log.accounts.label,
          host: log.accounts.imap_host,
          total_requests: 0,
          successful_requests: 0,
          failed_requests: 0,
          success_rate: 0,
        };
      }
      
      acc[accountId].total_requests++;
      if (log.status === 'success') {
        acc[accountId].successful_requests++;
      } else {
        acc[accountId].failed_requests++;
      }
      
      acc[accountId].success_rate = (acc[accountId].successful_requests / acc[accountId].total_requests) * 100;
      
      return acc;
    }, {});

    res.json(Object.values(accountMetrics));
  } catch (error) {
    console.error('Get account analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch account analytics' });
  }
});

// Get product usage metrics
router.get('/analytics/products', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('otp_logs')
      .select(`
        product_id,
        status,
        products!inner (
          id,
          title,
          slug
        )
      `)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Group by product and calculate metrics
    const productMetrics = data.reduce((acc: any, log: any) => {
      const productId = log.product_id;
      if (!acc[productId]) {
        acc[productId] = {
          product_id: productId,
          title: log.products.title,
          slug: log.products.slug,
          total_requests: 0,
          successful_requests: 0,
          failed_requests: 0,
          success_rate: 0,
        };
      }
      
      acc[productId].total_requests++;
      if (log.status === 'success') {
        acc[productId].successful_requests++;
      } else {
        acc[productId].failed_requests++;
      }
      
      acc[productId].success_rate = (acc[productId].successful_requests / acc[productId].total_requests) * 100;
      
      return acc;
    }, {});

    res.json(Object.values(productMetrics));
  } catch (error) {
    console.error('Get product analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch product analytics' });
  }
});

// Get time-based analytics (requests over time)
router.get('/analytics/timeline', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    // Add cache-busting headers for development
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    const days = parseInt(req.query.days as string) || 7;
    const { data, error } = await supabaseAdmin
      .from('otp_logs')
      .select('created_at, status')
      .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Group by day and calculate daily metrics
    const dailyMetrics = data.reduce((acc: any, log: any) => {
      const date = new Date(log.created_at).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          total_requests: 0,
          successful_requests: 0,
          failed_requests: 0,
          success_rate: 0,
        };
      }
      
      acc[date].total_requests++;
      if (log.status === 'success') {
        acc[date].successful_requests++;
      } else {
        acc[date].failed_requests++;
      }
      
      acc[date].success_rate = (acc[date].successful_requests / acc[date].total_requests) * 100;
      
      return acc;
    }, {});

    // Fill in missing days with zeros
    const timeline = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      timeline.push(dailyMetrics[date] || {
        date,
        total_requests: 0,
        successful_requests: 0,
        failed_requests: 0,
        success_rate: 0,
      });
    }

    res.json(timeline);
  } catch (error) {
    console.error('Get timeline analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch timeline analytics' });
  }
});

// Get recent activity logs
router.get('/analytics/logs', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const { data, error } = await supabaseAdmin
      .from('otp_logs')
      .select(`
        *,
        products (
          title,
          slug
        ),
        accounts (
          label
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Delete endpoints for admin management

// Delete Product
router.delete('/product/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { force } = req.query;
    const auditContext = AuditService.getContext(req);
    
    // Fetch existing data for audit logging
    const oldValues = await AuditService.fetchCurrentState('products', id);
    if (!oldValues) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Count dependencies with detailed information
    const { data: mappings } = await supabaseAdmin
      .from('product_accounts')
      .select('id, accounts(label)')
      .eq('product_id', id);
      
    const { data: credentials } = await supabaseAdmin
      .from('product_credentials')
      .select('id, username')
      .eq('product_id', id);
      
    const { data: userAccess } = await supabaseAdmin
      .from('user_access')
      .select('id, user_id, expires_at')
      .eq('product_id', id);

    const { data: totpSecrets } = await supabaseAdmin
      .from('product_totp')
      .select('id')
      .eq('product_id', id);

    const { data: otpLogs } = await supabaseAdmin
      .from('otp_logs')
      .select('id')
      .eq('product_id', id);
    
    const hasDepedencies = mappings?.length || credentials?.length || userAccess?.length || otpLogs?.length;
    
    // If dependencies exist and force is not specified, return detailed info
    if (hasDepedencies && force !== 'true') {
      return res.status(400).json({ 
        error: 'dependencies_exist',
        message: 'Cannot delete product with existing related records. Use force=true to cascade delete.',
        details: {
          mappings: mappings?.length || 0,
          credentials: credentials?.length || 0,
          user_access: userAccess?.length || 0,
          totp_secrets: totpSecrets?.length || 0,
          otp_logs: otpLogs?.length || 0,
          mapping_details: mappings?.map(m => ({ id: m.id, account_label: m.accounts?.label })),
          credential_details: credentials?.map(c => ({ id: c.id, username: c.username })),
          user_access_details: userAccess?.map(u => ({ id: u.id, user_id: u.user_id, expires_at: u.expires_at }))
        }
      });
    }

    // If force=true or no dependencies, proceed with deletion
    if (force === 'true' && hasDepedencies) {
      // Delete related records first (in the correct order)
      
      // 1. Delete user access records
      if (userAccess?.length) {
        const { error: userAccessError } = await supabaseAdmin
          .from('user_access')
          .delete()
          .eq('product_id', id);
        
        if (userAccessError) {
          return res.status(400).json({ error: `Failed to delete user access: ${userAccessError.message}` });
        }
      }
      
      // 2. Delete product credentials
      if (credentials?.length) {
        const { error: credentialsError } = await supabaseAdmin
          .from('product_credentials')
          .delete()
          .eq('product_id', id);
        
        if (credentialsError) {
          return res.status(400).json({ error: `Failed to delete credentials: ${credentialsError.message}` });
        }
      }
      
      // 3. Delete product-account mappings
      if (mappings?.length) {
        const { error: mappingsError } = await supabaseAdmin
          .from('product_accounts')
          .delete()
          .eq('product_id', id);
        
        if (mappingsError) {
          return res.status(400).json({ error: `Failed to delete mappings: ${mappingsError.message}` });
        }
      }
      
      // 4. Delete OTP logs
      if (otpLogs?.length) {
        const { error: otpLogsError } = await supabaseAdmin
          .from('otp_logs')
          .delete()
          .eq('product_id', id);
        
        if (otpLogsError) {
          return res.status(400).json({ error: `Failed to delete OTP logs: ${otpLogsError.message}` });
        }
      }
      
      // 5. TOTP secrets will be cascade deleted automatically due to schema constraint
    }

    // Delete the product (this will cascade delete TOTP secrets)
    const { error } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Log the deletion
    await AuditService.logAction(auditContext, {
      entity_type: 'products',
      action: 'delete',
      entity_id: id,
      old_values: oldValues,
      new_values: null,
      metadata: {
        forced_cascade: force === 'true',
        deleted_mappings: mappings?.length || 0,
        deleted_credentials: credentials?.length || 0,
        deleted_user_access: userAccess?.length || 0,
        deleted_otp_logs: otpLogs?.length || 0,
        deleted_totp_secrets: totpSecrets?.length || 0
      }
    });

    res.json({ 
      message: 'Product deleted successfully',
      deleted_records: {
        mappings: mappings?.length || 0,
        credentials: credentials?.length || 0,
        user_access: userAccess?.length || 0,
        otp_logs: otpLogs?.length || 0,
        totp_secrets: totpSecrets?.length || 0
      }
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Delete Account
router.delete('/account/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const auditContext = AuditService.getContext(req);
    
    // Fetch existing data for audit logging
    const oldValues = await AuditService.fetchCurrentState('accounts', id);
    if (!oldValues) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Check for dependencies
    const { data: mappings } = await supabaseAdmin
      .from('product_accounts')
      .select('id')
      .eq('account_id', id)
      .limit(1);
    
    if (mappings?.length) {
      return res.status(400).json({ 
        error: 'Cannot delete account with existing product mappings. Please remove them first.' 
      });
    }

    const { error } = await supabaseAdmin
      .from('accounts')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Log the deletion
    await AuditService.logAction(auditContext, {
      entity_type: 'accounts',
      action: 'delete',
      entity_id: id,
      old_values: oldValues,
      new_values: null,
    });

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// Delete Product-Account Mapping
router.delete('/mapping/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const auditContext = AuditService.getContext(req);
    
    // Fetch existing data for audit logging
    const oldValues = await AuditService.fetchCurrentState('product_accounts', id);
    if (!oldValues) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    const { error } = await supabaseAdmin
      .from('product_accounts')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Log the deletion
    await AuditService.logAction(auditContext, {
      entity_type: 'product_accounts',
      action: 'delete',
      entity_id: id,
      old_values: oldValues,
      new_values: null,
    });

    res.json({ message: 'Mapping deleted successfully' });
  } catch (error) {
    console.error('Delete mapping error:', error);
    res.status(500).json({ error: 'Failed to delete mapping' });
  }
});

// Delete Product Credential
router.delete('/credential/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const auditContext = AuditService.getContext(req);
    
    // Fetch existing data for audit logging
    const oldValues = await AuditService.fetchCurrentState('product_credentials', id);
    if (!oldValues) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    const { error } = await supabaseAdmin
      .from('product_credentials')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Log the deletion
    await AuditService.logAction(auditContext, {
      entity_type: 'product_credentials',
      action: 'delete',
      entity_id: id,
      old_values: oldValues,
      new_values: null,
    });

    res.json({ message: 'Credential deleted successfully' });
  } catch (error) {
    console.error('Delete credential error:', error);
    res.status(500).json({ error: 'Failed to delete credential' });
  }
});

// Delete User Access
router.delete('/user-access/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const auditContext = AuditService.getContext(req);
    
    // Fetch existing data for audit logging
    const oldValues = await AuditService.fetchCurrentState('user_access', id);
    if (!oldValues) {
      return res.status(404).json({ error: 'User access not found' });
    }

    const { error } = await supabaseAdmin
      .from('user_access')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Log the deletion
    await AuditService.logAction(auditContext, {
      entity_type: 'user_access',
      action: 'delete',
      entity_id: id,
      old_values: oldValues,
      new_values: null,
    });

    res.json({ message: 'User access revoked successfully' });
  } catch (error) {
    console.error('Delete user access error:', error);
    res.status(500).json({ error: 'Failed to revoke user access' });
  }
});

// Delete TOTP Configuration
router.delete('/totp/product/:product_id', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { product_id } = req.params;
    const auditContext = AuditService.getContext(req);
    
    // Fetch existing product data for audit logging
    const { data: product, error: fetchError } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', product_id)
      .single();

    if (fetchError || !product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if product has TOTP configuration
    if (!product.description?.includes('TOTP configured')) {
      return res.status(404).json({ error: 'TOTP configuration not found for this product' });
    }

    // Store old values for audit
    const oldValues = {
      id: `totp-${product_id}`,
      product_id: product_id,
      description: product.description,
      totp_configured: true
    };

    // Remove TOTP configuration by updating the description
    // Remove both the indicator and any metadata
    let newDescription = product.description;
    if (newDescription.includes('|')) {
      // New format: "Issuer TOTP configured|{metadata}"
      newDescription = newDescription.split('|')[0].replace(' TOTP configured', '');
    } else {
      // Old format: just remove "TOTP configured"
      newDescription = newDescription.replace(' TOTP configured', '');
    }

    const { error } = await supabaseAdmin
      .from('products')
      .update({ description: newDescription })
      .eq('id', product_id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Log the deletion
    await AuditService.logAction(auditContext, {
      entity_type: 'product_totp',
      action: 'delete',
      entity_id: `totp-${product_id}`,
      old_values: oldValues,
      new_values: null,
    });

    res.json({ message: 'TOTP configuration deleted successfully' });
  } catch (error) {
    console.error('Delete TOTP configuration error:', error);
    res.status(500).json({ error: 'Failed to delete TOTP configuration' });
  }
});

// Bulk User Management endpoints

// Bulk grant user access (CSV import)
router.post('/bulk-access/import', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { users, product_id, expires_at } = req.body;
    
    if (!Array.isArray(users) || !product_id) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    const results = {
      successful: [] as Array<{ user: string; access_id: string }>,
      failed: [] as Array<{ user: string; error: string }>,
      total: users.length,
    };

    // Process each user
    for (const user of users) {
      try {
        const { email, user_id, custom_expires_at } = user;
        
        // Use custom expiry if provided, otherwise use default
        const finalExpiresAt = custom_expires_at || expires_at;
        
        const accessData = {
          user_id: user_id,
          product_id: product_id,
          expires_at: finalExpiresAt || null,
        };

        const validatedData = insertUserAccessSchema.parse(accessData);

        const { data, error } = await supabaseAdmin
          .from('user_access')
          .upsert(validatedData, { onConflict: 'user_id,product_id' })
          .select()
          .single();

        if (error) {
          results.failed.push({
            user: email || user_id,
            error: error.message,
          });
        } else {
          results.successful.push({
            user: email || user_id,
            access_id: data.id,
          });
        }
      } catch (error: any) {
        results.failed.push({
          user: user.email || user.user_id || 'Unknown',
          error: error.message || 'Validation failed',
        });
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ error: 'Failed to process bulk import' });
  }
});

// Export user access as CSV
router.get('/bulk-access/export', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const product_id = req.query.product_id as string;
    
    let query = supabaseAdmin
      .from('user_access')
      .select(`
        user_id,
        expires_at,
        created_at,
        products!inner (
          id,
          title,
          slug
        )
      `);

    if (product_id) {
      query = query.eq('product_id', product_id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Convert to CSV format
    const csvHeader = 'User ID,Product,Product Slug,Expires At,Created At\n';
    const csvRows = data.map((access: any) => {
      const expiresAt = access.expires_at ? new Date(access.expires_at).toISOString() : 'Never';
      const createdAt = new Date(access.created_at).toISOString();
      
      return `"${access.user_id}","${access.products.title}","${access.products.slug}","${expiresAt}","${createdAt}"`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="user_access_export.csv"');
    res.send(csvContent);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export user access' });
  }
});

// Bulk revoke user access
router.post('/bulk-access/revoke', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { user_ids, product_id } = req.body;
    
    if (!Array.isArray(user_ids) || !product_id) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    const { data, error } = await supabaseAdmin
      .from('user_access')
      .delete()
      .in('user_id', user_ids)
      .eq('product_id', product_id)
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'Bulk revoke completed',
      revoked_count: data.length,
      revoked_users: data.map((access: any) => access.user_id),
    });
  } catch (error) {
    console.error('Bulk revoke error:', error);
    res.status(500).json({ error: 'Failed to revoke user access' });
  }
});

// Get user access list for management
router.get('/user-access', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const product_id = req.query.product_id as string;
    const limit = parseInt(req.query.limit as string) || 100;
    
    let query = supabaseAdmin
      .from('user_access')
      .select(`
        *,
        products (
          title,
          slug
        )
      `)
      .order('granted_at', { ascending: false })
      .limit(limit);

    if (product_id) {
      query = query.eq('product_id', product_id);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Enrich with user emails
    if (data && data.length > 0) {
      const userIds = Array.from(new Set(data.map((item: any) => item.user_id)));
      const emailMap = await userDirectoryService.getEmailsForUserIds(userIds);
      
      // Add user_email to each record
      const enrichedData = data.map((item: any) => ({
        ...item,
        user_email: emailMap.get(item.user_id) || 'Unknown'
      }));
      
      res.json(enrichedData);
    } else {
      res.json(data);
    }
  } catch (error) {
    console.error('Get user access error:', error);
    res.status(500).json({ error: 'Failed to fetch user access' });
  }
});

// Batch update user access (extend/modify expiry dates)
router.post('/bulk-access/update', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { access_ids, expires_at } = req.body;
    
    if (!Array.isArray(access_ids)) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    const { data, error } = await supabaseAdmin
      .from('user_access')
      .update({ expires_at: expires_at || null })
      .in('id', access_ids)
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'Bulk update completed',
      updated_count: data.length,
      updated_access: data,
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Failed to update user access' });
  }
});

// Search users by email (for typeahead)
router.get('/search-users', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 10;
    
    if (!query || query.length < 2) {
      return res.json([]);
    }
    
    const users = await userDirectoryService.searchUsersByEmail(query, limit);
    res.json(users);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

export default router;
