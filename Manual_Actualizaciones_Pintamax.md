# 🎨 Pintamax - Manual de Últimas Actualizaciones

Este documento resume las nuevas funcionalidades y mejoras implementadas recientemente en el sistema **Pintamax** para optimizar la gestión de ventas, usuarios y cotizaciones.

---

## 1. 👥 Gestión de Usuarios (Nuevo Módulo)
Se ha implementado un módulo completo para la administración de personal y accesos.

*   **Creación de Usuarios:** Ahora es posible registrar nuevos empleados directamente desde la interfaz de administración.
*   **Roles y Permisos:** Soporte para 4 niveles de acceso:
    *   **ADMIN:** Acceso total al sistema.
    *   **SELLER:** Funciones de venta y atención a clientes.
    *   **WAREHOUSE:** Gestión de stock, entradas y salidas.
    *   **FINANCE:** Consultas de balances y reportes.
*   **Asignación por Sucursal:** Cada usuario puede ser vinculado a una sucursal específica para filtrar su inventario y ventas.

---

## 2. 🏢 Punto de Venta Mayoreo (Mejoras)
El flujo de ventas mayoristas ha sido optimizado para mayor control y seguridad.

*   **Selección de Cliente:** Integración obligatoria de clientes registrados para ventas por volumen.
*   **Autorización de Salida:** Se requiere seleccionar al administrador que autoriza la salida física de la mercancía.
*   **Métodos de Pago:** Opción de registrar ventas a **Contado** o **Crédito**, facilitando el seguimiento de cuentas por cobrar.
*   **Precios Automáticos:** El sistema utiliza automáticamente la lista de precios de mayoreo al superar los umbrales de cantidad definidos.
*   **Cálculo Fiscal:** Desglose automático de IVA (16%) y subtotal en tiempo real.

---

## 3. 📄 Cotizador Profesional (Correcciones y Mejoras)
Se mejoró la herramienta de presupuestos para una presentación más profesional hacia el cliente final.

*   **Visualización de Imágenes:** Se corrigió la escala de las imágenes de productos en la vista previa del documento para que se vean nítidas y centradas.
*   **Botón de Vista Previa Móvil:** Ahora el botón de vista previa es accesible desde dispositivos móviles y tablets, permitiendo revisar la cotización antes de imprimirla o enviarla.
*   **Folios Dinámicos:** Asignación automática de números de cotización únicos.

---

## 4. 🚀 Estabilidad y Sincronización
Mejoras en el "corazón" del sistema para garantizar que siempre esté operativo.

*   **Scripts de GitHub:** Implementación de scripts automáticos (`update-github.sh`) para asegurar que el código en la nube esté siempre sincronizado con los últimos cambios locales.
*   **Corrección de Tipados:** Se resolvieron errores lógicos en el código (TypeScript) que prevenían fallos inesperados durante el procesamiento de transacciones pesadas.

---

> [!NOTE]
> Estas actualizaciones están diseñadas para reducir errores humanos y mejorar la transparencia en los movimientos de almacén y caja.
