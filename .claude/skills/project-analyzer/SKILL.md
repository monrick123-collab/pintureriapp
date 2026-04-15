---
name: project-analyzer
description: Diagnóstico completo y preciso del proyecto PinturaMax ERP. Detecta bugs conocidos, verifica arquitectura, prioriza issues por impacto en negocio y reporta en formato estructurado con falsos positivos descartados.
---

# SKILL: project-analyzer

Eres un auditor experto del ERP PinturaMax. Cuando se active esta skill, haz diagnósticos completos y precisos del código: detecta bugs conocidos, verifica patrones, distingue bugs activos de falsos positivos y reporta priorizando por impacto en negocio.

**Regla fundamental:** verificar siempre en código real antes de reportar. Nunca asumir por nombre de archivo o memoria.

---

## 1. Patrones de bugs conocidos (recurrentes en múltiples módulos)

### Bug timezone — `new Date().toISOString()` sin offset
- **Síntoma:** rangos de fecha cortan el día equivocado para México Central (UTC-6).
- **Patrón incorrecto:** `new Date(year, month, 1).toISOString()` → produce `Z` (UTC).
- **Patrón correcto:**
  ```ts
  const from = `${yyyy}-${mm}-01T00:00:00-06:00`;
  const to   = `${yyyy}-${mm}-${lastDay}T23:59:59-06:00`;
  ```
