#!/bin/bash
# Script para ejecutar la migración de tipos de envasado en Supabase

echo "=== Migración de Tipos de Envasado ==="
echo ""
echo "Este script ejecutará la migración SQL para actualizar los tipos de envasado."
echo "Los nuevos tipos serán:"
echo "  - cuarto_litro (0.25 litros)"
echo "  - medio_litro (0.5 litros)"
echo "  - litro (1 litro)"
echo "  - galon (3.8 litros)"
echo ""
echo "⚠️  ADVERTENCIA: Esta operación modifica la estructura de la base de datos."
echo ""

read -p "¿Continuar? (s/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "Migración cancelada."
    exit 0
fi

echo ""
echo "Para ejecutar la migración, sigue estos pasos:"
echo ""
echo "1. Ve al panel de control de Supabase:"
echo "   https://supabase.com/dashboard/project/rqrumtpqutzdbwtqjaoh"
echo ""
echo "2. Navega a 'SQL Editor' en el menú lateral"
echo ""
echo "3. Copia y pega el siguiente código SQL:"
echo ""
echo "=========================================="
cat migrations/migration_update_packaging_types_safe.sql
echo "=========================================="
echo ""
echo "4. Haz clic en 'Run' para ejecutar la migración"
echo ""
echo "5. Verifica que no haya errores"
echo ""
echo "¡Listo! La migración ha sido aplicada."