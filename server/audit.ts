import express from 'express';
import { supabaseAdmin } from './db.js';
import { requireAdmin, type AuthenticatedRequest } from './auth.js';
import { auditLogs, products, accounts, productAccounts, productCredentials, userAccess } from '@shared/schema.js';
import type { InsertAuditLog, AuditLog } from '@shared/schema.js';

const router = express.Router();

interface AuditContext {
  admin_user_id: string;
  ip_address?: string;
  user_agent?: string;
}

interface AuditOptions {
  entity_type: string;
  action: 'create' | 'update' | 'delete' | 'bulk_create' | 'bulk_update' | 'bulk_delete';
  entity_id?: string;
  entity_ids?: string[];
  old_values?: any;
  new_values?: any;
  metadata?: any;
}

// Audit logging service
class AuditService {
  static async logAction(context: AuditContext, options: AuditOptions): Promise<void> {
    try {
      const auditData: InsertAuditLog = {
        admin_user_id: context.admin_user_id,
        action: options.action,
        entity_type: options.entity_type,
        entity_id: options.entity_id || null,
        entity_ids: options.entity_ids ? JSON.stringify(options.entity_ids) : null,
        old_values: options.old_values ? JSON.stringify(options.old_values) : null,
        new_values: options.new_values ? JSON.stringify(options.new_values) : null,
        metadata: options.metadata ? JSON.stringify(options.metadata) : null,
        ip_address: context.ip_address || null,
        user_agent: context.user_agent || null,
      };

      const { error } = await supabaseAdmin
        .from('audit_logs')
        .insert(auditData);

      if (error) {
        console.error('Audit logging failed:', error);
        // Don't throw error to avoid breaking the main operation
      }
    } catch (error) {
      console.error('Audit logging exception:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  static getContext(req: AuthenticatedRequest): AuditContext {
    return {
      admin_user_id: req.user?.id || 'unknown',
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
    };
  }

  // Fetch current state before modification
  static async fetchCurrentState(entity_type: string, entity_id: string): Promise<any> {
    try {
      let table: any;
      
      switch (entity_type) {
        case 'products':
          table = 'products';
          break;
        case 'accounts':
          table = 'accounts';
          break;
        case 'product_accounts':
          table = 'product_accounts';
          break;
        case 'product_credentials':
          table = 'product_credentials';
          break;
        case 'user_access':
          table = 'user_access';
          break;
        default:
          return null;
      }

      const { data, error } = await supabaseAdmin
        .from(table)
        .select('*')
        .eq('id', entity_id)
        .single();

      if (error || !data) {
        return null;
      }

      // Remove sensitive data from audit logs
      if (entity_type === 'accounts' && data.imap_password_enc) {
        data.imap_password_enc = '[ENCRYPTED]';
      }

      return data;
    } catch (error) {
      console.error('Failed to fetch current state:', error);
      return null;
    }
  }

  // Rollback functionality
  static async rollbackAction(audit_id: string, admin_user_id: string): Promise<{ success: boolean; message: string }> {
    try {
      // Fetch the audit log
      const { data: auditLog, error: auditError } = await supabaseAdmin
        .from('audit_logs')
        .select('*')
        .eq('id', audit_id)
        .single();

      if (auditError || !auditLog) {
        return { success: false, message: 'Audit log not found' };
      }

      const { entity_type, action, entity_id, old_values } = auditLog;

      // Only allow rollback for certain actions
      if (!['create', 'update', 'delete'].includes(action)) {
        return { success: false, message: 'Cannot rollback bulk operations' };
      }

      if (!entity_id) {
        return { success: false, message: 'No entity ID for rollback' };
      }

      let rollbackResult: any;
      let rollbackAction: string;

      switch (action) {
        case 'create':
          // Rollback create by deleting the record
          const { error: deleteError } = await supabaseAdmin
            .from(entity_type)
            .delete()
            .eq('id', entity_id);

          if (deleteError) {
            return { success: false, message: `Rollback failed: ${deleteError.message}` };
          }

          rollbackResult = { deleted_id: entity_id };
          rollbackAction = 'delete';
          break;

        case 'update':
          // Rollback update by restoring old values
          if (!old_values) {
            return { success: false, message: 'No old values to restore' };
          }

          const oldData = JSON.parse(old_values);
          const { data: updateData, error: updateError } = await supabaseAdmin
            .from(entity_type)
            .update(oldData)
            .eq('id', entity_id)
            .select()
            .single();

          if (updateError) {
            return { success: false, message: `Rollback failed: ${updateError.message}` };
          }

          rollbackResult = updateData;
          rollbackAction = 'update';
          break;

        case 'delete':
          // Rollback delete by recreating the record
          if (!old_values) {
            return { success: false, message: 'No old values to restore' };
          }

          const restoreData = JSON.parse(old_values);
          const { data: insertData, error: insertError } = await supabaseAdmin
            .from(entity_type)
            .insert(restoreData)
            .select()
            .single();

          if (insertError) {
            return { success: false, message: `Rollback failed: ${insertError.message}` };
          }

          rollbackResult = insertData;
          rollbackAction = 'create';
          break;

        default:
          return { success: false, message: 'Unsupported action for rollback' };
      }

      // Log the rollback action
      await AuditService.logAction(
        { admin_user_id },
        {
          entity_type,
          action: rollbackAction as any,
          entity_id,
          new_values: rollbackResult,
          metadata: {
            rollback_of: audit_id,
            original_action: action,
          },
        }
      );

      return { success: true, message: 'Rollback completed successfully' };
    } catch (error: any) {
      console.error('Rollback error:', error);
      return { success: false, message: `Rollback failed: ${error.message}` };
    }
  }
}

// API Routes for Audit Logs

// Get audit logs with filtering and pagination
router.get('/logs', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      entity_type, 
      action, 
      admin_user_id, 
      start_date, 
      end_date 
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    let query = supabaseAdmin
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (entity_type) {
      query = query.eq('entity_type', entity_type);
    }
    if (action) {
      query = query.eq('action', action);
    }
    if (admin_user_id) {
      query = query.eq('admin_user_id', admin_user_id);
    }
    if (start_date) {
      query = query.gte('created_at', start_date);
    }
    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    // Apply pagination
    query = query.range(offset, offset + Number(limit) - 1);

    const { data, error, count } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Parse JSON fields for response
    const logs = data.map((log: any) => ({
      ...log,
      entity_ids: log.entity_ids ? JSON.parse(log.entity_ids) : null,
      old_values: log.old_values ? JSON.parse(log.old_values) : null,
      new_values: log.new_values ? JSON.parse(log.new_values) : null,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
    }));

    res.json({
      logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Fetch audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get audit statistics
router.get('/stats', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { data: logs, error } = await supabaseAdmin
      .from('audit_logs')
      .select('action, entity_type, created_at')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Calculate statistics
    const stats = {
      total_actions: logs.length,
      actions_by_type: logs.reduce((acc: any, log: any) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      }, {}),
      entities_by_type: logs.reduce((acc: any, log: any) => {
        acc[log.entity_type] = (acc[log.entity_type] || 0) + 1;
        return acc;
      }, {}),
      daily_activity: logs.reduce((acc: any, log: any) => {
        const date = new Date(log.created_at).toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {}),
    };

    res.json(stats);
  } catch (error) {
    console.error('Fetch audit stats error:', error);
    res.status(500).json({ error: 'Failed to fetch audit statistics' });
  }
});

// Rollback an action
router.post('/rollback/:audit_id', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { audit_id } = req.params;
    const admin_user_id = req.user?.id || 'unknown';

    const result = await AuditService.rollbackAction(audit_id, admin_user_id);

    if (result.success) {
      res.json({ message: result.message });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('Rollback error:', error);
    res.status(500).json({ error: 'Failed to rollback action' });
  }
});

export default router;
export { AuditService };