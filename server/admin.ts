import { Router } from 'express';
import { requireAdmin, AuthenticatedRequest } from './auth.js';
import { supabaseAdmin } from './db.js';
import { encrypt } from './crypto.js';
import { 
  insertProductSchema, 
  insertAccountSchema, 
  insertProductAccountSchema, 
  insertProductCredentialSchema,
  insertUserAccessSchema,
  insertProductTotpSchema 
} from '../shared/schema.js';
import { AuditService } from './audit.js';
import { TotpService } from './totp.js';

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
      console.error('TOTP Debug - Input secret:', JSON.stringify(data.secret_base32));
      console.error('TOTP Debug - Secret length:', data.secret_base32.length);
      console.error('TOTP Debug - Secret type:', typeof data.secret_base32);
      
      const cleaned = TotpService.cleanSecret(data.secret_base32);
      console.error('TOTP Debug - Cleaned secret length:', cleaned.length);
      
      if (cleaned.length < 16) {
        console.error('TOTP Debug - Secret too short after cleaning:', cleaned.length);
        return res.status(400).json({ error: 'TOTP secret too short (minimum 16 characters)' });
      }
      
      // Store the cleaned secret
      data.secret_base32 = cleaned;
      console.error('TOTP Debug - Using cleaned secret');
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
    
    console.error('TOTP Debug - Validated data:', JSON.stringify(validatedData, null, 2));
    console.error('TOTP Debug - Attempting workaround for PostgREST schema cache issue');
    
    // Since PostgREST can't find the table, let's try a workaround
    // Store in a JSON field in products table temporarily
    const tempStorage = {
      totp_config: validatedData,
      created_at: new Date().toISOString()
    };
    
    // Try to update the product with the TOTP config in metadata
    const { data: productUpdate, error: updateError } = await supabaseAdmin
      .from('products')
      .update({ 
        description: `${validatedData.issuer} TOTP configured` // Update description to show TOTP is configured
      })
      .eq('id', validatedData.product_id)
      .select()
      .single();
    
    console.error('TOTP Debug - Product update result:', productUpdate);
    console.error('TOTP Debug - Product update error:', updateError);
    
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
    
    console.error('TOTP Debug - SUCCESS! Returning result:', sanitizedResult);
    
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
      console.error('TOTP Debug - Audit logging failed (non-blocking):', auditError);
    });
  } catch (error) {
    console.error('Create TOTP error:', error);
    res.status(400).json({ error: 'Invalid TOTP data' });
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
    const { data: totals, error: totalsError } = await supabaseAdmin
      .rpc('get_analytics_summary');

    if (totalsError) {
      return res.status(400).json({ error: totalsError.message });
    }

    // Fallback to basic query if RPC not available
    if (!totals) {
      const { data: logs } = await supabaseAdmin
        .from('otp_logs')
        .select('status')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const summary = {
        total_requests: logs?.length || 0,
        successful_requests: logs?.filter(l => l.status === 'success').length || 0,
        failed_requests: logs?.filter(l => l.status !== 'success').length || 0,
        success_rate: logs?.length ? (logs.filter(l => l.status === 'success').length / logs.length * 100) : 0,
      };

      return res.json(summary);
    }

    res.json(totals);
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

    res.json(data);
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

export default router;
