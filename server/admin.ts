import { Router } from 'express';
import { requireAdmin, AuthenticatedRequest } from './auth.js';
import { supabaseAdmin } from './db.js';
import { encrypt } from './crypto.js';
import { 
  insertProductSchema, 
  insertAccountSchema, 
  insertProductAccountSchema, 
  insertProductCredentialSchema,
  insertUserAccessSchema 
} from '../shared/schema.js';

const router = Router();

// Create/Update Product
router.post('/product', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = insertProductSchema.parse(req.body);
    
    const { data, error } = await supabaseAdmin
      .from('products')
      .upsert(validatedData, { onConflict: 'slug' })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

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
    
    const { data, error } = await supabaseAdmin
      .from('product_accounts')
      .upsert(validatedData, { onConflict: 'product_id,account_id' })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Create mapping error:', error);
    res.status(400).json({ error: 'Invalid mapping data' });
  }
});

// Create/Update Product Credential
router.post('/credential', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = insertProductCredentialSchema.parse(req.body);
    
    const { data, error } = await supabaseAdmin
      .from('product_credentials')
      .upsert(validatedData)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Create credential error:', error);
    res.status(400).json({ error: 'Invalid credential data' });
  }
});

// Grant/Update User Access
router.post('/user-access', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = insertUserAccessSchema.parse(req.body);
    
    const { data, error } = await supabaseAdmin
      .from('user_access')
      .upsert(validatedData, { onConflict: 'user_id,product_id' })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Create user access error:', error);
    res.status(400).json({ error: 'Invalid user access data' });
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

export default router;
