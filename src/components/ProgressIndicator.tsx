import React from 'react';
import { JobStatus, JobStatusMessages } from '../types';
import { LoadingSpinner } from './LoadingSpinner';

interface ProgressIndicatorProps {
  status: JobStatus;
  startTime: number | null;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ status, startTime }) => {
  return (
    <div className="w-full text-center p-8 bg-gray-800/50 rounded-lg flex flex-col items-center justify-center space-y-4">
      <LoadingSpinner startTime={startTime} />
      <p className="text-lg font-medium text-gray-300">{JobStatusMessages[status]}</p>
    </div>
  );
};
