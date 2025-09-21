import type { Express } from "express";
import { createServer, type Server } from "http";
import cors from 'cors';
import { requireUser, AuthenticatedRequest } from './auth.js';
import { supabaseAdmin } from './db.js';
import otpRoutes from './otp.js';
import adminRoutes from './admin.js';

export async function registerRoutes(app: Express): Promise<Server> {
  // Enable CORS
  app.use(cors({
    origin: true,
    credentials: true,
  }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ ok: true });
  });

  // Get user's products with credentials and access info
  app.get('/api/my-products', requireUser, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;

      const { data, error } = await supabaseAdmin
        .from('user_access')
        .select(`
          expires_at,
          products!inner (
            id,
            slug,
            title,
            description,
            is_active
          ),
          product_credentials!product_credentials_product_id_fkey (
            id,
            label,
            login_email,
            login_username,
            login_password,
            notes,
            is_active
          )
        `)
        .eq('user_id', userId)
        .eq('products.is_active', true)
        .or('expires_at.is.null,expires_at.gt.now()');

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      // Transform the data to a more usable format
      const products = data.map(item => ({
        ...item.products,
        expires_at: item.expires_at,
        credentials: item.product_credentials?.filter(cred => cred.is_active) || [],
      }));

      res.json(products);
    } catch (error) {
      console.error('Get my products error:', error);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });

  // Mount OTP routes
  app.use('/api', otpRoutes);

  // Mount admin routes
  app.use('/api/admin', adminRoutes);

  const httpServer = createServer(app);
  return httpServer;
}
