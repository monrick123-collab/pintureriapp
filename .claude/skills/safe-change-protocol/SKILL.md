# SKILL: safe-change-protocol

Cuando se active esta skill, sigue este protocolo antes y durante cualquier cambio en PinturaMax para evitar regresiones y errores conocidos.

---

## Módulos de ALTO RIESGO

Antes de tocar cualquiera de estos módulos, leer el archivo completo y hacer regression-check post-cambio:

### Packaging (`views/Packaging.tsx` / `services/packaging/packagingService.ts`)
Dos implementaciones coexistiendo: legacy (1 presentación) y v3 (multi-línea). Código de ambas vive en el mismo servicio. FK ambigua a `products` (`bulk_product_id` + `target_product_id`). `packaging_order_lines` tiene RLS deshabilitado. Cualquier cambio requiere probar ambos flujos.

### Barter/Trueque (`views/Transfers.tsx` tab Trueque / `services/inventoryService.ts`)
Lógica bidireccional compleja con 8 estados posibles. `approveBarterTransfer` tiene compensating rollback explícito — si se modifica, verificar que el rollback siga siendo correcto. El RPC `process_barter_transfer_bidirectional` toca inventario de dos sucursales simultáneamente. No hay rollback manual si falla a mitad.

### process_sale RPC (`migrations/migration_merged_process_sale.sql`)
Genera folios con `MAX(folio)+1` en vez de `get_next_folio()`. Race condition teórica bajo ventas concurrentes desde la misma sucursal. Además, overridea `payment_status` silenciosamente para `cash`/`transfer`. Cualquier cambio al RPC debe mantener ambos comportamientos o documentar explícitamente la desviación.

---

## Checklist PRE-cambio

Antes de escribir código, responde estas preguntas:

### 1. ¿El cambio toca inventario?
- Si mueve stock entre sucursales → usar RPC `confirm_transfer_receipt`
- Si descuenta por venta → usar RPC `process_sale`
- Si devuelve stock → usar RPC `process_return`
- Si resurtido llega → usar RPC `confirm_restock_arrival`
- **PROHIBIDO en flujos operativos:** UPDATE directo a `inventory` desde el cliente
- **Permitido:** `InventoryService.updateStock()` solo para ajustes manuales de admin

### 2. ¿El cambio agrega una tabla nueva?
Incluir en la migración **las tres líneas**, no solo CREATE POLICY:
```sql
ALTER TABLE IF EXISTS public.nueva_tabla ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.nueva_tabla;
CREATE POLICY "Enable All for Anon" ON public.nueva_tabla
  FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.nueva_tabla TO anon;  -- ← Esta línea también es obligatoria
```
La política sin el `GRANT` falla silenciosamente (lección: commit `1fb4762` — `coupons` tenía política pero sin GRANT).

### 3. ¿El cambio agrega una ruta nueva en App.tsx?
- Agregar guarda de rol explícita
- **NUNCA usar** `user ? <View> : <Navigate to="/login" />` para vistas operativas
- Patrón correcto:
```typescript
<Route path="/nueva-ruta" element={
  user && (user.role === UserRole.ADMIN || user.role === UserRole.WAREHOUSE)
    ? <NuevaVista user={user} onLogout={handleLogout} />
    : <Navigate to="/" replace />
} />
```

### 4. ¿El cambio usa branch_id?
- **NUNCA hardcodear** ningún ID de sucursal — ni `'BR-CENTRO'`, ni `'BR-MAIN'`, ni cualquier otro
- `'BR-MAIN'` existe como única excepción en el código SQL interno de `confirm_restock_arrival`; no replicar ese patrón en frontend
- Para usuarios no-admin: `user.branchId`
- Para admin: estado dinámico `const [selectedBranch, setSelectedBranch] = useState('')`
- Guardar correctamente:
```typescript
// MAL — puede ser undefined para admin/finance:
const branchId = user.branchId || 'BR-MAIN'; // ← commits b6924d8, 03866a5, 7207ac3

// BIEN:
const branchId = user.branchId || '';
// O con selector para admin:
const branchId = isAdmin ? selectedBranchId : (user.branchId || '');
```

