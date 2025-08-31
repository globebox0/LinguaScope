
import { GoogleGenAI, Type } from "@google/genai";
import { Readability } from "@mozilla/readability";
import DOMPurify from 'dompurify';
import { AiModel, JobResult, AnalysisOutput } from '../types';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  // In a real app, you might want to show this error to the user.
  // For this project, we assume the key is always present.
  console.error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'A concise and suitable title for the provided text, in the original language of the text.'
    },
    oneLineSummary: {
      type: Type.STRING,
      description: 'A single, comprehensive sentence summarizing the entire text, in the original language of the text.'
    },
    keyPoints: {
      type: Type.ARRAY,
      description: 'A concise array of the 3 to 5 most critical key points from the text. Each point should be a complete but brief sentence. The points should be in the original language of the text.',
      items: { type: Type.STRING }
    },
    keyPlayers: {
        type: Type.ARRAY,
        description: 'An array of strings listing the key people, organizations, or entities mentioned in the text, in the original language.',
        items: { type: Type.STRING }
    },
    keywords: {
        type: Type.ARRAY,
        description: 'An array of strings listing the main keywords or topics of the text, in the original language.',
        items: { type: Type.STRING }
    },
  },
  required: ['title', 'oneLineSummary', 'keyPoints', 'keyPlayers', 'keywords']
};

const UNWANTED_TAGS = [
    'script', 'style', 'nav', 'footer', 'aside', 'header', 'form', 'dialog', 'iframe',
];
const UNWANTED_SELECTORS = [
    '[role="navigation"]', '[role="search"]', '[class*="ad"]', '[id*="ad-"]', 
    '[class*="comment"]', '[id*="comment"]', '[class*="cookie"]', '[id*="cookie"]',
    '[class*="promo"]', '[id*="promo"]', '[class*="sidebar"]', '[id*="sidebar"]',
    '[class*="social"]', '[id*="social"]'
];

export const fetchUrlContent = async (url: string): Promise<string> => {
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;

    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) {
            // Create a more informative error message for HTTP errors.
            let errorMessage = `서버가 ${response.status} 코드로 응답했습니다.`;
            if (response.statusText) {
                errorMessage += ` (${response.statusText})`;
            }
            // Add suggestions for common HTTP error codes.
            switch(response.status) {
                case 403:
                    errorMessage += ' 대상 서버가 접근을 거부했을 수 있습니다.';
                    break;
                case 404:
                    errorMessage += ' 페이지를 찾을 수 없습니다. URL을 확인해주세요.';
                    break;
                case 500:
                case 502:
                case 503:
                case 504:
                    errorMessage += ' 대상 서버 또는 프록시 서비스에 문제가 발생했습니다.';
                    break;
            }
            throw new Error(errorMessage);
        }
        const html = await response.text();
        
        const doc = new DOMParser().parseFromString(html, 'text/html');
        let contentToProcess: string;

        // First, try to get the main content with Readability on the original document
        const reader = new Readability(doc.cloneNode(true) as Document); // Use a clone as Readability modifies the DOM
        const article = reader.parse();

        // Check if Readability provided good content
        if (article && article.content && article.textContent.trim().length > 100) {
            contentToProcess = article.content;
        } else {
            // If Readability fails, fall back to manual cleaning of the original document
            console.warn("Readability failed or produced insufficient content, falling back to manual cleaning.");
            
            const selectorsToRemove = [...UNWANTED_TAGS, ...UNWANTED_SELECTORS];
            doc.querySelectorAll(selectorsToRemove.join(', ')).forEach(el => el.remove());
            
            contentToProcess = doc.body.innerHTML;
        }

        // Post-processing and Sanitization to preserve structure
        const sanitizedContent = DOMPurify.sanitize(contentToProcess, {
            USE_PROFILES: { html: true },
            ALLOWED_TAGS: [
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'b', 'i', 'em', 'strong',
                'ul', 'ol', 'li', 'a', 'br', 'blockquote', 'pre', 'code', 'table',
                'thead', 'tbody', 'tr', 'th', 'td'
            ],
            ALLOWED_ATTR: ['href'] 
        });

        // Resolve relative URLs and add security attributes to links
        const contentDoc = new DOMParser().parseFromString(`<body>${sanitizedContent}</body>`, 'text/html');
        contentDoc.querySelectorAll('a').forEach(a => {
            try {
                const href = a.getAttribute('href');
                if (href) {
                    const absoluteUrl = new URL(href, url).href;
                    a.setAttribute('href', absoluteUrl);
                    a.setAttribute('target', '_blank');
                    a.setAttribute('rel', 'noopener noreferrer');
                }
            } catch (e) {
                // If URL is invalid, remove the link to avoid errors
                a.removeAttribute('href');
            }
        });

        const finalHtml = contentDoc.body.innerHTML;
        
        // More robust check for actual text content to avoid sending empty structures to the AI.
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = finalHtml;
        const textContent = tempDiv.textContent || tempDiv.innerText || "";
        
        if (!textContent.trim()) {
            throw new Error("페이지에서 텍스트 콘텐츠를 추출하지 못했습니다. JavaScript로 동적 로딩되는 페이지일 수 있습니다.");
        }

        return finalHtml;
    } catch (error) {
        console.error("콘텐츠를 가져오는 중 오류 발생:", error);
        if (error instanceof TypeError && error.message.toLowerCase().includes('failed to fetch')) {
            throw new Error("네트워크 요청에 실패했습니다. 인터넷 연결을 확인하거나 프록시 서비스에 문제가 있을 수 있습니다.");
        }
        // Re-throw custom, informative errors from the try block.
        if (error instanceof Error) {
            throw error;
        }
        // Generic fallback for unknown errors.
        throw new Error("URL에서 콘텐츠를 가져오는 중 알 수 없는 오류가 발생했습니다.");
    }
};

