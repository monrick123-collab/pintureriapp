# SKILL: db-connection-rules

Cuando se active esta skill, aplica estas reglas sobre cómo funciona la base de datos en PinturaMax antes de escribir cualquier consulta o migración.

---

## Cliente Supabase

**Archivo:** `services/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// IMPORTANTE: Si faltan las variables de entorno, el cliente se crea con
// valores placeholder ('https://placeholder.supabase.co', 'placeholder-key').
// Esto impide que la app crashee al arrancar, pero todas las queries fallan silenciosamente.
// No confundir "la app cargó" con "la DB está conectada".
if (!supabaseUrl || !supabaseAnonKey) {
    if (import.meta.env.DEV) {
        console.warn('⚠️ Alerta: Faltan variables de entorno de Supabase.');
    }
}

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key'
);
```

**Regla crítica:** La app usa la clave `anon`. No hay sesiones JWT de usuario activas en las consultas. Todo el acceso es bajo el rol `anon` de PostgreSQL.

---

## RLS (Row Level Security) — Regla de oro

**Toda tabla nueva DEBE tener esta política:**

```sql
ALTER TABLE IF EXISTS public.nueva_tabla ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.nueva_tabla;
CREATE POLICY "Enable All for Anon" ON public.nueva_tabla
  FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.nueva_tabla TO anon;
```

**Sin esta política:**
- `SELECT` devuelve array vacío (sin error visible)
- `INSERT` retorna `data: []` sin error → RLS bloqueando con `WITH CHECK`
- `UPDATE`/`DELETE` fallan silenciosamente

**Señal en código actual** (`notificationService.ts`):
```typescript
// Insert sin .single() para evitar error 406 cuando RLS bloquea
const { data, error } = await supabase
  .from('notifications')
  .insert([payload])
  .select(); // NO usar .single() en inserts que puedan ser bloqueados por RLS

const row = data?.[0];
if (!row) {
  // data === [] sin error → RLS está bloqueando
  console.warn('Notification insert returned no rows – likely blocked by RLS.');
  return null;
}
```

**Toda nueva función RPC también necesita:**
```sql
GRANT EXECUTE ON FUNCTION public.nombre_funcion TO anon;
```

### Historia de RLS en este proyecto (importante)

Hay una migración abandonada `migration_security_rls_strict.sql` que intentó implementar políticas JWT (`TO authenticated`). **Esto no funciona** porque la app usa clave `anon`, no sesiones JWT. Migraciones posteriores (`migration_fix_rls_all.sql`, `migration_master_anon_policies.sql`, y múltiples `migration_fix_*_anon.sql`) revirtieron al modelo `anon`. Si ves políticas `TO authenticated` en una tabla nueva, están efectivamente muertas para esta app.

---

## Comportamiento real de inventario

### Constraint de stock no-negativo

Existe `migration_fix_negative_stock.sql` que agregó:
```sql
ALTER TABLE inventory
ADD CONSTRAINT inventory_stock_non_negative CHECK (stock >= 0);
```

**Esto significa:** Si una venta intenta descontar más stock del disponible, la transacción completa falla con error de constraint. Algunos RPCs antiguos tienen comentarios diciendo "permitimos stock negativo temporal" — esos comentarios son obsoletos. El constraint está activo.

### Excepción documentada: `updateStock()` hace UPDATE directo

`inventoryService.ts:178` tiene este método:
```typescript
async updateStock(productId: string, branchId: string, newStock: number) {
    if (newStock < 0) throw new Error('El stock no puede ser negativo');
    await supabase.from('inventory').upsert(
        { product_id: productId, branch_id: branchId, stock: newStock },
        { onConflict: 'product_id,branch_id' }
    );
}
```

**La regla correcta** (no "nunca hacer UPDATE directo"):
- ❌ PROHIBIDO: UPDATE directo en flujos operativos (ventas, traspasos, resurtidos, devoluciones)
- ✅ PERMITIDO: `updateStock()` para ajustes manuales de inventario por admin
- ✅ PERMITIDO: `bulkCreateProducts()` inicializa inventario con `stock: 0` en todas las sucursales

### El bodeguero principal es siempre `'BR-MAIN'`

El RPC `confirm_restock_arrival` (en `migration_fix_inventory_upsert.sql`) hardcodea:
```sql
-- Descontar de Hub (Bodega Principal)
INSERT INTO public.inventory (product_id, branch_id, stock, updated_at)
VALUES (v_req.product_id, 'BR-MAIN', -(v_req.quantity), now())
ON CONFLICT (product_id, branch_id) DO UPDATE ...
```

**Este es el único ID hardcodeado que existe por diseño en producción.** La bodega principal SIEMPRE es `'BR-MAIN'`. Cualquier resurtido siempre deduce de ahí. No crear sucursales "bodega" con otros IDs.

