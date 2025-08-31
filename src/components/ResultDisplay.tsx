import React, { useState, useEffect, useRef } from 'react';
import { JobResult } from '../types';
import { ClockIcon, LinkIcon, CopyIcon, WandIcon } from './icons';
import { enhanceReadability } from '../services/apiService';
import { LoadingSpinner } from './LoadingSpinner';

interface ResultDisplayProps {
  result: JobResult;
}

// Utility function moved from utils/export.ts to simplify file structure.
const copyToClipboard = (text: string) => {
    return navigator.clipboard.writeText(text).catch(err => {
        console.error("클립보드 복사 실패:", err);
        // Re-throw the error so the component can catch it and show UI feedback.
        throw new Error("클립보드 복사에 실패했습니다.");
    });
};

type TabType = 'original' | 'translation' | 'editable';

// Helper function to create a clean, text-focused HTML for editing
const createEditableHtml = (htmlString: string): string => {
    if (!htmlString) return '';
    
    // Use the browser's DOM parser to safely manipulate the HTML
    const doc = new DOMParser().parseFromString(htmlString, 'text/html');
    
    // Define tags to be completely removed
    const tagsToRemove = ['img', 'figure', 'link', 'script', 'style', 'iframe', 'svg'];
    doc.querySelectorAll(tagsToRemove.join(', ')).forEach(el => el.remove());
    
    // Replace anchor tags with their text content to preserve the text but remove the link
    doc.querySelectorAll('a').forEach(a => {
        // replaceWith is a modern and clean way to replace a node with its children
        a.replaceWith(...a.childNodes);
    });
    
    return doc.body.innerHTML;
};


const AnalysisSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h3 className="text-base font-semibold text-blue-400 mb-2">{title}</h3>
    {children}
  </div>
);

const TagList: React.FC<{ items: string[] }> = ({ items }) => (
  <div className="flex flex-wrap gap-2">
    {items.map((item, index) => (
      <span key={index} className="bg-gray-700 text-blue-300 text-xs font-medium px-2.5 py-1 rounded-full">
        {item}
      </span>
    ))}
  </div>
);

const PointList: React.FC<{ items: string[] }> = ({ items }) => (
    <ul className="space-y-2 list-disc list-inside text-gray-300">
        {items.map((point, index) => (
            <li key={index}>{point}</li>
        ))}
    </ul>
);

