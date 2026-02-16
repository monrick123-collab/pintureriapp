
import Groq from "groq-sdk";
import { Product } from "../types";

// API Key should be set in Vercel Environment Variables as VITE_GROQ_API_KEY
// Or users can provide it via the UI (stored in localStorage)
const API_KEY_STORAGE_KEY = 'pintamax_groq_api_key';
const DEFAULT_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';

export class AiService {
    private static groq: Groq | null = null;
    private static modelName = "llama-3.3-70b-versatile";

    static initialize() {
        // Groq SDK automatically looks for GROQ_API_KEY env var, but in browser we need to pass it
        // dangerousApiKey: true is required for client-side usage (safe because we have low limits/free tier)
        const key = localStorage.getItem(API_KEY_STORAGE_KEY) || DEFAULT_API_KEY;
        if (key && !this.groq) {
            this.groq = new Groq({
                apiKey: key,
                dangerouslyAllowBrowser: true
            });
        }
    }

    private static MANUAL_CONTENT = `
Manual de Usuario: "Pintamax Facilito" 🎨

1. Accesos de Prueba (Demo)
- Admin: admin@pintamax.com
- Encargado: encargado@pintamax.com
- Bodega: bodega@pintamax.com
- Vendedor: vendedor@pintamax.com
- Contador: contador@pintamax.com

2. Permisos (¿Qué puedo hacer?)
- Vendedor: POS (Vender), Ver Precios, Registrar Clientes.
- Encargado: POS + Cotizaciones + Resurtidos (Pedir) + Corte de Caja + Devoluciones.
- Bodega: Envasado (Tambos->Cubetas) + Surtir Pedidos + Mayoreo + Insumos.
- Finanzas: Cuentas por Pagar + Arrendamientos + Proveedores.
- Admin: Todo + Aprobar Cortes.

3. Guía Paso a Paso
A. Vender (POS): POS > Buscar > Agregar > COBRAR > Método Pago.
B. Mayoreo (Crédito): Venta Mayoreo > Cliente > Agregar > Cobrar > Crédito.
C. Resurtido (Pedir): Inventario > Resurtidos > Solicitar > Enviar. Recibir: Confirmar Recepción.
D. Envasado: Envasado > Nuevo > Origen (Tambo) > Destino (Cubeta) > Iniciar > Llenar > Finalizar.
E. Corte de Caja (Encargado): Corte de Caja > Contar físico > Comparar > Revisar Gastos > ENVIAR A REVISIÓN.
F. Aprobar Corte (Admin): Aprobación Cortes > Revisar > Aprobar/Rechazar.

4. Trucos
- ¿Perdido? Pregúntame a mí (IA).
- ¿Falla IA? Clic en Llave 🗝️ > Poner nueva API Key.
- ¿Sin cambio? Botón "Cambio de Moneda".
    `;

    static setApiKey(key: string) {
        localStorage.setItem(API_KEY_STORAGE_KEY, key);
        this.groq = null; // Force re-initialization
        this.initialize();
    }

    static hasApiKey(): boolean {
        return !!localStorage.getItem(API_KEY_STORAGE_KEY) || !!DEFAULT_API_KEY;
    }

