import { Router } from 'express';
import { requireAdmin, AuthenticatedRequest } from './auth.js';
import { supabaseAdmin } from './db.js';
import { 
  sendAccessExpiringNotification, 
  sendAccessExpiredNotification, 
  sendAdminAlert,
  testEmailConfig 
} from './email.js';

const router = Router();

// Notification settings interface
interface NotificationSettings {
  access_expiry_warning_days: number;
  admin_alerts_enabled: boolean;
  admin_email: string;
  daily_notifications_enabled: boolean;
  notification_time: string; // HH:MM format
}

// Default notification settings
const defaultSettings: NotificationSettings = {
  access_expiry_warning_days: 7,
  admin_alerts_enabled: true,
  admin_email: '',
  daily_notifications_enabled: true,
  notification_time: '09:00',
};

// In-memory storage for notification settings (should be moved to database in production)
let notificationSettings: NotificationSettings = { ...defaultSettings };

// Track last notification check
let lastNotificationCheck = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

// Send access expiry notifications
export const checkAndSendExpiryNotifications = async (): Promise<{
  processed: number;
  successful: number;
  failed: number;
  details: Array<{ user_id: string; status: string; error?: string }>;
}> => {
  const results = {
    processed: 0,
    successful: 0,
    failed: 0,
    details: [] as Array<{ user_id: string; status: string; error?: string }>,
  };

  try {
    // Calculate warning date
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + notificationSettings.access_expiry_warning_days);

    // Find users with access expiring soon (not already expired)
    const { data: expiringAccess, error } = await supabaseAdmin
      .from('user_access')
      .select(`
        user_id,
        expires_at,
        products!inner (
          title,
          slug
        )
      `)
      .lte('expires_at', warningDate.toISOString())
      .gt('expires_at', new Date().toISOString()) // Not expired yet
      .not('expires_at', 'is', null);

    if (error) {
      throw error;
    }

    if (!expiringAccess || expiringAccess.length === 0) {
      return results;
    }

    // Process each expiring access
    for (const access of expiringAccess) {
      results.processed++;
      
      try {
        // For simplicity, use user_id as email (in production, you'd look up actual email)
        // This assumes user_id is an email address or you have a user lookup system
        const userEmail = access.user_id.includes('@') ? access.user_id : `${access.user_id}@example.com`;
        const userName = access.user_id;
        const productName = access.products?.title || 'Unknown Product';
        const expiresAt = access.expires_at;

        const success = await sendAccessExpiringNotification(
          userEmail,
          userName,
          productName,
          expiresAt
        );

        if (success) {
          results.successful++;
          results.details.push({
            user_id: access.user_id,
            status: 'sent',
          });
        } else {
          results.failed++;
          results.details.push({
            user_id: access.user_id,
            status: 'failed',
            error: 'Email sending failed',
          });
        }
      } catch (error: any) {
        results.failed++;
        results.details.push({
          user_id: access.user_id,
          status: 'error',
          error: error.message,
        });
      }
    }

    // Log notification batch
    console.log('Expiry notifications processed:', results);

    // Send admin summary if enabled
    if (notificationSettings.admin_alerts_enabled && notificationSettings.admin_email && results.processed > 0) {
      const summary = `
Expiry Notification Summary:
- Processed: ${results.processed}
- Successful: ${results.successful}
- Failed: ${results.failed}

Details:
${results.details.map(d => `- ${d.user_id}: ${d.status}${d.error ? ` (${d.error})` : ''}`).join('\n')}
      `;

      await sendAdminAlert(
        notificationSettings.admin_email,
        'Expiry Notifications Processed',
        `Processed ${results.processed} expiry notifications`,
        summary
      );
    }

    return results;
  } catch (error: any) {
    console.error('Failed to process expiry notifications:', error);
    
    // Send admin alert about the failure
    if (notificationSettings.admin_alerts_enabled && notificationSettings.admin_email) {
      await sendAdminAlert(
        notificationSettings.admin_email,
        'Notification System Error',
        'Failed to process expiry notifications',
        error.message
      );
    }

    throw error;
  }
};

// Check for expired access and send notifications
export const checkAndSendExpiredNotifications = async (): Promise<{
  processed: number;
  successful: number;
  failed: number;
}> => {
  const results = {
    processed: 0,
    successful: 0,
    failed: 0,
  };

  try {
    // Find recently expired access (expired in the last day)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { data: expiredAccess, error } = await supabaseAdmin
      .from('user_access')
      .select(`
        user_id,
        expires_at,
        products!inner (
          title,
          slug
        )
      `)
      .lt('expires_at', new Date().toISOString())
      .gte('expires_at', yesterday.toISOString());

    if (error) {
      throw error;
    }

    if (!expiredAccess || expiredAccess.length === 0) {
      return results;
    }

    // Process each expired access
    for (const access of expiredAccess) {
      results.processed++;
      
      try {
        const userEmail = access.user_id.includes('@') ? access.user_id : `${access.user_id}@example.com`;
        const userName = access.user_id;
        const productName = access.products?.title || 'Unknown Product';

        const success = await sendAccessExpiredNotification(
          userEmail,
          userName,
          productName
        );

        if (success) {
          results.successful++;
        } else {
          results.failed++;
        }
      } catch (error) {
        results.failed++;
      }
    }

    return results;
  } catch (error) {
    console.error('Failed to process expired notifications:', error);
    throw error;
  }
};

