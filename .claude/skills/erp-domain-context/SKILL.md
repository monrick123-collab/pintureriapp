# SKILL: erp-domain-context

Eres un experto en el ERP PinturaMax. Cuando se active esta skill, proporciona contexto de dominio completo para la tarea que el usuario está describiendo.

---

## Stack real del proyecto

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19, TypeScript 5.8, Vite 6 |
| Estilos | Tailwind CSS |
| Routing | React Router DOM 7 |
| Estado global | Zustand 5 (solo auth — `store/authStore.ts`) |
| Backend/DB | Supabase (PostgreSQL + RLS con clave `anon`) |
| Gráficas | Recharts 2 |
| AI | Google Gemini (`@google/generative-ai`), Groq SDK |

---

## Roles y acceso

```typescript
// types.ts
enum UserRole {
  ADMIN         // Acceso total, aprueba todo
  WAREHOUSE     // Bodega principal
  WAREHOUSE_SUB // Asistente bodega (requiere auth para algunas acciones)
  STORE_MANAGER // Encargado de sucursal
  SELLER        // Vendedor
  FINANCE       // Finanzas
}
```

**Patrón universal de detección de roles en vistas:**
```typescript
const isAdmin    = user.role === UserRole.ADMIN;
const isWarehouse = user.role === UserRole.WAREHOUSE || user.role === UserRole.WAREHOUSE_SUB;
const isFinance  = user.role === UserRole.FINANCE;
```

**branchId por rol:**
- `SELLER`, `STORE_MANAGER`: tienen `user.branchId` fijo
- `WAREHOUSE`, `WAREHOUSE_SUB`: tienen `user.branchId` fijo
- `ADMIN`, `FINANCE`: `user.branchId` es `undefined` — siempre guardar con `!!user.branchId &&`

---

## Módulos y sus vistas/servicios

| Módulo | Vista | Servicio principal |
|--------|-------|--------------------|
| POS Retail | `views/POS.tsx` | `services/salesService.ts` |
| POS Mayoreo | `views/WholesalePOS.tsx` | `services/salesService.ts` |
| POS Municipal | `views/MunicipalPOS.tsx` | `services/salesService.ts` |
| Inventario | `views/Inventory.tsx` | `services/inventoryService.ts` |
| Devoluciones | `views/Returns.tsx` | `services/inventoryService.ts` (activo) — `returnService.ts` es código muerto |
| Traspasos | `views/Transfers.tsx` | `services/transfer/transferService.ts` (activo, con cleanup de huérfanos) |
| Resurtidos | `views/Restocks.tsx` | `services/restock/restockService.ts` |
| Envasado | `views/Packaging.tsx` | `services/packaging/packagingService.ts` |
| Cambio Moneda | `views/CoinChange.tsx` | `services/coin/coinService.ts` |
| Suministros | `views/Supplies.tsx` | `services/supply/supplyService.ts` |
| Corte Caja | `views/CashCut.tsx` | `services/inventoryService.ts` (RPC) |
| Clientes/CRM | `views/Clients.tsx` | `services/clientService.ts` |
| Cotizaciones | `views/Quotations.tsx` | `services/quotationService.ts` |
| Finanzas | `views/Finance.tsx` | `services/financeService.ts` |
| Proveedores | `views/SupplierManagement.tsx` | `services/financeService.ts` |
| Cuentas x Pagar | `views/AccountsPayable.tsx` | `services/financeService.ts` |
| Arrendamientos | `views/Leasing.tsx` | `services/financeService.ts` |
| Dashboard Admin | `views/Dashboard.tsx` | múltiples servicios |
| Dashboard Bodega | `views/WarehouseDashboard.tsx` | múltiples servicios |
| Usuarios | `views/UserManagement.tsx` | `services/userService.ts` |
| Sucursales | `views/Branches.tsx` | `services/branchService.ts` |
| Historial Admin | `views/AdminHistory.tsx` | varios |
| Descuentos Admin | `views/AdminPromotionRequests.tsx` | `services/promotionService.ts` |

---

## Flujos de estado en tablas clave

