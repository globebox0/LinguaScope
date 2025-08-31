import { Readability } from "@mozilla/readability";
import DOMPurify from 'dompurify';
import { AiModel, AnalysisOutput } from '../types';

// --- Helper for API calls to our proxy ---
async function callApiProxy(action: string, payload: object) {
    try {
        const response = await fetch('/api/proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action, payload }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `서버 에러: ${response.status}`);
        }

        return data.result;
    } catch (error) {
        console.error(`API Proxy call failed for action '${action}':`, error);
        if (error instanceof Error) {
            throw new Error(`요청 실패: ${error.message}`);
        }
        throw new Error(`'${action}' 동작을 수행하는 중 알 수 없는 오류가 발생했습니다.`);
    }
}


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
    // Vercel 환경에서는 CORS 프록시가 필요 없을 수 있으나, 만약을 위해 유지합니다.
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;

    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) {
            let errorMessage = `서버가 ${response.status} 코드로 응답했습니다. (${response.statusText})`;
            throw new Error(errorMessage);
        }
        const html = await response.text();
        
        const doc = new DOMParser().parseFromString(html, 'text/html');
        let contentToProcess: string;

        const reader = new Readability(doc.cloneNode(true) as Document);
        const article = reader.parse();

        if (article && article.content && article.textContent.trim().length > 100) {
            contentToProcess = article.content;
        } else {
            console.warn("Readability failed, falling back to manual cleaning.");
            const selectorsToRemove = [...UNWANTED_TAGS, ...UNWANTED_SELECTORS];
            doc.querySelectorAll(selectorsToRemove.join(', ')).forEach(el => el.remove());
            contentToProcess = doc.body.innerHTML;
        }

        const sanitizedContent = DOMPurify.sanitize(contentToProcess, {
            USE_PROFILES: { html: true },
            ALLOWED_TAGS: ['h1', 'h2', 'h3', 'p', 'b', 'i', 'em', 'strong', 'ul', 'ol', 'li', 'a', 'br', 'blockquote', 'pre', 'code'],
            ALLOWED_ATTR: ['href'] 
        });

        const contentDoc = new DOMParser().parseFromString(`<body>${sanitizedContent}</body>`, 'text/html');
        contentDoc.querySelectorAll('a').forEach(a => {
            try {
                const href = a.getAttribute('href');
                if (href) {
                    a.setAttribute('href', new URL(href, url).href);
                    a.setAttribute('target', '_blank');
                    a.setAttribute('rel', 'noopener noreferrer');
                }
            } catch (e) {
                a.removeAttribute('href');
            }
        });

        const finalHtml = contentDoc.body.innerHTML;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = finalHtml;
        if (!tempDiv.textContent?.trim()) {
            throw new Error("페이지에서 텍스트 콘텐츠를 추출하지 못했습니다.");
        }

        return finalHtml;
    } catch (error) {
        console.error("콘텐츠를 가져오는 중 오류 발생:", error);
         if (error instanceof Error) {
            throw error;
        }
        throw new Error("URL에서 콘텐츠를 가져오는 중 알 수 없는 오류가 발생했습니다.");
    }
};

export const detectLanguage = (contentHtml: string): Promise<string> => {
    return callApiProxy('detectLanguage', { contentHtml });
};

export const performAnalysis = (contentHtml: string, model: AiModel): Promise<AnalysisOutput> => {
    return callApiProxy('performAnalysis', { contentHtml, model });
};

export const translateAnalysis = (analysis: AnalysisOutput, model: AiModel): Promise<AnalysisOutput> => {
    return callApiProxy('translateAnalysis', { analysis, model });
};

export const performTranslation = (contentHtml: string, model: AiModel): Promise<string> => {
    return callApiProxy('performTranslation', { contentHtml, model });
};

export const enhanceReadability = (contentHtml: string): Promise<string> => {
    return callApiProxy('enhanceReadability', { contentHtml });
};
