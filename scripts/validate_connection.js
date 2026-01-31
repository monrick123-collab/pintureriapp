import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rqrumtpqutzdbwtqjaoh.supabase.co';
const supabaseKey = 'sb_publishable_rTrOdDmjiGGzl-jYeEcbeQ_pJMTSMgf';

const supabase = createClient(supabaseUrl, supabaseKey);

async function validate() {
    console.log("---------------------------------------------------------");
    console.log("🔍 Validando conexión a Supabase y Schema Update...");
    console.log("---------------------------------------------------------");

    // 1. Validate Products Schema Update
    console.log("\n1. Verificando tabla PRODUCTS (Columnas nuevas)...");
    // We try to select the new columns. If they don't exist, this might error or return null.
    const { data: products, error: pError } = await supabase
        .from('products')
        .select('id, name, min_stock, location')
        .limit(1);

    if (pError) {
        console.error("❌ Error conectando a products:", pError.message);
        if (pError.message.includes('column')) {
            console.error("   ❌ Causa probable: No se han corrido las migraciones SQL.");
        }
    } else {
        console.log("✅ Conexión exitosa. Filas encontradas:", products?.length);
        if (products && products.length > 0) {
            const prod = products[0];
            // console.log("   Muestra:", prod);

            if (prod.min_stock !== undefined) {
                console.log("   ✅ Columna 'min_stock' detectada correctamente.");
            } else {
                console.warn("   ⚠️ Columna 'min_stock' NO detectada en la respuesta. ¿Corriste la migración?");
            }
        } else {
            console.log("   ⚠️ La tabla está vacía, pero la conexión funciona.");
        }
    }

    // 2. Validate Branches Schema Update
    console.log("\n2. Verificando tabla BRANCHES (Config JSON)...");
    const { data: branches, error: bError } = await supabase
        .from('branches')
        .select('id, name, config')
        .limit(1);

    if (bError) {
        console.error("❌ Error conectando a branches:", bError.message);
    } else {
        console.log("✅ Conexión exitosa. Filas encontradas:", branches?.length);
        if (branches && branches.length > 0) {
            const branch = branches[0];
            if (branch.config !== undefined) {
                console.log("   ✅ Columna 'config' detectada correctamente.");
            } else {
                console.log("   ⚠️ Columna 'config' no presente (puede ser null pero la query no falló).");
            }
        }
    }
}

validate();