### Devoluciones (`returns`)
```
pending_authorization → approved → received_at_warehouse → closed
                     ↘ rejected
```

### Resurtidos (`restock_requests` / `restock_sheets`)
```
pending_admin → approved_warehouse → shipped → completed
             ↘ rejected
```

### Traspasos (`stock_transfers`)
```
pending → approved → shipped → received
        ↘ rejected
```

### Envasado (`packaging_requests`)
```
pending → approved → sent_to_branch → received_at_branch → processing → completed
        ↘ rejected
```

### Suministros (`supply_orders`)
```
pending → processing → shipped → received | received_with_incidents
        ↘ cancelled
```

### Facturas de Proveedor (`supplier_invoices`)
```
received → verified → authorized → paid
         ↘ rejected
```

### Cambio de Moneda (`coin_change_requests`)
```
pending → completed | cancelled
```

---

## RPCs atómicos (funciones de PostgreSQL en Supabase)

Estas funciones existen y deben usarse para operaciones multi-tabla:

| RPC | Propósito | Uso desde |
|-----|-----------|-----------|
| `get_next_folio(p_branch_id, p_folio_type)` | Genera folio secuencial por sucursal | Todos los módulos |
| `process_sale(...)` | Crea venta y descuenta inventario | `salesService.ts` |
| `confirm_restock_arrival(p_request_id)` | Confirma llegada y actualiza stock | `restockService.ts` |
| `process_return(p_return_id)` | Mueve inventario de devolución | `returnService.ts` |
| `confirm_transfer_receipt(p_transfer_id)` | Confirma recepción en destino | `transferService.ts` |
| `process_internal_consumption(...)` | Descuenta consumo interno | `supplyService.ts` |
| `complete_packaging(...)` | Finaliza envasado | `packagingService.ts` |
| `get_daily_cash_cut_data(...)` | Datos de corte de caja | `CashCut.tsx` |
| `add_wholesale_charge(...)` | Cargo atómico en cuenta mayoreo (con FOR UPDATE) | `salesService.ts` |
| `add_wholesale_payment(...)` | Pago en cuenta mayoreo | `salesService.ts` |
| `add_municipal_payment(...)` | Pago en cuenta municipal | `salesService.ts` |
| `process_barter_transfer_bidirectional(...)` | Trueque entre sucursales | `transferService.ts` |

**Regla:** Si la operación toca `inventory` + otra tabla, usa RPC. No hagas UPDATE de inventario directamente.

---

## Sistema de notificaciones

**Tabla:** `notifications`
**Campos:** `user_id`, `target_role`, `target_branch_id`, `title`, `message`, `action_url`, `is_read`, `created_at`

**Patrón obligatorio — siempre no-bloqueante:**
```typescript
try {
  await NotificationService.createNotification({
    targetRole: 'ADMIN',
    title: 'Título',
    message: 'Mensaje descriptivo',
    actionUrl: '/ruta-relevante'
  });
} catch (e) {
  console.error('Error enviando notificación:', e);
  // NUNCA throw aquí — las notificaciones son secundarias
}
```

---

## Tipos de documentos y sus folios

Cada folio se genera con `get_next_folio(p_branch_id, p_folio_type)`:

| Tipo | p_folio_type |
|------|-------------|
| Venta retail | `'sale'` |
| Venta mayoreo | `'wholesale'` |
| Venta municipal | `'municipal'` |
| Devolución | `'return'` |
| Resurtido | `'restock'` |
| Traspaso | `'transfer'` |
| Cambio de moneda | `'coin_change'` |
| Cotización | `'quotation'` |

---

## Tablas de inventario

- `inventory` — Stock por sucursal: `{product_id, branch_id, stock}` — upsert en `(product_id, branch_id)`
- `products` — Catálogo: `{sku, name, category, brand, price, wholesale_price, wholesale_min_qty, package_type, min_stock, max_stock, cost_price, unit_measure, supplier_id}`
- `branch_bulk_inventory` — Inventario a granel: `{branch_id, product_id, available_liters, updated_at}`

