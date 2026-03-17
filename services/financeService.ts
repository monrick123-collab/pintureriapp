import { supabase } from './supabase';
import { Supplier, SupplierInvoice, Lease, LeasePayment } from '../types';

export const FinanceService = {
    // --- PROVEEDORES ---
    async getSuppliers(): Promise<Supplier[]> {
        const { data, error } = await supabase
            .from('suppliers')
            .select('*')
            .order('name');
        if (error) throw error;
        return data || [];
    },

    async createSupplier(supplier: Omit<Supplier, 'id' | 'createdAt'>) {
        const { data, error } = await supabase.from('suppliers').insert({
            name: supplier.name,
            tax_id: supplier.taxId,
            contact_info: supplier.contactInfo, // Legacy
            contact_name: supplier.contactName,
            contact_phone: supplier.contactPhone,
            contact_email: supplier.contactEmail,
            payment_terms_days: supplier.paymentTermsDays,
            commercial_conditions: supplier.commercialConditions || {}
        }).select().single();
        if (error) throw error;
        return data;
    },

    async updateSupplier(id: string, updates: Partial<Supplier>) {
        const dbUpdates: any = {};
        if (updates.name) dbUpdates.name = updates.name;
        if (updates.taxId) dbUpdates.tax_id = updates.taxId;

        // Contact fields
        if (updates.contactInfo) dbUpdates.contact_info = updates.contactInfo;
        if (updates.contactName) dbUpdates.contact_name = updates.contactName;
        if (updates.contactPhone) dbUpdates.contact_phone = updates.contactPhone;
        if (updates.contactEmail) dbUpdates.contact_email = updates.contactEmail;

        if (updates.paymentTermsDays !== undefined) dbUpdates.payment_terms_days = updates.paymentTermsDays;

        const { error } = await supabase.from('suppliers').update(dbUpdates).eq('id', id);
        if (error) throw error;
    },

    async deleteSupplier(id: string) {
        const { error } = await supabase.from('suppliers').delete().eq('id', id);
        if (error) throw error;
    },

    // --- FACTURAS ---
    async getInvoices(statusFilter?: string): Promise<SupplierInvoice[]> {
        let query = supabase.from('supplier_invoices').select('*, suppliers(name)');

        if (statusFilter && statusFilter !== 'all') {
            query = query.eq('status', statusFilter);
        }

        const { data, error } = await query.order('due_date', { ascending: true });

        if (error) throw error;
        return data?.map(d => ({
            id: d.id,
            supplierId: d.supplier_id,
            supplierName: d.suppliers?.name,
            invoiceFolio: d.invoice_folio,
            amount: d.amount,
            status: d.status,
            issueDate: d.issue_date,
            dueDate: d.due_date,
            pdfUrl: d.pdf_url,
            xmlUrl: d.xml_url,
            notes: d.notes,
            createdAt: d.created_at
        })) || [];
    },

    async createInvoice(invoice: Omit<SupplierInvoice, 'id' | 'createdAt' | 'status' | 'amount'> & { amount: number }) {
        const { data, error } = await supabase.from('supplier_invoices').insert({
            supplier_id: invoice.supplierId,
            invoice_folio: invoice.invoiceFolio,
            amount: invoice.amount,
            issue_date: invoice.issueDate,
            due_date: invoice.dueDate,
            status: 'received'
        }).select().single();

        if (error) throw error;
        return data;
    },

    async updateInvoiceStatus(id: string, status: 'verified' | 'authorized' | 'paid' | 'rejected') {
        const { error } = await supabase.from('supplier_invoices').update({ status }).eq('id', id);
        if (error) throw error;
    },

    // --- ARRENDAMIENTOS ---
    async getLeases(): Promise<Lease[]> {
        const { data, error } = await supabase.from('leases').select('*').eq('active', true);
        if (error) throw error;
        // Map snake_case to camelCase
        return (data || []).map(l => ({
            id: l.id,
            propertyName: l.property_name,
            landlordName: l.landlord_name,
            monthlyAmount: l.monthly_amount,
            paymentDay: l.payment_day,
            contractStart: l.contract_start,
            contractEnd: l.contract_end,
            active: l.active,
            branchId: l.branch_id
        }));
    },

    async registerLeasePayment(payment: { leaseId: string, amount: number, paymentDate: string, notes?: string }) {
        const { error } = await supabase.from('lease_payments').insert({
            lease_id: payment.leaseId,
            amount: payment.amount,
            payment_date: payment.paymentDate,
            notes: payment.notes
        });
        if (error) throw error;
    },

    // --- DASHBOARD METRICS ---
    async getFinanceMetrics() {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

        // 1. Cuentas por Pagar (Pendientes + Autorizadas)
        const { data: invoices } = await supabase
            .from('supplier_invoices')
            .select('amount')
            .in('status', ['received', 'verified', 'authorized']);

        const accountsPayable = invoices?.reduce((sum, inv) => sum + inv.amount, 0) || 0;

        // 2. Gastos del Mes (facturas pagadas este mes)
        const { data: paidInvoices } = await supabase
            .from('supplier_invoices')
            .select('amount')
            .eq('status', 'paid')
            .gte('due_date', monthStart.split('T')[0])
            .lt('due_date', monthEnd.split('T')[0]);

        const monthlyExpenses = paidInvoices?.reduce((sum, inv) => sum + inv.amount, 0) || 0;

        // 3. Ventas del Mes
        const { data: salesData } = await supabase
            .from('sales')
            .select('total')
            .gte('created_at', monthStart)
            .lt('created_at', monthEnd);

        const monthlySales = salesData?.reduce((sum, s) => sum + s.total, 0) || 0;

        return {
            accountsPayable,
            monthlyExpenses,
            monthlySales,
            netIncome: monthlySales - monthlyExpenses
        };
    },

    async getMonthlyFinancials(months = 6): Promise<{ month: string; ingresos: number; gastos: number }[]> {
        const results: { month: string; ingresos: number; gastos: number }[] = [];
        const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

        for (let i = months - 1; i >= 0; i--) {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
            const startStr = start.toISOString();
            const endStr = end.toISOString();
            const startDate = startStr.split('T')[0];
            const endDate = endStr.split('T')[0];

            const [{ data: sales }, { data: expenses }] = await Promise.all([
                supabase.from('sales').select('total').gte('created_at', startStr).lt('created_at', endStr),
                supabase.from('supplier_invoices').select('amount').eq('status', 'paid').gte('due_date', startDate).lt('due_date', endDate)
            ]);

            results.push({
                month: MONTH_NAMES[start.getMonth()],
                ingresos: sales?.reduce((sum, s) => sum + s.total, 0) || 0,
                gastos: expenses?.reduce((sum, e) => sum + e.amount, 0) || 0
            });
        }

        return results;
    },

    async getExpenseDistribution(): Promise<{ category: string; value: number }[]> {
        const [{ data: invoices }, { data: leasePayments }] = await Promise.all([
            supabase.from('supplier_invoices').select('amount, suppliers(name)').eq('status', 'paid'),
            supabase.from('lease_payments').select('amount')
        ]);

        const supplierTotals: Record<string, number> = {};
        (invoices || []).forEach((inv: any) => {
            const name = inv.suppliers?.name || 'Proveedor';
            supplierTotals[name] = (supplierTotals[name] || 0) + inv.amount;
        });

        const result = Object.entries(supplierTotals)
            .map(([category, value]) => ({ category, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6);

        const rentas = (leasePayments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
        if (rentas > 0) result.push({ category: 'Rentas', value: rentas });

        return result;
    }
};
