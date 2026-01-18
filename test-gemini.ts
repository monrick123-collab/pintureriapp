
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyBoW3_hQOtggteBgDQgx5k_pzeb_4Wa4CI";

async function testConnection() {
    console.log("Testing Gemini Connection with Key ending in ...", API_KEY.slice(-4));

    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        // Try to get model - specific version
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        console.log("Attempting to generate content...");
        const result = await model.generateContent("Hello, are you there?");
        console.log("Success! Response:", result.response.text());

    } catch (e: any) {
        console.error("Content Generation Failed:", e.message);

        // Fallback: List models if possible? 
        // Note: The JS SDK might not expose listModels easily in the simplified client, 
        // but let's try to infer from the error or just try a different model.
    }
}

testConnection();