### Enum `products.status` — valores válidos

```
'available' | 'low' | 'out' | 'expired'
```

**NO existe `'active'`**. Filtrar por `.eq('status', 'active')` retorna 0 resultados sin error (bug real: commit `9eb2012` — inventario vacío en todos los roles).

### Módulo Inventario (`views/Inventory.tsx`)

La vista tiene **tres tabs**:
1. **Productos** — lista paginable de todos los productos con stock por sucursal. Admin ve stock total y puede editar cualquier sucursal. Seller/Store Manager ve solo su sucursal.
2. **Resurtidos** — solicitar resurtido de un producto (redirige al flujo de `restock_requests`)
3. **Consumo interno** — registrar uso interno de producto (RPC `process_internal_consumption`)

**Edición de stock (solo ADMIN):**
- Usa `InventoryService.updateStock(productId, branchId, newStock)` — único UPDATE directo permitido
- Requiere confirmar antes de guardar (window.confirm en la vista)
- Genera entradas en `internal_consumption` si se registra como ajuste

**`min_stock` / `max_stock`:**
- Se muestran como referencia visual en la tabla de inventario
- No generan alertas automáticas en la app (no hay trigger o job que las revise)
- Son datos informativos para que el encargado decida cuándo pedir resurtido

### Métodos clave de `InventoryService`

```typescript
// Carga inicial — productos con su stock por sucursal
getProducts(): Promise<Product[]>
  // Hace DOS queries: products + inventory
  // Construye product.inventory = { [branch_id]: stock }

getProductsByBranch(branchId: string): Promise<Product[]>
  // Si branchId === 'ALL' → llama getProducts()
  // Si branchId es concreto → join inventory+products para esa sucursal

updateStock(productId, branchId, newStock): Promise<void>
  // Único UPDATE directo permitido. Solo para admin, ajuste manual.
  // Valida newStock >= 0 antes de llamar a Supabase

getBulkInventory(branchId): Promise<BulkInventoryItem[]>
  // Lee branch_bulk_inventory (litros a granel), NO la tabla inventory
```

**`mapDbProduct` — función local en `inventoryService.ts`:**
Convierte una fila de DB al tipo `Product` del frontend. Todos los demás servicios que necesiten mapear un producto deben usar este patrón (no está exportada, pero el patrón es copiable):
```typescript
const mapDbProduct = (item: Record<string, any>): Product => ({
    id: item.product_id || item.id,         // handles joined tables
    sku: item.sku || item.products?.sku,
    price: parseFloat(item.price || item.products?.price || '0'),
    wholesalePrice: parseFloat(item.wholesale_price || '0'),
    wholesaleMinQty: parseInt(item.wholesale_min_qty || '12'),  // default 12
    // ...
    inventory: {}   // se llena después si se necesita
});
```

---

## Tipos de pago en ventas

```typescript
type PaymentMethod = 'cash' | 'transfer' | 'credit' | 'mixed'
type PaymentStatus = 'approved' | 'pending' | 'rejected'
type PaymentType   = 'credit_days' | 'immediate'
```

---

## Clientes especiales

```typescript
// En tabla clients:
is_municipality: boolean        // Cliente municipal
extra_percentage: number        // % adicional para precios municipales
is_active_credit: boolean       // Tiene crédito activo
credit_limit: number
credit_days: number
```

---

---

# REGLAS DE NEGOCIO EXPLÍCITAS

> Extraídas del código real. Cada regla tiene su origen documentado.
> Antes de modificar cualquier cálculo o validación, consultar esta sección.

---

## RN-01 · Cálculo de precios en venta

### Precio base por tipo de cliente

```
POS Retail:
  precio = (cantidad >= wholesaleMinQty) ? wholesalePrice : price

POS Mayoreo:
  precio = wholesalePrice ?? price
  si paymentType === 'credito': precio × 1.05   ← +5% por crédito

POS Municipal:
  precio = price × (1 + extraPercentage / 100)  ← extraPercentage viene de clients.extra_percentage
```

