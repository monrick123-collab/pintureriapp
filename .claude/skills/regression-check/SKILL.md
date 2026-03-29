# SKILL: regression-check

Cuando se active esta skill, ejecuta una revisión sistemática de regresiones sobre el cambio reciente. Analiza el código modificado y el contexto del sistema para detectar problemas antes de que lleguen a producción.

---

## Uso

Invoca esta skill después de implementar cualquier cambio. Proporciona:
1. Los archivos modificados
2. La descripción del cambio
3. El módulo afectado

La skill revisará si el cambio rompe alguna de las reglas críticas del proyecto.

---

## Mapa de fragilidad — dónde ser más cuidadoso

Basado en el historial de bugs reales (138 commits de fix). Antes de tocar cualquiera de estos módulos, leer la sección entera.

### 🔴 MUY FRÁGIL

**Packaging (`views/Packaging.tsx` / `services/packaging/packagingService.ts`)**
- Tiene **dos implementaciones coexistiendo**: legacy (1 presentación) y v3 (multi-línea). Código de ambas vive en el mismo servicio.
- La tabla `packaging_requests` tiene **dos FKs a `products`** (`bulk_product_id` y `target_product_id`) → cualquier query con join a `products (*)` falla por FK ambigua. Usar siempre `products:bulk_product_id (name, sku)`.
- `packaging_order_lines` tiene RLS **deshabilitado** (workaround a un bug de schema cache de PostgREST). No re-habilitar sin probar primero.
- `target_product_id` puede ser null (orden v3 sin producto destino definido). No asumir que siempre tiene valor.
- Flujo legacy empieza en `'sent_to_branch'`, flujo v3 empieza en `'processing'`. Son estados iniciales diferentes.

**Trueque/Barter (`views/Transfers.tsx` tab Trueque / `services/inventoryService.ts`)** — Revisado (`08b4159`)
- Flujo más complejo del sistema: **9 estados reales** con lógica bidireccional.
- `approveBarterTransfer` tiene compensating rollback con try/catch (fix `08b4159`). UI state resets aplicados en tab/modal.
- **Precauciones vigentes:** `confirmBarterReception` setea `received_by` antes del RPC (inconsistente si falla). `cancelBarterTransfer` no es atómico (2 llamadas separadas). Ambos requieren migración de DB para resolver.
- El RPC `process_barter_transfer_bidirectional` toca inventario de **dos sucursales simultáneamente**. No hay forma de deshacerlo manualmente si falla a mitad.
- Estados `counter_proposed` y `pending_selection` requieren que la sucursal correcta actúe. Verificar siempre quién puede hacer qué en cada estado.

---

### 🟠 FRÁGIL

**POS Municipal (`views/MunicipalPOS.tsx`)**
- Sistema completamente separado de POS retail: tablas propias (`municipal_sales`, `municipal_sale_items`, `municipal_accounts`, `municipal_payments`), RPCs propios, flujo de aprobación propio.
- `municipal_sales.updated_at` puede no existir en todas las instancias — hay un workaround documentado en `paymentExpiryService.ts:54`.
- `municipal_accounts.municipality` es UNIQUE global (no por sucursal) — un municipio tiene una sola cuenta de crédito en todo el sistema.
- Las ventas municipales NO usan `SalesService.approvePayment()`. Tienen su propio método de aprobación.
- Precio se calcula con `extraPercentage` del cliente, que puede ser 0. No asumir que siempre hay un porcentaje.

**Corte de Caja (`views/CashCut.tsx` / `views/AdminCashCuts.tsx`)**
- Depende del RPC `get_daily_cash_cut_data` que filtra por fecha con timezone `-06:00` hardcodeado. Cambiar zona horaria rompe el corte.
- Dos bugs de timezone fueron corregidos en producción (`migration_cash_cut_tz_fix.sql`, `migration_fix_cashcut_tz_again.sql`). El formato correcto es `${fecha}T00:00:00-06:00` / `${fecha}T23:59:59.999-06:00`.
- El cálculo de saldo de efectivo es: ventas_efectivo − gastos. Los gastos se restan, los vales se muestran por separado.
- Cualquier cambio aquí afecta el cierre diario — error en producción se nota de inmediato.