// Helper to extract a sample of text from HTML for language detection.
const extractTextSample = (html: string, maxLength: number = 1000): string => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return (tempDiv.textContent || tempDiv.innerText || "").trim().substring(0, maxLength);
};

export const detectLanguage = async (contentHtml: string): Promise<string> => {
    try {
        const textContent = extractTextSample(contentHtml);
        if (!textContent) {
            // If there's no text, no need to translate. Classify as 'ko' to skip the step.
            return 'ko';
        }

        const prompt = `Detect the predominant language of the following text. Respond with ONLY the two-letter ISO 639-1 language code (e.g., 'en' for English, 'ko' for Korean).

        Text:
        ---
        ${textContent}
        ---
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: 0 } // Faster response for simple classification
            }
        });

        const langCode = response.text.trim().toLowerCase();

        // Basic validation for a 2-letter code
        if (/^[a-z]{2}$/.test(langCode)) {
            return langCode;
        } else {
            console.warn(`Language detection returned a non-standard code: '${langCode}'. Assuming 'en' to proceed with translation.`);
            // Fallback to 'en' if the response isn't a simple 2-letter code.
            return 'en';
        }
    } catch (error) {
        console.error("Error during language detection:", error);
        // In case of an API error, it's safer to assume the text needs translation.
        return 'en';
    }
};

// Helper function to strip potential markdown code fences from AI responses
const stripMarkdown = (text: string): string => {
    const textToClean = text.trim();
    // This regex handles code blocks with optional language identifiers (e.g., ```json, ```html, or just ```)
    const codeBlockRegex = /^```(?:\w+)?\s*([\s\S]*?)\s*```$/;
    const match = textToClean.match(codeBlockRegex);
    
    // If a match is found, return the captured group (the content inside the fence)
    if (match && match[1]) {
        return match[1].trim();
    }
    
    // If no code block fence is found, return the original trimmed string
    return textToClean;
};

// Helper to select model and its configuration based on user choice
const getModelConfig = (model: AiModel) => {
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

export const performAnalysis = async (contentHtml: string, model: AiModel): Promise<AnalysisOutput> => {
    try {
        const { modelName, config: modelConfig } = getModelConfig(model);
        const prompt = `Analyze the following HTML content from a web page. Your analysis should be based on the text within the HTML.
        
        Provide the following, all in the original language of the text:
        1. A concise "title".
        2. A single sentence "oneLineSummary".
        3. A list of the 3 to 5 most important "keyPoints". Each point should be a concise sentence.
        4. A list of "keyPlayers" (key people, organizations, or entities).
        5. A list of "keywords".
        
        Return a single, valid JSON object that matches the provided schema.
        
        HTML CONTENT TO ANALYZE:
        ---
        ${contentHtml}
        ---
        `;
        
        const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: analysisSchema,
              ...modelConfig
            },
        });
        
        const jsonString = stripMarkdown(response.text);
        let jsonResponse;
        try {
            jsonResponse = JSON.parse(jsonString);
        } catch (parseError) {
            console.error("Failed to parse JSON response from AI:", jsonString, parseError);
            throw new Error("AI 분석 실패: AI가 유효한 JSON 형식을 반환하지 않았습니다.");
        }

        if (!jsonResponse.title || !jsonResponse.oneLineSummary || !jsonResponse.keyPoints || !jsonResponse.keyPlayers || !jsonResponse.keywords) {
            throw new Error("AI analysis response is missing required fields.");
        }

        return jsonResponse;

    } catch (error) {
        console.error("Error during AI analysis:", error);
        if (error instanceof Error) {
            if (error.message.includes('JSON') || error.message.includes('object')) {
                 throw new Error(`AI 분석 실패: AI가 유효한 JSON을 반환하지 않았습니다.`);
            }
            throw new Error(`AI 분석 실패: ${error.message}`);
        }
        throw new Error("An unknown error occurred during AI analysis.");
    }
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

