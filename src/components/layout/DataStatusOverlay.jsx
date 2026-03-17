import React from 'react';
import { Button } from '@/components/ui/button.jsx';

const DataStatusOverlay = ({
  isVisible,
  title = 'Unable to load data',
  description = 'No data was loaded. Check your connection and try again.',
  retryLabel = 'Retry',
  onRetry,
  children,
  className = '',
}) => {
  return (
    <div className={`relative ${className}`}>
      <div className={isVisible ? 'pointer-events-none select-none blur-[2px]' : ''}>
        {children}
      </div>

      {isVisible ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-slate-100/65 p-4 backdrop-blur-sm dark:bg-slate-950/65">
          <div className="w-full max-w-md rounded-xl border border-slate-300 bg-white/95 p-5 text-center shadow-xl dark:border-slate-700 dark:bg-slate-900/95">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{description}</p>
            {typeof onRetry === 'function' ? (
              <Button className="mt-4" onClick={onRetry}>
                {retryLabel}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DataStatusOverlay;