**Fuente:** `views/WholesalePOS.tsx` cálculo de subtotal; `views/MunicipalPOS.tsx` `extraMultiplier`

### IVA

```
IVA = 16% fijo sobre (subtotal − descuento)
total = subtotalConDescuento + IVA
```

**Fuente:** `views/POS.tsx`, `views/WholesalePOS.tsx`, `views/MunicipalPOS.tsx` — constante hardcodeada `0.16` en los tres módulos.

### Descuento

```
descuento tipo 'percentage': descuentoAplicado = subtotal × (amount / 100)
descuento tipo 'fixed':      descuentoAplicado = amount   (cantidad fija en pesos)
subtotalConDescuento = subtotal − descuentoAplicado
```

**Fuente:** `views/POS.tsx` función de cálculo de totales.

---

## RN-02 · Validación de stock antes de venta

```
stockDisponible = product.inventory[currentBranchId] ?? 0
cantidadEnCarrito = cart.find(i => i.id === product.id)?.quantity ?? 0

SI cantidadEnCarrito >= stockDisponible → rechazar adición, toast "Stock insuficiente"
SI stockResultante < 0 → constraint DB lo rechaza (CHECK stock >= 0)
```

La validación ocurre **dos veces**: en el cliente (al agregar al carrito) y en la DB (constraint + RPC). El constraint `inventory_stock_non_negative` fue agregado en `migration_fix_negative_stock.sql` después de que ventas produjeran stock negativo.

**Fuente:** `views/POS.tsx` función `addToCart`; `views/WholesalePOS.tsx` función `addToCart` y cambio de cantidad.

---

## RN-03 · Aprobación de pagos por método

El RPC `process_sale` aplica esta regla **internamente**, independiente de lo que mande el frontend:

```sql
-- En process_sale (migration_merged_process_sale.sql):
IF p_payment_method IN ('transfer', 'cash') AND p_payment_status = 'approved' THEN
    p_payment_status := 'pending';   -- ← override silencioso
END IF;
```

```
paymentMethod = 'card'      → paymentStatus = 'approved' (automático)
paymentMethod = 'cash'      → paymentStatus = 'pending'  (requiere aprobación admin)
paymentMethod = 'transfer'  → paymentStatus = 'pending'  (requiere aprobación admin)
paymentMethod = 'credit'    → paymentStatus según acuerdo
```

**Consecuencia:** Pasar `paymentStatus: 'approved'` para `cash`/`transfer` es ignorado por el RPC. Para aprobar una venta cash/transfer ya creada, usar `SalesService.approvePayment()`.

**Fuente:** `migration_merged_process_sale.sql` línea 146; `services/salesService.ts`.

---

## RN-04 · Transferencia bancaria requiere referencia

```
SI paymentMethod === 'transfer' Y transferReference.trim() === ''
  → bloquear envío, alerta "Ingrese la referencia de transferencia"
```

Aplica en POS Municipal. Verificar si aplica también al extender a otros módulos.

**Fuente:** `views/MunicipalPOS.tsx` validación pre-submit.

---

## RN-05 · Descuentos: quién aprueba qué

```
Rol ADMIN:
  → Aplica descuento directamente, sin solicitud
  → No genera DiscountRequest en DB

Rol SELLER / STORE_MANAGER:
  → Crea DiscountRequest con status = 'pending'
  → Espera polling hasta que admin cambie a 'approved' o 'rejected'
  → Solo aplica al carrito si status === 'approved'
  → Al completar la venta: status → 'used'
```

```typescript
// Tipos de descuento (discount_requests.type):
'percentage'  // % sobre subtotal
'fixed'       // pesos fijos
```

**Fuente:** `views/POS.tsx` función `handleApplyDiscount`; `services/discountService.ts`.

---

## RN-06 · Mayoreo: precio mínimo por cantidad

```
SI cantidad en carrito >= product.wholesaleMinQty
  → usar product.wholesalePrice en lugar de product.price
  → (automático, sin aprobación)
```

`wholesaleMinQty` por defecto es `12` si no está configurado en el producto.