- **Variante sucia:** `.999ms` residual (ver Issue #21 en coinService/packagingService).
- **Dónde buscar:** todos los services con filtros por rango de fecha.

### Bug camelCase/snake_case — campos sin mapear
- **Síntoma:** `row.branchId` es `undefined` aunque la tabla tiene `branch_id`.
- **Patrón incorrecto:** `return { ...row }` o spread sin mapeo explícito.
- **Patrón correcto:** mapeo explícito en el `return` del service:
  ```ts
  return {
    id: row.id,
    branchId: row.branch_id,
    createdAt: row.created_at,
    authorizedExitBy: row.authorized_exit_by,
  };
  ```

### Bug FK join inválido — PostgREST falla sin FK formal
- **Síntoma:** `.select('*, profiles(name)')` devuelve `null` o error 400.
- **Patrón incorrecto:** asumir join anidado cuando no existe constraint FK.
- **Patrón correcto:** query separada:
  ```ts
  const { data: sale } = await supabase.from('sales').select('*').eq('id', id).single();
  const { data: profile } = await supabase
    .from('profiles').select('name').eq('id', sale.user_id).maybeSingle();
  ```

### Bug UUID visible — tabla muestra UUID crudo en lugar de nombre
- **Síntoma:** columna "Autorizado por" muestra `a1b2c3d4-...` en vez de "Juan".
- **Patrón correcto:** lookup batch con `.in()`:
  ```ts
  const userIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
  const { data: profiles } = await supabase
    .from('profiles').select('id,name').in('id', userIds);
  const nameById = new Map(profiles.map(p => [p.id, p.name]));
  ```

### Bug sentinel `'ALL'` — filtros que no excluyen el valor
- **Síntoma:** query por branch rompe cuando admin tiene sucursal = `'ALL'`.
- **Patrón correcto:**
  ```ts
  if (branchId && branchId !== 'ALL') query = query.eq('branch_id', branchId);
  ```

---

## 2. Arquitectura real del proyecto

### Servicios ACTIVOS vs MUERTOS
| Servicio | Estado | Notas |
|----------|--------|-------|
| `InventoryService` | **ACTIVO** (1,876 líneas) | Servicio principal: productos, inventario, devoluciones, traspasos |
| `TransferService` | **ACTIVO** | Traspasos |
| `CoinService` | **MIXTO** | Writes activos; reads muertos → se leen vía `InventoryService` |
| `ReturnService` | **MUERTO** | Usar `InventoryService.createReturnRequest()` |
| `SupplyService` | **MUERTO** | Operaciones van por InventoryService |
| `SalesService`, `ClientService`, `PromotionService`, `RestockService`, `PackagingService` | ACTIVOS | |

**Regla:** antes de proponer cambios en un service, confirmar si es el que realmente usa la vista (grep del import en `views/`).

### Stack y constantes
- **Stack:** React 19 + TypeScript 5.8 + Vite 6 + Supabase + Tailwind + Zustand + Recharts.
- **Timezone de negocio:** México Central (**UTC-6**).
- **RLS:** toda la app va con clave `anon` — cada tabla necesita política `FOR ALL TO anon USING (true) WITH CHECK (true)`.
- **RPCs críticos atómicos en Supabase:** `process_sale`, `confirm_restock_arrival`, `process_return`, `process_internal_consumption`, `confirm_transfer_receipt`, `complete_packaging`, `get_daily_cash_cut_data`, `get_next_folio`, `process_barter_transfer_bidirectional`.

---

## 3. Checklist de diagnóstico (aplicar a CUALQUIER módulo)

### DATOS
- [ ] ¿Las queries por rango de fecha usan `T00:00:00-06:00` / `T23:59:59-06:00`?
- [ ] ¿El mapeo en services es explícito (no `...spread` pelado)?
- [ ] ¿Los joins usan FK formal? Si no, ¿hay query separada con `.maybeSingle()`?
- [ ] ¿Los campos con UUID resuelven a nombre vía lookup batch?
- [ ] ¿El filtro de `branchId` excluye el sentinel `'ALL'`?

### SEGURIDAD
- [ ] ¿La ruta en `App.tsx` verifica rol específico (no `user ? <V/> : <Navigate/>`)?
- [ ] ¿Las acciones críticas (delete, cancel, aprobar) piden confirmación?
- [ ] ¿Los `catch` muestran mensaje al usuario (no silent fail)?

### UX
- [ ] ¿La tabla tiene `overflow-x-auto` y columnas secundarias con `hidden md:table-cell`?
- [ ] ¿Hay botón/ícono de ojo para ver detalle completo?
- [ ] ¿El form state se resetea al cambiar sucursal o tab?
- [ ] ¿Los botones tienen loading state (`disabled` + spinner)?

### CONSISTENCIA
- [ ] ¿Sigue el patrón de otros módulos similares?
- [ ] ¿Usa el servicio ACTIVO (no un servicio muerto)?
- [ ] ¿Los commits recientes tienen mensaje descriptivo (`fix:`, `feat:`, etc.)?

---

## 4. Estado actual de módulos

| Módulo | Estado | Servicios | Issues pendientes |
|--------|--------|-----------|-------------------|
| POS | estable | SalesService | #20 (responsive) |
| WholesalePOS | estable | SalesService | #20 (responsive) |
| MunicipalPOS | bugs conocidos | InventoryService | #14, #25 |
| Inventory | estable | InventoryService | — |
| Returns | bugs conocidos | InventoryService | #13 |
| Transfers (+ Trueque) | bugs conocidos | TransferService, InventoryService | #1, #2, #10 |
| Packaging | bugs conocidos | PackagingService | #9, #18, #21 |
| Restocks | estable | RestockService | — |
| CoinChange | estable | CoinService (write) + InventoryService (read) | #21 |
| CashCut / AdminCashCuts | estable | — | #20 (responsive) |
| Quotations | no revisado | — | — |
| Clients | bugs conocidos | ClientService | #15, #22 |
| AdminHistory | bugs conocidos | — | #7 |
| Finance / FinanceDashboard | bugs conocidos | financeService | #20, #26 |
| AccountsPayable | bugs conocidos | — | #19, #20 |
| SupplierManagement | bugs conocidos | — | #17 |
| Leases | bugs conocidos | — | #16 |
| WarehouseDashboard | bugs conocidos | — | #6 |
| authStore | bugs conocidos | — | #11 |

---

## 5. Issues pendientes confirmados

| # | Módulo | Resumen | SQL? |
|---|--------|---------|------|
| 1 | Transfers/Trueque | `confirmBarterReception` setea `received_by` antes del RPC | **Sí** (modificar RPC) |
| 2 | Transfers/Trueque | `cancelBarterTransfer` ejecuta 2 RPCs no atómicos | **Sí** (crear RPC `cancel_barter_transfer_full`) |
| 6 | WarehouseDashboard | Sin diseño responsive | No |
| 7 | AdminHistory | UUIDs visibles en columnas de tabla | No |
| 9 | Packaging | Modal de auth no cierra al cambiar de tab | No |
| 10 | Transfers | Modales no cierran al cambiar de tab | No |
| 11 | authStore | `signOut` con catch silencioso | No |
| 13 | Returns | `handleSubmit` con validación silenciosa | No |
| 14 | MunicipalPOS | `authorizedExitBy` sin `disabled` cuando corresponde | No |
| 15 | Clients | Delete sin doble confirmación | No |
| 16 | Leases | Registrar pago sin datos suficientes | No |
| 17 | SupplierManagement | Validaciones de formato faltantes | No |
| 18 | Packaging | No valida estado anterior antes de transición | No |
| 19 | AccountsPayable | Sin modal de detalle | No |
| 20 | POS/WholesalePOS/AdminCashCuts/AccountsPayable/Finance | Tablas sin responsive | No |
| 21 | coinService, packagingService | Timezone con `.999ms` residual | No (o RPC menor) |
| 22 | Clients | UUID visible bajo el nombre | No |
| 25 | MunicipalPOS | Modal edit no resetea al cambiar de tab | No |
| 26 | FinanceDashboard | KPIs sin responsive | No |

---

## 6. Reglas de análisis

1. **Verificar en código real** antes de reportar un bug. Nunca reportar por memoria.
2. **Distinguir bug activo vs bug potencial.** Un bug en un service muerto NO es activo.
3. **Priorizar por impacto en negocio:** DINERO > DATOS > UX > COSMÉTICO.
4. **No reportar falsos positivos** (ejemplo histórico: Issue #3 de CoinChange — verificar si el campo realmente almacena UUID o es texto libre antes de sugerir lookup).
5. **Marcar explícitamente** si el fix requiere SQL (cambio en RPC o política RLS).
6. **Proponer siempre el patrón correcto existente** en el proyecto (citar archivo:línea donde ya se hace bien).
7. Ante un bug de timezone, revisar TODOS los services con rangos de fecha (tiende a repetirse).
8. Antes de sugerir cambio en un service, confirmar que sea el ACTIVO (ver sección 2).

---

## 7. Formato de reporte

Cuando hagas un diagnóstico completo devuelve esta estructura:

### Tabla principal (ordenada por severidad)
| # | Módulo | Severidad | Causa raíz (1 línea) | SQL? |
|---|--------|-----------|----------------------|------|
| 1 | Transfers | **CRÍTICO** | RPC `confirm_barter_reception` no setea `received_by` atómicamente | Sí |
| 2 | ... | **ALTO** | ... | No |
| 3 | ... | **MEDIO** | ... | No |
| 4 | ... | **BAJO** | ... | No |

Orden estricto: **CRÍTICO → ALTO → MEDIO → BAJO**.

Escala de severidad:
- **CRÍTICO**: pierde dinero, corrompe datos, bloquea operación.
- **ALTO**: dato incorrecto visible, riesgo de seguridad, inconsistencia transaccional.
- **MEDIO**: UX degradada, falta responsive, UUID visible, silent fail.
- **BAJO**: cosmético, refactor, mensaje poco claro.

### Falsos positivos descartados
Lista los que investigaste y NO son bugs, con 1 línea de por qué se descartan (ej: "El campo es texto libre, no UUID — no aplica lookup").

### Recomendación de orden de implementación
1. Primero: CRÍTICOs que no requieran SQL (deploy rápido).
2. Luego: CRÍTICOs con SQL (coordinar migración).
3. Luego: ALTOs agrupados por módulo (minimizar context switch).
4. Al final: MEDIOs/BAJOs de UX (responsive, confirmaciones, loading states) en barrido conjunto.

---

## 8. Flujo recomendado al activarse la skill

1. Preguntar (o inferir del contexto) el alcance: **un módulo**, **varios módulos**, o **proyecto completo**.
2. Para cada módulo en alcance: leer la vista + el/los services que usa + migrations relevantes.
3. Correr el checklist de la sección 3 contra el código real.
4. Cruzar hallazgos con la tabla de issues pendientes (sección 5) para no duplicar.
5. Emitir el reporte con el formato de la sección 7.
6. Si algún hallazgo requiere SQL, incluir el snippet sugerido al final del reporte.
