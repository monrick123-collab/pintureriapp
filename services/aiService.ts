
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Product } from "../types";

// NOTE: In production, this should be an environment variable.
// For development, we'll ask the user to input it or set it in localStorage.
// API Key should be set in Vercel Environment Variables as VITE_GEMINI_API_KEY
const API_KEY_STORAGE_KEY = 'pintamax_gemini_api_key';
const DEFAULT_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

export class AiService {
    private static genAI: GoogleGenerativeAI | null = null;
    private static model: any = null;

    static initialize() {
        const key = localStorage.getItem(API_KEY_STORAGE_KEY) || DEFAULT_API_KEY;
        if (key) {
            this.genAI = new GoogleGenerativeAI(key);
            // Usar gemini-pro: el modelo legacy más compatible universalmente
            this.model = this.genAI.getGenerativeModel(
                { model: "gemini-pro" }
            );
        }
    }

    static setApiKey(key: string) {
        localStorage.setItem(API_KEY_STORAGE_KEY, key);
        this.initialize();
    }

    static hasApiKey(): boolean {
        return !!localStorage.getItem(API_KEY_STORAGE_KEY) || !!DEFAULT_API_KEY;
    }

    static async sendMessage(
        userMessage: string,
        context: { products: Product[], branchId?: string, userRole?: string }
    ): Promise<string> {
        if (!this.model) {
            this.initialize();
            if (!this.model) throw new Error("API Key no configurada");
        }

        // 1. Build System Context based on Role
        let roleInstruction = "";
        switch (context.userRole) {
            case 'ADMIN':
                roleInstruction = "Eres el consultor estratégico de Pintamax. Enfócate en análisis de ventas, eficiencia de sucursales y sugerencias proactivas para el negocio.";
                break;
            case 'FINANCE':
                roleInstruction = "Eres el auditor financiero de Pintamax. Enfócate en la precisión de precios, costos, gastos y salud financiera de las cuentas.";
                break;
            case 'WAREHOUSE':
            case 'WAREHOUSE_SUB':
                roleInstruction = "Eres el experto en logística de Pintamax. Tu prioridad es el control de stock, movimientos de almacén, caducidades y reportes de inventario crítico.";
                break;
            default: // Vendedor / POS
                roleInstruction = "Eres el asesor técnico de ventas de Pintamax. Tu objetivo es ayudar al cliente a elegir el producto correcto, explicar beneficios técnicos y verificar disponibilidad inmediata.";
        }

        // OPTIMIZATION: Limit context to avoid hitting Token Limits (TPM)
        // Only send name, price and total stock. Skip description and images.
        const productSummary = context.products.slice(0, 50).map(p =>
            `- ${p.name} ($${p.price}) Stock:${Object.values(p.inventory || {}).reduce((a: any, b: any) => a + b, 0)}`
        ).join('\n');

        const systemPrompt = `
      ESTO ES UN SISTEMA DE GESTIÓN (SaaS) PARA PINTURERÍAS LLAMADO PINTAMAX.
      
      ${roleInstruction}
      
      CONTEXTO OPERATIVO:
      - Sucursal Activa: ${context.branchId || 'General'}
      - Catálogo/Stock Actual:
      ${productSummary.slice(0, 50000)}

      REGLAS CRÍTICAS:
      1. Solo responde basado en los datos proporcionados. Si un producto no está en la lista, di que no lo tenemos.
      2. No inventes precios.
      3. Mantén un tono profesional acorde a tu rol asignado.
      4. Si el usuario te saluda, identifícate según tu rol de forma amable.
      5. Sé conciso pero informativo.
    `;

        // 2. Generate Content
        try {
            const chat = this.model.startChat({
                history: [
                    {
                        role: "user",
                        parts: [{ text: systemPrompt }],
                    },
                    {
                        role: "model",
                        parts: [{ text: "Entendido, soy el experto de Pintamax. ¿En qué puedo ayudar hoy?" }],
                    },
                ],
            });

            const result = await chat.sendMessage(userMessage);
            const response = await result.response;
            return response.text();
        } catch (error: any) {
            console.error("DEBUG - Gemini Error Full Object:", error);
            const errorMessage = error?.message || "Error desconocido";
            return `Lo siento, tuve un problema: ${errorMessage}. Verifica tu conexión o la API Key.`;
        }
    }
}