---

## Comportamiento real de `process_sale` RPC

### Folio por `MAX(folio)+1` — No por `get_next_folio`

El RPC `process_sale` genera folios así:
```sql
SELECT COALESCE(MAX(folio), 0) + 1 INTO v_folio
FROM public.sales WHERE branch_id = p_branch_id;
```

Esto es un `MAX+1` inside the transaction, **no usa `get_next_folio()`**. Bajo PostgreSQL con `READ COMMITTED`, dos transacciones concurrentes podrían calcular el mismo folio. En la práctica esto no ha causado problemas porque las ventas raramente son concurrentes desde la misma sucursal. Sin embargo, `get_next_folio()` (si existe y usa una secuencia) sería más seguro.

### `process_sale` overridea `p_payment_status` silenciosamente

```sql
-- En el RPC (merged_process_sale.sql):
IF p_payment_method IN ('transfer', 'cash') AND p_payment_status = 'approved' THEN
    p_payment_status := 'pending';
END IF;
```

**Esto es un business rule encoded en el RPC:** pasar `payment_status: 'approved'` para métodos `cash` o `transfer` será ignorado y se convierte a `'pending'`. Solo `payment_method: 'credit'` o `'card'` puede llegar como `approved`. Si necesitas que una venta cash/transfer sea aprobada directamente, hay que hacerlo con un UPDATE posterior (via `approvePayment()`).

---

## Tres sistemas de venta separados

La app tiene tres tablas de ventas independientes:

| Tabla | Módulo | Vista |
|-------|--------|-------|
| `sales` + `sale_items` | Retail (POS) + Mayoreo | `POS.tsx`, `WholesalePOS.tsx` |
| `municipal_sales` + `municipal_sale_items` | Municipal | `MunicipalPOS.tsx` |
| `wholesale_accounts` + `wholesale_payments` | Crédito mayoreo | `WholesalePOS.tsx` |
| `municipal_accounts` + `municipal_payments` | Crédito municipal | `MunicipalPOS.tsx` |

Las ventas municipales tienen su **propio RPC de aprobación**, no usan `approvePayment()` de sales normales.

---

## Tablas y sus campos reales

### `products`
```
sku, name, category, brand, description, price, wholesale_price,
wholesale_min_qty, package_type, min_stock, max_stock, location,
cost_price, unit_measure, supplier_id, active, image, status
```

### `inventory`
```
product_id, branch_id, stock, updated_at
-- Unique constraint en (product_id, branch_id)
-- CHECK constraint: stock >= 0 (migration_fix_negative_stock.sql)
-- Flujos que usan RPC: process_sale, confirm_transfer_receipt, confirm_restock_arrival, process_return
-- Excepción legítima: updateStock() en inventoryService para ajustes manuales admin
```

### `branches`
```
id, name, address, manager, phone, status, type
-- 'BR-MAIN' es la bodega principal (hardcodeado en RPCs de resurtido)
```

### `profiles`
```
id, email, full_name, role, branch_id, avatar_url
```

### `sales`
```
id, folio, branch_id, client_id, total, subtotal, discount_amount, iva,
payment_method, payment_status, payment_type, is_wholesale,
transfer_reference, promotion_request_id,
pending_since,           -- timestamp cuando entró en status 'pending'
rejection_reason,        -- si fue rechazado
cancelled_at,            -- si fue cancelado
cancelled_by,            -- UUID del admin que canceló
cancellation_reason,     -- razón de cancelación
departure_admin_id,      -- admin que autorizó la salida
credit_days,
billing_bank, billing_social_reason, billing_invoice_number,
delivery_receiver_name,
created_at, created_by
```

### `sale_items`
```
id, sale_id, product_id, product_name, quantity,
unit_price,   -- ← CAMPO REAL: unit_price (NO 'price')
total,
created_at
```
**Nota histórica:** Hubo una migración (`migration_merged_process_sale.sql`) con un comentario indicando confusión entre `price` y `unit_price`. El campo real en DB es `unit_price`. El mapeo en `salesService.ts` toma `i.unit_price` → `price` (frontend). No confundir.

### `municipal_sales`
```
id, folio (SERIAL), branch_id, municipality, department, contact_name,
social_reason, rfc, invoice_number, authorized_exit_by, delivery_receiver,
payment_type ('contado'|'credito'), payment_method ('cash'|'card'|'transfer'|'check'),
credit_days, subtotal, iva, total, notes, transfer_reference,
payment_status ('pending'|'approved'|'rejected'), pending_since, rejection_reason,
created_at, updated_at
```

### `municipal_sale_items`
```
id, municipal_sale_id, product_id, product_name, quantity, unit_price, total, created_at
```

