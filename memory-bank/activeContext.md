# Active Context - Pintamax (pintureriapp)

> Contexto ACTIVO de trabajo. Mantener actualizado con el estado actual, tareas en curso y proximos pasos.

## Estado actual del proyecto

- Repo: monrick123-collab/pintureriapp (rama main).
- Backend: proyecto Supabase Pintamax (ref rqrumtpqutzdbwtqjaoh), estado ACTIVE_HEALTHY.
- Stack: React 19 + Vite 6 + TypeScript + Supabase (PostgreSQL 17) + Zustand 5.
- Clon local: /Users/ricardojuarez/Desktop/pintureriapp
- Dependencias NO instaladas aun (falta npm install).
- Archivo .env NO creado (usar .env.example como plantilla).

---

## Tareas pendientes (setup inicial)

- [ ] Crear .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY del proyecto Pintamax.
- [ ] Ejecutar npm install para instalar dependencias.
- [ ] Verificar que la app conecte a Supabase Pintamax (npm run dev).
- [ ] Revisar estado de la base de datos (tablas, RLS, migraciones aplicadas).

---

## Proximos pasos sugeridos

1. Configurar .env y levantar el dev server.
2. Inspeccionar schema/RLS de Pintamax vs las migraciones del repo.
3. Ejecutar migraciones pendientes si las hay.
4. Definir la tarea de desarrollo concreta a abordar.


---

## Estado de seguridad (post-fix RLS 2026-07-04)

- Las 58 tablas del schema public ahora tienen RLS habilitado (100 por ciento).
- notifications y packaging_order_lines selladas: anon denegado, scoping por branch_id/role.
- Patron legacy Enable All for Anon eliminado en las 2 tablas; el resto del proyecto aun lo mantiene (deuda tecnica futura).
