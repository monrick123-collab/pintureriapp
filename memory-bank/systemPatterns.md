# System Patterns - Arquitectura - Pintamax (pintureriapp)

> Patrones arquitectonicos y convenciones tecnicas del codigo. Documentado tras analizar el repositorio.

---

## 1. Arquitectura general

**SPA (Single Page Application)** monolitica en el cliente + backend serverless en Supabase.

- Navegador (SPA React) se conecta via HTTPS con clave anon directamente a Supabase API -> PostgreSQL 17 / Auth / Storage / RPC.
- **No hay servidor propio de aplicacion.** Todo el acceso a datos va del navegador a Supabase.
- **No es Next.js.** No hay SSR/SSG ni rutas API internas. El backend es exclusivamente Supabase.
- Servida como archivos estaticos en Vercel (SPA rewrite catch-all a index.html, ver vercel.json).

---

## 2. Estructura de directorios (real)

```
pintureriapp/
|- index.tsx            # Entry point: createRoot(App)
|- App.tsx              # Router principal + guardas de rol + init de sesion
|- types.ts             # TODOS los tipos/interfaces (UserRole, User, Product...)
|- constants.tsx        # WAREHOUSE_BRANCH_ID + datos mock + branches ejemplo
|- index.css            # Estilos globales (Tailwind)
|- vite.config.ts       # Vite (puerto 3000, alias @, terser drop_console)
|- tsconfig.json        # TS estricto, target ES2022, alias @/*
|- vercel.json          # SPA rewrite catch-all
|- views/               # 34 pantallas (una por modulo), cargadas con lazy()
|- components/          # Reutilizables (Sidebar, SmartSearch, AiAssistant...)
|   |- ui/              # Lib base: Badge, Button, Card, Input, Modal, Toast
|- services/            # Capa de acceso a datos (wraps supabase-js)
|   |- supabase.ts      # createClient() con URL + clave anon
|   |- index.ts         # Barrel de exportacion
|   |- *.ts             # Servicios planos (sales, product, client...)
|   |- inventory/ restock/ coin/ transfer/ return/ packaging/ supply/
|- store/               # Estado Zustand: auth, cart, product, ui
|- hooks/               # useCart, useDebounce, useProducts, useSales, useToast
|- utils/               # csvExport, formatters
|- migrations/          # ~100 scripts SQL (RLS, RPCs, schema)
|- tests/               # e2e (Playwright) + unit (Vitest)
```

---

## 3. Patrones clave

### 3.1 Capa de servicios (Service Layer)
Cada archivo en services/ exporta un objeto con metodos async que envuelven llamadas a supabase. Ej: ProductService.getProducts(). Barrel en services/index.ts. Convencion dual: servicios planos legacy (inventoryService.ts, salesService.ts) y servicios por subdominio en carpetas (restock/restockService.ts).

### 3.2 Estado global con Zustand (no Redux)
- authStore.ts: sesion + selectores por rol (isAdmin, isWarehouse, isFinance, isStoreManager). Persiste en localStorage('pintamax_user') y sincroniza con supabase.auth.
- cartStore.ts: carrito POS; calcula subtotal/descuento/IVA (16%).
- productStore.ts: cache de productos + CRUD delegado a ProductService/StockService.
- uiStore.ts: modales, loading y notificaciones/toasts (auto-remove 5s).

### 3.3 Routing y guardas de rol (App.tsx)
- BrowserRouter + Routes/Route de react-router-dom 7.
- Todas las vistas se importan con lazy() -> code-splitting (un chunk por vista).
- La ruta / redirige segun rol al dashboard correspondiente.
- Guardas de rol explicitas por ruta.
- Init: supabase.auth.getSession() + fetch del profile en tabla profiles; escucha onAuthStateChange.

### 3.4 Acceso a datos: clave anon + RLS
- Regla critica: la app usa SOLO la clave anon.
- TODA tabla nueva requiere politica RLS para anon; sin ella SELECT devuelve vacio y los writes fallan silenciosamente.
- Operaciones multi-tabla atomicas via RPC (funciones PostgreSQL), no desde el cliente.

### 3.5 Code-splitting y build
- lazy(() => import('./views/X')) por cada vista -> chunks separados.
- Build con Terser: drop_console + drop_debugger en produccion.
- Alias @ -> raiz del proyecto (vite.config.ts + tsconfig paths).

---

## 4. Base de datos (Supabase)

### Tablas principales
products, inventory, branches, profiles, sales, sale_items, returns, restock_requests, restock_sheets, restock_items, stock_transfers, stock_transfer_items, barter_transfers (+4 relacionadas), quotations, coin_change_requests, cash_cuts, packaging_requests, internal_supplies, supply_orders, discount_requests, promotion_requests, notifications, clients, suppliers, supplier_invoices, supplier_payments, leases, lease_payments, expenses, shipping_orders, shipping_tracking_history.

### RPCs criticos (PostgreSQL functions)
get_next_folio, process_sale, confirm_restock_arrival, process_return, process_internal_consumption, confirm_transfer_receipt, complete_packaging, get_daily_cash_cut_data, process_barter_transfer_bidirectional.

---

## 5. Flujos de dominio (maquinas de estado)

| Flujo | Estados |
| Venta POS | carrito -> process_sale RPC -> descuenta inventory |
| Resurtido | pending -> aprobado -> shipped -> received |
| Devolucion | pending_authorization -> approved -> received_at_warehouse -> closed |
| Traspaso | pending -> approved -> received |
| Envasado | sent_to_branch -> received_at_branch -> processing -> completed |

---

## 6. Reglas y convenciones (de CLAUDE.md)

1. Nueva tabla Supabase -> agregar politica RLS anon.
2. Nueva ruta en App.tsx -> agregar guarda de rol explicita.
3. Nunca hardcodear IDs de sucursal; usar user.branchId o variable dinamica. Constante: WAREHOUSE_BRANCH_ID = BR-MAIN.
4. Formulario con sucursal seleccionable -> resetear producto, cart y estados al cambiar sucursal.
5. Modal/detail view -> cerrar al cambiar de tab.
6. Operacion multi-tabla -> usar RPC existente; si no, documentar que no es atomica.
7. Notificacion en servicio -> try/catch que NO bloquee la operacion principal.
8. Consulta vacia -> verificar RLS antes de asumir que no hay datos.
9. Admin/Bodega -> user.branchId puede ser undefined; usar guard !!user.branchId && en comparaciones.

---

## 7. Configuracion y comandos

- Variables de entorno (.env): VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_GROQ_API_KEY, GEMINI_API_KEY.
- Scripts: npm run dev (:3000), npm run build, npm run preview, npm run test (vitest).
- Node >= 18.
