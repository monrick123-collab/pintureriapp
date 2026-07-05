# 📋 Project Brief — Pintamax (pintureriapp)

> Sistema ERP / SaaS de gestión integral para pinturerías (venta e inventario de tiendas de pinturas).
> Fuente de verdad fundacional del proyecto. Leer primero.

---

## 🎯 Resumen del proyecto

**Pintamax** es una plataforma web tipo ERP orientada a cadenas de pinturerías con múltiples sucursales. Centraliza la operación comercial: punto de venta (TPV), inventario multi-sucursal, finanzas, clientes, traspasos, devoluciones, resurtidos, trueques, envasado/tintorería, cotizaciones y reportes. Incluye un asistente con IA para análisis predictivo.

- **Repositorio GitHub:** monrick123-collab/pintureriapp
- **Proyecto Supabase:** Pintamax (ref: rqrumtpqutzdbwtqjaoh, región us-east-2, estado ACTIVE_HEALTHY)
- **Organización Supabase:** monrick123-collab Org
- **Clonado localmente en:** /Users/ricardojuarez/Desktop/pintureriapp

---

## 🧩 Corrección importante de stack

> ⚠️ **El proyecto NO es Next.js.** Es una **SPA (Single Page Application)** construida con **React 19 + Vite 6 + TypeScript**. Arquitectura real detectada en package.json, vite.config.ts, index.tsx y App.tsx (BrowserRouter + lazy/Suspense).

---

## 🚀 Objetivos del producto

1. **Operación comercial unificada:** un solo sistema para ventas, inventario y finanzas en todas las sucursales.
2. **Inventario multi-sucursal en tiempo real:** stock por sucursal, traspasos, resurtidos y trueques entre tiendas.
3. **Control de roles:** permisos granulares por rol (Admin, Vendedor, Bodega, Finanzas, Encargado).
4. **Trazabilidad:** folios únicos por sucursal y flujos con estados (pendiente → aprobado → enviado → recibido).
5. **Asistencia con IA:** análisis de ventas, predicciones y sugerencias vía Gemini/Groq.
6. **Despliegue sencillo:** SPA alojada en Vercel con backend serverless en Supabase.

---

## 👥 Roles de usuario

| Rol (enum UserRole) | Descripción | Pantalla inicial |
|----------------------|-------------|-----------------|
| ADMIN | Acceso total; aprueba todas las solicitudes | Dashboard |
| WAREHOUSE | Bodega principal (hub) | WarehouseDashboard |
| WAREHOUSE_SUB | Asistente de bodega | WarehouseDashboard |
| STORE_MANAGER | Encargado de sucursal | POS |
| SELLER | Vendedor | POS |
| FINANCE | Finanzas / contabilidad | Finance |

---

## ✨ Módulos / funcionalidades principales

- **POS (Punto de Venta)** retail, mayoreo (WholesalePOS) y municipal (MunicipalPOS)
- **Gestión de Inventario** multi-sucursal con stock por sucursal
- **Resurtidos** (solicitud → aprobación → envío → recepción)
- **Traspasos** entre sucursales (incluye **Trueque** bidireccional)
- **Devoluciones** con autorización
- **Envasado / Tintorería** (Packaging)
- **Cambio de moneda** y **Corte de caja**
- **Clientes / CRM** y **Cotizaciones**
- **Finanzas:** proveedores, cuentas por pagar, arrendamientos, gastos, facturas
- **Notificaciones** en tiempo real
- **Gestión de Usuarios** y **Sucursales**
- **Dashboard** con reportes y gráficas (Recharts)
- **Asistente IA** (AiAssistant) e insights predictivos

---

## 🛠️ Stack tecnológico (resumen)

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19, TypeScript 5.8, Vite 6 |
| Estilos | Tailwind CSS |
| Routing | React Router DOM 7 |
| Estado global | Zustand 5 |
| Backend/DB | Supabase (PostgreSQL 17 + RLS) |
| Gráficas | Recharts 2 |
| IA | Google Gemini API, Groq SDK |
| Testing | Vitest (unit), Playwright (e2e) |
| Despliegue | Vercel (SPA) |

> Ver detalle de arquitectura en systemPatterns.md.

---

## 📌 Fuera de alcance (no objetivo actual)

- App móvil nativa (es web responsive).
- SSR/SSG (es una SPA pura, no usa Next.js).
- Multi-tenant estricto: el aislamiento es por branch_id, no por organización separada.