**Fuente:** `services/inventoryService.ts` `mapDbProduct` — `wholesaleMinQty: parseInt(item.wholesale_min_qty || '12')`.

---

## RN-07 · Crédito mayoreo: límite y bloqueo

```
Límite por defecto: $10,000 MXN (wholesale_accounts.credit_limit DEFAULT 10000.00)

Al registrar cargo (add_wholesale_charge RPC):
  nuevoSaldo = saldoActual + monto
  SI nuevoSaldo > credit_limit → RAISE EXCEPTION (venta rechazada)

Tipos de movimiento en wholesale_payments:
  'cargo'         → aumenta saldo (venta a crédito)
  'abono'         → reduce saldo (pago parcial)
  'pago_completo' → liquida todo el saldo

SI wholesale_accounts.is_blocked = true → bloquear cualquier nueva venta a crédito
```

La validación usa `SELECT ... FOR UPDATE` para prevenir condiciones de carrera en cargos concurrentes.

**Fuente:** `migration_atomic_credit_rpcs.sql`; `views/WholesalePOS.tsx`.

---

## RN-08 · Crédito municipal: límite, bloqueo y porcentaje extra

```
Límite por defecto: $10,000 MXN (municipal_accounts.credit_limit DEFAULT 10000.00)

SI municipal_accounts.is_blocked = true:
  → mostrar advertencia en UI antes de intentar venta
  → bloquear submit si blockedWarning !== null

Precio unitario municipal:
  precioFinal = precio × (1 + client.extraPercentage / 100)
  Ejemplo: precio $100, extraPercentage 15 → $115

Municipio como clave única:
  municipal_accounts.municipality es UNIQUE
  → un municipio = una cuenta de crédito global (no por sucursal)
```

**Fuente:** `views/MunicipalPOS.tsx`; `migration_create_municipal_tables.sql`.

---

## RN-09 · Devoluciones: flujo y restricciones de rol

```
Estado inicial: 'pending_authorization'

Transiciones permitidas:
  pending_authorization → approved    (solo ADMIN, requiere seleccionar sucursal destino)
  pending_authorization → rejected    (solo ADMIN)
  approved              → received_at_warehouse  (solo WAREHOUSE / WAREHOUSE_SUB)
  received_at_warehouse → closed      (solo ADMIN)

Restricción WAREHOUSE_SUB:
  → Requiere pasar por modal de autorización antes de crear devolución
  → (AuthorizationModal verifica credenciales adicionales)

Campo obligatorio en aprobación:
  approvalDestBranchId → sucursal a la que irá el producto devuelto
  → botón "Confirmar" permanece disabled si approvalDestBranchId === ''
```

**Fuente:** `views/Returns.tsx`; `services/return/returnService.ts`.

---

## RN-10 · Resurtidos: roles y flujo

```
Quién crea solicitudes:
  SELLER / STORE_MANAGER → tab 'new' visible, pueden solicitar
  WAREHOUSE / WAREHOUSE_SUB → tab inicial es 'history' (ven solicitudes, no crean)

Flujo de estados:
  pending_admin       → (Admin aprueba) → approved_warehouse
  approved_warehouse  → (Bodega despacha, marca shipped_at) → shipped
  shipped             → (Sucursal confirma con RPC confirm_restock_arrival) → completed

Deducción de inventario al confirmar:
  → Resta de 'BR-MAIN' (bodega principal, hardcodeado en RPC)
  → Suma a branch_id de la solicitud

Campo timestamps adicionales en restock_requests:
  approved_at  → timestamp al pasar a approved_warehouse
  shipped_at   → timestamp al pasar a shipped
  received_at  → timestamp al confirmar llegada (vía RPC)
```

**Fuente:** `services/inventoryService.ts`; `migration_fix_inventory_upsert.sql`.

---

## RN-11 · Traspasos: validaciones y trueque

### Traspasos simples
```
fromBranchId ≠ toBranchId  (destinos diferentes, validación en UI)
cart.length > 0            (al menos un producto)
Stock verificado en fromBranchId antes de crear

Flujo de aprobación:
  pending → approved (Admin) → shipped → received (RPC confirm_transfer_receipt)
```

