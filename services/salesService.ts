import { supabase } from './supabase';
import { Sale, SaleItem } from '../types';
import { NotificationService } from './notificationService';

export const SalesService = {
    /**
     * Procesa una venta completa de manera atómica usando una función RPC en Supabase.
     */
    async processSale(
        branchId: string,
        items: SaleItem[],
        total: number,
        paymentMethod: string,
        clientId?: string,
        extra?: {
            subtotal: number,
            discountAmount?: number,
            iva: number,
            isWholesale?: boolean,
            paymentType?: 'contado' | 'credito',
            departureAdminId?: string,
            creditDays?: number,
            billingBank?: string,
            billingSocialReason?: string,
            billingInvoiceNumber?: string,
            deliveryReceiverName?: string,
            transferReference?: string,
            paymentStatus?: 'pending' | 'approved' | 'rejected',
        }
    ): Promise<string> {
        // Preparamos los items para enviarlos al RPC
        const rpcItems = items.map(i => ({
            product_id: i.productId,
            quantity: i.quantity,
            price: i.price,
            product_name: i.productName
        }));

        const { data, error } = await supabase.rpc('process_sale', {
            p_branch_id: branchId,
            p_total: total,
            p_payment_method: paymentMethod,
            p_items: rpcItems,
            p_subtotal: extra?.subtotal || total,
            p_discount_amount: extra?.discountAmount || 0,
            p_iva: extra?.iva || 0,

            // New optional fields sent directly to INSERT
            p_client_id: clientId || null,
            p_is_wholesale: extra?.isWholesale || false,
            p_payment_type: extra?.paymentType || 'contado',
            p_departure_admin_id: extra?.departureAdminId || null,
            p_credit_days: extra?.creditDays || 0,
            p_billing_bank: extra?.billingBank || null,
            p_billing_social_reason: extra?.billingSocialReason || null,
            p_billing_invoice_number: extra?.billingInvoiceNumber || null,
            p_delivery_receiver_name: extra?.deliveryReceiverName || null,
            p_transfer_reference: extra?.transferReference || null,
            p_payment_status: extra?.paymentStatus || 'approved'
        });

        if (error) {
            console.error("Error processing sale:", error);
            throw new Error(error.message);
        }

        // Crear notificación si el pago está pendiente de aprobación
        if (extra?.paymentStatus === 'pending' || 
            (paymentMethod === 'transfer' && extra?.paymentStatus !== 'approved') ||
            (paymentMethod === 'cash' && extra?.paymentStatus !== 'approved')) {
            
            try {
                // Determinar tipo de venta
                const saleType = extra?.isWholesale ? 'Mayoreo' : 'Municipal';
                const amountFormatted = new Intl.NumberFormat('es-MX', {
                    style: 'currency',
                    currency: 'MXN'
                }).format(total);
                
                // Crear notificación para administradores
                await NotificationService.createNotification({
                    targetRole: 'ADMIN', // Solo administradores
                    title: `Pago Pendiente de Aprobación - ${saleType}`,
                    message: `Venta ${data.substring(0, 8)} por ${amountFormatted} requiere aprobación. Método: ${paymentMethod === 'transfer' ? 'Transferencia' : 'Efectivo'}`,
                    actionUrl: `/admin/pending-payments`
                });
                
                console.log(`Notificación creada para venta pendiente: ${data}`);
            } catch (notifError) {
                console.error("Error creando notificación para pago pendiente:", notifError);
                // No lanzar error para no afectar la venta principal
            }
        }

        return data;
    },

    async getSalesByBranch(branchId: string): Promise<Sale[]> {
        const { data, error } = await supabase
            .from('sales')
            .select(`
                *,
                sale_items (*),
                clients (name)
            `)
            .eq('branch_id', branchId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return (data || []).map((s: any) => ({
            id: s.id,
            branchId: s.branch_id,
            clientId: s.client_id,
            clientName: s.clients?.name,
            subtotal: s.subtotal || 0,
            discountAmount: s.discount_amount || 0,
            iva: s.iva || 0,
            total: s.total,
            status: s.status,
            paymentMethod: s.payment_method,
            paymentStatus: s.payment_status || 'approved',
            transferReference: s.transfer_reference,
            pendingSince: s.pending_since,
            rejectionReason: s.rejection_reason,
            createdAt: s.created_at,
            isWholesale: s.is_wholesale,
            paymentType: s.payment_type,
            departureAdminId: s.departure_admin_id,
            billingBank: s.billing_bank,
            billingSocialReason: s.billing_social_reason,
            billingInvoiceNumber: s.billing_invoice_number,
            deliveryReceiverName: s.delivery_receiver_name,
            items: (s.sale_items || []).map((i: any) => ({
                productId: i.product_id,
                productName: i.product_name,
                quantity: i.quantity,
                price: i.unit_price,
                total: i.quantity * i.unit_price
            }))
        }));
    },
    
    async getAdmins(): Promise<{ id: string; name: string }[]> {
        // Obtener usuarios con rol ADMIN o STORE_MANAGER
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('role', ['ADMIN', 'STORE_MANAGER'])
            .order('full_name', { ascending: true });
        
        if (error) {
            console.error('Error fetching admins:', error);
            return [];
        }
        
        return (data || []).map(p => ({
            id: p.id,
            name: p.full_name || 'Sin nombre'
        }));
    },
    
    async updateMunicipalInvoiceNumber(saleId: string, invoiceNumber: string): Promise<void> {
        const { error } = await supabase
            .from('municipal_sales')
            .update({ invoice_number: invoiceNumber, updated_at: new Date().toISOString() })
            .eq('id', saleId);
        if (error) throw error;
    },

    async approvePayment(saleId: string, isMunicipal: boolean = false, adminId?: string): Promise<void> {
        if (isMunicipal) {
            await this.approveMunicipalPayment(saleId, adminId);
        } else {
            await this.approveRegularPayment(saleId, adminId);
        }
    },
    
    async approveRegularPayment(saleId: string, adminId?: string): Promise<void> {
        console.log(`Approving regular sale payment: saleId=${saleId}`);
        
        // 1. Primero obtener información de la venta para la notificación
        const { data: sale, error: fetchError } = await supabase
            .from('sales')
            .select('id, total, branch_id, is_wholesale, client_id')
            .eq('id', saleId)
            .single();
        
        if (fetchError) {
            console.error(`Error fetching regular sale:`, fetchError);
            throw fetchError;
        }
        
        // 2. Actualizar estado de pago
        const updateData: any = { 
            payment_status: 'approved',
            pending_since: null,
            rejection_reason: null
        };
        
        // Solo agregar updated_at si la columna existe
        try {
            updateData.updated_at = new Date().toISOString();
        } catch (e) {
            console.log('Not adding updated_at (column might not exist yet)');
        }
        
        const { error } = await supabase
            .from('sales')
            .update(updateData)
            .eq('id', saleId);
        
        if (error) {
            console.error(`Error approving regular sale payment:`, error);
            throw error;
        }
        
        console.log(`Regular sale payment ${saleId} approved successfully`);
        
        // 3. Crear notificación para el vendedor/encargado
        try {
            const amountFormatted = new Intl.NumberFormat('es-MX', {
                style: 'currency',
                currency: 'MXN'
            }).format(sale.total);
            
            const saleType = sale.is_wholesale ? 'Mayoreo' : 'Menudeo';
            const clientName = sale.client_id ? 'Cliente registrado' : 'Cliente no especificado';
            
            // Notificar a usuarios de la sucursal
            await NotificationService.createNotification({
                targetRole: 'WAREHOUSE', // Para encargados de bodega
                title: `Pago Aprobado - Venta ${saleType}`,
                message: `Venta ${saleId.substring(0, 8)} por ${amountFormatted} ha sido aprobada. Cliente: ${clientName}`,
                actionUrl: `/wholesale-pos?tab=history`
            });
            
            console.log(`Notificación creada para aprobación de venta regular: ${saleId}`);
        } catch (notifError) {
            console.error("Error creando notificación de aprobación:", notifError);
            // No lanzar error para no afectar la aprobación principal
        }
    },
    
    async approveMunicipalPayment(saleId: string, adminId?: string): Promise<void> {
        console.log(`Approving municipal sale payment: saleId=${saleId}`);
        
        // 1. Primero obtener información de la venta para la notificación
        const { data: sale, error: fetchError } = await supabase
            .from('municipal_sales')
            .select('folio, municipality, total, branch_id')
            .eq('id', saleId)
            .single();
        
        if (fetchError) {
            console.error(`Error fetching municipal sale:`, fetchError);
            throw fetchError;
        }
        
        // 2. Actualizar estado de pago (usar 'paid' en lugar de 'approved' para coincidir con la tabla existente)
        const updateData: any = { 
            payment_status: 'paid',
            // Nota: La tabla municipal_sales no tiene pending_since ni rejection_reason
            // según la estructura existente
        };
        
        // Solo agregar updated_at si la columna existe
        try {
            updateData.updated_at = new Date().toISOString();
        } catch (e) {
            console.log('Not adding updated_at to municipal_sales (column might not exist yet)');
        }
        
        const { error } = await supabase
            .from('municipal_sales')
            .update(updateData)
            .eq('id', saleId);
        
        if (error) {
            console.error(`Error approving municipal sale payment:`, error);
            throw error;
        }
        
        console.log(`Municipal sale payment ${saleId} approved successfully`);
        
        // 3. Crear notificación para el vendedor/encargado
        try {
            const amountFormatted = new Intl.NumberFormat('es-MX', {
                style: 'currency',
                currency: 'MXN'
            }).format(sale.total);
            
            // Notificar a usuarios de la sucursal (WAREHOUSE, STORE_MANAGER)
            await NotificationService.createNotification({
                targetRole: 'WAREHOUSE', // Para encargados de bodega
                title: `Pago Aprobado - Venta Municipal`,
                message: `Venta #M-${String(sale.folio).padStart(4, '0')} por ${amountFormatted} ha sido aprobada. Municipio: ${sale.municipality}`,
                actionUrl: `/municipal-pos?tab=history`
            });
            
            console.log(`Notificación creada para aprobación de venta municipal: ${saleId}`);
        } catch (notifError) {
            console.error("Error creando notificación de aprobación:", notifError);
            // No lanzar error para no afectar la aprobación principal
        }
    },

    async rejectPayment(saleId: string, isMunicipal: boolean = false, reason: string): Promise<void> {
        if (isMunicipal) {
            await this.rejectMunicipalPayment(saleId, reason);
        } else {
            await this.rejectRegularPayment(saleId, reason);
        }
    },
    
    async rejectRegularPayment(saleId: string, reason: string): Promise<void> {
        console.log(`Rejecting regular sale payment: saleId=${saleId}, reason=${reason}`);
        
        // Preparar datos de actualización
        const updateData: any = { 
            payment_status: 'rejected',
            rejection_reason: reason
        };
        
        // Solo agregar updated_at si la columna existe
        try {
            updateData.updated_at = new Date().toISOString();
        } catch (e) {
            console.log('Not adding updated_at (column might not exist yet)');
        }
        
        const { error } = await supabase
            .from('sales')
            .update(updateData)
            .eq('id', saleId);
        
        if (error) {
            console.error(`Error rejecting regular sale payment:`, error);
            throw error;
        }
        
        console.log(`Regular sale payment ${saleId} rejected successfully`);
    },
    
    async rejectMunicipalPayment(saleId: string, reason: string): Promise<void> {
        console.log(`Rejecting municipal sale payment: saleId=${saleId}, reason=${reason}`);
        
        // Preparar datos de actualización
        // Nota: La tabla municipal_sales no tiene rejection_reason según la estructura existente
        // Mantener payment_status como 'pending' o cambiar a algo diferente
        const updateData: any = { 
            payment_status: 'pending', // Mantener como pendiente pero con nota
            notes: `RECHAZADO: ${reason} - ${new Date().toLocaleString()}`
        };
        
        // Solo agregar updated_at si la columna existe
        try {
            updateData.updated_at = new Date().toISOString();
        } catch (e) {
            console.log('Not adding updated_at to municipal_sales (column might not exist yet)');
        }
        
        const { error } = await supabase
            .from('municipal_sales')
            .update(updateData)
            .eq('id', saleId);
        
        if (error) {
            console.error(`Error rejecting municipal sale payment:`, error);
            throw error;
        }
        
        console.log(`Municipal sale payment ${saleId} rejected successfully`);
    },

    async getPendingPayments(branchId?: string): Promise<Sale[]> {
        let query = supabase
            .from('sales')
            .select(`
                *,
                branch:branches(name),
                sale_items (*),
                clients (name)
            `)
            .eq('payment_status', 'pending')
            .order('pending_since', { ascending: true });

        if (branchId && branchId !== 'ALL') {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;
        if (error) throw error;

        return (data || []).map((s: any) => ({
            id: s.id,
            branchId: s.branch_id,
            branchName: s.branch?.name,
            clientId: s.client_id,
            clientName: s.clients?.name,
            subtotal: s.subtotal || 0,
            discountAmount: s.discount_amount || 0,
            iva: s.iva || 0,
            total: s.total,
            status: s.status,
            paymentMethod: s.payment_method,
            paymentStatus: s.payment_status,
            transferReference: s.transfer_reference,
            pendingSince: s.pending_since,
            rejectionReason: s.rejection_reason,
            createdAt: s.created_at,
            isWholesale: s.is_wholesale,
            paymentType: s.payment_type,
            departureAdminId: s.departure_admin_id,
            billingBank: s.billing_bank,
            billingSocialReason: s.billing_social_reason,
            billingInvoiceNumber: s.billing_invoice_number,
            deliveryReceiverName: s.delivery_receiver_name,
            items: (s.sale_items || []).map((i: any) => ({
                productId: i.product_id,
                productName: i.product_name,
                quantity: i.quantity,
                price: i.unit_price,
                total: i.quantity * i.unit_price
            }))
        }));
    },

    /**
     * Obtiene ventas municipales con filtros opcionales
     */
    async getMunicipalSales(branchId?: string, startDate?: string, endDate?: string): Promise<any[]> {
        let query = supabase
            .from('municipal_sales')
            .select(`
                *,
                branch:branches(name),
                municipal_sale_items (*)
            `)
            .order('created_at', { ascending: false });

        if (branchId && branchId !== 'ALL') {
            query = query.eq('branch_id', branchId);
        }

        if (startDate) {
            query = query.gte('created_at', startDate);
        }

        if (endDate) {
            // Para incluir todo el día de endDate, buscamos menores que el día siguiente
            const date = new Date(endDate);
            date.setDate(date.getDate() + 1);
            const nextDay = date.toISOString().split('T')[0];
            query = query.lt('created_at', nextDay);
        }

        const { data, error } = await query;
        if (error) throw error;

        return data || [];
    },

    /**
     * Crea una venta municipal
     */
    async createMunicipalSale(
        branchId: string,
        items: any[],
        saleData: {
            municipality: string;
            department?: string;
            contactName?: string;
            socialReason?: string;
            rfc?: string;
            invoiceNumber?: string;
            authorizedExitBy: string;
            deliveryReceiver: string;
            paymentType: 'contado' | 'credito';
            paymentMethod: 'cash' | 'card' | 'transfer' | 'check';
            creditDays?: number;
            subtotal: number;
            iva: number;
            total: number;
            notes?: string;
            transferReference?: string;
        }
    ): Promise<string> {
        // 1. Obtener el siguiente folio municipal
        const { data: folioData, error: folioError } = await supabase.rpc('get_next_folio', {
            p_branch_id: branchId,
            p_folio_type: 'municipal'
        });
        
        if (folioError) {
            console.error('Error getting municipal folio:', folioError);
            throw folioError;
        }
        
        const folio = folioData ?? 1;

        // 2. Crear la venta municipal
        const { data: sale, error: saleError } = await supabase
            .from('municipal_sales')
            .insert({
                branch_id: branchId,
                folio: folio,
                municipality: saleData.municipality,
                department: saleData.department || null,
                contact_name: saleData.contactName || null,
                social_reason: saleData.socialReason || null,
                rfc: saleData.rfc || null,
                invoice_number: saleData.invoiceNumber || null,
                authorized_exit_by: saleData.authorizedExitBy,
                delivery_receiver: saleData.deliveryReceiver,
                payment_type: saleData.paymentType,
                payment_method: saleData.paymentMethod,
                credit_days: saleData.creditDays || 0,
                subtotal: saleData.subtotal,
                iva: saleData.iva,
                total: saleData.total,
                notes: saleData.notes || null,
                // Si es transferencia o efectivo, marcar como pendiente de aprobación
                payment_status: (saleData.paymentMethod === 'transfer' || saleData.paymentMethod === 'cash') ? 'pending' : 'paid',
                // Nota: La tabla usa 'pending', 'invoiced', 'paid' en lugar de 'pending', 'approved', 'rejected'
                // Agregar transfer_reference si existe
                ...(saleData.transferReference ? { transfer_reference: saleData.transferReference } : {})
            })
            .select()
            .single();

        if (saleError) {
            console.error('Error creating municipal sale:', saleError);
            throw saleError;
        }

        // 3. Crear los items de la venta
        const saleItems = items.map(item => ({
            sale_id: sale.id, // Nota: La tabla usa sale_id, no municipal_sale_id
            product_id: item.productId,
            product_name: item.productName,
            quantity: item.quantity,
            unit_price: item.price,
            total_price: item.quantity * item.price
        }));

        const { error: itemsError } = await supabase
            .from('municipal_sale_items')
            .insert(saleItems);

        if (itemsError) {
            console.error('Error creating municipal sale items:', itemsError);
            throw itemsError;
        }

        // 4. Crear notificación si el pago está pendiente
        if (saleData.paymentMethod === 'transfer' || saleData.paymentMethod === 'cash') {
            try {
                const amountFormatted = new Intl.NumberFormat('es-MX', {
                    style: 'currency',
                    currency: 'MXN'
                }).format(saleData.total);
                
                await NotificationService.createNotification({
                    targetRole: 'ADMIN',
                    title: `Pago Pendiente de Aprobación - Municipal`,
                    message: `Venta municipal #M-${String(folio).padStart(4, '0')} por ${amountFormatted} requiere aprobación. Método: ${saleData.paymentMethod === 'transfer' ? 'Transferencia' : 'Efectivo'}`,
                    actionUrl: `/admin/pending-payments`
                });
                
                console.log(`Notificación creada para venta municipal pendiente: ${sale.id}`);
            } catch (notifError) {
                console.error("Error creando notificación para pago pendiente municipal:", notifError);
            }
        }

        return sale.id;
    },

    /**
     * Obtiene cuentas municipales (crédito)
     */
    async getMunicipalAccounts(branchId?: string): Promise<any[]> {
        let query = supabase
            .from('municipal_accounts')
            .select(`
                *,
                branch:branches(name)
            `)
            .order('municipality', { ascending: true });

        if (branchId && branchId !== 'ALL') {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;
        if (error) throw error;

        return data || [];
    },

    /**
     * Agrega un pago a una cuenta municipal
     */
    async addMunicipalPayment(
        accountId: string,
        currentBalance: number,
        paymentType: 'abono' | 'pago_completo',
        amount: number,
        notes: string,
        userId: string
    ): Promise<void> {
        const newBalance = paymentType === 'pago_completo' ? 0 : Math.max(0, currentBalance - amount);

        const { error } = await supabase
            .from('municipal_accounts')
            .update({
                balance: newBalance,
                updated_at: new Date().toISOString()
            })
            .eq('id', accountId);

        if (error) throw error;

        // Registrar el pago en el historial
        const { error: historyError } = await supabase
            .from('municipal_payments')
            .insert({
                account_id: accountId, // La tabla usa account_id, no municipal_account_id
                amount,
                type: paymentType, // La tabla usa type, no payment_type
                notes,
                registered_by: userId, // La tabla usa registered_by, no created_by
                created_at: new Date().toISOString()
            });

        if (historyError) throw error;
    },

    /**
     * Bloquea una cuenta municipal
     */
    async blockMunicipalAccount(accountId: string, reason: string): Promise<void> {
        const { error } = await supabase
            .from('municipal_accounts')
            .update({
                is_blocked: true,
                block_reason: reason,
                updated_at: new Date().toISOString()
            })
            .eq('id', accountId);

        if (error) throw error;
    },

    /**
     * Desbloquea una cuenta municipal
     */
    async unblockMunicipalAccount(accountId: string): Promise<void> {
        const { error } = await supabase
            .from('municipal_accounts')
            .update({
                is_blocked: false,
                block_reason: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', accountId);

        if (error) throw error;
    },

    /**
     * Establece el límite de crédito para una cuenta municipal
     */
    async setCreditLimit(accountId: string, limit: number): Promise<void> {
        const { error } = await supabase
            .from('municipal_accounts')
            .update({
                credit_limit: limit,
                updated_at: new Date().toISOString()
            })
            .eq('id', accountId);

        if (error) throw error;
    },

    /**
     * Obtiene pagos municipales pendientes
     */
    async getPendingMunicipalPayments(branchId?: string): Promise<any[]> {
        let query = supabase
            .from('municipal_sales')
            .select(`
                *,
                branch:branches(name)
            `)
            .eq('payment_status', 'pending')
            .order('created_at', { ascending: true }); // Ordenar por fecha de creación

        if (branchId && branchId !== 'ALL') {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;
        if (error) throw error;

        return data || [];
    },

    /**
     * Actualiza el número de factura de una venta
     */
    async updateInvoiceNumber(saleId: string, invoiceNumber: string): Promise<void> {
        const { error } = await supabase
            .from('sales')
            .update({ 
                billing_invoice_number: invoiceNumber,
                updated_at: new Date().toISOString()
            })
            .eq('id', saleId);

        if (error) throw error;
    },

    /**
     * Obtiene ventas con filtros por fecha y sucursal
     */
    async getSalesWithFilters(startDate: string, endDate: string, branchId?: string): Promise<Sale[]> {
        let query = supabase
            .from('sales')
            .select(`
                *,
                branch:branches(name),
                sale_items (*),
                clients (name)
            `)
            .gte('created_at', startDate)
            .lt('created_at', (() => {
                const d = new Date(endDate);
                d.setDate(d.getDate() + 1);
                return d.toISOString().split('T')[0];
            })())
            .order('created_at', { ascending: false });

        if (branchId && branchId !== 'ALL') {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;
        if (error) throw error;

        return (data || []).map((s: any) => ({
            id: s.id,
            branchId: s.branch_id,
            branchName: s.branch?.name,
            clientId: s.client_id,
            clientName: s.clients?.name,
            subtotal: s.subtotal || 0,
            discountAmount: s.discount_amount || 0,
            iva: s.iva || 0,
            total: s.total,
            status: s.status,
            paymentMethod: s.payment_method,
            paymentStatus: s.payment_status,
            transferReference: s.transfer_reference,
            pendingSince: s.pending_since,
            rejectionReason: s.rejection_reason,
            createdAt: s.created_at,
            isWholesale: s.is_wholesale,
            paymentType: s.payment_type,
            departureAdminId: s.departure_admin_id,
            billingBank: s.billing_bank,
            billingSocialReason: s.billing_social_reason,
            billingInvoiceNumber: s.billing_invoice_number,
            deliveryReceiverName: s.delivery_receiver_name,
            items: (s.sale_items || []).map((i: any) => ({
                productId: i.product_id,
                productName: i.product_name,
                quantity: i.quantity,
                price: i.unit_price,
                total: i.quantity * i.unit_price
            }))
        }));
    },
};