### `municipal_accounts`
```
id, branch_id, municipality (UNIQUE), balance, credit_limit,
is_blocked, block_reason, blocked_at, last_payment_date, created_at, updated_at
-- NUNCA actualizar balance directamente: usar RPC add_municipal_payment
```

### `municipal_payments`
```
id, municipal_account_id, amount, payment_type, notes, registered_by, created_at
```

### `wholesale_accounts`
```
id, client_id, balance, credit_limit, updated_at
-- NUNCA actualizar balance directamente: usar RPC add_wholesale_charge/add_wholesale_payment
-- El RPC usa SELECT ... FOR UPDATE para prevenir Lost Update concurrente
```

### `wholesale_payments`
```
id, wholesale_account_id, amount, payment_type ('cargo'|'abono'|'pago_completo'),
sale_id, notes, registered_by, created_at
```

### `returns`
```
id, folio, branch_id, product_id, quantity, reason, status,
authorized_by, transported_by, received_by, created_at, updated_at
-- status: 'pending_authorization' | 'approved' | 'received_at_warehouse' | 'closed' | 'rejected'
```

### `stock_transfers` / `stock_transfer_items`
```
stock_transfers: id, folio, from_branch_id, to_branch_id, status, notes, created_at, updated_at
stock_transfer_items: id, transfer_id, product_id, quantity
-- status: 'pending' | 'approved' | 'shipped' | 'received' | 'rejected'
```

### `restock_requests`
```
id, branch_id, product_id, quantity, status, created_at, shipped_at,
approved_at,   -- timestamp al aprobar (se agrega vía updateRestockStatus)
received_at    -- timestamp al confirmar llegada (via RPC)
```

### `restock_sheets` / `restock_items`
```
restock_sheets: id, folio, branch_id, total_amount, status, departure_time, arrival_time, created_at
restock_items: id, sheet_id, product_id, quantity, unit_price, total_price
```

### `coin_change_requests`
```
id, folio, branch_id, amount, breakdown_details (jsonb), status,
requester_id, receiver_id, collected_by, created_at
-- status: 'pending' | 'completed' | 'cancelled'
```

### `notifications`
```
id, user_id, target_role, target_branch_id, title, message,
action_url, is_read, created_at
-- Filtrado por target_branch_id se hace CLIENT-SIDE (no en DB)
-- La query trae hasta 50 notificaciones y filtra en JS
```

### `clients`
```
id, name, email, phone, tax_id, address, type, municipality, locality,
credit_limit, credit_days, is_active_credit, is_municipality, extra_percentage
```

### `discount_requests`
```
id, requester_id, requester_name, branch_id, amount, type ('percentage'|'fixed'),
status ('pending'|'approved'|'rejected'|'used'), reason, items (jsonb), created_at
```

### `packaging_requests`
```
id, bulk_product_id, target_package_type, target_product_id, quantity_drum,
liters_requested, packages_produced, status, branch_id, created_by, created_at
```

### `supplier_invoices`
```
id, supplier_id, invoice_folio, amount, status, issue_date, due_date, pdf_url, xml_url
-- status: 'received' | 'verified' | 'authorized' | 'paid' | 'rejected'
```

### `leases`
```
id, property_name, landlord_name, monthly_amount, payment_day,
contract_start, contract_end, active, branch_id
```

### `shipping_orders`
```
id, entity_type, entity_id, origin_branch_id, destination_branch_id,
carrier, tracking_number, status, estimated_delivery_date, notes
```

### `internal_consumption`
```
id, product_id, branch_id, user_id, quantity, reason, cost_at_time, created_at
```

### `branch_bulk_inventory`
```
id, branch_id, product_id, available_liters, updated_at
```

---

## Patrones de consulta (PostgREST)

### SELECT simple
```typescript
const { data, error } = await supabase
  .from('products')
  .select('*')
  .order('name', { ascending: true });
```

### SELECT con joins
```typescript
const { data, error } = await supabase
  .from('sales')
  .select(`
    *,
    sale_items (*),
    clients (name),
    branch:branches(name)
  `)
  .eq('branch_id', branchId)
  .order('created_at', { ascending: false });
```

### SELECT con filtro OR (ej: traspasos bidireccionales)
```typescript
const { data, error } = await supabase
  .from('stock_transfers')
  .select('*, stock_transfer_items(*)')
  .or(`from_branch_id.eq.${branchId},to_branch_id.eq.${branchId}`);
```

### Filtro por rango de fechas (timezone México -06:00)
```typescript
query = query
  .gte('created_at', `${startDate}T00:00:00-06:00`)
  .lte('created_at', `${endDate}T23:59:59.999-06:00`);
```

