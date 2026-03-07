import { supabase } from './supabase';
import { Sale, SaleItem } from '../types';

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
            p_delivery_receiver_name: extra?.deliveryReceiverName || null
        });

        if (error) {
            console.error("Error processing sale:", error);
            throw new Error(error.message);
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
            .lte('created_at', endDate)
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
            createdAt: s.created_at,
            isWholesale: s.is_wholesale,
            paymentType: s.payment_type,
            departureAdminId: s.departure_admin_id,
            departureAdminName: s.departure_admin_id, // Fallback to ID
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

    async getAdmins(): Promise<{ id: string, name: string }[]> {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('role', 'ADMIN');

        if (error) throw error;

        return (data || []).map((d: { id: string, full_name: string | null }) => ({
            id: d.id,
            name: d.full_name || 'Sin nombre'
        }));
    },

    async getSaleDetail(id: string): Promise<Sale> {
        const { data, error } = await supabase
            .from('sales')
            .select(`
                *,
                sale_items (*),
                clients (*)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        return {
            id: data.id,
            branchId: data.branch_id,
            clientId: data.client_id,
            clientName: data.clients?.name,
            subtotal: data.subtotal || 0,
            discountAmount: data.discount_amount || 0,
            iva: data.iva || 0,
            total: data.total,
            status: data.status,
            paymentMethod: data.payment_method,
            createdAt: data.created_at,
            isWholesale: data.is_wholesale,
            paymentType: data.payment_type,
            departureAdminId: data.departure_admin_id,
            departureAdminName: data.departure_admin_id,
            billingBank: data.billing_bank,
            billingSocialReason: data.billing_social_reason,
            billingInvoiceNumber: data.billing_invoice_number,
            deliveryReceiverName: data.delivery_receiver_name,
            items: (data.sale_items || []).map((i: any) => ({
                productId: i.product_id,
                productName: i.product_name,
                quantity: i.quantity,
                price: i.unit_price,
                total: i.quantity * i.unit_price
            }))
        };
    },

    // --- VENTAS A MUNICIPIO ---

    async createMunicipalSale(
        branchId: string,
        items: { productId: string; productName: string; quantity: number; price: number }[],
        saleData: {
            municipality: string;
            department?: string;
            contactName?: string;
            socialReason?: string;
            rfc?: string;
            invoiceNumber?: string;
            authorizedExitBy?: string;
            deliveryReceiver: string;
            paymentType: 'contado' | 'credito';
            paymentMethod: 'cash' | 'card' | 'transfer' | 'check';
            creditDays?: number;
            subtotal: number;
            discountAmount?: number;
            iva: number;
            total: number;
            notes?: string;
        }
    ): Promise<void> {
        // 1. Si es crédito, verificar que la cuenta no esté bloqueada
        if (saleData.paymentType === 'credito') {
            const account = await this.getMunicipalAccount(saleData.municipality, branchId);
            if (account?.is_blocked) {
                throw new Error(`La cuenta del municipio "${saleData.municipality}" está bloqueada. Contacte al administrador.`);
            }
        }

        // 2. Obtener folio
        const { data: folio } = await supabase.rpc('get_next_folio', {
            p_branch_id: branchId,
            p_folio_type: 'municipal'
        });

        // 3. Crear la venta principal
        const { data: sale, error: saleError } = await supabase
            .from('municipal_sales')
            .insert({
                branch_id: branchId,
                folio: folio || 0,
                municipality: saleData.municipality,
                department: saleData.department || null,
                contact_name: saleData.contactName || null,
                social_reason: saleData.socialReason || null,
                rfc: saleData.rfc || null,
                invoice_number: saleData.invoiceNumber || null,
                authorized_exit_by: (saleData.authorizedExitBy && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saleData.authorizedExitBy))
                    ? saleData.authorizedExitBy
                    : null,
                delivery_receiver: saleData.deliveryReceiver,
                payment_type: saleData.paymentType,
                payment_method: saleData.paymentMethod,
                credit_days: saleData.creditDays || 0,
                subtotal: saleData.subtotal,
                discount_amount: saleData.discountAmount || 0,
                iva: saleData.iva,
                total: saleData.total,
                notes: saleData.notes || null,
            })
            .select()
            .single();

        if (saleError) throw saleError;

        // 4. Insertar ítems
        const saleItems = items.map(item => ({
            sale_id: sale.id,
            product_id: item.productId,
            product_name: item.productName,
            quantity: item.quantity,
            unit_price: item.price,
            total_price: item.price * item.quantity,
        }));

        const { error: itemsError } = await supabase
            .from('municipal_sale_items')
            .insert(saleItems);

        if (itemsError) throw itemsError;

        // 5. Ajustar inventario
        for (const item of items) {
            const { data: inv } = await supabase
                .from('inventory')
                .select('stock')
                .eq('product_id', item.productId)
                .eq('branch_id', branchId)
                .single();

            if (inv) {
                await supabase
                    .from('inventory')
                    .update({ stock: Math.max(0, inv.stock - item.quantity) })
                    .eq('product_id', item.productId)
                    .eq('branch_id', branchId);
            }
        }

        // 6. Si es a crédito → registrar cargo en la cuenta del municipio
        if (saleData.paymentType === 'credito') {
            const account = await this.getOrCreateMunicipalAccount(saleData.municipality, branchId);
            // Incrementar saldo
            await supabase
                .from('municipal_accounts')
                .update({ balance: account.balance + saleData.total, updated_at: new Date().toISOString() })
                .eq('id', account.id);
            // Log de movimiento
            await supabase.from('municipal_payments').insert({
                account_id: account.id,
                sale_id: sale.id,
                type: 'cargo',
                amount: saleData.total,
                notes: `Venta #M-${String(folio || 0).padStart(4, '0')}${saleData.creditDays ? ` — ${saleData.creditDays} días de crédito` : ''}`,
            });
        }
    },

    async getMunicipalSales(branchId?: string, startDate?: string, endDate?: string): Promise<any[]> {
        let query = supabase
            .from('municipal_sales')
            .select(`
                *,
                branches (name),
                items:municipal_sale_items (
                    *,
                    products (name, sku)
                )
            `)
            .order('created_at', { ascending: false });

        if (branchId) query = query.eq('branch_id', branchId);
        if (startDate) query = query.gte('created_at', `${startDate}T00:00:00-06:00`);
        if (endDate) query = query.lte('created_at', `${endDate}T23:59:59-06:00`);

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map((s: any) => ({
            ...s,
            branchName: s.branches?.name,
            createdAt: s.created_at,
        }));
    },

    // --- CUENTAS DE CRÉDITO MUNICIPAL ---

    async getMunicipalAccounts(branchId?: string): Promise<any[]> {
        let query = supabase
            .from('municipal_accounts')
            .select(`
                *,
                payments:municipal_payments (
                    id, type, amount, notes, created_at
                )
            `)
            .order('municipality', { ascending: true });

        if (branchId) query = query.eq('branch_id', branchId);

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map((a: any) => ({
            ...a,
            payments: (a.payments || []).sort((x: any, y: any) =>
                new Date(y.created_at).getTime() - new Date(x.created_at).getTime()
            ),
        }));
    },

    async getMunicipalAccount(municipality: string, branchId: string): Promise<any | null> {
        const { data } = await supabase
            .from('municipal_accounts')
            .select('*')
            .eq('municipality', municipality)
            .eq('branch_id', branchId)
            .maybeSingle();
        return data;
    },

    async getOrCreateMunicipalAccount(municipality: string, branchId: string): Promise<any> {
        const existing = await this.getMunicipalAccount(municipality, branchId);
        if (existing) return existing;

        const { data, error } = await supabase
            .from('municipal_accounts')
            .insert({ municipality, branch_id: branchId, balance: 0 })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async addMunicipalPayment(
        accountId: string,
        currentBalance: number,
        type: 'abono' | 'pago_completo',
        amount: number,
        notes: string,
        userId: string
    ): Promise<void> {
        const newBalance = type === 'pago_completo' ? 0 : Math.max(0, currentBalance - amount);

        await supabase
            .from('municipal_accounts')
            .update({ balance: newBalance, updated_at: new Date().toISOString() })
            .eq('id', accountId);

        const { error } = await supabase.from('municipal_payments').insert({
            account_id: accountId,
            type,
            amount,
            notes: notes || null,
            registered_by: (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) ? userId : null,
        });
        if (error) throw error;
    },

    async blockMunicipalAccount(accountId: string, reason: string): Promise<void> {
        const { error } = await supabase
            .from('municipal_accounts')
            .update({ is_blocked: true, block_reason: reason, updated_at: new Date().toISOString() })
            .eq('id', accountId);
        if (error) throw error;
    },

    async unblockMunicipalAccount(accountId: string): Promise<void> {
        const { error } = await supabase
            .from('municipal_accounts')
            .update({ is_blocked: false, block_reason: null, updated_at: new Date().toISOString() })
            .eq('id', accountId);
        if (error) throw error;
    },

    async setCreditLimit(accountId: string, limit: number): Promise<void> {
        const { error } = await supabase
            .from('municipal_accounts')
            .update({ credit_limit: limit, updated_at: new Date().toISOString() })
            .eq('id', accountId);
        if (error) throw error;
    },
};