**Notificaciones (`services/notificationService.ts`)**
- Filtrado por `target_branch_id` se hace **client-side** en JavaScript, no en la query de DB. La query trae hasta 50 notifs y filtra en el frontend. Cambiar el límite o el filtro puede hacer que notificaciones lleguen a roles equivocados.
- El RLS de `notifications` fue un problema recurrente (múltiples `migration_fix_notifications_*.sql`). Si se agrega una nueva tabla de notificaciones o se modifica la existente, verificar RLS cuidadosamente.
- `createNotification` usa `insert().select()` sin `.single()` para evitar error 406 cuando RLS bloquea. No cambiar a `.single()`.

---

### 🟡 MODERADAMENTE FRÁGIL

**Devoluciones (`views/Returns.tsx` / `services/return/returnService.ts`)**
- `approvalDestBranchId` es obligatorio al aprobar — el botón queda disabled si está vacío. Si se refactoriza el formulario de aprobación, verificar que esta validación no desaparezca.
- WAREHOUSE_SUB requiere `AuthorizationModal` antes de crear devoluciones. Verificar que ese check no se rompa al agregar nuevas acciones.
- Las branches se cargan en un `useEffect` **separado e independiente** de `loadData()` — esto fue un fix deliberado. No juntar las dos cargas.

**Traspasos simples (`views/Transfers.tsx` / `services/transfer/transferService.ts`)**
- La query de historial usa `.or('from_branch_id.eq.X,to_branch_id.eq.X')` — bidireccional. Si se agrega filtro de fecha, asegurarse de que sigue usando esa forma de OR.
- `fromBranchId ≠ toBranchId` se valida en UI pero no en RPC. Si se agrega lógica de traspaso interno, verificar.

**WholesalePOS (`views/WholesalePOS.tsx`)**
- El subtotal recalcula precio si `paymentType === 'credito'` (+5%). Si se modifica el cálculo, verificar que el recargo sigue aplicándose correctamente.
- `wholesale_accounts.balance` solo se puede modificar vía RPC `add_wholesale_charge` / `add_wholesale_payment` (con `FOR UPDATE`). Nunca con UPDATE directo.
- Promociones se recalculan en `useEffect([cart, promotions])` — si se agrega estado al carrito, verificar que no rompe el trigger.

---

### 🟢 RELATIVAMENTE ESTABLE

- `views/Inventory.tsx` / `services/inventoryService.ts` — bien documentado, flujos claros
- `views/Restocks.tsx` / `services/restock/restockService.ts` — flujo lineal
- `views/CoinChange.tsx` / `services/coin/coinService.ts` — simple, pocos estados
- `services/financeService.ts` — después del fix de camelCase, mapeo explícito
- `views/Clients.tsx` / `services/clientService.ts` — CRUD básico
- `views/Quotations.tsx` / `services/quotationService.ts` — poco acoplamiento

---

### Regla de escala de precaución

```
🔴 Tocar packaging o barter → leer todo el archivo antes de cambiar cualquier línea
🟠 Tocar municipal/corte/notificaciones → hacer regression-check completo post-cambio
🟡 Tocar devoluciones/traspasos/mayoreo → verificar checklist post-cambio
🟢 Tocar resto → checklist mínimo + npm run build
```

---

## Revisiones por categoría

### CATEGORÍA 1: Inventario (crítico — dinero real)

Preguntas a revisar:

