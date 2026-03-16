import { supabase } from './supabase';
import { NotificationService } from './notificationService';

/**
 * Servicio para manejar la expiración de pagos pendientes después de 48 horas
 * y el archivado automático de notificaciones después de 15 días
 */
export const PaymentExpiryService = {
  /**
   * Verifica y expira pagos pendientes que han superado las 48 horas
   * Debería ejecutarse periódicamente (ej: cada hora)
   */
  async expireOldPendingPayments(): Promise<{ expiredSales: number; expiredMunicipalSales: number }> {
    try {
      const fortyEightHoursAgo = new Date();
      fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);
      
      const isoDate = fortyEightHoursAgo.toISOString();
      
      // 1. Expirar ventas normales pendientes
      const updateSalesData: any = { 
        payment_status: 'expired',
        rejection_reason: 'Pago expirado: No se aprobó dentro de las 48 horas'
      };
      
      // Solo agregar updated_at si la columna existe
      try {
        updateSalesData.updated_at = new Date().toISOString();
      } catch (e) {
        console.log('Not adding updated_at to sales (column might not exist yet)');
      }
      
      const { data: expiredSales, error: salesError } = await supabase
        .from('sales')
        .update(updateSalesData)
        .eq('payment_status', 'pending')
        .lt('pending_since', isoDate)
        .select('id, total, client_id');
      
      if (salesError) {
        console.error('Error expiring sales:', salesError);
      }
      
      // 2. Expirar ventas municipales pendientes
      const updateMunicipalData: any = { 
        payment_status: 'expired',
        rejection_reason: 'Pago expirado: No se aprobó dentro de las 48 horas'
      };
      
      // Solo agregar updated_at si la columna existe
      try {
        updateMunicipalData.updated_at = new Date().toISOString();
      } catch (e) {
        console.log('Not adding updated_at to municipal_sales (column might not exist yet)');
      }
      
      const { data: expiredMunicipalSales, error: municipalError } = await supabase
        .from('municipal_sales')
        .update(updateMunicipalData)
        .eq('payment_status', 'pending')
        .lt('pending_since', isoDate)
        .select('id, total, municipality');
      
      if (municipalError) {
        console.error('Error expiring municipal sales:', municipalError);
      }
      
      // 3. Crear notificaciones para las ventas expiradas
      const expiredCount = (expiredSales?.length || 0) + (expiredMunicipalSales?.length || 0);
      
      if (expiredCount > 0) {
        try {
          // Notificar a administradores sobre ventas expiradas
          await NotificationService.createNotification({
            targetRole: 'ADMIN',
            title: `${expiredCount} Pagos Expirados`,
            message: `${expiredCount} pagos pendientes han expirado por falta de aprobación en 48 horas.`,
            actionUrl: '/admin/pending-payments'
          });
          
          console.log(`Notificados ${expiredCount} pagos expirados`);
        } catch (notifError) {
          console.error('Error creating expiry notification:', notifError);
        }
      }
      
      return {
        expiredSales: expiredSales?.length || 0,
        expiredMunicipalSales: expiredMunicipalSales?.length || 0
      };
      
    } catch (error) {
      console.error('Error in expireOldPendingPayments:', error);
      return { expiredSales: 0, expiredMunicipalSales: 0 };
    }
  },
  
  /**
   * Verifica el tiempo restante para un pago pendiente
   * @param pendingSince Fecha cuando se creó el pago pendiente
   * @returns Objeto con horas restantes y estado
   */
  getTimeRemaining(pendingSince: string): {
    hoursRemaining: number;
    isExpired: boolean;
    isUrgent: boolean;
    status: 'ok' | 'warning' | 'expired';
  } {
    const pendingDate = new Date(pendingSince);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - pendingDate.getTime()) / (1000 * 60 * 60));
    const hoursRemaining = 48 - diffHours;
    
    const isExpired = hoursRemaining <= 0;
    const isUrgent = hoursRemaining > 0 && hoursRemaining <= 12;
    
    let status: 'ok' | 'warning' | 'expired' = 'ok';
    if (isExpired) status = 'expired';
    else if (isUrgent) status = 'warning';
    
    return {
      hoursRemaining: Math.max(0, hoursRemaining),
      isExpired,
      isUrgent,
      status
    };
  },
  
  /**
   * Formatea el tiempo restante para mostrar al usuario
   */
  formatTimeRemaining(pendingSince: string): string {
    const { hoursRemaining, isExpired, isUrgent } = this.getTimeRemaining(pendingSince);
    
    if (isExpired) {
      return 'EXPIRADO';
    } else if (isUrgent) {
      return `${hoursRemaining}h restantes ⚠️`;
    } else {
      return `${hoursRemaining}h restantes`;
    }
  },
  
  /**
   * Ejecuta el archivado de notificaciones antiguas
   * Esta función debería llamarse desde un cron job o periódicamente
   */
  async archiveOldNotifications(): Promise<number> {
    try {
      // Esta función debería ejecutar la función SQL archive_old_notifications()
      // que ya está definida en la migración
      const { data, error } = await supabase.rpc('archive_old_notifications');
      
      if (error) {
        console.error('Error archiving old notifications:', error);
        return 0;
      }
      
      console.log(`Archivadas ${data || 0} notificaciones antiguas`);
      return data || 0;
      
    } catch (error) {
      console.error('Error in archiveOldNotifications:', error);
      return 0;
    }
  }
};