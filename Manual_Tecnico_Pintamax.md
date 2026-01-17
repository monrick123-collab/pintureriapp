# Manual Técnico y Plan de Pruebas: Pintamax v2.0

Este manual integra las actualizaciones más recientes y proporciona un plan paso a paso para verificar la integridad del sistema.

## 🚀 Logros Tecnológicos Recientes

- **Gestión Multi-Rol**: Implementación de 4 niveles de acceso (ADMIN, SELLER, WAREHOUSE, FINANCE).
- **Venta Mayorista Robusta**: Flujo con autorización de salida y métodos de pago 'Contado' vs 'Crédito'.
- **Integridad de Tipos**: Eliminación de vulnerabilidades de tipado (`any`) y sincronización de contratos con la DB.
- **Optimización de Cotizaciones**: Corrección de visualización móvil e imágenes escaladas.

---

## 🛠 Guía de Funcionalidades y Verificación

### 1. Sistema de Usuarios y Permisos
Permite la administración centralizada de perfiles y asignación de sucursales.

- **Archivos Clave**: [UserManagement.tsx](file:///home/fergus/Descargas/pintureriapp-main/views/UserManagement.tsx), [userService.ts](file:///home/fergus/Descargas/pintureriapp-main/services/userService.ts).

#### 🧪 Plan de Pruebas:
1.  **Creación**: Ir a "Gestión de Usuarios", clic en "Nuevo Usuario".
2.  **Validación**: Ingresar un ID aleatorio (ej: `test-uid-1`), nombre, email y seleccionar el rol `FINANCE`.
3.  **Sucursal**: Asignar a `Sucursal Centro`.
4.  **Éxito**: Confirmar que el usuario aparece en la tabla y que no hay errores de consola.

### 2. POS de Mayoreo (Wholesale)
Flujo optimizado para ventas por volumen con precios automáticos.

- **Archivos Clave**: [WholesalePOS.tsx](file:///home/fergus/Descargas/pintureriapp-main/views/WholesalePOS.tsx), [salesService.ts](file:///home/fergus/Descargas/pintureriapp-main/services/salesService.ts).

#### 🧪 Plan de Pruebas:
1.  **Selección de Cliente**: Es obligatorio elegir un cliente registrado antes de agregar productos.
2.  **Trigger de Mayoreo**: Agregar 12 o más unidades de un producto (ej: Cubeta de Pintura). El precio debe cambiar automáticamente al de mayoreo.
3.  **Autorización**: Seleccionar un administrador para la "Autorización de Salida".
4.  **Finalización**: Elegir "Pago a Crédito" y finalizar. Verificar que se genere el ticket con IVA desglosado.

### 3. Logística y Resurtido (Bodega)
Control de flujo de mercancía entre la bodega central y las sucursales.

- **Archivos Clave**: [WarehouseDashboard.tsx](file:///home/fergus/Descargas/pintureriapp-main/views/WarehouseDashboard.tsx), [inventoryService.ts](file:///home/fergus/Descargas/pintureriapp-main/services/inventoryService.ts).

#### 🧪 Plan de Pruebas:
1.  **Nota de Resurtido**: Desde el panel de Bodega, seleccionar "Resurtir" en una sucursal tienda.
2.  **Selección**: Agregar productos al carrito de resurtido.
3.  **Impresión**: Al finalizar, el sistema debe redirigir a la "Nota de Envío" lista para imprimir.
4.  **Confirmación**: Iniciar sesión como SELLER en la sucursal destino y confirmar la recepción para que el stock se incremente.

---

## 🛡 Verificación de Estabilidad (Checklist Técnico)

- [x] **Sincronización Supabase**: Todas las llamadas RPC (`process_sale`, `process_internal_consumption`) usan los parámetros correctos.
- [x] **Seguridad de Datos**: Los servicios no usan casts a `any` en funciones críticas de actualización de producto.
- [x] **Responsividad**: El botón de "Vista Previa" en Cotizaciones es visible en iPhone/iPad.
- [x] **Escalado de Imágenes**: Las imágenes en el PDF de cotización mantienen su relación de aspecto original (no estiradas).

---

## 📈 Próximos Pasos Sugeridos
1.  **Auditoría**: Finalizar el módulo de auditoría en la pestaña de Finanzas.
2.  **Escaneo**: Implementar lectura de códigos de barras en el POS de mayoreo.
3.  **Dashboards**: Enriquecer los gráficos de Recharts con comparativas inter-sucursales.

---

## 🏗 Arquitectura de Base de Datos (Master)

Para garantizar la integridad y seguridad del sistema, se ha consolidado toda la estructura en un único script maestro:

- **Archivo Maestro**: [master_migration_v1.sql](file:///home/fergus/Descargas/pintureriapp-main/master_migration_v1.sql).
- **Contenido**: 
    - Unificación de tablas `clients` y `restock_requests`.
    - Implementación de seguridad RLS basada en roles (ADMIN, SELLER, WAREHOUSE, FINANCE).
    - Funciones RPC atómicas para movimientos de stock y ventas.

> [!CAUTION]
> Antes de aplicar el script maestro, asegúrate de respaldar cualquier dato existente o usarlo en una instancia limpia de Supabase para evitar conflictos de duplicidad.

> [!TIP]
> Para cualquier error de sincronización con la base de datos, utiliza siempre el [master_migration_v1.sql](file:///home/fergus/Descargas/pintureriapp-main/master_migration_v1.sql) como fuente de verdad.
