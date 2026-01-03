---
description: Cómo actualizar código en GitHub
---

# Workflow: Actualizar Código en GitHub

Este workflow te guía para subir cambios a GitHub de forma segura.

## Pasos para Subir Cambios

### 1. Verificar el estado actual
```bash
git status
```
Esto te mostrará qué archivos han cambiado.

### 2. Ver los cambios específicos (opcional)
```bash
git diff
```
Revisa exactamente qué modificaste.

### 3. Añadir archivos al staging
```bash
# Para añadir todos los archivos modificados:
git add .

# O para añadir archivos específicos:
git add nombre-del-archivo.tsx
```

### 4. Crear un commit con mensaje descriptivo
```bash
git commit -m "Descripción clara de los cambios"
```

**Ejemplos de buenos mensajes:**
- `"✨ Añadir módulo de reportes de ventas"`
- `"🐛 Corregir error en cálculo de inventario"`
- `"📝 Actualizar documentación de API"`
- `"🎨 Mejorar diseño del dashboard"`

### 5. Subir cambios a GitHub
```bash
git push origin main
```

## Pasos para Descargar Cambios desde GitHub

Si alguien más hizo cambios en GitHub y quieres actualizarlos localmente:

### 1. Descargar los últimos cambios
```bash
git pull origin main
```

### 2. Si hay conflictos
Git te avisará. Abre los archivos con conflictos y resuélvelos manualmente, luego:
```bash
git add .
git commit -m "Resolver conflictos de merge"
git push origin main
```

## Scripts Rápidos

### Script para subir cambios rápidamente
```bash
# Usar el script update-github.sh
./update-github.sh "Mensaje de tu commit"
```

### Script para sincronizar (descargar y subir)
```bash
# Usar el script sync-github.sh
./sync-github.sh
```

## Comandos Útiles

### Ver historial de commits
```bash
git log --oneline -10
```

### Ver ramas disponibles
```bash
git branch -a
```

### Crear una nueva rama para experimentar
```bash
git checkout -b nombre-nueva-rama
```

### Volver a la rama principal
```bash
git checkout main
```

### Deshacer el último commit (mantener cambios)
```bash
git reset --soft HEAD~1
```

## Buenas Prácticas

1. **Commits frecuentes**: Haz commits pequeños y frecuentes
2. **Mensajes claros**: Usa mensajes descriptivos
3. **Pull antes de Push**: Siempre descarga cambios antes de subir
4. **Revisar antes de commit**: Usa `git status` y `git diff`
5. **No subir archivos sensibles**: El `.env` ya está en `.gitignore`

## Emojis para Commits (Opcional)

- ✨ `:sparkles:` - Nueva característica
- 🐛 `:bug:` - Corrección de bug
- 📝 `:memo:` - Documentación
- 🎨 `:art:` - Mejoras de UI/diseño
- ♻️ `:recycle:` - Refactorización
- ⚡ `:zap:` - Mejora de rendimiento
- 🔒 `:lock:` - Seguridad
- 🚀 `:rocket:` - Despliegue
