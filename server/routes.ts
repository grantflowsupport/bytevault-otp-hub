import type { Express } from "express";
import { createServer, type Server } from "http";
import cors from 'cors';
import { requireUser, AuthenticatedRequest } from './auth.js';
import { supabaseAdmin } from './db.js';
import otpRoutes from './otp-email.js';
import adminRoutes from './admin.js';
import notificationRoutes, { startNotificationScheduler } from './notifications.js';
import auditRoutes from './audit.js';

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
      console.log('My-products request for user ID:', userId);

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
          )
        `)
        .eq('user_id', userId)
        .eq('products.is_active', true)
        .or('expires_at.is.null,expires_at.gt.now()');

      console.log('User access query result:', { data, error, dataLength: data?.length });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      // Fetch credentials for all user's products
      const productIds = data.map((item: any) => item.products.id);
      let credentials: any[] = [];
      let totpConfigs: any[] = [];
      
      if (productIds.length > 0) {
        // Fetch credentials
        const { data: credData } = await supabaseAdmin
          .from('product_credentials')
          .select('*')
          .in('product_id', productIds)
          .eq('is_active', true);
        credentials = credData || [];

        // Fetch TOTP configurations
        const { data: totpData } = await supabaseAdmin
          .from('product_totp')
          .select('product_id')
          .in('product_id', productIds)
          .eq('is_active', true);
        totpConfigs = totpData || [];
      }

      // Transform the data to a more usable format
      const products = data.map((item: any) => ({
        ...item.products,
        expires_at: item.expires_at,
        credentials: credentials.filter(cred => cred.product_id === item.products.id),
        has_totp: totpConfigs.some(totp => totp.product_id === item.products.id),
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

  // Mount notification routes
  app.use('/api/notifications', notificationRoutes);

  // Mount audit routes
  app.use('/api/audit', auditRoutes);

  // Start notification scheduler
  startNotificationScheduler();

  const httpServer = createServer(app);
  return httpServer;
}