    static async sendMessage(
        userMessage: string,
        context: {
            products: Product[],
            branchId?: string,
            userRole?: string,
            financeContext?: {
                accountsPayable: number,
                monthlyExpenses: number,
                netIncome: number
            }
        }
    ): Promise<string> {
        this.initialize();

        // 1. Build System Context based on Role
        let roleInstruction = "";
        let financeDataSnippet = "";

        switch (context.userRole) {
            case 'ADMIN':
                roleInstruction = "Eres el consultor estratégico de Pintamax. Enfócate en análisis de ventas, eficiencia de sucursales y sugerencias proactivas para el negocio.";
                if (context.financeContext) {
                    financeDataSnippet = `
                    RESUMEN FINANCIERO (ADMIN):
                    - Cuentas por Pagar: $${context.financeContext.accountsPayable.toLocaleString()}
                    - Gastos Mes: $${context.financeContext.monthlyExpenses.toLocaleString()}
                    - Utilidad Neta Est.: $${context.financeContext.netIncome.toLocaleString()}
                    `;
                }
                break;
            case 'FINANCE':
                roleInstruction = "Eres 'ContadorAI', el asistente financiero experto de Pintamax. Tu labor es analizar flujos de caja, detectar gastos inusuales y asegurar el pago puntual a proveedores.";
                if (context.financeContext) {
                    financeDataSnippet = `
                    ESTADO FINANCIERO ACTUAL:
                    - Cuentas por Pagar (Deuda): $${context.financeContext.accountsPayable.toLocaleString()}
                    - Gastos Operativos Mes: $${context.financeContext.monthlyExpenses.toLocaleString()}
                    - Utilidad Estimada: $${context.financeContext.netIncome.toLocaleString()}
                    `;
                }
                break;
            case 'WAREHOUSE':
            case 'WAREHOUSE_SUB':
                roleInstruction = "Eres el experto en logística de Pintamax. Tu prioridad es el control de stock, movimientos de almacén, caducidades y reportes de inventario crítico.";
                break;
            default: // Vendedor / POS
                roleInstruction = "Eres el asesor técnico de ventas de Pintamax. Tu objetivo es ayudar al cliente a elegir el producto correcto, explicar beneficios técnicos y verificar disponibilidad inmediata.";
        }

        // OPTIMIZATION: Limit context
        const productSummary = context.products.slice(0, 50).map(p =>
            `- ${p.name} ($${p.price}) Stock:${Object.values(p.inventory || {}).reduce((a: any, b: any) => a + b, 0)}`
        ).join('\n');

        const systemPrompt = `
      ESTO ES UN SISTEMA DE GESTIÓN (SaaS) PARA PINTURERÍAS LLAMADO PINTAMAX.
      
      ${roleInstruction}
      
      CONTEXTO OPERATIVO:
      - Sucursal Activa: ${context.branchId || 'General'}
      ${financeDataSnippet}
      - Catálogo/Stock Actual (Muestra):
      ${productSummary.slice(0, 30000)}

      REGLAS CRÍTICAS:
      1. Solo responde basado en los datos proporcionados. Si un producto no está en la lista, di que no lo tenemos.
      2. No inventes precios.
      3. Mantén un tono profesional acorde a tu rol asignado.
      4. Si el usuario te saluda, identifícate según tu rol de forma amable.
      5. Sé conciso pero informativo.
      6. SI TE PREGUNTAN CÓMO HACER ALGO: Usa la información del MANUAL DE USUARIO abajo.

      MANUAL DE USUARIO RESUMIDO:
      ${this.MANUAL_CONTENT}
    `;

        // 2. Generate Content using Groq
        try {
            if (!this.groq) throw new Error("Groq client not initialized");

            const completion = await this.groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: userMessage
                    }
                ],
                model: this.modelName,
                temperature: 0.5,
                max_tokens: 1024,
            });

            return completion.choices[0]?.message?.content || "No pude generar una respuesta.";

        } catch (error: any) {
            console.error("DEBUG - Groq Error:", error);
            const errorMessage = error?.message || "Error desconocido";
            return `Lo siento, tuve un problema conectando con Groq: ${errorMessage}.`;
        }
    }


    static async generateBusinessInsights(
        context: {
            sales: any[], // Simplified Sale Interface
            products: Product[]
        }
    ): Promise<string> {
        this.initialize();

        // 1. Prepare Data Summary for AI
        const totalSales = context.sales.reduce((sum, s) => sum + s.total, 0);

        // Find top selling products
        const productSales: Record<string, number> = {};
        context.sales.forEach(s => {
            s.items.forEach((i: any) => {
                productSales[i.productName] = (productSales[i.productName] || 0) + i.quantity;
            });
        });

        const topProducts = Object.entries(productSales)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, qty]) => `${name} (${qty} vendidos)`)
            .join(', ');

        const lowStock = context.products
            .filter(p => Object.values(p.inventory).reduce((a: any, b: any) => a + b, 0) < 10)
            .slice(0, 5)
            .map(p => p.name)
            .join(', ');

        const systemPrompt = `
            ACTÚA COMO UN CONSULTOR DE NEGOCIOS EXPERTO PARA PINTAMAX (Pinturería).
            
            DATOS DE LA SEMANA/MES:
            - Ventas Totales: $${totalSales.toLocaleString()}
            - Productos Estrella: ${topProducts || 'Sin datos suficientes'}
            - Alerta Stock Bajo: ${lowStock || 'Ninguno crítico'}

            TU TAREA:
            Genera 3 consejos estratégicos MUY BREVES Y ACCIONABLES (máximo 15 palabras cada uno) en formato JSON estricto.
            Deben enfocarse en: 1) Aumentar margen, 2) Mover inventario estancado, o 3) Prevenir quiebres de stock.
            
            FORMATO RESPUESTA JSON:
            {
                "tips": [
                    { "title": "Promoción", "description": "Haz pack de rodillos con pintura..." },
                    { "title": "Reabastece", "description": "Pide más Impermeabilizante antes del viernes..." },
                    { "title": "Oportunidad", "description": "Sube precio a X..." }
                ]
            }
            SOLO JSON VALIDO. SIN EXPLICACIONES.
        `;

        try {
            if (!this.groq) throw new Error("Groq client not initialized");

            const completion = await this.groq.chat.completions.create({
                messages: [{ role: "user", content: systemPrompt }],
                model: this.modelName,
                temperature: 0.4,
                response_format: { type: "json_object" },
                max_tokens: 300,
            });

            return completion.choices[0]?.message?.content || '{"tips": []}';

        } catch (error: any) {
            console.error("DEBUG - Groq Insights Error:", error);
            return '{"tips": []}';
        }
    }
    static async getDynamicPricingSuggestion(
        client: any, // Client type
        cartItems: any[] // CartItem type
    ): Promise<{ discount: number, reasoning: string }> {
        this.initialize();

        const cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const itemSummary = cartItems.map(i => `${i.name} (x${i.quantity})`).join(', ');

        const systemPrompt = `
            ACTÚA COMO UN GERENTE DE VENTAS EXPERTO.
            
            CLIENTE: ${client.name} (${client.type})
            HISTORIAL: Límite crédito $${client.creditLimit || 0}, Días crédito: ${client.creditDays || 0}
            COMPRA ACTUAL: $${cartTotal.toLocaleString()} - Items: ${itemSummary}

            TU TAREA:
            Sugiere un porcentaje de descuento (0-15%) para cerrar esta venta, considerando el volumen y perfil del cliente.
            
            FORMATO RESPUESTA JSON:
            {
                "discount": 5,
                "reasoning": "Volumen alto de cubetas y cliente frecuente."
            }
        `;

        try {
            if (!this.groq) throw new Error("Groq client not initialized");

            const completion = await this.groq.chat.completions.create({
                messages: [{ role: "user", content: systemPrompt }],
                model: this.modelName,
                temperature: 0.3,
                response_format: { type: "json_object" },
                max_tokens: 150,
            });

            const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
            return {
                discount: result.discount || 0,
                reasoning: result.reasoning || "No se pudo generar descuento."
            };

        } catch (error) {
            console.error("DEBUG - AI Pricing Error:", error);
            return { discount: 0, reasoning: "Error de conexión con IA." };
        }
    }
}