### Trueque (Barter)
```
Estados del flujo:
  pending_offer      → Sucursal A propone sus ítems
  pending_selection  → Sucursal B selecciona qué quiere recibir
  counter_proposed   → (opcional) Sucursal A propone contra-oferta
  pending_approval   → Admin debe aprobar
  approved           → Stock reservado con RPC reserve_barter_inventory
  in_transit         → En camino
  completed          → RPC process_barter_transfer_bidirectional ejecutado

Si reserve_barter_inventory falla:
  → Compensating rollback: status vuelve a 'pending_approval' (no queda atascado)
```

**Fuente:** `views/Transfers.tsx`; `services/transfer/transferService.ts`; `services/inventoryService.ts` `approveBarterTransfer`.

---

## RN-12 · Envasado: unidades y conversiones

```
Unidades de presentación:
  'cuarto_litro'  → 0.25 L
  'medio_litro'   → 0.5 L
  'litro'         → 1 L
  'galon'         → 3.785 L  (configurable en packaging_settings.galon_liters)

Tambor (drum):
  Capacidad por defecto: 200 L  (configurable en packaging_settings.drum_liters)

Flujo v3 (multi-línea):
  Una orden puede tener múltiples líneas de presentación simultáneas
  Atomicidad via RPC complete_packaging_v2
  Estado inicial de orden v3: 'processing' (no 'pending')

Flujo legacy (una presentación):
  Estado inicial: 'sent_to_branch'
```

**Fuente:** `services/packaging/packagingService.ts` `getSettings()`; `submitPackagingOrderV3`.

---

## RN-13 · Cambio de moneda: flujo y desglose

```
Estado inicial: 'pending'

Flujo:
  pending → coins_sent  (se registra coins_sent_at)
          → completed   (se registra completed_at)
          → cancelled

Desglose opcional:
  breakdown: Record<string, number>
  Ejemplo: { "500": 2, "200": 5, "100": 10 }  → $2,000 total

Folio único por sucursal:
  get_next_folio(branchId, 'coin_change')
```

**Fuente:** `services/coin/coinService.ts`.

---

## RN-14 · Corte de caja: composición del resumen

```
Datos del RPC get_daily_cash_cut_data:
  summary.cash        → suma de ventas efectivo del día
  summary.card        → suma de ventas tarjeta del día
  summary.transfer    → suma de ventas transferencia del día
  summary.total       → suma total
  expenses[]          → gastos registrados ese día
  coupons[]           → vales canjeados ese día

Cálculo de saldo de efectivo disponible:
  saldoEfectivo = summary.cash − sum(expenses[].amount)

Zona horaria: México UTC-6 (hardcodeado en consultas de fecha)
  startOfDay = `${fecha}T00:00:00-06:00`
  endOfDay   = `${fecha}T23:59:59.999-06:00`

Flujo de aprobación:
  Encargado genera corte → status 'pending'
  Admin aprueba en AdminCashCuts.tsx → status 'approved' | 'rejected'
```

**Fuente:** `views/CashCut.tsx`; `migration_cash_cut_tz_fix.sql`.

---

## RN-15 · Promociones mayoreo: auto-aplicación

```
Matching automático (se recalcula al cambiar el carrito):
  totalUnidades = sum(cart[].quantity)
  promo = promotions.find(p =>
    p.minQuantity <= totalUnidades &&
    (!p.maxQuantity || p.maxQuantity >= totalUnidades)
  )
  SI promo && promo.autoApply → aplicar automáticamente

Vigencia:
  promo.startDate y promo.endDate (filtradas antes de llegar al frontend)

Solicitud manual de promoción (al admin):
  promotionRequestDiscount > 0 && selectedClient && cart.length > 0
  → crea PromotionRequest para aprobación
```

**Fuente:** `views/WholesalePOS.tsx` `useEffect` sobre `[cart, promotions]`.

---

## RN-16 · Notificaciones por evento de negocio

Quién recibe cada notificación (targetRole en `notifications`):

