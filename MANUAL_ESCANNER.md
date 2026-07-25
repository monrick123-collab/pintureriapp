# Manual de Usuario — Escáner de Código de Barras

Bienvenido al nuevo módulo de escaneo de Pintamax. Esta guía te explica cómo usar el escáner para trabajar más rápido en el punto de venta y en el inventario.

---

## ¿Qué es el escáner de código de barras?

Es una herramienta nueva que te permite identificar productos al instante escaneando su código de barras, sin necesidad de escribir el nombre o buscarlo manualmente. Hay dos formas de usarlo:

1. **Pistola escáner (USB o Bluetooth)** — la conectas y funciona automáticamente.
2. **Cámara del dispositivo** — ideal para tablets y celulares; usas un botón en la pantalla.

---

## 1. Escáner de Hardware (Pistola)

### ¿Cómo funciona?
La pistola escáner funciona como un teclado: cuando apuntas y presionas el gatillo, "escribe" el código del producto a gran velocidad y presiona Enter automáticamente. **No necesitas hacer clic en ningún campo de texto** — el sistema detecta el escaneo sin importar en qué parte de la pantalla estés.

### En el Punto de Venta (POS Retail, Mayoreo y Municipal)
1. Simplemente **apunta la pistola al código de barras del producto** y presiona el gatillo.
2. El producto se **agrega automáticamente al carrito** con cantidad 1.
3. Verás un mensaje verde de confirmación: *"Producto agregado: [nombre] (escaneado)"*.
4. Si escaneas el mismo producto otra vez, se suma una unidad más.
5. Repite con todos los productos de la venta y procede a cobrar normalmente.

> **Importante:** El escáner está pausado mientras tienes abierto el modal de pago o el modal de descuento, para que no interfiera con tu trabajo.

### En el módulo de Inventario
1. Apunta la pistola al producto y escanea.
2. El código se **inyecta automáticamente en el campo de búsqueda**.
3. La tabla muestra el producto encontrado para que veas su stock en cada sucursal.

---

## 2. Escáner con Cámara (Tablet o Celular)

### ¿Cómo usarlo?
1. Busca el **botón con ícono de escáner** junto al campo de búsqueda de productos.
2. Presiona el botón. Se abrirá una ventana con la cámara activada.
3. **Apunta la cámara al código de barras** del producto.
4. Mantén la cámara a unos **15-20 cm** del código, con buena iluminación.
5. Cuando el sistema lee el código, la ventana se cierra automáticamente y el producto se procesa.

### Permisos de cámara
La **primera vez** que uses el escáner de cámara, el navegador te pedirá permiso:
- **Chrome/Edge:** Mensaje en la parte superior → **"Permitir"**.
- **Safari (iPad/iPhone):** Ventana → **"Permitir"**.
- Si rechazaste el permiso, debes ir a la configuración del navegador y habilitarlo manualmente.

> **Consejo:** El escáner prefiere la cámara trasera. Si estás en una computadora sin cámara, usa la pistola.

---

## 3. Comportamiento en cada módulo

| Módulo | Pistola | Cámara | ¿Qué hace? |
|--------|---------|--------|------------|
| POS Retail | Automático | Botón | Agrega al carrito (cantidad 1) + confirmación |
| POS Mayoreo | Automático | Botón | Agrega al carrito (cantidad 1) + confirmación |
| POS Municipal | Automático | Botón | Agrega al carrito (cantidad 1) + confirmación |
| Inventario | Automático | Botón | Solo busca y muestra en la tabla |

---

## 4. Tips y Solución de Problemas

### La pistola no lee los códigos
- **Verifica la conexión** USB o Bluetooth.
- **Limpia el lente** de la pistola con un paño suave.
- **Prueba en Bloc de Notas:** si aparecen letras/números al escanear, la pistola funciona.
- **Distancia ideal:** 10 a 30 cm del código.

### La cámara no abre
- **Permisos:** revisa que el navegador tenga permiso de cámara.
- **Otra app usando la cámara:** cierra Zoom, Meet u otras apps.
- **Sin cámara:** el sistema mostrará "No se encontró ninguna cámara".

### El producto escaneado no se encuentra
- Aparecerá: *"No encontrado: Ningún producto con código: [código]"*.
- **Causas:** el producto no está registrado, o el código no coincide con el SKU/campo barcode.
- **Solución:** pide al administrador que revise la ficha del producto en Inventario.

### El escáner interfiere cuando escribo
- El sistema distingue escritura humana de pistola. Si tienes un modal abierto, el escáner está pausado.

---

## Preguntas Frecuentes

**¿Necesito internet?** La pistola lee sin internet, pero Pintamax necesita conexión para buscar el producto. La cámara necesita internet siempre.

**¿Puedo usar pistola y cámara a la vez?** Sí, pero usa un método a la vez.

**¿Qué códigos puedo escanear?** Pistola: EAN-13, UPC, Code128, QR. Cámara: EAN-13, UPC-A, Code128, Code39, QR y más.

---

*Pintamax — Sistema de Gestión Integral para Pinturerías*
