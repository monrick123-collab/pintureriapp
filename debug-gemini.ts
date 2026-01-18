
import { GoogleGenerativeAI } from "@google/generative-ai";

// Clave proporcionada por el usuario
const API_KEY = "AIzaSyATyeV5K_x2fcWrSaotLAIY-KxBTJ6j8cU";

async function diagnose() {
    console.log("=== DIAGNÓSTICO DE GEMINI API ===");
    console.log(`Probando Key terminada en: ...${API_KEY.slice(-5)}`);

    const genAI = new GoogleGenerativeAI(API_KEY);

    try {
        // 1. Intentar listar modelos disponibles (si la API lo permite en esta version)
        // Nota: El SDK de cliente a veces oculta listModels, probaremos invocación directa si falla.
        // Pero primero intentemos un modelo "seguro".

        console.log("\n--- Intento 1: gemini-1.5-flash ---");
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent("Hola, responde 'OK' si me escuchas.");
            console.log("✅ ÉXITO gemini-1.5-flash. Respuesta:", result.response.text());
        } catch (e: any) {
            console.log("❌ FALLO gemini-1.5-flash:", e.message);
        }

        console.log("\n--- Intento 2: gemini-pro ---");
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });
            const result = await model.generateContent("Hola, responde 'OK' si me escuchas.");
            console.log("✅ ÉXITO gemini-pro. Respuesta:", result.response.text());
        } catch (e: any) {
            console.log("❌ FALLO gemini-pro:", e.message);
        }

        console.log("\n--- Intento 3: gemini-2.0-flash-exp ---");
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
            const result = await model.generateContent("Hola, responde 'OK' si me escuchas.");
            console.log("✅ ÉXITO gemini-2.0-flash-exp. Respuesta:", result.response.text());
        } catch (e: any) {
            console.log("❌ FALLO gemini-2.0-flash-exp:", e.message);
        }

    } catch (error: any) {
        console.error("\n❌ ERROR GENERAL:", error);
    }
}

diagnose();
