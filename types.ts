
export type AiModel = 'gemini-2.5-flash' | 'gemini-2.5-flash-lite';

export interface JobResult {
  title: string;
  originalUrl: string;
  processingTime: {
    total: number;      // seconds
  };
  originalContent: string;
  outputs: {
    oneLineSummary: string;
    keyPoints: string[];
    keyPlayers: string[];
    keywords: string[];
    fullTranslation: string;
  };
}

// FIX: Add missing LocalHistoryItem type definition.
export interface LocalHistoryItem {
  id: number;
  timestamp: string;
  title: string;
  url: string;
  result: JobResult;
}

// Type for the result of the first AI analysis step (without translation)
export interface AnalysisOutput {
  title: string;
  oneLineSummary: string;
  keyPoints: string[];
  keyPlayers: string[];
  keywords: string[];
}


export enum UiState {
  DEFAULT = 'DEFAULT',
  PROCESSING = 'PROCESSING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export enum JobStatus {
  QUEUED = 'QUEUED',
  EXTRACTING = 'EXTRACTING',
  DETECTING_LANGUAGE = 'DETECTING_LANGUAGE',
  ANALYZING = 'ANALYZING',
  TRANSLATING = 'TRANSLATING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export const JobStatusMessages: Record<JobStatus, string> = {
  [JobStatus.QUEUED]: '작업 대기 중...',
  [JobStatus.EXTRACTING]: '본문 추출 중...',
  [JobStatus.DETECTING_LANGUAGE]: '언어 감지 중...',
  [JobStatus.ANALYZING]: '요약/키워드 추출 중...',
  [JobStatus.TRANSLATING]: '전체 번역 중...',
  [JobStatus.COMPLETED]: '분석 완료!',
  [JobStatus.FAILED]: '작업 실패',
};