import React, { useState, useEffect, useCallback, useReducer } from 'react';
import { AiModel, JobResult, UiState, JobStatus, AnalysisOutput } from './types';
import { UrlInputForm, InputMode } from './components/UrlInputForm';
import { ResultDisplay } from './components/ResultDisplay';
import { ProgressIndicator } from './components/ProgressIndicator';
import { useHotkeys } from './hooks/useHotkeys';
import { fetchUrlContent, performAnalysis, performTranslation, detectLanguage, translateAnalysis } from './services/apiService';
import { LogoIcon } from './components/icons';

// --- State Management with Reducer ---

interface State {
  uiState: UiState;
  jobStatus: JobStatus | null;
  currentResult: JobResult | null;
  error: string | null;
  inputValue: string;
  jobStartTime: number | null;
}

type Action =
  | { type: 'JOB_START'; payload: { value: string; startTime: number } }
  | { type: 'JOB_PROGRESS'; payload: { status: JobStatus } }
  | { type: 'JOB_SUCCESS'; payload: { result: JobResult } }
  | { type: 'JOB_ERROR'; payload: { error: string } }
  | { type: 'RESET' };

const initialState: State = {
  uiState: UiState.DEFAULT,
  jobStatus: null,
  currentResult: null,
  error: null,
  inputValue: '',
  jobStartTime: null,
};

function jobReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'JOB_START':
      return {
        ...initialState,
        uiState: UiState.PROCESSING,
        inputValue: action.payload.value,
        jobStartTime: action.payload.startTime,
        jobStatus: JobStatus.QUEUED,
      };
    case 'JOB_PROGRESS':
      return {
        ...state,
        jobStatus: action.payload.status,
      };
    case 'JOB_SUCCESS':
      return {
        ...state,
        uiState: UiState.COMPLETE,
        jobStatus: JobStatus.COMPLETED,
        currentResult: action.payload.result,
        error: null,
      };
    case 'JOB_ERROR':
      return {
        ...state,
        uiState: UiState.ERROR,
        jobStatus: JobStatus.FAILED,
        error: action.payload.error,
      };
    case 'RESET':
      return {
        ...initialState
      };
    default:
      return state;
  }
}


const App: React.FC = () => {
  const [state, dispatch] = useReducer(jobReducer, initialState);
  const [model, setModel] = useState<AiModel>('gemini-2.5-flash-lite');
  
  const handleJobSubmit = useCallback(async (value: string, mode: InputMode) => {
    const jobStart = performance.now();
    dispatch({ type: 'JOB_START', payload: { value, startTime: jobStart } });
    
    try {
      let content: string;
      let finalUrl: string;

      if (mode === 'url') {
        dispatch({ type: 'JOB_PROGRESS', payload: { status: JobStatus.EXTRACTING } });
        content = await fetchUrlContent(value);
        finalUrl = value;
      } else {
        const paragraphs = value.split(/\n{2,}/);
        content = paragraphs.map(p => {
          const lines = p.split('\n').join('<br>');
          return `<p>${lines}</p>`;
        }).join('');
        finalUrl = ''; 
      }
      
      dispatch({ type: 'JOB_PROGRESS', payload: { status: JobStatus.DETECTING_LANGUAGE } });
      const language = await detectLanguage(content);

      dispatch({ type: 'JOB_PROGRESS', payload: { status: JobStatus.ANALYZING } });
      const rawAnalysisResult = await performAnalysis(content, model);
      
      let fullTranslation: string;
      let finalAnalysisResult: AnalysisOutput;

      if (language === 'ko') {
        fullTranslation = content; 
        finalAnalysisResult = rawAnalysisResult;
      } else {
        dispatch({ type: 'JOB_PROGRESS', payload: { status: JobStatus.TRANSLATING } });
        const [translatedAnalysis, translatedContent] = await Promise.all([
          translateAnalysis(rawAnalysisResult, model),
          performTranslation(content, model)
        ]);
        finalAnalysisResult = translatedAnalysis;
        fullTranslation = translatedContent;
      }
      
      const jobEnd = performance.now();
      const totalTime = (jobEnd - jobStart) / 1000;

      const finalResult: JobResult = {
        title: finalAnalysisResult.title,
        originalUrl: finalUrl,
        originalContent: content,
        processingTime: { total: totalTime },
        outputs: {
          oneLineSummary: finalAnalysisResult.oneLineSummary,
          keyPoints: finalAnalysisResult.keyPoints,
          keyPlayers: finalAnalysisResult.keyPlayers,
          keywords: finalAnalysisResult.keywords,
          fullTranslation: fullTranslation,
        }
      };

      dispatch({ type: 'JOB_SUCCESS', payload: { result: finalResult } });
      
    } catch (err) {
      dispatch({ type: 'JOB_ERROR', payload: { error: (err as Error).message } });
    }
  }, [model]);

  const resetState = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);
  
  const toggleDarkMode = useCallback(() => {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('lingua-canvas-dark-mode', document.documentElement.classList.contains('dark').toString());
  }, []);

  useHotkeys({
    'ctrl+d': toggleDarkMode,
  });

  useEffect(() => {
    const isDarkMode = localStorage.getItem('lingua-canvas-dark-mode');
    if (isDarkMode === 'false') {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  return (
    <div className="bg-gray-900 text-gray-100 font-sans">
      <main className="flex flex-col p-4 md:p-8 min-h-screen">
        <div className="w-full max-w-4xl mx-auto flex-grow flex flex-col">
          <header className="flex items-center justify-start mb-6">
            <div className="flex items-center">
              <LogoIcon />
              <h1 className="text-xl md:text-2xl font-bold ml-2">LinguaScope</h1>
            </div>
          </header>
          
          <UrlInputForm 
            initialValue={state.inputValue}
            onSubmit={handleJobSubmit} 
            isProcessing={state.uiState === UiState.PROCESSING} 
            onReset={resetState}
            model={model}
            onModelChange={setModel}
          />

          <div className="mt-8 flex-grow flex flex-col">
            {state.uiState === UiState.PROCESSING && state.jobStatus && (
              <div className="animate-fade-in">
                <ProgressIndicator status={state.jobStatus} startTime={state.jobStartTime} />
              </div>
            )}
            {state.uiState === UiState.COMPLETE && state.currentResult && (
              <div className="animate-fade-in">
                <ResultDisplay result={state.currentResult} />
              </div>
            )}
             {state.uiState === UiState.ERROR && (
                <div className="text-center p-8 bg-red-900/20 rounded-lg animate-fade-in">
                    <h3 className="text-xl font-semibold text-red-400">작업 실패</h3>
                    <p className="mt-2 text-red-300">{state.error}</p>
                    <button onClick={resetState} className="mt-6 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                        새로 시작하기
                    </button>
                </div>
            )}
            {state.uiState === UiState.DEFAULT && (
                <div className="text-center p-8 text-gray-400">
                    <p>분석하고 싶은 웹 페이지의 URL을 입력하거나 텍스트를 직접 붙여넣어주세요.</p>
                </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
