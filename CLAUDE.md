# CLAUDE.md — PinturaMax: Guía de Arquitectura y Reglas de Validación

> Este archivo es la fuente de verdad para Claude al trabajar en este proyecto.
> Léelo antes de hacer cualquier cambio.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19, TypeScript 5.8, Vite 6 |
| Estilos | Tailwind CSS |
| Routing | React Router DOM 7 |
| Estado global | Zustand 5 |
| Backend/DB | Supabase (PostgreSQL + RLS) |
| Gráficas | Recharts 2 |
| AI | Google Gemini API, Groq SDK |

**Comandos:**
```bash
npm run dev      # Dev server en puerto 3000
npm run build    # Build de producción (Vite + Terser)
npm run preview  # Preview del build
```

**Variables de entorno requeridas** (`.env`):
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

---

## Estructura de archivos

```
pintureriapp/
├── App.tsx               # Router principal + guardas de rol por ruta
├── index.tsx             # Entry point
├── types.ts              # TODOS los tipos e interfaces
├── views/                # Pantallas (una por módulo)
├── services/             # Servicios de datos (Supabase)
│   ├── inventoryService.ts  # Servicio principal (productos, inventario, devoluciones, traspasos, etc.)
│   ├── salesService.ts
│   ├── clientService.ts
│   ├── promotionService.ts
│   ├── coin/coinService.ts
│   ├── restock/restockService.ts
│   ├── return/returnService.ts
│   ├── transfer/transferService.ts
│   ├── supply/supplyService.ts
│   └── ...
├── components/           # Componentes reutilizables
│   ├── Sidebar.tsx       # Navegación (controla qué links ve cada rol)
│   └── SmartSearch.tsx   # Buscador de productos (acepta `includeZeroStock` para devoluciones)
├── store/                # Estado global Zustand
│   └── authStore.ts      # Sesión de usuario
└── migrations/           # Scripts SQL para Supabase
```

---

## Roles de usuario

| Rol (enum) | Descripción | Pantalla inicial |
|------------|-------------|-----------------|
| `ADMIN` | Acceso total, aprueba todo | Dashboard |
| `WAREHOUSE` | Bodega principal | WarehouseDashboard |
| `WAREHOUSE_SUB` | Asistente de bodega (requiere auth para algunas acciones) | WarehouseDashboard |
| `STORE_MANAGER` | Encargado de sucursal | POS |
| `SELLER` | Vendedor | POS |
| `FINANCE` | Finanzas | Finance |

### Acceso por ruta (App.tsx)

| Ruta | Roles permitidos |
|------|-----------------|
| `/` | Todos (redirige según rol) |
| `/pos` | Todos |
| `/inventory` | Todos |
| `/clients` | Todos |
| `/finance` | ADMIN, FINANCE |
| `/quotations` | ADMIN, STORE_MANAGER |
| `/returns` | ADMIN, WAREHOUSE, WAREHOUSE_SUB, STORE_MANAGER |
| `/supplies` | ADMIN, WAREHOUSE, WAREHOUSE_SUB, STORE_MANAGER |
| `/packaging` | ADMIN, WAREHOUSE, WAREHOUSE_SUB, STORE_MANAGER |
| `/restocks` | ADMIN, WAREHOUSE, WAREHOUSE_SUB, STORE_MANAGER |
| `/transfers` | ADMIN, WAREHOUSE, WAREHOUSE_SUB, STORE_MANAGER |
| `/coin-change` | ADMIN, WAREHOUSE, WAREHOUSE_SUB, STORE_MANAGER |
| `/cash-cut` | ADMIN, WAREHOUSE, WAREHOUSE_SUB, FINANCE, STORE_MANAGER |
| `/wholesale-pos` | ADMIN, WAREHOUSE, WAREHOUSE_SUB, STORE_MANAGER |
| `/municipal-pos` | ADMIN, WAREHOUSE, WAREHOUSE_SUB, STORE_MANAGER |
| `/users` | ADMIN |
| `/branches` | ADMIN |
| `/admin-cash-cuts` | ADMIN |
| `/admin/history` | ADMIN |
| `/admin/pending-payments` | ADMIN |
| `/admin/promotions` | ADMIN |
| `/finance-dashboard` | ADMIN, FINANCE |
| `/suppliers` | ADMIN, FINANCE |
| `/accounts-payable` | ADMIN, FINANCE |
| `/leases` | ADMIN, FINANCE |

---

## Base de datos (Supabase)

### Regla crítica: La app usa la clave `anon`

La app NO usa sesiones JWT de Supabase. Todas las consultas llegan con el rol `anon`.

**Toda tabla nueva debe tener política RLS para `anon`:**
```sql
ALTER TABLE IF EXISTS public.nueva_tabla ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.nueva_tabla;
CREATE POLICY "Enable All for Anon" ON public.nueva_tabla FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.nueva_tabla TO anon;
```

Sin esta política: SELECT devuelve vacío, INSERT/UPDATE/DELETE fallan silenciosamente.

### Tablas principales

