import React from 'react';
import { WarningCircle, ArrowClockwise } from '@phosphor-icons/react';
import { Button } from './Button';

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  title?: string;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message,
  onRetry,
  title = 'Failed to load data',
  className = '',
}) => {
  return (
    <div
      role="alert"
      className={`p-6 bg-surface border border-[#fca5a5] rounded-[0.75rem] shadow-[0_1px_2px_rgba(43,42,42,0.06)] flex flex-col items-center text-center max-w-md mx-auto ${className}`}
    >
      <div className="w-10 h-10 rounded-full bg-[#fef2f2] flex items-center justify-center text-[#dc2626] mb-3">
        <WarningCircle size={24} weight="bold" />
      </div>
      <h4 className="text-[16px] font-semibold text-ink mb-1">{title}</h4>
      <p className="text-[13px] text-subtext leading-relaxed mb-4">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <ArrowClockwise size={14} weight="bold" />
          <span>Retry</span>
        </Button>
      )}
    </div>
  );
};
