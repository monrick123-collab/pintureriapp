
import { GoogleGenAI, Type } from "@google/genai";
import { Product, FinancialInvoice } from "../types";

// Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY}); as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Analyzes inventory and returns reorder suggestions
 */
export async function analyzeInventory(products: Product[]) {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze this inventory and suggest reorder quantities based on current stock levels. Return suggestions as a list of bullet points in Spanish: ${JSON.stringify(products)}`,
    config: {
      systemInstruction: "Eres un experto en gestión de inventarios para tiendas de pintura. Analiza los productos y sé conciso.",
    }
  });
  return response.text;
}

/**
 * Summarizes financial status and suggests actions for overdue invoices
 */
export async function analyzeFinances(invoices: FinancialInvoice[]) {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analiza estas facturas financieras y sugiere acciones para las que están vencidas. Devuelve el resultado en un párrafo profesional en español: ${JSON.stringify(invoices)}`,
    config: {
      systemInstruction: "Eres un contador experto y asesor financiero.",
    }
  });
  return response.text;
}
