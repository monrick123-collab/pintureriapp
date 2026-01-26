
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rqrumtpqutzdbwtqjaoh.supabase.co'
const supabaseKey = 'sb_publishable_rTrOdDmjiGGzl-jYeEcbeQ_pJMTSMgf'
const supabase = createClient(supabaseUrl, supabaseKey)

async function validate() {
    console.log("Validating database tables...")

    const tables = ['suppliers', 'supplier_invoices', 'leases', 'supplier_payments', 'price_lists']
    let allGood = true

    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('count', { count: 'exact', head: true })
        if (error) {
            console.error(`❌ Table '${table}' check failed:`, error.message)
            allGood = false
        } else {
            console.log(`✅ Table '${table}' exists.`)
        }
    }

    if (allGood) {
        console.log("\nAll finance tables validated successfully!")
    } else {
        console.log("\nSome tables are missing or inaccessible.")
        process.exit(1)
    }
}

validate()