| Evento | Destinatario | actionUrl |
|--------|-------------|-----------|
| Venta con pago pendiente (cash/transfer) | `ADMIN` | `/admin/pending-payments` |
| Nueva solicitud de resurtido | `WAREHOUSE` | `/restocks` |
| Resurtido aprobado → proceder despacho | `WAREHOUSE` | `/restocks` |
| Resurtido despachado (en camino) | `STORE_MANAGER` | `/restocks` |
| Nuevo traspaso solicitado | `ADMIN` | `/transfers` |
| Trueque propuesto (contra-oferta) | `ADMIN` | `/transfers` |
| Descuento solicitado por vendedor | `ADMIN` | (polling, sin URL) |
| Promoción solicitada | `ADMIN` | `/admin/promotions` |

Todas las notificaciones son **no-bloqueantes**: si fallan, el flujo principal continúa.

---

## RN-17 · Validaciones de formulario que bloquean envío

Campos que deben estar completos antes de permitir el submit (botón disabled o return temprano):

| Módulo | Campo obligatorio | Condición de bloqueo |
|--------|------------------|----------------------|
| Devoluciones (aprobación) | `approvalDestBranchId` | `=== ''` |
| Municipal POS (transferencia) | `transferReference` | `.trim() === ''` |
| Municipal POS (crédito) | cuenta no bloqueada | `blockedWarning !== null` |
| Mayoreo (abono) | `paymentAmount` | `isNaN` o `<= 0` |
| Traspaso | `toBranchId` | `=== ''` |
| Traspaso | `cart` | `length === 0` |
| Traspaso | `fromBranchId` | `=== ''` (admin) |
| Packaging | `bulkProductId` | `=== ''` |
| Packaging | líneas de orden | `length === 0` |

---

## RN-18 · Restricciones específicas por rol (más allá del routing)

```
ADMIN:
  - Aplica descuentos directamente (sin DiscountRequest)
  - Puede seleccionar cualquier sucursal en todos los módulos
  - user.branchId === undefined → nunca filtrar por branchId sin guard

WAREHOUSE_SUB:
  - Requiere AuthorizationModal para crear devoluciones
  - (misma restricción puede aplicar a otras operaciones sensibles)

WAREHOUSE / WAREHOUSE_SUB en Restocks:
  - Tab inicial es 'history' (no ven el form de creación al entrar)
  - No crean solicitudes, las procesan

STORE_MANAGER:
  - Puede crear cotizaciones (SELLER no)
  - Tab de POS completo, incluyendo historial de sucursal

SELLER:
  - Solicita descuentos (no los aprueba)
  - No accede a cotizaciones
```

**Fuente:** `views/Restocks.tsx` estado inicial; `views/Returns.tsx` check de WAREHOUSE_SUB; `App.tsx` routing.

---

## RN-19 · Folios: contador por sucursal y tipo

```
Cada sucursal mantiene contadores independientes en branch_folios:
  last_sale_folio, last_municipal_folio, last_restock_folio,
  last_transfer_folio, last_quotation_folio, last_return_folio,
  last_coin_change_folio

DEFAULT de cada contador: 0 (no -1, no null — lección de commit a855ce2)

process_sale usa MAX(folio)+1 internamente (no get_next_folio)
  → posible race condition en ventas concurrentes desde misma sucursal
  → no ha causado problemas en producción por baja concurrencia

Todos los demás módulos deben usar:
  get_next_folio(p_branch_id, p_folio_type)
```

---

## RN-20 · Envasado a granel: inventario separado

```
Inventario de productos a granel ≠ inventory table

Tabla: branch_bulk_inventory
  available_liters → litros disponibles por producto y sucursal

Tabla: inventory
  stock → unidades envasadas por producto y sucursal

Al envasar:
  branch_bulk_inventory.available_liters -= litros_consumidos
  inventory.stock += unidades_producidas
  (vía RPC complete_packaging_v2 para atomicidad)
```

**Fuente:** `services/inventoryService.ts` `getBulkInventory()`; `services/packaging/packagingService.ts`.
