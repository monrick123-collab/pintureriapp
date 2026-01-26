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
            contact_info: supplier.contactInfo,
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
        if (updates.contactInfo) dbUpdates.contact_info = updates.contactInfo;
        if (updates.paymentTermsDays !== undefined) dbUpdates.payment_terms_days = updates.paymentTermsDays;

        const { error } = await supabase.from('suppliers').update(dbUpdates).eq('id', id);
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

    // --- DASHBOARD METRICS (Mock implementation until RPCs exist) ---
    async getFinanceMetrics() {
        // En futuro, llamar a un RPC que calcule todo en DB
        // Por ahora lo hacemos en cliente (ineficiente pero funcional para prototipo)

        // 1. Cuentas por Pagar (Pendientes + Autorizadas)
        const { data: invoices } = await supabase
            .from('supplier_invoices')
            .select('amount')
            .in('status', ['received', 'verified', 'authorized']);

        const accountsPayable = invoices?.reduce((sum, inv) => sum + inv.amount, 0) || 0;

        // 2. Gastos del Mes (Pagos realizados + Rentas + Nomina simple)
        // Mock placeholder
        const monthlyExpenses = accountsPayable * 0.5; // Dummy logic

        // 3. Ventas Mes
        // Mock placeholder
        const monthlySales = 120000;

        return {
            accountsPayable,
            monthlyExpenses,
            monthlySales,
            netIncome: monthlySales - monthlyExpenses
        };
    }
};