// Run daily notification check
export const runDailyNotificationCheck = async () => {
  if (!notificationSettings.daily_notifications_enabled) {
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  
  // Only run once per day
  if (lastNotificationCheck === today) {
    return;
  }

  try {
    console.log('Running daily notification check...');
    
    const expiryResults = await checkAndSendExpiryNotifications();
    const expiredResults = await checkAndSendExpiredNotifications();
    
    lastNotificationCheck = today;
    
    console.log('Daily notification check completed:', {
      expiry: expiryResults,
      expired: expiredResults,
    });
  } catch (error) {
    console.error('Daily notification check failed:', error);
  }
};

// API Routes

// Get notification settings
router.get('/settings', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    res.json(notificationSettings);
  } catch (error) {
    console.error('Get notification settings error:', error);
    res.status(500).json({ error: 'Failed to fetch notification settings' });
  }
});

// Update notification settings
router.post('/settings', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const updates = req.body;
    
    // Validate settings
    if (typeof updates.access_expiry_warning_days === 'number' && updates.access_expiry_warning_days > 0) {
      notificationSettings.access_expiry_warning_days = updates.access_expiry_warning_days;
    }
    
    if (typeof updates.admin_alerts_enabled === 'boolean') {
      notificationSettings.admin_alerts_enabled = updates.admin_alerts_enabled;
    }
    
    if (typeof updates.admin_email === 'string') {
      notificationSettings.admin_email = updates.admin_email.trim();
    }
    
    if (typeof updates.daily_notifications_enabled === 'boolean') {
      notificationSettings.daily_notifications_enabled = updates.daily_notifications_enabled;
    }
    
    if (typeof updates.notification_time === 'string' && /^\d{2}:\d{2}$/.test(updates.notification_time)) {
      notificationSettings.notification_time = updates.notification_time;
    }

    res.json({
      message: 'Notification settings updated',
      settings: notificationSettings,
    });
  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({ error: 'Failed to update notification settings' });
  }
});

// Test email configuration
router.post('/test-email', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email address required' });
    }

    const configTest = await testEmailConfig();
    
    if (!configTest.success) {
      return res.status(400).json({ 
        error: 'Email configuration invalid', 
        details: configTest.error 
      });
    }

    // Send test notification
    await sendAdminAlert(
      email,
      'Email Configuration Test',
      'This is a test email to verify your email configuration is working correctly.',
      `Sent at: ${new Date().toISOString()}`
    );

    res.json({
      message: 'Test email sent successfully',
      email: email,
    });
  } catch (error: any) {
    console.error('Test email error:', error);
    res.status(500).json({ 
      error: 'Failed to send test email',
      details: error.message,
    });
  }
});

// Manually trigger expiry notifications
router.post('/trigger-expiry-check', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const results = await checkAndSendExpiryNotifications();
    
    res.json({
      message: 'Expiry notification check completed',
      results: results,
    });
  } catch (error: any) {
    console.error('Manual expiry check error:', error);
    res.status(500).json({ 
      error: 'Failed to process expiry notifications',
      details: error.message,
    });
  }
});

// Get notification history/logs (basic implementation)
router.get('/history', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    // In a production system, this would query a notifications log table
    // For now, return a simple response
    res.json({
      message: 'Notification history not yet implemented',
      last_check: lastNotificationCheck,
      settings: notificationSettings,
    });
  } catch (error) {
    console.error('Get notification history error:', error);
    res.status(500).json({ error: 'Failed to fetch notification history' });
  }
});

// Simple background task runner (in production, use a proper job queue)
let backgroundTaskInterval: NodeJS.Timeout | null = null;

export const startNotificationScheduler = () => {
  if (backgroundTaskInterval) {
    clearInterval(backgroundTaskInterval);
  }

  // Check every hour
  backgroundTaskInterval = setInterval(async () => {
    try {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      // Run daily check at the configured time
      if (currentTime === notificationSettings.notification_time) {
        await runDailyNotificationCheck();
      }
    } catch (error) {
      console.error('Background notification task error:', error);
    }
  }, 60 * 60 * 1000); // Every hour

  console.log('Notification scheduler started');
};

export const stopNotificationScheduler = () => {
  if (backgroundTaskInterval) {
    clearInterval(backgroundTaskInterval);
    backgroundTaskInterval = null;
    console.log('Notification scheduler stopped');
  }
};

export default router;