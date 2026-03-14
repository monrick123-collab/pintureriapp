# Guía de Prueba Manual - Pinturería App

## 🚀 Iniciar la Aplicación Localmente

### Opción 1: Desarrollo (Recomendado para pruebas)
```bash
# 1. Instalar dependencias (si no lo has hecho)
npm install

# 2. Iniciar servidor de desarrollo
npm run dev

# 3. Abrir en navegador
# La aplicación estará en: http://localhost:3000
```

### Opción 2: Build de Producción
```bash
# 1. Crear build de producción
npm run build

# 2. Servir build localmente
npm run preview

# 3. Abrir en navegador
# La aplicación estará en: http://localhost:4173
```

## 🔧 Configuración Requerida

### Variables de Entorno
Verifica que el archivo `.env` contenga:
```
VITE_SUPABASE_URL=https://rqrumtpqutzdbwtqjaoh.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_rTrOdDmjiGGzl-jYeEcbeQ_pJMTSMgf
```

## 🧪 Flujos de Prueba Recomendados

### 1. **Autenticación y Navegación**
```
1. Abrir http://localhost:3000
2. Deberías ver la página de login
3. Probar navegación sin login (debería redirigir a login)
```

### 2. **Punto de Venta (POS)**
```
1. Login con usuario de prueba
2. Navegar a Punto de Venta
3. Probar:
   - Búsqueda de productos
   - Agregar productos al carrito
   - Modificar cantidades
   - Aplicar descuentos
   - Procesar venta (simulado)
```

### 3. **Inventario**
```
1. Navegar a Inventario
2. Probar:
   - Ver lista de productos
   - Filtrar por categoría
   - Buscar productos
   - Ver stock por sucursal
```

### 4. **Dashboard y Reportes**
```
1. Navegar a Dashboard
2. Verificar que se muestren:
   - KPIs de ventas
   - Gráficos (si existen)
   - Resumen del día
```

## 🐛 Problemas Comunes y Soluciones

### Problema 1: "Cannot connect to Supabase"
**Síntomas**: Errores en consola sobre conexión a Supabase
**Solución**:
```bash
# Verificar variables de entorno
cat .env

# Probar conexión manualmente
node test-supabase.js
```

### Problema 2: "Failed to compile"
**Síntomas**: Errores de TypeScript en consola
**Solución**:
```bash
# Verificar errores de TypeScript
npx tsc --noEmit

# Si hay errores, intentar:
rm -rf node_modules package-lock.json
npm install
```

### Problema 3: "Port already in use"
**Síntomas**: El servidor no puede iniciar
**Solución**:
```bash
# Matar procesos en puerto 3000
sudo lsof -ti:3000 | xargs kill -9

# O usar puerto diferente
# Editar vite.config.ts o usar variable de entorno
```

## 📱 Pruebas en Diferentes Dispositivos

### Navegadores Recomendados
- ✅ Chrome 90+ (Recomendado)
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

### Responsive Design
Verificar en:
- Desktop (1920x1080)
- Tablet (768x1024)
- Mobile (375x667)

## 🔍 Verificación de Consola

### Errores a Monitorear
1. **Errores de Red**: Verificar requests a Supabase
2. **Errores de JavaScript**: Check console for uncaught exceptions
3. **Advertencias de React**: Deprecations o key warnings

### Herramientas de Desarrollo
1. **React DevTools**: Para inspeccionar componentes y estado
2. **Redux DevTools**: Para Zustand stores (necesita extensión)
3. **Network Tab**: Para ver requests a Supabase

## 📊 Métricas de Performance

### Lighthouse Audit (Chrome DevTools)
1. Abrir DevTools (F12)
2. Ir a pestaña "Lighthouse"
3. Ejecutar auditoría para:
   - Performance
   - Accessibility
   - Best Practices
   - SEO

### Web Vitals
Monitorear en consola:
- LCP (Largest Contentful Paint)
- FID (First Input Delay)
- CLS (Cumulative Layout Shift)

## 🧪 Datos de Prueba

### Sucursales Disponibles (en Supabase)
- `BR-CENTRO` - Sucursal Centro
- `BR-NORTE` - Sucursal Norte  
- `BR-SUR` - Sucursal Sur

### Productos de Ejemplo
La base de datos contiene al menos 3 productos para pruebas.

## 🚨 Pruebas de Seguridad

### 1. **Validación de Inputs**
- Probar inyección SQL en formularios
- Verificar sanitización de datos

### 2. **Control de Acceso**
- Usuarios no autenticados no deben acceder a rutas protegidas
- Roles deben respetarse (admin vs vendedor)

### 3. **Variables de Entorno**
- Verificar que no se exponen keys en el cliente
- Confirmar que .env no se sube a GitHub

## 📝 Checklist de Pruebas

### [ ] Autenticación
- [ ] Login funciona
- [ ] Logout funciona
- [ ] Rutas protegidas redirigen

### [ ] Navegación
- [ ] Sidebar se expande/contrae
- [ ] Rutas cargan correctamente
- [ ] Breadcrumbs funcionan (si existen)

### [ ] POS
- [ ] Búsqueda de productos
- [ ] Carrito funciona
- [ ] Cálculos correctos (IVA, descuentos)
- [ ] Modal de pago

### [ ] Inventario
- [ ] Lista de productos carga
- [ ] Filtros funcionan
- [ ] Stock se muestra correctamente

### [ ] Dashboard
- [ ] KPIs se actualizan
- [ ] Gráficos renderizan
- [ ] Datos en tiempo real

### [ ] Responsive
- [ ] Desktop (OK)
- [ ] Tablet (OK)
- [ ] Mobile (OK)

### [ ] Performance
- [ ] Lighthouse score > 70
- [ ] Tiempo de carga < 3s
- [ ] Sin memory leaks

## 🎯 Pruebas Avanzadas

### 1. **Offline Mode**
- Probar con conexión lenta/inestable
- Verificar manejo de errores de red

### 2. **Concurrencia**
- Múltiples pestañas abiertas
- Estado sincronizado entre tabs

### 3. **Persistencia**
- Recargar página mantiene estado
- LocalStorage funciona correctamente

## 📞 Soporte Durante Pruebas

### Para Reportar Issues
1. Capturar screenshot del error
2. Copiar error de consola
3. Describir pasos para reproducir
4. Especificar navegador y versión

### Recursos de Ayuda
- `README-refactor.md` - Nueva arquitectura
- `migration-guide.md` - Guía de migración
- Consola de Supabase: https://supabase.com/dashboard

## 🎉 Prueba Exitosa

Una vez que todas las pruebas pasen, la aplicación está lista para:

1. ✅ **Deploy a Vercel**
2. ✅ **Uso en producción**
3. ✅ **Escalabilidad garantizada**

**Nota**: La nueva arquitectura con Zustand y servicios modularizados asegura mejor performance y mantenibilidad.