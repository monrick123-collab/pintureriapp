# 🎨 Pintamax - Gestión Integral de Pinturerías

Sistema ERP completo para la gestión de inventario, ventas (TPV), finanzas y administración de sucursales en tiempo real, potenciado con inteligencia artificial.

## 🚀 Características Principales

- **Sistema de Punto de Venta (POS)** con gestión de descuentos y múltiples métodos de pago
- **Gestión de Inventario Multi-Sucursal** con traspasos automáticos
- **Panel de Administración** con aprobación de solicitudes en tiempo real
- **Gestión de Clientes** y facturación
- **Reportes Financieros** con análisis de ventas y gastos
- **Sistema de Roles** (Admin, Vendedor, Bodega, Finanzas)
- **Integración con IA** (Gemini) para análisis predictivo

## 📋 Requisitos Previos

- **Node.js** (v18 o superior)
- **Cuenta de Supabase** (gratuita)
- **API Key de Gemini** (opcional, para funciones de IA)

## 🛠️ Instalación y Configuración

### 1. Clonar el repositorio

```bash
git clone https://github.com/monrick123-collab/pintureriapp.git
cd pintureriapp
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar Supabase

#### 3.1 Crear proyecto en Supabase
1. Ve a [supabase.com](https://supabase.com) y crea una cuenta
2. Crea un nuevo proyecto
3. Espera a que se complete la configuración

#### 3.2 Ejecutar migraciones SQL
En el **SQL Editor** de Supabase, ejecuta los siguientes archivos en orden:

1. `supabase_setup.sql` - Configuración inicial de tablas
2. `supabase_setup_v2.sql` - Tablas de ventas y clientes
3. `supabase_migrations.sql` - Perfiles de usuario
4. `supabase_restock.sql` - Sistema de resurtido
5. `migration_accounting.sql` - Contabilidad
6. `migration_discounts_fixed_v2.sql` - Sistema de descuentos
7. `migration_consumption.sql` - Consumo interno
8. `migration_wholesale.sql` - Ventas mayoreo
9. `migration_sales_discounts.sql` - Descuentos en ventas

### 4. Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_clave_anon_publica
GEMINI_API_KEY=tu_api_key_de_gemini
```

**Obtener credenciales de Supabase:**
- Ve a Settings → API en tu proyecto de Supabase
- Copia `Project URL` → `VITE_SUPABASE_URL`
- Copia `anon public` key → `VITE_SUPABASE_ANON_KEY`

### 5. Ejecutar la aplicación

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

## 🏗️ Estructura del Proyecto

```
pintureriapp/
├── components/         # Componentes reutilizables
├── services/          # Servicios de API (Supabase, Gemini)
├── views/             # Vistas principales de la aplicación
├── types.ts           # Definiciones de TypeScript
├── constants.tsx      # Datos mock y constantes
└── *.sql             # Migraciones de base de datos
```

## 👥 Sistema de Roles

- **ADMIN**: Acceso completo, aprobación de solicitudes
- **SELLER**: Punto de venta, gestión de clientes
- **WAREHOUSE**: Gestión de bodega y traspasos
- **FINANCE**: Reportes financieros y contabilidad

## 🚢 Despliegue en Producción

### Vercel (Recomendado)

1. Conecta tu repositorio de GitHub a Vercel
2. Configura las variables de entorno en Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY`
3. Despliega automáticamente

### Build Manual

```bash
npm run build
npm run preview
```

## 📱 Uso de la Aplicación

### Login Inicial
Por defecto, puedes usar cualquier email/contraseña para desarrollo. Para producción, configura autenticación en Supabase.

### Crear Primera Venta
1. Accede como SELLER
2. Ve al módulo POS
3. Agrega productos al carrito
4. Procesa el pago

### Gestionar Inventario
1. Accede como ADMIN
2. Ve a Inventario
3. Ajusta stock por sucursal
4. Solicita traspasos entre sucursales

## 🔧 Tecnologías Utilizadas

- **Frontend**: React 19, TypeScript, Vite
- **Backend**: Supabase (PostgreSQL)
- **Estilos**: Tailwind CSS
- **IA**: Google Gemini API
- **Gráficos**: Recharts
- **Routing**: React Router v7

## 📄 Licencia

Este proyecto es de código abierto.

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor, abre un issue o pull request.

## 📞 Soporte

Para preguntas o soporte, abre un issue en GitHub.
