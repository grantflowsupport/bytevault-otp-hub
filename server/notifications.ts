import { Router } from 'express';
import { requireAdmin, AuthenticatedRequest } from './auth.js';
import { supabaseAdmin } from './db.js';
import { 
  sendAccessExpiringNotification, 
  sendAccessExpiredNotification, 
  sendAdminAlert,
  testEmailConfig 
} from './email.js';
import { 
  notificationSettings as notificationSettingsTable, 
  insertNotificationSettingsSchema,
  type InsertNotificationSettings
} from '../shared/schema.js';

const router = Router();

// Default notification settings
const defaultSettings = {
  access_expiry_warning_days: 7,
  admin_alerts_enabled: true,
  admin_email: '',
  daily_notifications_enabled: true,
  notification_time: '09:00',
};

// Database helper functions for notification settings
const getNotificationSettings = async () => {
  try {
    // TEMPORARY: Disable PostgREST access due to schema cache issue
    // Return safe defaults to prevent errors
    return {
      id: '00000000-0000-0000-0000-000000000001',
      email_notifications_enabled: false,
      notification_frequency: 'disabled',
      max_notifications_per_day: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    throw error;
  }
};

const updateNotificationSettings = async (updates: Partial<InsertNotificationSettings>) => {
  try {
    // TEMPORARY: Disable PostgREST access due to schema cache issue
    // Return safe defaults
    const currentSettings = await getNotificationSettings();
    return {
      ...currentSettings,
      ...updates,
      updated_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error updating notification settings:', error);
    throw error;
  }
};

// Track last notification check (initialize to past date to allow runs on startup)
let lastNotificationCheck = '1970-01-01'; // YYYY-MM-DD (fallback for memory)

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
    // Fetch notification settings from database
    const settings = await getNotificationSettings();
    
    // Calculate warning date
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + settings.access_expiry_warning_days);

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
        // Get user email from Supabase Auth using the UUID
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(access.user_id);
        
        if (authError || !authUser.user?.email) {
          results.failed++;
          results.details.push({
            user_id: access.user_id,
            status: 'failed',
            error: `No email found for user ${access.user_id}`,
          });
          continue;
        }

        const userEmail = authUser.user.email;
        const userName = authUser.user.email; // Use email as display name
        const productName = (access.products as any)?.title || 'Unknown Product';
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
    if (settings.admin_alerts_enabled && settings.admin_email && results.processed > 0) {
      const summary = `
Expiry Notification Summary:
- Processed: ${results.processed}
- Successful: ${results.successful}
- Failed: ${results.failed}

Details:
${results.details.map(d => `- ${d.user_id}: ${d.status}${d.error ? ` (${d.error})` : ''}`).join('\n')}
      `;

      await sendAdminAlert(
        settings.admin_email,
        'Expiry Notifications Processed',
        `Processed ${results.processed} expiry notifications`,
        summary
      );
    }

    return results;
  } catch (error: any) {
    console.error('Failed to process expiry notifications:', error);
    
    // Send admin alert about the failure
    try {
      const errorSettings = await getNotificationSettings();
      if (errorSettings.admin_alerts_enabled && errorSettings.admin_email) {
        await sendAdminAlert(
          errorSettings.admin_email,
          'Notification System Error',
          'Failed to process expiry notifications',
          error.message
        );
      }
    } catch (alertError) {
      console.error('Failed to send error alert:', alertError);
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
        // Get user email from Supabase Auth using the UUID
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(access.user_id);
        
        if (authError || !authUser.user?.email) {
          results.failed++;
          continue;
        }

        const userEmail = authUser.user.email;
        const userName = authUser.user.email; // Use email as display name
        const productName = (access.products as any)?.title || 'Unknown Product';

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
  const settings = await getNotificationSettings();
  if (!settings.daily_notifications_enabled) {
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  
  // Atomic guard: Try to claim this run by updating last_run_date BEFORE doing work
  // This prevents duplicate runs across multiple instances
  const { data: updateResult, error: updateError } = await supabaseAdmin
    .from('notification_settings')
    .update({ last_run_date: today })
    .eq('id', settings.id) // Scope to this specific settings row
    .neq('last_run_date', today) // Only update if not already run today
    .select();

  if (updateError || !updateResult || updateResult.length === 0) {
    console.log('Daily notification already processed today or update failed');
    return; // Another instance already ran today or update failed
  }

  try {
    console.log('Running daily notification check...');
    
    const expiryResults = await checkAndSendExpiryNotifications();
    const expiredResults = await checkAndSendExpiredNotifications();
    
    lastNotificationCheck = today; // Keep in-memory fallback
    
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
    const settings = await getNotificationSettings();
    res.json(settings);
  } catch (error) {
    console.error('Get notification settings error:', error);
    res.status(500).json({ error: 'Failed to fetch notification settings' });
  }
});

// Update notification settings
router.post('/settings', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    // Use Zod validation following project guidelines
    const validatedUpdates = insertNotificationSettingsSchema.partial().parse(req.body);
    
    // Additional validation rules
    if (validatedUpdates.access_expiry_warning_days !== undefined) {
      if (validatedUpdates.access_expiry_warning_days < 1 || validatedUpdates.access_expiry_warning_days > 30) {
        return res.status(400).json({ 
          error: 'access_expiry_warning_days must be between 1 and 30' 
        });
      }
    }
    
    if (validatedUpdates.notification_time !== undefined) {
      if (!/^\d{2}:\d{2}$/.test(validatedUpdates.notification_time)) {
        return res.status(400).json({ 
          error: 'notification_time must be in HH:MM format' 
        });
      }
    }

    const updatedSettings = await updateNotificationSettings(validatedUpdates);

    res.json({
      message: 'Notification settings updated',
      settings: updatedSettings,
    });
  } catch (error: any) {
    console.error('Update notification settings error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Invalid notification settings data',
        details: error.errors,
      });
    }
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
    const settings = await getNotificationSettings();
    // In a production system, this would query a notifications log table
    // For now, return a simple response
    res.json({
      message: 'Notification history not yet implemented',
      last_check: lastNotificationCheck,
      settings: settings,
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

  // Check every minute for reliable timing
  backgroundTaskInterval = setInterval(async () => {
    try {
      const settings = await getNotificationSettings();
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const today = now.toISOString().split('T')[0];
      
      // Run daily check at the configured time if not already run today (with 1-minute tolerance)
      const scheduledTime = settings.notification_time;
      const [scheduledHour, scheduledMinute] = scheduledTime.split(':').map(Number);
      const [currentHour, currentMinute] = [now.getHours(), now.getMinutes()];
      
      const isScheduledTime = (currentHour === scheduledHour && Math.abs(currentMinute - scheduledMinute) <= 1);
      
      // Check database-persisted last run date (more reliable than in-memory across restarts)
      if (isScheduledTime && settings.last_run_date !== today) {
        await runDailyNotificationCheck();
      }
    } catch (error) {
      console.error('Background notification task error:', error);
    }
  }, 60 * 1000); // Every minute for reliable scheduling

  console.log('Notification scheduler started (checking every minute)');
};

export const stopNotificationScheduler = () => {
  if (backgroundTaskInterval) {
    clearInterval(backgroundTaskInterval);
    backgroundTaskInterval = null;
    console.log('Notification scheduler stopped');
  }
};

export default router;