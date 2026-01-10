
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

        // Solicitudes de Precio y Descuento
        'resolved': 'Resuelto',
        'approved': 'Aprobado',
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

        // Métodos de Pago
        'cash': 'Efectivo',
        'card': 'Tarjeta',
        'transfer': 'Transferencia',
        'contado': 'Contado',
        'credito': 'Crédito'
    };

    return STATUS_MAP[status.toLowerCase()] || status;
};
