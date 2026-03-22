import { supabase } from './supabase';
import { Notification } from '../types';

export const NotificationService = {
  async getUnreadNotifications(userId: string, userRole: string, branchId?: string): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('is_read', false)
      .or(`user_id.eq.${userId},target_role.eq.${userRole},target_role.eq.ALL`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }

    console.log('[NotificationService] getUnreadNotifications →', { userId, userRole, branchId, count: data?.length, data });

    // Filter out notifications targeted to a different branch
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
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false)
      .or(`user_id.eq.${userId},target_role.eq.${userRole},target_role.eq.ALL`);

    if (error) {
        console.error('Error marking all notifications as read:', error);
        throw error;
    }
  },

  async createNotification(notification: Partial<Notification>): Promise<Notification> {
    const payload = {
      ...(notification.userId && { user_id: notification.userId }),
      ...(notification.targetRole && { target_role: notification.targetRole }),
      ...(notification.targetBranchId && { target_branch_id: notification.targetBranchId }),
      title: notification.title,
      message: notification.message,
      action_url: notification.actionUrl,
      is_read: false
    };

    const { data, error } = await supabase
      .from('notifications')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('[NotificationService] Error creating notification:', error, { payload });
      throw error;
    }

    console.log('[NotificationService] createNotification OK →', { payload, result: data });

    return {
      id: data.id,
      userId: data.user_id,
      targetRole: data.target_role,
      targetBranchId: data.target_branch_id,
      title: data.title,
      message: data.message,
      actionUrl: data.action_url,
      isRead: data.is_read,
      createdAt: data.created_at,
    };
  }
};