### 5. ¿El cambio agrega un modal o detail view?
- Cerrar al cambiar de tab:
```typescript
const handleTabChange = (newTab: string) => {
  setActiveTab(newTab);
  setIsModalOpen(false);    // ← requerido (commit 3346853)
  setSelectedItem(null);
};
```

### 6. ¿El cambio agrega notificaciones?
- Siempre envolver en try/catch separado
- **NUNCA** hacer throw dentro del catch de notificaciones
- Usar `NotificationService.createNotification()` de `services/notificationService.ts`

### 7. ¿El cambio es una operación multi-tabla?
- Si existe un RPC para ella → usarlo
- Si no → implementar compensating rollback si la segunda operación falla:
```typescript
// Lección: commit 1fb4762 — approveBarterTransfer
await supabase.from('barter_transfers').update({ status: 'approved' }).eq('id', id);
const { error } = await supabase.rpc('reserve_barter_inventory', { p_barter_id: id });
if (error) {
    // Revertir el estado para no dejar registro atascado
    await supabase.from('barter_transfers')
        .update({ status: 'pending_approval', authorized_by: null })
        .eq('id', id);
    throw error;
}
```

### 8. ¿El nuevo servicio hace INSERT/UPDATE con objetos frontend?
- **NUNCA pasar el objeto camelCase directamente** a Supabase — mapear siempre a snake_case
- Lección: commit `e0ec031` — `FinanceService.createSupplier()` pasaba `{ taxId, contactInfo }` directo, causando que los campos se guardaran como null silenciosamente
```typescript
// MAL:
await supabase.from('suppliers').insert(supplier); // supplier.taxId no existe en DB

// BIEN: mapear explícitamente
await supabase.from('suppliers').insert({
    name: supplier.name,
    tax_id: supplier.taxId,         // camelCase → snake_case
    contact_info: supplier.contactInfo,
    payment_terms_days: supplier.paymentTermsDays,
});
```

### 9. ¿El servicio mapea los campos del resultado al tipo frontend?
- **SIEMPRE mapear todos los campos** que se usen en la UI, incluyendo fechas
- Lección: commit `0fb3b7a` — `getStockTransfers()` no mapeaba `created_at` → `createdAt`, causando "Invalid Date" en toda la lista
```typescript
// MAL — el spread no garantiza que created_at llegue como createdAt:
return (data || []).map(t => ({
    ...t,
    fromBranchName: t.from?.name,
}));

// BIEN — mapear explícitamente todos los campos usados en UI:
return (data || []).map(t => ({
    id: t.id,
    fromBranchName: t.from?.name,
    createdAt: t.created_at,   // ← siempre mapear fechas
    updatedAt: t.updated_at,
    status: t.status,
}));
```

### 10. ¿Hay UPDATEs de inventario sin UPSERT?
- `UPDATE ... WHERE product_id=X AND branch_id=Y` falla silenciosamente si no existe la fila
- Lección: commit `95aac99` — `confirm_restock_with_differences` usaba UPDATE, si no había fila → 0 rows affected → inventario sin actualizar, sin error
```sql
-- MAL (falla silenciosamente si no hay fila):
UPDATE inventory SET stock = stock + qty WHERE product_id = pid AND branch_id = bid;

-- BIEN (UPSERT crea la fila si no existe):
INSERT INTO inventory (product_id, branch_id, stock, updated_at)
VALUES (pid, bid, qty, now())
ON CONFLICT (product_id, branch_id) DO UPDATE
SET stock = inventory.stock + EXCLUDED.stock, updated_at = now();
```

---

## Patrones de componente correctos

### Estructura estándar de una vista

