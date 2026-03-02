import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rqrumtpqutzdbwtqjaoh.supabase.co';
const supabaseKey = 'sb_publishable_rTrOdDmjiGGzl-jYeEcbeQ_pJMTSMgf';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSale() {
    const saleItems = [{
        productId: '6d07ab7b-3b3d-4c3d-bc87-9915ecbf3d37', // Dummy UUID from DB maybe?
        productName: 'Pintura Test',
        quantity: 1,
        price: 100,
        total: 100
    }];
    
    // We need a real product ID to avoid FK and stock errors. Let's fetch one.
    const { data: prods } = await supabase.from('inventory').select('product_id, branch_id, stock').eq('branch_id', 'BR-CENTRO').gt('stock', 0).limit(1);
    const prod = prods?.[0];
    if (!prod) {
        console.error("No stock available for test");
        process.exit(1);
    }

    const items = [{
        product_id: prod.product_id,
        product_name: 'Test Product',
        quantity: 1,
        price: 100,
        total: 100
    }];

    const { data, error } = await supabase.rpc('process_sale', {
        p_branch_id: 'BR-CENTRO',
        p_total: 116,
        p_payment_method: 'cash',
        p_items: items,
        p_subtotal: 100,
        p_discount_amount: 0,
        p_iva: 16,
        p_client_id: null,
        p_is_wholesale: false,
        p_payment_type: 'contado',
        p_departure_admin_id: null,
        p_credit_days: 0,
        p_billing_bank: null,
        p_billing_social_reason: null,
        p_billing_invoice_number: null,
        p_delivery_receiver_name: null
    });
    console.log("Sale result:", data, "Error:", error);
    process.exit(0);
}

testSale().catch(console.error);
