#!/bin/bash
echo "=== INICIANDO APLICACIÓN PINTAMAX ==="
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ ERROR: No estás en el directorio correcto."
    echo "Ejecuta: cd /home/fergus/Descargas/pintureriapp-main"
    exit 1
fi

echo "1. Verificando dependencias..."
if [ ! -d "node_modules" ]; then
    echo "   Instalando dependencias..."
    npm install
else
    echo "   ✅ Dependencias ya instaladas"
fi

echo ""
echo "2. Verificando configuración..."
if [ ! -f ".env" ]; then
    echo "   ❌ ERROR: Archivo .env no encontrado"
    echo "   Crea un archivo .env con:"
    echo "   VITE_SUPABASE_URL=https://rqrumtpqutzdbwtqjaoh.supabase.co"
    echo "   VITE_SUPABASE_ANON_KEY=sb_publishable_rTrOdDmjiGGzl-jYeEcbeQ_pJMTSMgf"
    exit 1
else
    echo "   ✅ Configuración encontrada"
fi

echo ""
echo "3. Iniciando servidor de desarrollo..."
echo "   La aplicación estará disponible en:"
echo "   - http://localhost:3000 (o 3001 si 3000 está ocupado)"
echo "   - http://192.168.1.15:3000 (acceso desde red local)"
echo ""
echo "   Presiona Ctrl+C para detener el servidor"
echo ""
echo "   ⏳ Iniciando..."

# Iniciar servidor
npm run dev