```typescript
import { UserRole } from '../types';

interface ViewProps {
  user: User;
  onLogout: () => void;
}

const MiVista: React.FC<ViewProps> = ({ user, onLogout }) => {
  // 1. Detección de roles
  const isAdmin    = user.role === UserRole.ADMIN;
  const isWarehouse = user.role === UserRole.WAREHOUSE || user.role === UserRole.WAREHOUSE_SUB;

  // 2. Estado de datos
  const [items, setItems] = useState<MiTipo[]>([]);
  const [loading, setLoading] = useState(false);

  // 3. Estado de formulario
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 4. Estado de filtros/tab
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [selectedBranch, setSelectedBranch] = useState(user.branchId || '');

  // 5. Cargar sucursales INDEPENDIENTEMENTE de los datos principales
  // Lección: commit 079e5fd — si loadData falla, el selector de sucursal
  // también quedaba vacío porque se cargaban dentro del mismo useEffect
  useEffect(() => {
    if (isAdmin || isWarehouse) {
      InventoryService.getBranches()
        .then(setBranches)
        .catch(e => console.error('[MiVista] branches:', e));
    }
  }, []);

  // 6. Cargar datos principales
  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await MiServicio.getData(selectedBranch);
      setItems(data);
    } catch (e) {
      console.error('[MiVista] Error cargando datos:', e);
    } finally {
      setLoading(false);
    }
  };

  // 7. Submit con limpieza de estado
  const handleSubmit = async () => {
    try {
      setLoading(true);
      await MiServicio.create({ ... });
      setCart([]);
      setIsModalOpen(false);
      setActiveTab('history');
      loadData();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };
```

### Reset de estado al cambiar de sucursal (admin)

```typescript
const handleBranchChange = (newBranchId: string) => {
  setSelectedBranch(newBranchId);
  setCart([]);
  setSelectedProduct(null);
  setNotes('');
  loadData();
};
```

### Reset al cerrar modal

```typescript
useEffect(() => {
  if (!isModalOpen) {
    setCart([]);
    setSelectedProductId('');
    setQuantity(1);
    setNotes('');
  }
}, [isModalOpen]);
```

---

## Patrones de servicio correctos

### Mapeo explícito en inserts

```typescript
async create(data: MiTipo): Promise<MiTipo> {
  const { data: result, error } = await supabase
    .from('mi_tabla')
    .insert([{
        field_one: data.fieldOne,     // camelCase → snake_case SIEMPRE
        field_two: data.fieldTwo,
        branch_id: data.branchId,
    }])
    .select()
    .single();

  if (error) throw error;
  if (!result) throw new Error('No se pudo crear el registro');
  return result;
}
```

### Mapeo explícito en selects

```typescript
return (data || []).map((r: any) => ({
    id: r.id,
    branchId: r.branch_id,
    branchName: r.branches?.name,     // join con optional chaining
    productName: r.products?.name,
    createdAt: r.created_at,          // ← SIEMPRE mapear fechas
    updatedAt: r.updated_at,          // ← aunque parezcan obvias
    status: r.status,
    total: parseFloat(r.total || '0'), // ← parseFloat para numéricos
}));
```

---

## Lecciones del historial de git (errores reales que ocurrieron)

### Lección 1: Hardcoded branch IDs causan datos cruzados entre sucursales
**Commits:** `b7b54d1`, `b6924d8`, `7207ac3`, `03866a5`

Había `user.branchId || 'BR-CENTRO'` y `user.branchId || 'BR-MAIN'` en varios archivos. Efecto real: vendedores de otras sucursales veían historial de BR-CENTRO; ventas mayoreo se atribuían a BR-MAIN aunque el vendedor fuera de otra sucursal.

**Regla:** Nunca hardcodear ningún ID de sucursal como fallback. Usar `''` como fallback y validar antes de usar.

---

### Lección 2: RLS sin GRANT bloquea silenciosamente
**Commits:** `1fb4762`, `fd17df1`, múltiples `migration_fix_*_anon.sql`

El patrón completo para acceso anon requiere **tres cosas**:
1. `ENABLE ROW LEVEL SECURITY`
2. `CREATE POLICY ... TO anon USING (true) WITH CHECK (true)`
3. `GRANT ALL ON public.tabla TO anon`

Faltar cualquiera de las tres → SELECT retorna `[]`, INSERT retorna `data: []`, sin error visible. La tabla `coupons` tenía 1 y 2 pero no el 3 → corte de caja no cargaba cupones.

**Señal diagnóstica:** Si una query retorna vacío sin error, sospechar de RLS antes de buscar bugs en el código.

---

### Lección 3: camelCase pasado directamente a Supabase se ignora silenciosamente
**Commit:** `e0ec031`

`FinanceService.createSupplier(supplier)` pasaba el objeto TypeScript directo. Supabase recibía `{ taxId: '...', contactInfo: '...' }` pero la columna se llama `tax_id` y `contact_info` → los campos llegaban como null, sin error.

