# 📘 Manual de Usuario Definitivo - Pintamax

Bienvenido al sistema **ERP y TPV de Pintamax**. Este manual describe exhaustivamente todas las funcionalidades operativas de la plataforma en la nube, la cual permite la gestión interconectada de finanzas, ventas e inventario entre múltiples sucursales.

---

## 1. 👥 Roles y Permisos (Accesos)
El sistema segmenta e interconecta la empresa mediante **4+ perfiles** principales, garantizando que cada colaborador vea solo los datos que requiere:

- **Admin (Administrador General):** Acceso total sin fricciones. Puede aprobar o rechazar cortes de caja emitidos por sucursales, visualizar balances financieros globales, editar catálogos de productos y usuarios, y visualizar las métricas en crudo.
- **Encargado (Store Manager):** Administra de forma local la operación de una sucursal tienda (Mostrador). Puede realizar ventas, emitir cotizaciones, solicitar "Resurtidos" a la Bodega Central, pedir cambio (monedas) para la operación diaria, realizar devoluciones, y ejecutar los **Cortes de Caja**.
- **Vendedor (Seller):** Enfocado 100% en el ritmo de venta. Vende en el TPV (POS), busca disponibilidad en tiempo real, registra información básica de clientes, y emite cotizaciones ágiles.
- **Bodega (Warehouse):** Central logística. Reciben pedidos de "Resurtido" solicitados por tiendas, autorizan traspasos, asientan las recepciones de proveedores con faltantes, ejecutan el **Envasado** de cubetas, y fungen como canal principal de las ventas de **Mayoreo** corporativo.
- **Finanzas (Finance):** Control del capital. Visualizan estadísticas históricas, pagos pendientes de los clientes a crédito, y llevan control íntegro de **Cuentas por Pagar** (Arrendamientos, pago de servicios).

---

## 2. 🛒 Ventas y Punto de Venta (POS)

### Venta al Menudeo (POS Normal)
- Módulo ágil. Búsqueda por SKU (código de barras) o nombre directo.
- Cálculo de impuestos invisible y automático.
- Métodos de cuenta clásica: `Efectivo`, `Tarjeta de Crédito/Débito`, `Transferencia SPEI`.
- **Precios Dinámicos con IA:** La IA sugiere el margen de tolerancia que un vendedor puede aplicar de descuento para motivar el cierre, analizando al cliente sin violar las políticas de utilidad.

### Venta al Mayoreo (Bodega/Corporativo)
- Se "activa" cuando los volúmenes en productos exceden a las métricas del detalle (ej: más de 12 barriles).
- Obliga el vínculo con un `Cliente Frecuente / Empresa` validando sus límites crediticios asíncronos.
- Permite la facturación a **Crédito** definiendo lapsos fijos para el cobro.
- Requiere seleccionar qué responsable / figura de autoridad **liberó físicamente la salida de mercancía** en las rampas de la empresa.

### Emisión de Cotizaciones
- Funciona como una plantilla de carrito de compras que *no afecta al inventario*.
- Permite ofrecer garantía de precios a los clientes durante vigencia. 
- Genera PDF interactivos estéticos adaptativos hasta para consultar en móviles.

---

## 3. 🏦 Finanzas y Administración del Flujo

### Arrendamiento y Cuentas por Pagar (Módulo Crítico)
- **Ubicación en Plataforma:** Pestaña lateral -> "Finanzas" -> "Cuentas por Pagar".
- **Concepto:** Pintamax no solo registra los ingresos; también permite asentar las fugas de capital fijo operativo para cruzar datos de rentabilidad ("Net Income").
- El **Arrendamiento** (ej: Renta del almacén principal, o renta de locales mostrador) se captura obligatoriamente aquí, definiendo montos pactados, fechas de vencimiento de la renta y proveedor de inmueble. 
- Esto garantiza que el flujo de efectivo refleje fielmente si una tienda vende mucho pero a la vez es inviable por el alto costo de arrendamiento comercial.

### Control de Cortes de Caja Diarios
- Una caja registradora debe balancearse antes del cierre temporal de turno.
- El empleado declara lo que posee contablemente en _físico_ en gaveta (Billetes, Monedas) y sube comprobantes de tarjeta/transferencia.
- El sistema pinta métricas de Descuadre de Fondo si faltan depósitos.
- Al cuadrar, se emite un estatus "Pendiente de Aprobación" que cruza por la validación inamovible de un Admin de nivel jerárquico superior.
- Este menú también asienta "Extracciones", por ejemplo, agarrar $200 de caja para pagar al del garrafón de agua potable, que queda registrado a ojos del SAT interno.

---

## 4. 📦 Bodega y Logística de Distribución

### Resurtido Inter-Sucursal ("Surtir")
- Las tiendas mostrador piden unidades a bodega (ej: "Mándanos 5 galones del color rojo colonial").
- Bodega consolida las diferentes "Hojas de requerimientos", paletiza las cajas y genera un envío físico en camión cambiando el folio a estatus de **'En Tránsito' (Shipped)**.
- El inventario queda "flotante". Solo hasta que la sucursal final da click en "Recibí e inspeccioné", el inventario digital en base de datos sube sumando el activo a su favor.

### Conversiones Físicas y Envasado ("Tambo A")
- Módulo estricto para compras a granel sin perder la mermas.
- Un barril importado puede contener X litros madre. El operador registra el volcado, indicando: _Destruir 1 barril en sistema -> Cargar 19 cubetas a plataforma_. 
- Actualiza inventario a la micro-fracción operativa.

### Órdenes al Proveedor y Recepción con Faltantes ("Semáforo")
- Módulo de "Suministros Corporativos".
- Se carga lo que el proveedor debería enviar. Al descender del tráiler en instalaciones, si una cubeta está abollada, golpeada o falta mercancía, se registra el evento en el modal como **"Recepción Parcial / Dañado"**. Las cifras se auto-corrigen y blindan las pérdidas generadas antes de aceptar ingresos defectuosos en nuestra ERP.

---

## 5. 🤖 El "Copiloto" IA (Asistente de IA)

Pintamax no está solo, existe una **Inteligencia Artificial de Negocios y Soporte** anclada directamente a la vista de los usuarios.

- **Soporte Técnico Local:** La IA conoce TODAS las especificaciones de este presente manual y navega las entrañas corporativas operacionales. Al recibir dudas por la parte de los empleados (ej: _¿Oye IA en qué opción subo la renta mensual?_), les guiará de manera instantánea a la función referida.
- **Asesoría Numérica Estratégica:** Actúa como Chief Financial Officer detectando "Fallas / Agujeros" y brindando tips automáticos (ej: "Tienes mercancía varada desde hace meses", "Aplica un descuento para subir la venta un 12% hoy", "Reduce los préstamos de caja"). Tono afable, siempre atento.
