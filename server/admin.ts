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

export default router;
