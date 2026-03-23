import { supabase } from './supabase';
import { Notification } from '../types';

export const NotificationService = {
  async getUnreadNotifications(userId: string, userRole: string, branchId?: string): Promise<Notification[]> {
    try {
      // Build OR filter: notifications for this user, their role, or for ALL roles.
      // Use PostgREST-compatible format with proper null handling.
      const orFilter = [
        `user_id.eq.${userId}`,
        `target_role.eq.${userRole}`,
        `target_role.eq.ALL`,
      ].join(',');

      const { data, error } = await supabase
        .from('notifications')
        .select('id, user_id, target_role, target_branch_id, title, message, action_url, is_read, created_at')
        .eq('is_read', false)
        .or(orFilter)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[NotificationService] getUnreadNotifications error:', error);
        // Return empty array on error so the UI doesn't break
        return [];
      }

      console.log('[NotificationService] getUnreadNotifications →', { userId, userRole, branchId, count: data?.length });

      // Filter by branch if applicable
      const filtered = (data || []).filter(n =>
        !n.target_branch_id || !branchId || n.target_branch_id === branchId
      );

      return filtered.map(n => ({
        id: n.id,
        userId: n.user_id,
        targetRole: n.target_role,
        targetBranchId: n.target_branch_id,
        title: n.title,
        message: n.message,
        actionUrl: n.action_url,
        isRead: n.is_read,
        createdAt: n.created_at,
      }));
    } catch (err) {
      console.error('[NotificationService] unexpected error in getUnreadNotifications:', err);
      return [];
    }
  },

  async markAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  },

  async markAllAsRead(userId: string, userRole: string): Promise<void> {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('is_read', false)
        .or(`user_id.eq.${userId},target_role.eq.${userRole},target_role.eq.ALL`);
    } catch (err) {
      console.warn('[NotificationService] markAllAsRead failed silently:', err);
    }
  },

  async createNotification(notification: Partial<Notification>): Promise<Notification | null> {
    const payload = {
      ...(notification.userId && { user_id: notification.userId }),
      ...(notification.targetRole && { target_role: notification.targetRole }),
      ...(notification.targetBranchId && { target_branch_id: notification.targetBranchId }),
      title: notification.title,
      message: notification.message,
      action_url: notification.actionUrl,
      is_read: false
    };

    // Use insert without .single() to avoid 406 when RLS blocks or 0 rows returned
    const { data, error } = await supabase
      .from('notifications')
      .insert([payload])
      .select();

    if (error) {
      console.error('[NotificationService] Error creating notification:', error, { payload });
      throw error;
    }

    const row = data?.[0];
    if (!row) {
      console.warn('[NotificationService] Notification insert returned no rows – likely blocked by RLS. Check Supabase policies for the notifications table.');
      return null;
    }

    console.log('[NotificationService] createNotification OK →', { payload, result: row });

    return {
      id: row.id,
      userId: row.user_id,
      targetRole: row.target_role,
      targetBranchId: row.target_branch_id,
      title: row.title,
      message: row.message,
      actionUrl: row.action_url,
      isRead: row.is_read,
      createdAt: row.created_at,
    };
  }
};