**Regla:** En cada INSERT/UPDATE, mapear explícitamente field por field. Nunca `insert(objeto)` directo.

---

### Lección 4: UPDATE falla silenciosamente si no existe la fila
**Commit:** `95aac99`

`UPDATE inventory SET stock = stock + qty WHERE product_id = X AND branch_id = Y` → si no existe esa combinación en inventory, el UPDATE afecta 0 filas y retorna sin error. El inventario nunca se actualiza.

**Regla:** Todo UPDATE a `inventory` debe ser `INSERT ... ON CONFLICT DO UPDATE` (UPSERT). Aplica también en RPCs.

---

### Lección 5: status con valor inválido devuelve 0 resultados sin error
**Commit:** `9eb2012`

`getProductsByBranch()` tenía `.eq('status', 'active')`. El enum real de products es `'available' | 'low' | 'out' | 'expired'` — no existe `'active'`. Resultado: inventario vacío en TODAS las sucursales para TODOS los roles.

**Regla:** Antes de filtrar por un campo enum, verificar los valores válidos en `types.ts` o en la constraint del schema. Nunca asumir valores de status.

---

### Lección 6: Fechas no mapeadas causan "Invalid Date" en UI
**Commit:** `0fb3b7a`

`getStockTransfers()` devolvía `{ ...t, fromBranchName: t.from?.name }` con spread. El problema: TypeScript acepta el tipo pero `created_at` (snake_case de DB) no es `createdAt` (camelCase que espera la UI). Resultado: fechas mostraban "Invalid Date" en toda la lista de traspasos.

**Regla:** Mapear `created_at → createdAt` y `updated_at → updatedAt` explícitamente en CADA objeto de retorno. No confiar en el spread para esto.

---

### Lección 7: Dos FKs a la misma tabla → PostgREST necesita sintaxis explícita
**Commit:** `614e95c`

`packaging_requests` tiene `bulk_product_id` y `target_product_id`, ambas FK a `products`. Usar `.select('*, products(name, sku)')` → error de PostgREST por FK ambigua.

**Regla:** Cuando una tabla tiene múltiples FKs a la misma tabla destino, usar la sintaxis de alias explícito:
```typescript
.select(`
    *,
    products:bulk_product_id (name, sku),
    target_product:target_product_id (name, sku)
`)
```

---

### Lección 8: IDs de mock users rompen columnas UUID en DB
**Commits:** `2f24d86`, `ab8ecf9`

`authorized_by UUID` recibía strings como `'4829'` o `'ADM-001'` → Postgres: `invalid input syntax for type uuid`. Igual para `coin_change_requests.requester_id` que fue creada como UUID pero el sistema usaba IDs de texto.

**Regla:** Si un campo de DB es `UUID`, validar antes de incluirlo en el payload:
```typescript
const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
const payload: any = { status: newStatus };
if (isValidUUID) payload.authorized_by = adminId; // solo si es UUID válido
```
Si el campo siempre recibirá IDs de texto (no UUID), crear la columna como `TEXT` desde el inicio.

---

### Lección 9: Sesiones en localStorage sobreviven a cambios de schema
**Commit:** `52060ee`

Al pasar de mock users a Supabase Auth real, usuarios tenían sesiones antiguas en localStorage con `branchId: 'BR-MAIN'` hardcodeado (de cuando era un campo mock). La app arrancaba con esos datos incorrectos.

**Regla:** Al iniciar la app, siempre validar la sesión contra Supabase Auth antes de confiar en localStorage:
```typescript
const { data: { session } } = await supabase.auth.getSession();
if (session?.user) {
    // Re-fetch del perfil real desde profiles
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (profile) setUser({ ...freshUserFromProfile });
} else {
    localStorage.removeItem('pintamax_user'); // limpiar sesión stale
}
```

---

### Lección 10: Importaciones dinámicas en callbacks causan timing bugs
**Commit:** `3346853`

`Returns.tsx` usaba `import('../services/supabase')` dentro de callbacks de eventos (`handleCloseReturn`, `handleConfirmReception`). Esto crea una promesa adicional en el critical path del evento y puede resolver en momento incorrecto.

**Regla:** Todas las importaciones de servicios deben ser estáticas en el top del archivo. Nunca `import()` dinámico para módulos que se usarán en callbacks.

