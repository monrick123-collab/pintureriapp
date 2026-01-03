#!/bin/bash

# Script para sincronizar código con GitHub (descargar y subir)
# Uso: ./sync-github.sh

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Sincronizando con GitHub...${NC}\n"

# 1. Guardar cambios locales temporalmente (stash)
echo -e "${YELLOW}💾 Guardando cambios locales temporalmente...${NC}"
git stash

# 2. Descargar últimos cambios de GitHub
echo -e "\n${YELLOW}⬇️  Descargando cambios desde GitHub...${NC}"
git pull origin main

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error al descargar cambios${NC}"
    git stash pop
    exit 1
fi

# 3. Restaurar cambios locales
echo -e "\n${YELLOW}📦 Restaurando cambios locales...${NC}"
git stash pop

# 4. Verificar si hay conflictos
if git diff --name-only --diff-filter=U | grep -q .; then
    echo -e "\n${RED}⚠️  HAY CONFLICTOS - Debes resolverlos manualmente${NC}"
    echo -e "${YELLOW}Archivos con conflictos:${NC}"
    git diff --name-only --diff-filter=U
    echo -e "\n${YELLOW}Después de resolver los conflictos, ejecuta:${NC}"
    echo "  git add ."
    echo "  git commit -m 'Resolver conflictos'"
    echo "  git push origin main"
    exit 1
fi

# 5. Si hay cambios locales, subirlos
if ! git diff --quiet || ! git diff --staged --quiet; then
    echo -e "\n${YELLOW}📤 Hay cambios locales para subir${NC}"
    read -p "¿Deseas subirlos ahora? (s/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[SsYy]$ ]]; then
        read -p "Mensaje del commit: " commit_msg
        git add .
        git commit -m "$commit_msg"
        git push origin main
        
        if [ $? -eq 0 ]; then
            echo -e "\n${GREEN}✅ ¡Sincronización completa!${NC}"
        else
            echo -e "\n${RED}❌ Error al subir cambios${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}ℹ️  Cambios locales guardados, pero no subidos${NC}"
    fi
else
    echo -e "\n${GREEN}✅ ¡Repositorio sincronizado! No hay cambios locales.${NC}"
fi