**¿El cambio modifica stock directamente?**
```typescript
// PROHIBIDO — UPDATE directo a inventory:
await supabase.from('inventory').update({ stock: newVal }).eq('product_id', pid);

// CORRECTO — usar RPC:
await supabase.rpc('confirm_transfer_receipt', { p_transfer_id: id });
await supabase.rpc('process_sale', { ... });
await supabase.rpc('process_return', { p_return_id: id });
await supabase.rpc('confirm_restock_arrival', { p_request_id: id });
```

**¿Hay operación multi-tabla SIN RPC?**
- Si INSERT en tabla A + UPDATE en tabla B no van en mismo RPC → riesgo de inconsistencia
- Verificar si ya existe un RPC para esa combinación en `migrations/`

**¿El folio se genera correctamente?**
```typescript
// CORRECTO — siempre con get_next_folio:
const { data: folio } = await supabase.rpc('get_next_folio', {
  p_branch_id: branchId,
  p_folio_type: 'transfer'  // sale|return|restock|transfer|coin_change|quotation
});
// NUNCA calcular MAX(folio) + 1 en el cliente
```

---

### CATEGORÍA 2: Seguridad y acceso por rol

**¿Toda nueva ruta tiene guarda de rol en App.tsx?**
```typescript
// PROHIBIDO — solo verifica autenticación:
<Route path="/nueva" element={user ? <NuevaVista /> : <Navigate to="/login" />} />

// CORRECTO — verifica rol:
<Route path="/nueva" element={
  user && (user.role === UserRole.ADMIN || user.role === UserRole.WAREHOUSE)
    ? <NuevaVista user={user} onLogout={handleLogout} />
    : <Navigate to="/" replace />
} />
```

**¿Los roles WAREHOUSE_SUB están incluidos donde corresponde?**
```typescript
// WAREHOUSE_SUB debe tener mismo acceso que WAREHOUSE en la mayoría de vistas:
const isWarehouse = user.role === UserRole.WAREHOUSE || user.role === UserRole.WAREHOUSE_SUB;
```

---

### CATEGORÍA 3: Branch ID (aislamiento de datos)

**¿Hay IDs hardcodeados?**
```bash
# Buscar en el cambio:
grep -n "'BR-\|'MAIN\|'CENTRO\|'branch-\|branchId.*=.*'" archivos_modificados
```

**¿Las queries del admin filtran correctamente?**
```typescript
// Admin tiene user.branchId = undefined
// MAL — query retorna vacío para admin:
.eq('branch_id', user.branchId)  // undefined → falla silenciosamente

// BIEN — admin ve todo, otros filtran por su sucursal:
const branchFilter = isAdmin ? selectedBranch : user.branchId;
if (branchFilter) query = query.eq('branch_id', branchFilter);
```

**¿Las comparaciones con branchId tienen guard?**
```typescript
// MAL — undefined === 'algo' es false pero confuso:
if (user.branchId === targetBranchId) { showButton(); }

// BIEN:
if (!!user.branchId && user.branchId === targetBranchId) { showButton(); }
// O:
if (isAdmin || user.branchId === targetBranchId) { showButton(); }
```

---

### CATEGORÍA 4: Estado de UI (experiencia de usuario)

**¿Los modales se cierran al cambiar de tab?**
```typescript
// Verificar que el tab change handler incluya:
const handleTabChange = (tab: string) => {
  setActiveTab(tab);
  setIsModalOpen(false);    // ← requerido
  setSelectedItem(null);    // ← requerido
};
```

**¿El estado del formulario se resetea en el lugar correcto?**

Momentos donde se debe resetear:
1. Al cerrar modal (`useEffect` sobre `isModalOpen`)
2. Al cambiar de sucursal (handler de sucursal)
3. Al cambiar de tab (handler de tab)
4. Después de submit exitoso

```typescript
// Verificar que handleSubmit incluya limpieza:
setCart([]);
setSelectedProduct(null);
setQuantity(1);
setNotes('');
setIsModalOpen(false);
```

