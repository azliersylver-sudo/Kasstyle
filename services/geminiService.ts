import { GoogleGenAI } from "@google/genai";
import { Invoice, Client } from "../types";

// This service is safe to fail if API key is missing
const apiKey = process.env.API_KEY || '';
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

export const GeminiService = {
  isAvailable: !!apiKey,

  analyzeFinancials: async (invoices: Invoice[], clients: Client[]): Promise<string> => {
    if (!ai) return "API Key not configured. Please set process.env.API_KEY.";

    const dataSummary = {
      totalInvoices: invoices.length,
      statusCounts: invoices.reduce((acc, inv) => ({...acc, [inv.status]: (acc[inv.status] || 0) + 1}), {} as Record<string, number>),
      totalRevenue: invoices.reduce((acc, inv) => acc + inv.grandTotalUsd, 0),
      topClients: clients.slice(0, 5).map(c => c.name) // Simplified for token limits
    };

    const prompt = `
      Actúa como un experto analista financiero para un negocio de importaciones en Venezuela.
      Analiza los siguientes datos resumidos del negocio:
      ${JSON.stringify(dataSummary)}

      Proporciona un resumen ejecutivo de 3 párrafos en formato Markdown:
      1. Salud financiera actual.
      2. Recomendaciones para mejorar el flujo de caja.
      3. Identificación de riesgos potenciales basados en los estados de las facturas (ej. muchos pendientes).
      
      Mantén un tono profesional y alentador.
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      return response.text || "No response generated.";
    } catch (error) {
      console.error("Gemini Error:", error);
      return "Error generating analysis. Please check your connection.";
    }
  },

  suggestProductDescription: async (productName: string): Promise<string> => {
    if (!ai) return "No AI available";
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Describe brevemente el producto "${productName}" para una factura comercial, haciéndolo sonar atractivo pero formal. Máximo 15 palabras.`
        });
        return response.text || "";
    } catch (e) {
        return "";
    }
  }
};