| Tabla | Módulo |
|-------|--------|
| `products` | Catálogo de productos |
| `inventory` | Stock por sucursal (branch_id + product_id) |
| `branches` | Sucursales |
| `profiles` | Usuarios del sistema |
| `sales` / `sale_items` | Ventas retail |
| `returns` | Devoluciones |
| `restock_requests` / `restock_sheets` / `restock_items` | Resurtidos |
| `stock_transfers` / `stock_transfer_items` | Traspasos |
| `barter_transfers` + 4 tablas relacionadas | Trueque |
| `quotations` | Cotizaciones |
| `coin_change_requests` | Cambio de moneda |
| `cash_cuts` | Corte de caja |
| `packaging_requests` | Envasado/tintorería |
| `internal_supplies` / `supply_orders` | Suministros |
| `discount_requests` / `promotion_requests` | Descuentos |
| `notifications` | Notificaciones en tiempo real |
| `clients` | Clientes / CRM |
| `suppliers` / `supplier_invoices` / `supplier_payments` | Finanzas |
| `leases` / `lease_payments` | Arrendamientos |
| `expenses` | Gastos |
| `shipping_orders` / `shipping_tracking_history` | Envíos |

### RPCs críticos (deben existir en Supabase)

| RPC | Uso |
|-----|-----|
| `get_next_folio(p_branch_id, p_folio_type)` | Genera folios únicos por sucursal |
| `process_sale(...)` | Procesa venta y descuenta inventario |
| `confirm_restock_arrival(...)` | Confirma llegada de resurtido y actualiza stock |
| `process_return(...)` | Procesa devolución y mueve inventario |
| `process_internal_consumption(...)` | Descuenta consumo interno |
| `confirm_transfer_receipt(...)` | Confirma recepción de traspaso |
| `complete_packaging(...)` | Finaliza proceso de envasado |
| `get_daily_cash_cut_data(...)` | Obtiene datos del corte diario |

---

## Flujos principales

### Venta (POS)
`POS.tsx` → `SalesService.processSale()` → RPC `process_sale` → descuenta `inventory` → notifica si hay descuento

### Resurtido
`Restocks.tsx` → `RestockService.createRestockRequest()` → notifica WAREHOUSE + ADMIN → WAREHOUSE aprueba/rechaza → `shipped` → `RestockService.confirmRestockArrival()` → RPC actualiza stock

### Devolución
`Returns.tsx` → `InventoryService.createReturnRequest()` → `pending_authorization` → Admin aprueba → `approved` + inventario se mueve (RPC) → Bodega confirma → `received_at_warehouse` → Admin cierra → `closed`

### Traspaso
`Transfers.tsx` → `InventoryService.createStockTransfer()` → `pending` → Admin aprueba → `approved` → envío con guía → destino confirma recepción → `received`

### Trueque
`Transfers.tsx` (tab Trueque) → `InventoryService.createBarterTransfer()` → contraparte selecciona ítems → propone/acepta → RPC `process_barter_transfer_bidirectional` → mueve inventario en ambas sucursales

### Cambio de moneda
`CoinChange.tsx` → `CoinService.createCoinChangeRequest()` → `pending` → confirmación envío → `completed` / cancelar → `cancelled`

### Corte de caja
`CashCut.tsx` → `get_daily_cash_cut_data` RPC → muestra resumen → Admin aprueba en `AdminCashCuts.tsx`

### Envasado
`Packaging.tsx` → `PackagingService.createPackagingRequest()` → Bodega procesa → `sent_to_branch` → Encargado confirma llegada → `received_at_branch` → inicia envasado → `processing` → finaliza → `completed`

---

## Reglas de validación para Claude

### Antes de cualquier cambio

1. **¿Nueva tabla Supabase?** → Agregar política RLS `anon` (ver plantilla arriba)
2. **¿Nueva ruta en App.tsx?** → Agregar guarda de rol explícita; nunca `user ? <View> : <Navigate to="/login">`  para vistas operativas
3. **¿Nuevo branch_id?** → Nunca hardcodear IDs de sucursal (ej: `'BR-CENTRO'`); usar siempre `user.branchId` o variable dinámica
4. **¿Formulario con sucursal seleccionable?** → Resetear producto, cart y estados del formulario al cambiar de sucursal
5. **¿Modal o detail view?** → Cerrar al cambiar de tab (`setIsModalOpen(false)` en el handler del tab)
6. **¿Operación multi-tabla?** → Usar RPC existente si aplica; si no, documentar que no es atómica
7. **¿Notificación en servicio?** → Envolver en try/catch que NO bloquee la operación principal (notificaciones son secundarias)
8. **¿Consulta que puede retornar vacío?** → Verificar si es por RLS antes de asumir que no hay datos

### Checklist de integridad al terminar

- [ ] `npm run build` pasa sin errores TypeScript
- [ ] No hay `'BR-CENTRO'` u otros IDs hardcodeados en el código
- [ ] Toda nueva tabla tiene política `anon` en su migración
- [ ] Toda nueva ruta en App.tsx tiene guarda de rol
- [ ] Estados de formulario se resetean al cambiar contexto (sucursal, tab)
- [ ] Modales se cierran al cambiar de tab
- [ ] Comparaciones con `user.branchId` usan guard `!!user.branchId &&` para admin/bodega (pueden ser undefined)

### Errores frecuentes y sus síntomas

| Síntoma | Causa probable |
|---------|---------------|
| Historial vacío para un rol | Falta política `anon` en la tabla |
| Error "RLS violation" en consola | Falta política `anon` para INSERT/UPDATE/DELETE |
| Vendedor ve datos de sucursal equivocada | Branch ID hardcodeado |
| Modal queda abierto al cambiar de tab | Falta `setIsModalOpen(false)` en tab change handler |
| Botón de acción invisible para Admin | Comparación `user.branchId === x` cuando branchId es `undefined` para Admin |
| Build falla con error TS | Tipo en `types.ts` no coincide con valor real en DB |