### Sentinel `'ALL'` para "sin filtro de sucursal"
```typescript
// Patrón usado en getProductsByBranch, getInternalConsumptionHistory, getBulkInventory:
if (branchId === 'ALL') return this.getProducts();   // sin filtro
if (branchId && branchId !== 'ALL') {
    query = query.eq('branch_id', branchId);
}
// 'ALL' no es un branch_id real, es un sentinel para "todas las sucursales"
```

### Upsert de inventario (inicialización)
```typescript
// Solo para inicializar stock en productos nuevos o bulk imports
await supabase
  .from('inventory')
  .upsert(
    { product_id: productId, branch_id: branchId, stock: newStock },
    { onConflict: 'product_id,branch_id' }
  );
// Para flujos operativos, usar RPC correspondiente
```

### Single record
```typescript
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single();
// .single() lanza error si retorna 0 o >1 filas
// NO usar .single() en inserts donde RLS puede bloquear (retornaría error 406)
```

### IN filter (múltiples valores)
```typescript
// Filtrar por array de estatus:
query = query.in('status', ['pending_admin', 'approved_warehouse']);
// Filtrar múltiples roles:
.in('role', ['ADMIN', 'STORE_MANAGER'])
```

### Llamada a RPC
```typescript
const { data, error } = await supabase.rpc('nombre_rpc', {
  p_param1: valor1,
  p_param2: valor2
});
if (error) throw error;
```

### Mapeo snake_case → camelCase (patrón manual)
```typescript
// NO hay ORM. Cada servicio mapea manualmente.
// inventoryService.ts tiene mapDbProduct() local.
// Patrón de mapeo en returns del select:
return (data || []).map((r: any) => ({
    id: r.id,
    branchId: r.branch_id,          // snake_case → camelCase
    branchName: r.branches?.name,   // join accedido con optional chaining
    productName: r.products?.name,
    createdAt: r.created_at,
    // parseFloat/parseInt para valores numéricos de Supabase:
    stock: parseFloat(r.stock || '0'),
    quantity: parseInt(r.quantity || '0'),
}));
```

---

## Errores frecuentes de DB y diagnóstico

| Síntoma | Causa | Solución |
|---------|-------|----------|
| SELECT retorna `[]` sin error | Falta política RLS `anon` en SELECT | Agregar `CREATE POLICY "Enable All for Anon"` |
| INSERT retorna `data: []` sin error | Falta `WITH CHECK (true)` en política | Recrear política con `WITH CHECK (true)` |
| Error `PGRST301` | RLS bloquea operación | Verificar política en tabla |
| Error en RPC "function not found" | Falta `GRANT EXECUTE TO anon` | `GRANT EXECUTE ON FUNCTION ...` |
| Venta falla con "constraint violation" | Stock insuficiente → constraint `inventory_stock_non_negative` | Verificar stock antes de venta; no hay stock negativo permitido |
| Balance de cuenta mayoreo/municipal incorrecto | UPDATE directo en lugar de RPC | Usar `add_wholesale_charge`/`add_municipal_payment` |
| Folio duplicado en ventas concurrentes | Race condition en `MAX(folio)+1` dentro del RPC | Poco probable en uso normal; si ocurre, considerar usar secuencia dedicada |
| Venta cash/transfer llega como 'pending' aunque se mandó 'approved' | RPC `process_sale` overridea el status | Es comportamiento intencional del RPC; aprobar después con `approvePayment()` |
| App carga pero todas las queries retornan vacío | Faltan variables de entorno VITE_SUPABASE_* | El cliente usa placeholder values; revisar .env |
| `updated_at` falla en `municipal_sales` | Columna puede no existir en todas las instancias | `paymentExpiryService.ts:54` tiene el workaround documentado |

---

## Reglas para migraciones

1. Nombre de archivo: `migrations/migration_descripcion_breve.sql`
2. Nombres especiales `RUN_IN_SUPABASE_*.sql` = scripts de emergencia puntuales, no secuencia normal
3. Siempre incluir `DROP POLICY IF EXISTS` antes de `CREATE POLICY`
4. Siempre incluir `DROP FUNCTION IF EXISTS` antes de `CREATE OR REPLACE FUNCTION`
5. Toda función nueva: `SECURITY DEFINER` + `GRANT EXECUTE ON FUNCTION ... TO anon`
6. Toda tabla nueva: RLS habilitado + política anon + `GRANT ALL ON ... TO anon`
7. Para secuencias: `GRANT USAGE, SELECT ON SEQUENCE ... TO anon`
8. **NO usar** `TO authenticated` en políticas — la app usa `anon`, no sesiones JWT
9. Si agregas columna nullable a tabla existente, verificar si hay RPCs que inserten en esa tabla (actualizar firma del RPC)
