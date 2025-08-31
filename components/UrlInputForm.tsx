import React, { useState, FormEvent, useEffect, useRef } from 'react';
import { AiModel } from '../types';
import { ClearIcon, InfoIcon } from './icons';

export type InputMode = 'url' | 'text';

interface UrlInputFormProps {
  initialValue: string;
  onSubmit: (value: string, mode: InputMode) => void;
  isProcessing: boolean;
  onReset: () => void;
  model: AiModel;
  onModelChange: (model: AiModel) => void;
}

const ModelTooltip: React.FC = () => (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-700 text-gray-200 text-sm rounded-lg shadow-lg z-10 pointer-events-none">
        <p className="font-bold text-white">Flash-lite (빠름)</p>
        <p className="mb-2 text-xs">더 빠른 응답 속도. 간단한 요약 및 번역에 적합합니다.</p>
        <p className="font-bold text-white">Flash (고품질)</p>
        <p className="text-xs">더 높은 품질의 분석. 복잡하고 긴 내용의 심층 분석에 적합합니다.</p>
    </div>
);


export const UrlInputForm: React.FC<UrlInputFormProps> = ({ initialValue, onSubmit, isProcessing, onReset, model, onModelChange }) => {
  const [inputValue, setInputValue] = useState(initialValue);
  const [mode, setMode] = useState<InputMode>('url');
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  useEffect(() => {
    setInputValue(initialValue);
  }, [initialValue]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (inputValue && !isProcessing) {
      onSubmit(inputValue, mode);
    }
  };

  const handleClearInput = () => {
    setInputValue('');
    if (mode === 'url') {
      inputRef.current?.focus();
    } else {
      textareaRef.current?.focus();
    }
  };
  
  const placeholders = {
    url: "번역 및 분석할 웹 페이지 URL을 입력하세요...",
    text: "번역 및 분석할 텍스트를 여기에 붙여넣으세요...",
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
       <div className="flex space-x-1 p-1 bg-gray-800 rounded-lg max-w-min">
            <button
                type="button"
                onClick={() => setMode('url')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${mode === 'url' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
            >
                URL
            </button>
            <button
                type="button"
                onClick={() => setMode('text')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${mode === 'text' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
            >
                TEXT
            </button>
        </div>

      <div className="flex flex-col md:flex-row md:items-start space-y-2 md:space-y-0 md:space-x-2">
        <div className="relative flex-grow w-full">
          {mode === 'url' ? (
             <input
              ref={inputRef}
              type="url"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={placeholders.url}
              required
              disabled={isProcessing}
              className="w-full pl-4 pr-12 py-3 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:shadow-lg focus:shadow-blue-500/20 outline-none transition-all placeholder-gray-500 disabled:opacity-50 font-mono text-sm"
              aria-label="URL to analyze"
            />
          ) : (
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={placeholders.text}
              required
              disabled={isProcessing}
              className="w-full pl-4 pr-12 py-3 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:shadow-lg focus:shadow-blue-500/20 outline-none transition-all placeholder-gray-500 disabled:opacity-50 font-mono text-sm min-h-[120px] resize-y"
              aria-label="Text to analyze"
            />
          )}

          {inputValue && !isProcessing && (
            <button
              type="button"
              onClick={handleClearInput}
              className="absolute right-3 top-3.5 p-1 text-gray-300 hover:text-white transition-colors"
              aria-label="Clear input"
            >
              <ClearIcon className="w-5 h-5" />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={isProcessing || !inputValue.trim()}
          className="w-full md:w-auto flex-shrink-0 px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {isProcessing ? '분석 중...' : '분석'}
        </button>
      </div>

      <div className="flex flex-col-reverse md:flex-row items-center justify-between gap-4">
        <button
          type="button"
          onClick={onReset}
          disabled={isProcessing}
          className="w-full md:w-auto px-6 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          초기화
        </button>
        <div className="w-full md:w-auto flex items-center space-x-1 p-1 bg-gray-700/50 rounded-lg">
            <button
                type="button"
                onClick={() => onModelChange('gemini-2.5-flash-lite')}
                disabled={isProcessing}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${model === 'gemini-2.5-flash-lite' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
            >
                Flash-lite (빠름)
            </button>
            <button
                type="button"
                onClick={() => onModelChange('gemini-2.5-flash')}
                disabled={isProcessing}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${model === 'gemini-2.5-flash' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
            >
                Flash (고품질)
            </button>
            <div className="relative ml-1">
                <button
                    type="button"
                    onMouseEnter={() => setIsTooltipVisible(true)}
                    onMouseLeave={() => setIsTooltipVisible(false)}
                    className="p-2 text-gray-400 hover:text-white"
                >
                    <InfoIcon className="w-5 h-5"/>
                </button>
                {isTooltipVisible && <ModelTooltip />}
            </div>
        </div>
      </div>
    </form>
  );
};