---

### Lección 11: Carga de sucursales acoplada a carga de datos → selector vacío en error
**Commits:** `079e5fd`, `bd4f579`, `fa77220`

En `Returns.tsx`, el selector de sucursal (para admin) se llenaba dentro de `loadData()`. Si `loadData()` fallaba a mitad → sucursales no se cargaban → el admin no podía ni seleccionar sucursal para filtrar.

**Regla:** Cargar siempre los catálogos (sucursales, productos, usuarios) en `useEffect` independientes, nunca dentro del flujo de `loadData()`:
```typescript
// Separado — no falla si loadData falla
useEffect(() => {
  InventoryService.getBranches().then(setBranches).catch(console.error);
}, []);

// Principal
useEffect(() => { loadData(); }, [selectedBranch]);
```

---

### Lección 12: Folios duplicados por inicialización incorrecta de tabla
**Commit:** `a855ce2`

La tabla `branch_folios` fue inicializada con `DEFAULT -1` en lugar de `DEFAULT 0`. El primer folio calculado era `MAX(-1) + 1 = 0`, generando folios duplicados con `0`.

**Regla:** Las tablas de contadores de folios deben inicializarse con `DEFAULT 0`. Al crear nuevas filas en `branch_folios` (o equivalente), verificar que el valor base sea 0, no null ni -1.

---

### Lección 13: Operación de aprobación sin compensating rollback deja estado corrupto
**Commit:** `1fb4762`

`approveBarterTransfer()` hacía:
1. `UPDATE barter_transfers SET status = 'approved'` ← OK
2. `rpc('reserve_barter_inventory')` ← falla

Si el RPC fallaba, el traspaso quedaba como `'approved'` sin stock reservado, imposible de procesar y difícil de diagnosticar.

**Regla:** Cuando una operación multi-paso no puede ser un solo RPC, agregar compensating rollback explícito si el paso 2 falla:
```typescript
await supabase.from('tabla').update({ status: 'approved' }).eq('id', id);
const { error } = await supabase.rpc('operacion_secundaria', { p_id: id });
if (error) {
    // Revertir para no dejar estado inconsistente
    await supabase.from('tabla').update({ status: 'pending' }).eq('id', id);
    throw error;
}
```

---

### Lección 14: PostgREST schema cache puede bloquear a pesar de políticas correctas
**Commit:** `aaadced`

`packaging_order_lines` tenía RLS + política `anon` correctas pero PostgREST continuaba bloqueando las queries (error de caché de schema). La solución de emergencia fue `DISABLE ROW LEVEL SECURITY` en esa tabla.

**Señal:** Si una tabla tiene políticas correctas pero sigue fallando, y el problema apareció después de modificar FKs o renombrar columnas, PostgREST puede tener el schema cacheado. Solución: en Supabase Dashboard → API → "Reload schema cache", o como último recurso `DISABLE ROW LEVEL SECURITY` si la tabla no tiene datos sensibles.

---

## Checklist POST-cambio

Antes de considerar el cambio completo:

- [ ] `npm run build` pasa sin errores TypeScript
- [ ] No hay IDs de sucursal hardcodeados: `grep -rn "'BR-" src/`
- [ ] No hay camelCase directo en inserts/updates de Supabase
- [ ] Todos los campos de fechas (`created_at`, `updated_at`) se mapean explícitamente en el retorno del servicio
- [ ] Todo UPDATE a `inventory` usa UPSERT (`ON CONFLICT DO UPDATE`)
- [ ] Toda tabla nueva tiene RLS + política + GRANT (las tres líneas)
- [ ] Toda ruta nueva tiene guarda de rol en `App.tsx`
- [ ] Estados de formulario se resetean al cambiar contexto (sucursal, tab, modal)
- [ ] Sucursales (y otros catálogos) se cargan en `useEffect` independiente
- [ ] Operaciones multi-tabla tienen compensating rollback si el paso 2 puede fallar
- [ ] Columnas UUID no reciben IDs de texto (validar con regex antes de insertar)
- [ ] Comparaciones con `user.branchId` usan guard `!!user.branchId &&` para admin/warehouse
- [ ] Si la tabla tiene múltiples FKs a la misma destino, el select usa alias explícito
