import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from "@google/genai";

// Vercel 환경 변수에서 API 키를 안전하게 가져옵니다.
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// 요청 본문의 타입을 정의합니다.
interface ApiRequestBody {
    action: 'detectLanguage' | 'performAnalysis' | 'translateAnalysis' | 'performTranslation' | 'enhanceReadability';
    payload: any;
}

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { action, payload } = req.body as ApiRequestBody;

    try {
        let result;
        switch (action) {
            case 'detectLanguage':
                result = await detectLanguage(payload.contentHtml);
                break;
            case 'performAnalysis':
                result = await performAnalysis(payload.contentHtml, payload.model);
                break;
            case 'translateAnalysis':
                 result = await translateAnalysis(payload.analysis, payload.model);
                break;
            case 'performTranslation':
                result = await performTranslation(payload.contentHtml, payload.model);
                break;
            case 'enhanceReadability':
                result = await enhanceReadability(payload.contentHtml);
                break;
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
        return res.status(200).json({ result });
    } catch (error: any) {
        console.error(`Error in action '${action}':`, error);
        return res.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
}

// --- 실제 로직 함수들 (기존 apiService.ts에서 이동 및 수정) ---

const getModelConfig = (model: 'gemini-2.5-flash' | 'gemini-2.5-flash-lite') => {
    if (model === 'gemini-2.5-flash-lite') {
        return {
            modelName: 'gemini-2.5-flash',
            config: { thinkingConfig: { thinkingBudget: 0 } }
        };
    }
    return {
        modelName: 'gemini-2.5-flash',
        config: {}
    };
};

const stripMarkdown = (text: string): string => {
    const textToClean = text.trim();
    const codeBlockRegex = /^```(?:\w+)?\s*([\s\S]*?)\s*```$/;
    const match = textToClean.match(codeBlockRegex);
    return (match && match[1]) ? match[1].trim() : textToClean;
};


const detectLanguage = async (contentHtml: string): Promise<string> => {
    const textContent = contentHtml.replace(/<[^>]*>/g, '').trim().substring(0, 1000);
    if (!textContent) return 'ko';

    const prompt = `Detect the predominant language of the following text. Respond with ONLY the two-letter ISO 639-1 language code. Text: --- ${textContent} ---`;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { thinkingConfig: { thinkingBudget: 0 } }
    });
    const langCode = response.text.trim().toLowerCase();
    return /^[a-z]{2}$/.test(langCode) ? langCode : 'en';
};

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    oneLineSummary: { type: Type.STRING },
    keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
    keyPlayers: { type: Type.ARRAY, items: { type: Type.STRING } },
    keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['title', 'oneLineSummary', 'keyPoints', 'keyPlayers', 'keywords']
};

const performAnalysis = async (contentHtml: string, model: any) => {
    const { modelName, config: modelConfig } = getModelConfig(model);
    const prompt = `Analyze the following HTML content. Provide the title, oneLineSummary, keyPoints, keyPlayers, and keywords in the original language of the text. Return a single, valid JSON object that matches the provided schema. HTML CONTENT: --- ${contentHtml} ---`;
    
    const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: analysisSchema, ...modelConfig },
    });
    return JSON.parse(stripMarkdown(response.text));
};

const translatedAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        oneLineSummary: { type: Type.STRING },
        keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
        keyPlayers: { type: Type.ARRAY, items: { type: Type.STRING } },
        keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ['oneLineSummary', 'keyPoints', 'keyPlayers', 'keywords']
};

const translateAnalysis = async (analysis: any, model: any) => {
    const { modelName, config: modelConfig } = getModelConfig(model);
    const contentToTranslate = { oneLineSummary: analysis.oneLineSummary, keyPoints: analysis.keyPoints, keyPlayers: analysis.keyPlayers, keywords: analysis.keywords };
    const prompt = `Translate the values in the following JSON object into Korean. Maintain the exact same JSON structure and keys. JSON TO TRANSLATE: --- ${JSON.stringify(contentToTranslate, null, 2)} ---`;

    const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: translatedAnalysisSchema, ...modelConfig },
    });

    const translatedContent = JSON.parse(stripMarkdown(response.text));
    return { ...analysis, ...translatedContent };
};

const performTranslation = async (contentHtml: string, model: any) => {
    const { modelName, config: modelConfig } = getModelConfig(model);
    const systemInstruction = `You are an expert translator. Translate the user-provided HTML content into Korean. Preserve the entire HTML structure and attributes exactly. Your response MUST BE ONLY the raw, translated HTML string.`;
    const response = await ai.models.generateContent({
        model: modelName,
        contents: contentHtml,
        config: { systemInstruction: systemInstruction, ...modelConfig },
    });
    return stripMarkdown(response.text);
};

const enhanceReadability = async (contentHtml: string) => {
    const prompt = `You are an expert editor. Reformat the following Korean HTML content for better readability (add headings, lists, bold text, break paragraphs). Do not change the core meaning or language. Your response must be a single block of valid HTML. HTML TO ENHANCE: --- ${contentHtml} ---`;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    const enhancedHtml = stripMarkdown(response.text);
    if (!enhancedHtml || !enhancedHtml.startsWith('<')) {
        throw new Error("AI did not return a valid HTML response.");
    }
    return enhancedHtml;
};
