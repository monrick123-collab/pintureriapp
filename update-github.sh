#!/bin/bash

# Script para actualizar código en GitHub rápidamente
# Uso: ./update-github.sh "Mensaje del commit"

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔄 Actualizando código en GitHub...${NC}\n"

# Verificar si hay un mensaje de commit
if [ -z "$1" ]; then
    echo -e "${RED}❌ Error: Debes proporcionar un mensaje de commit${NC}"
    echo "Uso: ./update-github.sh \"Tu mensaje de commit\""
    exit 1
fi

COMMIT_MSG="$1"

# 1. Verificar estado
echo -e "${YELLOW}📋 Verificando estado del repositorio...${NC}"
git status

# 2. Añadir todos los cambios
echo -e "\n${YELLOW}➕ Añadiendo archivos al staging...${NC}"
git add .

# 3. Verificar si hay cambios para commitear
if git diff --staged --quiet; then
    echo -e "${YELLOW}ℹ️  No hay cambios para commitear${NC}"
    exit 0
fi

# 4. Crear commit
echo -e "\n${YELLOW}💾 Creando commit...${NC}"
git commit -m "$COMMIT_MSG"

# 5. Subir a GitHub
echo -e "\n${YELLOW}🚀 Subiendo cambios a GitHub...${NC}"
git push origin main

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ ¡Código actualizado exitosamente en GitHub!${NC}"
else
    echo -e "\n${RED}❌ Error al subir cambios. Revisa tu conexión o credenciales.${NC}"
    exit 1
fi
