
import Groq from "groq-sdk";
import { Product } from "../types";

// API Key should be set in Vercel Environment Variables as VITE_GROQ_API_KEY
// Fallback to hardcoded key for immediate testing (as provided by user)
const API_KEY_STORAGE_KEY = 'pintamax_groq_api_key';
const DEFAULT_API_KEY = import.meta.env.VITE_GROQ_API_KEY || "";

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
}
