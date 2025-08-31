import React, { useState, useEffect } from 'react';

export const LoadingSpinner: React.FC<{className?: string, startTime?: number | null}> = ({ className = 'w-12 h-12', startTime }) => {
    const [elapsedTime, setElapsedTime] = useState(0);

    useEffect(() => {
        if (!startTime) {
            setElapsedTime(0);
            return;
        }

        const intervalId = setInterval(() => {
            const elapsed = (performance.now() - startTime) / 1000;
            setElapsedTime(elapsed);
        }, 100); // Update every 100ms

        return () => clearInterval(intervalId);
    }, [startTime]);

    return (
        <div className={`relative flex items-center justify-center ${className}`}>
            <div className="absolute w-full h-full border-4 border-blue-400 border-solid rounded-full animate-spin border-t-transparent"></div>
            {!!startTime && (
                <span className="text-sm font-semibold text-blue-300">{elapsedTime.toFixed(1)}s</span>
            )}
        </div>
    );
};