**¿Hay `loading` states correctamente?**
```typescript
// setLoading(true) antes del await
// setLoading(false) en finally (no solo en try)
try {
  setLoading(true);
  await servicio.accion();
} catch (e) {
  // manejar error
} finally {
  setLoading(false);  // ← SIEMPRE en finally
}
```

---

### CATEGORÍA 5: Base de datos y RLS

**¿La nueva tabla tiene política anon?**
```sql
-- Verificar en la migración:
CREATE POLICY "Enable All for Anon" ON public.nueva_tabla
  FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.nueva_tabla TO anon;
```

**¿La nueva función RPC tiene GRANT?**
```sql
GRANT EXECUTE ON FUNCTION public.nueva_funcion TO anon;
```

**¿Hay un posible problema de datos vacíos por RLS?**
Si el servicio retorna `[]` y no lanza error, sospechar de RLS antes de buscar bugs en el código.

---

### CATEGORÍA 6: Notificaciones (no-bloqueantes)

**¿Las notificaciones están en try/catch separado?**
```typescript
// MAL — puede cancelar la operación principal:
await MiServicio.hacerAlgo();
await NotificationService.createNotification({ ... }); // si falla, rompe el flujo

// BIEN:
await MiServicio.hacerAlgo();
try {
  await NotificationService.createNotification({ ... });
} catch (e) {
  console.error('Error en notificación:', e);
  // NO throw aquí
}
```

---

### CATEGORÍA 7: TypeScript y tipos

**¿El nuevo tipo está en `types.ts`?**
- No crear archivos de tipos separados
- Agregar interfaces y enums en `types.ts`
- Los status deben ser `type Alias = 'valor1' | 'valor2'` (no enum de string)

**¿Hay `any` innecesarios?**
```typescript
// MAL:
const handleError = (e: any) => alert(e.message);

// MEJOR:
const handleError = (e: unknown) => {
  if (e instanceof Error) alert(e.message);
  else alert('Error desconocido');
};
```

**¿El build pasa?**
```bash
npm run build
```
Si hay errores TypeScript, el build falla y el cambio no es apto para producción.

---

## Matriz de impacto por archivo modificado

| Archivo modificado | Riesgos a verificar |
|-------------------|---------------------|
| `services/salesService.ts` | Proceso de venta, folio, descuentos, inventario |
| `services/inventoryService.ts` | Operaciones multi-tabla, RPC usage |
| `services/transfer/transferService.ts` | Atomicidad, branch isolation |
| `services/return/returnService.ts` | Estado de devolución, inventario |
| `services/restock/restockService.ts` | Flujo de resurtido, notificaciones |
| `App.tsx` | Guardia de roles, rutas nuevas |
| `types.ts` | Compatibilidad con código existente |
| `store/authStore.ts` | Session handling, localStorage |
| `components/Sidebar.tsx` | Links visibles por rol |
| `views/*.tsx` | Estado de modal/tab, branch isolation |
| `migrations/*.sql` | RLS, GRANT, atomicidad |

---

## Comandos de verificación rápida

```bash
# 1. Verificar que el build TypeScript pasa
npm run build

# 2. Buscar branch IDs hardcodeados
grep -rn "'BR-\|\"BR-" src/

# 3. Buscar UPDATE directo a inventory (debería estar vacío)
grep -rn "from('inventory').update\|from(\"inventory\").update" src/

# 4. Verificar que los modales tienen handler de cierre en tabs
grep -rn "setActiveTab\|setIsModalOpen" src/views/

# 5. Buscar notificaciones sin try/catch
grep -B5 "createNotification" src/services/ | grep -v "try {"
```

---

## Resultado del regression-check

Al terminar la revisión, reportar:

```
## Regression Check Results

### ✅ OK
- [lista de categorías que pasaron]

### ⚠️ Advertencias
- [problemas no críticos encontrados]

### ❌ Bloqueantes
- [problemas que deben corregirse antes de continuar]

### Próximos pasos
- [acciones concretas para resolver los bloqueantes]
```
