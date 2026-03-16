// Test simple para verificar migraciones
console.log("Verificando migraciones ejecutadas...");

// Verificar que salesService.ts tiene los nuevos parámetros
const fs = require('fs');
const path = require('path');

const salesServicePath = path.join(__dirname, 'services/salesService.ts');
const salesServiceContent = fs.readFileSync(salesServicePath, 'utf8');

// Verificar que processSale incluye paymentStatus y transferReference
if (salesServiceContent.includes('paymentStatus?:') && salesServiceContent.includes('transferReference?:')) {
    console.log("✅ salesService.ts tiene los nuevos parámetros");
} else {
    console.log("❌ salesService.ts NO tiene los nuevos parámetros");
}

// Verificar que WholesalePOS.tsx tiene el sistema de aprobación
const wholesalePath = path.join(__dirname, 'views/WholesalePOS.tsx');
const wholesaleContent = fs.readFileSync(wholesalePath, 'utf8');

if (wholesaleContent.includes('paymentStatus:') && wholesaleContent.includes('transferReference')) {
    console.log("✅ WholesalePOS.tsx tiene sistema de aprobación");
} else {
    console.log("❌ WholesalePOS.tsx NO tiene sistema de aprobación");
}

// Verificar que Clients.tsx tiene campos municipio
const clientsPath = path.join(__dirname, 'views/Clients.tsx');
const clientsContent = fs.readFileSync(clientsPath, 'utf8');

if (clientsContent.includes('isMunicipality') && clientsContent.includes('extraPercentage')) {
    console.log("✅ Clients.tsx tiene campos municipio");
} else {
    console.log("❌ Clients.tsx NO tiene campos municipio");
}

console.log("\n✅ Verificación de archivos completada");
console.log("Ahora necesitas:");
console.log("1. Probar el flujo de venta con transferencia/efectivo");
console.log("2. Verificar que se establece payment_status: 'pending'");
console.log("3. Implementar sistema de notificaciones");
console.log("4. Crear UI para aprobación administrativa");