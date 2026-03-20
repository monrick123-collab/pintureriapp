
export const translateStatus = (status: string): string => {
    const STATUS_MAP: Record<string, string> = {
        // Inventario / Productos
        'available': 'Disponible',
        'low': 'Bajo Stock',
        'out': 'Agotado',
        'expired': 'Expirado',

        // Resurtidos (Tienda -> Bodega)
        'pending_admin': 'Pendiente',
        'approved_warehouse': 'Aprobado',
        'shipped': 'En Camino',
        'completed': 'Recibido',
        'rejected': 'Rechazado',

        // Notas de Resurtido (RestockSheet)
        'pending': 'Pendiente',
        'cancelled': 'Cancelado',
        // 'shipped', 'completed' shared

        // Pedidos a Administración (Supply Orders)
        'processing': 'Procesando',
        'received': 'Recibido',

        // Gastos
        'renta': 'Renta',
        'servicios': 'Servicios',
        'salarios': 'Salarios',
        'suministros': 'Suministros',
        'otros': 'Otros',

        // Solicitudes de Precio y Descuento
        'resolved': 'Resuelto',
        'approved': 'Aprobado',
        'pending_authorization': 'Pendiente',
        'received_at_warehouse': 'En Bodega',
        // 'pending', 'rejected' shared

        // Sucursales
        'active': 'Activa',
        'inactive': 'Inactiva',

        // Facturas y Otros
        'overdue': 'Vencido',
        'paid': 'Pagado',

        // Tipos de Sucursal
        'warehouse': 'Bodega',
        'store': 'Tienda',

        // Trueque
        'in_transit': 'En Tránsito',
        'pending_offer': 'Oferta Pendiente',
        'pending_selection': 'Selección Pendiente',
        'pending_approval': 'Pendiente Aprobación',
        'counter_proposed': 'Contra-oferta',

        // Métodos de Pago
        'cash': 'Efectivo',
        'card': 'Tarjeta',
        'transfer': 'Transferencia',
        'contado': 'Contado',
        'credito': 'Crédito'
    };

    return STATUS_MAP[status.toLowerCase()] || status;
};

/**
 * Mapea un status string al variant del componente Badge.
 * Uso: <Badge variant={getStatusColor(item.status)}>{translateStatus(item.status)}</Badge>
 */
export const getStatusColor = (
    status: string
): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
    const map: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
        approved: 'success',
        approved_warehouse: 'success',
        completed: 'success',
        received: 'success',
        received_at_warehouse: 'success',
        active: 'success',
        paid: 'success',
        resolved: 'success',
        available: 'success',
        closed: 'default',
        cancelled: 'default',
        pending: 'warning',
        pending_admin: 'warning',
        pending_authorization: 'warning',
        low: 'warning',
        processing: 'info',
        shipped: 'info',
        in_transit: 'info',
        pending_offer: 'warning',
        pending_selection: 'warning',
        pending_approval: 'warning',
        counter_proposed: 'warning',
        rejected: 'danger',
        out: 'danger',
        overdue: 'danger',
        inactive: 'danger',
    };
    return map[status?.toLowerCase()] ?? 'default';
};