export const translateAnalysis = async (analysis: AnalysisOutput, model: AiModel): Promise<AnalysisOutput> => {
    try {
        const { modelName, config: modelConfig } = getModelConfig(model);
        const contentToTranslate = {
            oneLineSummary: analysis.oneLineSummary,
            keyPoints: analysis.keyPoints,
            keyPlayers: analysis.keyPlayers,
            keywords: analysis.keywords,
        };

        const prompt = `Translate the values in the following JSON object into Korean.
        Maintain the exact same JSON structure and keys. Only translate the string values.

        JSON TO TRANSLATE:
        ---
        ${JSON.stringify(contentToTranslate, null, 2)}
        ---
        `;

        const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: translatedAnalysisSchema,
                ...modelConfig,
            },
        });
        
        const jsonString = stripMarkdown(response.text);
        const translatedContent = JSON.parse(jsonString);

        return {
            ...analysis,
            ...translatedContent,
        };

    } catch (error) {
        console.error("Error during AI analysis translation:", error);
        if (error instanceof Error) {
            throw new Error(`AI 분석 번역 실패: ${error.message}`);
        }
        throw new Error("An unknown error occurred during AI analysis translation.");
    }
};


export const performTranslation = async (contentHtml: string, model: AiModel): Promise<string> => {
    try {
        const { modelName, config: modelConfig } = getModelConfig(model);
        const prompt = contentHtml;
        const systemInstruction = `You are an expert translator. Your task is to translate the user-provided HTML content into Korean.
        
        Follow these rules strictly:
        1.  Translate ONLY the user-visible text content within the HTML tags.
        2.  You MUST preserve the entire HTML structure, including all tags (e.g., <h1>, <p>, <a>) and their attributes (e.g., href, class), exactly as they are. Do not add, remove, or alter any part of the HTML structure.
        3.  Your response MUST BE ONLY the raw, translated HTML string. Do not include any extra text, explanations, or markdown code fences like \`\`\`html.
        
        Example:
        - User Input: "<h1>Hello</h1><p>Read more <a href='/about'>here</a>.</p>"
        - Your Output: "<h1>안녕하세요</h1><p><a href='/about'>여기</a>에서 더 읽어보세요.</p>"`;

        const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                ...modelConfig,
            },
        });
        
        const translatedHtml = stripMarkdown(response.text);
        
        return translatedHtml;

    } catch (error) {
        console.error("Error during AI translation:", error);
        if (error instanceof Error) {
            throw new Error(`AI 번역 실패: ${error.message}`);
        }
        throw new Error("An unknown error occurred during AI translation.");
    }
};

export const enhanceReadability = async (contentHtml: string): Promise<string> => {
    try {
        const prompt = `You are an expert editor specializing in improving the readability of web content.
        Your task is to take the following Korean HTML content and reformat it for a better reading experience.
        Do not change the core meaning, information, or language (it should remain Korean).
        Your response must be a single block of valid HTML content, without any surrounding text or code blocks like \`\`\`html.

        Apply the following improvements:
        1.  **Structure:** If appropriate, introduce \`<h2>\` or \`<h3>\` headings to create a clear hierarchy for different sections.
        2.  **Paragraphs:** Break down very long, dense paragraphs into shorter, more focused ones.
        3.  **Lists:** Identify sentences that contain lists of items and convert them into bulleted lists (\`<ul><li>...</li></ul>\`).
        4.  **Emphasis:** Use \`<strong>\` tags to highlight the most critical phrases, keywords, or conclusions. Use \`<em>\` for subtle emphasis where needed.
        5.  **Clarity:** Simplify overly complex sentences to make them easier to understand, but without losing important nuance.
        
        HTML CONTENT TO ENHANCE:
        ---
        ${contentHtml}
        ---
        `;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        const enhancedHtml = stripMarkdown(response.text);

        if (!enhancedHtml || !enhancedHtml.startsWith('<')) {
            console.error("AI did not return valid HTML for readability enhancement:", enhancedHtml);
            throw new Error("AI did not return a valid HTML response.");
        }

        return enhancedHtml;

    } catch (error) {
        console.error("Error enhancing readability with Gemini API:", error);
        if (error instanceof Error) {
            throw new Error(`가독성 향상 실패: ${error.message}`);
        }
        throw new Error("An unknown error occurred during readability enhancement.");
    }
};
