# Active Context - Pintamax (pintureriapp)

> Contexto ACTIVO de trabajo. Mantener actualizado con el estado actual, tareas en curso y proximos pasos.

## Estado actual del proyecto

- Repo: monrick123-collab/pintureriapp (rama main).
- Backend: proyecto Supabase Pintamax (ref rqrumtpqutzdbwtqjaoh), estado ACTIVE_HEALTHY.
- Stack: React 19 + Vite 6 + TypeScript + Supabase (PostgreSQL 17) + Zustand 5.
- Clon local: /Users/ricardojuarez/Desktop/pintureriapp
- Archivo .env.local: configurado con credenciales de Supabase Pintamax.
- Vercel CLI: instalado globalmente (v58.4.4) y autenticado como monrick123-collab (team fergusxds-projects).
- Proyecto Vercel: pintureriapp linkeado, URL de produccion https://pintureriapp.vercel.app (HTTP 200).
- Variables de entorno en Vercel: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_GROQ_API_KEY (Production/Preview/Development).

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