export const ResultDisplay: React.FC<ResultDisplayProps> = ({ result }) => {
  const [copyButtonText, setCopyButtonText] = useState('내용 복사');
  const [activeTab, setActiveTab] = useState<TabType>('translation');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [editableContent, setEditableContent] = useState('');
  const editableDivRef = useRef<HTMLDivElement>(null);

  // Effect 1: Runs ONLY when a new result comes in.
  // It resets the state and prepares the editable content in the background.
  useEffect(() => {
    if (result) {
      setActiveTab('translation'); // Reset to the default tab
      setCopyButtonText('내용 복사');
      const cleanHtml = createEditableHtml(result.outputs.fullTranslation);
      setEditableContent(cleanHtml);
    }
  }, [result]);
  
  // Effect 2: Synchronizes the content of the editable div.
  // This runs when the active tab changes, ensuring the div is populated when it becomes visible.
  useEffect(() => {
    // Check if the editable tab is active and the ref is attached to the DOM element
    if (activeTab === 'editable' && editableDivRef.current) {
      // To prevent overwriting user edits and causing cursor jumps,
      // we only set the innerHTML if it's different from our state.
      // This is crucial for the initial population of the div.
      if (editableDivRef.current.innerHTML !== editableContent) {
        editableDivRef.current.innerHTML = editableContent;
      }
    }
  }, [activeTab, editableContent]); // Reruns when the tab or the base content changes

  const handleCopy = async () => {
    try {
      let contentToCopyHtml: string;
      switch(activeTab) {
        case 'original':
          contentToCopyHtml = result.originalContent;
          break;
        case 'translation':
          contentToCopyHtml = result.outputs.fullTranslation;
          break;
        case 'editable':
          // The state `editableContent` is kept up-to-date by the onInput event
          contentToCopyHtml = editableContent;
          break;
        default:
          contentToCopyHtml = '';
      }
      
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = contentToCopyHtml;
      const contentToCopy = tempDiv.textContent || tempDiv.innerText || '';
      await copyToClipboard(contentToCopy);

      setCopyButtonText('복사 완료!');
      setTimeout(() => setCopyButtonText('내용 복사'), 2000);
    } catch (error) {
      alert(((error as Error).message) || '클립보드 복사에 실패했습니다.');
      setCopyButtonText('복사 실패');
      setTimeout(() => setCopyButtonText('내용 복사'), 2000);
    }
  };

  const handleEnhanceReadability = async () => {
    setIsEnhancing(true);
  
    // 1. Open the new window immediately
    const newWindow = window.open("", "_blank");
    if (!newWindow) {
      alert("팝업이 차단되었습니다. 팝업을 허용하고 다시 시도해주세요.");
      setIsEnhancing(false);
      return;
    }
  
    // 2. Write placeholder/loading content to the new window
    const loadingContent = `
      <!DOCTYPE html>
      <html lang="ko" class="dark">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>가독성 향상 중... - ${result.title}</title>
          <script src="https://unpkg.com/turndown/dist/turndown.js"></script>
          <style>
            body { background-color: #171923; color: #edf2f7; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; }
            .container { max-width: 800px; margin: 2rem auto; padding: 2rem; background-color: #1a202c; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); min-height: 200px; }
            .loading-container { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 0; }
            
            .spinner-container { position: relative; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; }
            .spinner { width: 100%; height: 100%; border: 5px solid #4a5568; border-bottom-color: #60a5fa; border-radius: 50%; display: inline-block; box-sizing: border-box; animation: rotation 1s linear infinite; position: absolute; }
            @keyframes rotation { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            .timer-text { font-size: 0.9rem; color: #a0aec0; font-family: monospace; }
            
            .loading-container p { font-size: 1.1rem; color: #a0aec0; }
            .error-message { text-align: center; color: #f87171; }
            
            /* Final content styles */
            .prose-like h1, .prose-like h2, .prose-like h3 { margin-top: 1.2em; margin-bottom: 0.6em; font-weight: 600; line-height: 1.3; color: #e2e8f0; border-bottom: 1px solid #2d3748; padding-bottom: 0.3em; }
            .prose-like h1 { font-size: 1.875rem; }
            .prose-like h2 { font-size: 1.5rem; }
            .prose-like h3 { font-size: 1.25rem; }
            .prose-like p { margin-bottom: 1em; line-height: 1.7; }
            .prose-like ul, .prose-like ol { margin-left: 1.5em; margin-bottom: 1em; padding-left: 1.5em; }
            .prose-like ul { list-style-type: disc; }
            .prose-like ol { list-style-type: decimal; }
            .prose-like li { margin-bottom: 0.5em; }
            .prose-like a { color: #60a5fa; text-decoration: underline; }
            .prose-like a:hover { color: #93c5fd; }
            .prose-like blockquote { border-left: 4px solid #4a5568; padding-left: 1em; margin-left: 0; font-style: italic; color: #a0aec0; }
            .prose-like code { background-color: #2d3748; padding: 0.2em 0.4em; margin: 0; font-size: 85%; border-radius: 3px; }
            .prose-like pre { background-color: #1a202c; padding: 1em; border-radius: 6px; overflow-x: auto; }
            .prose-like pre code { background-color: transparent; padding: 0; font-size: inherit; }
            .prose-like strong { color: #f7fafc; font-weight: 600; }

            /* Action button styles */
            .actions-container > button { padding: 0.5rem 1rem; font-size: 0.9rem; background-color: #2d3748; color: #edf2f7; border: 1px solid #4a5568; border-radius: 6px; cursor: pointer; transition: background-color 0.2s; }
            .actions-container > button:hover { background-color: #4a5568; }
            .actions-container > button:disabled { background-color: #4a5568; color: #a0aec0; cursor: not-allowed; }

            /* Print styles */
            @media print {
              .no-print { display: none !important; }
              body { background-color: #ffffff; color: #000000; }
              .container { box-shadow: none; border: none; margin: 0; max-width: 100%; padding: 0; }
              .prose-like, .prose-like * { color: #000000 !important; }
              .prose-like a { color: #0000ff !important; text-decoration: underline; }
              hr { display: none; }
            }
          </style>
      </head>
      <body>
          <div id="content-container" class="container">
              <div class="loading-container">
                  <div class="spinner-container">
                    <div class="spinner"></div>
                    <span id="timer" class="timer-text">0.0s</span>
                  </div>
                  <p>AI가 가독성을 향상시키고 있습니다. 잠시만 기다려주세요...</p>
              </div>
          </div>
          <script>
            const startTime = performance.now();
            const timerElement = document.getElementById('timer');
            if (timerElement) {
              const intervalId = setInterval(() => {
                const timer = document.getElementById('timer');
                if (timer) {
                  const elapsed = (performance.now() - startTime) / 1000;
                  timer.textContent = elapsed.toFixed(1) + 's';
                } else {
                  clearInterval(intervalId);
                }
              }, 100);
            }
          </script>
      </body>
      </html>
    `;
    newWindow.document.write(loadingContent);
    newWindow.document.close();
  
    try {
      // 3. Make the API call using the current editable content
      const enhancedHtml = await enhanceReadability(editableContent);
      
      // 4. Update the new window with the final content
      newWindow.document.title = result.title;
      const contentContainer = newWindow.document.getElementById('content-container');
      if (contentContainer) {
        const headerContent = result.originalUrl ? `
            <p style="color: #a0aec0; font-size: 0.9em; margin: 0;">
                원본 링크: <a href="${result.originalUrl}" target="_blank" rel="noopener noreferrer" style="color: #60a5fa; text-decoration: underline;">${result.originalUrl}</a>
            </p>
        ` : '';

        const finalContent = `
          <div class="header no-print" style="margin-bottom: 1rem;">
            ${headerContent}
            <div class="actions-container no-print" style="margin-top: 0.75rem; display: flex; justify-content: flex-end; gap: 0.5rem;">
                <button id="copy-btn">복사하기</button>
                <button id="md-btn">MD 저장</button>
            </div>
          </div>
          <hr style="border-color: #4a5568; margin: 1.5rem 0;" class="no-print" />
          <h1 style="border: none; margin-bottom: 1rem;">${result.title}</h1>
          <div id="readable-content" class="prose-like">
              ${enhancedHtml}
          </div>
        `;
        contentContainer.innerHTML = finalContent;
        
        // Add script for functionality
        const script = newWindow.document.createElement('script');
        script.textContent = `
          function sanitizeFilename(name) {
              return name.replace(/[\\/\\\\?%*:|"<>\.]/g, '-').substring(0, 100);
          }

          const mdBtn = document.getElementById('md-btn');
          if (mdBtn) {
              mdBtn.onclick = function() {
                  if (typeof TurndownService === 'undefined') {
                      alert('Markdown 변환기가 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
                      return;
                  }
                  try {
                      const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
                      const contentElement = document.getElementById('readable-content');
                      if (!contentElement) {
                          alert('콘텐츠를 찾을 수 없습니다.');
                          return;
                      }
                      const markdown = turndownService.turndown(contentElement);
                      
                      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      const filename = sanitizeFilename(document.title) || 'export';
                      a.download = filename + '.md';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                  } catch (e) {
                      console.error(e);
                      alert('MarkDown 변환 중 오류가 발생했습니다. Turndown 라이브러리가 로드되었는지 확인해주세요.');
                  }
              };
          }

          const copyBtn = document.getElementById('copy-btn');
          if (copyBtn) {
              copyBtn.onclick = function() {
                  const contentElement = document.getElementById('readable-content');
                  if (contentElement) {
                      navigator.clipboard.writeText(contentElement.innerText).then(() => {
                          copyBtn.textContent = '복사 완료!';
                          setTimeout(() => { copyBtn.textContent = '복사하기'; }, 2000);
                      }).catch(err => {
                          alert('클립보드 복사에 실패했습니다.');
                          console.error('Copy to clipboard failed:', err);
                      });
                  }
              };
          }
        `;
        newWindow.document.body.appendChild(script);
      }
    } catch (error) {
      // 5. Update the new window with an error message
      const contentContainer = newWindow.document.getElementById('content-container');
      if (contentContainer) {
        newWindow.document.title = `오류 - 가독성 향상 실패`;
        contentContainer.innerHTML = `<div class="error-message"><h2>오류 발생</h2><p>${(error as Error).message}</p></div>`;
      }
      alert((error as Error).message);
    } finally {
      // 6. Reset the button state
      setIsEnhancing(false);
    }
  };

  const TabButton: React.FC<{tab: TabType, label: string}> = ({ tab, label }) => (
    <button
        onClick={() => setActiveTab(tab)}
        className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
            activeTab === tab
                ? 'border-b-2 border-blue-500 text-white'
                : 'text-gray-400 hover:text-white border-b-2 border-transparent'
        }`}
    >
        {label}
    </button>
  );

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden flex-grow flex flex-col mt-4">
      <header className="p-4 border-b border-gray-700 flex flex-col md:flex-row justify-between items-start gap-2">
        <div>
            <h2 className="text-lg md:text-xl font-bold text-gray-100">{result.title}</h2>
            <div className="flex flex-col items-start md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-4 text-sm text-gray-400 mt-2">
                <div className="flex items-center">
                    <ClockIcon className="w-4 h-4 mr-1" />
                    <span>총 처리 시간: {result.processingTime.total.toFixed(2)}초</span>
                </div>
                {result.originalUrl && (
                  <a href={result.originalUrl} target="_blank" rel="noopener noreferrer" className="flex items-center hover:text-blue-400 transition-colors">
                      <LinkIcon className="w-4 h-4 mr-1" />
                      <span>원본 링크</span>
                  </a>
                )}
            </div>
        </div>
      </header>
      
      <div className="overflow-y-auto p-4 flex-grow space-y-6">
        <AnalysisSection title="한 줄 요약">
            <p className="p-3 bg-gray-900/50 rounded-md text-gray-200">{result.outputs.oneLineSummary}</p>
        </AnalysisSection>

        <AnalysisSection title="주요 포인트">
            <PointList items={result.outputs.keyPoints} />
        </AnalysisSection>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnalysisSection title="핵심 인물/단체">
                <TagList items={result.outputs.keyPlayers} />
            </AnalysisSection>
            <AnalysisSection title="주요 키워드">
                <TagList items={result.outputs.keywords} />
            </AnalysisSection>
        </div>

        <div className="bg-gray-900/50 rounded-lg overflow-hidden">
            <h3 className="p-3 font-medium text-gray-200">
                전체 내용 보기
            </h3>
            <div className="p-4 border-t border-gray-700">
                <div className="border-b border-gray-600 mb-4">
                    <div className="flex overflow-x-auto">
                        <TabButton tab="original" label="원본 HTML" />
                        <TabButton tab="translation" label="번역 HTML" />
                        <TabButton tab="editable" label="편집용 HTML" />
                    </div>
                </div>
                 <div className="flex flex-col space-y-2">
                    <div className="flex justify-end items-center space-x-2">
                        {activeTab === 'editable' && (
                            <button
                                onClick={handleEnhanceReadability}
                                disabled={isEnhancing}
                                className="px-3 py-1 text-sm rounded-md bg-purple-600 hover:bg-purple-500 flex items-center transition-colors min-w-[95px] justify-center disabled:bg-gray-500 disabled:cursor-not-allowed"
                                title="AI로 가독성 향상"
                            >
                                {isEnhancing ? (
                                    <LoadingSpinner className="w-4 h-4" />
                                ) : (
                                    <>
                                        <WandIcon className="w-4 h-4 mr-2" />
                                        <span>보기좋게</span>
                                    </>
                                )}
                            </button>
                        )}
                        <button 
                            onClick={handleCopy}
                            className="px-3 py-1 text-sm rounded-md bg-gray-600 hover:bg-gray-500 flex items-center transition-colors min-w-[95px] justify-center"
                            title="현재 탭 내용 복사"
                        >
                            <CopyIcon className="w-4 h-4 mr-2" />
                            <span>{copyButtonText}</span>
                        </button>
                    </div>
                    
                    <div className="bg-gray-900 p-2 rounded-md overflow-y-auto">
                      {activeTab === 'original' && (
                        <div 
                          className="prose-like p-2"
                          dangerouslySetInnerHTML={{ __html: result.originalContent }} 
                        />
                      )}
                      {activeTab === 'translation' && (
                        <div 
                          className="prose-like p-2"
                          dangerouslySetInnerHTML={{ __html: result.outputs.fullTranslation }} 
                        />
                      )}
                      {activeTab === 'editable' && (
                        <div
                          ref={editableDivRef}
                          className="prose-like p-2 min-h-[10rem] focus:outline-none focus:ring-1 focus:ring-blue-500"
                          contentEditable={true}
                          suppressContentEditableWarning={true}
                          onInput={(e) => setEditableContent(e.currentTarget.innerHTML)}
                          // The content is now set imperatively via useEffect to prevent cursor jumps
                        />
                      )}
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
