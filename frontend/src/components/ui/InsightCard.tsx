import React from 'react';
import { Tag } from './Tag';

export interface InsightCardProps {
  tagText?: string;
  headline: React.ReactNode;
  supportingText: React.ReactNode;
  className?: string;
}

export const InsightCard: React.FC<InsightCardProps> = ({
  tagText = 'MODEL SIGNAL',
  headline,
  supportingText,
  className = '',
}) => {
  return (
    <div
      className={`bg-surface border border-border rounded-[0.75rem] p-5 md:p-6 shadow-[0_1px_2px_rgba(43,42,42,0.06)] ${className}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Tag tone="brand">{tagText}</Tag>
      </div>
      <h3 className="font-serif text-[24px] md:text-[28px] text-ink leading-tight font-normal">
        {headline}
      </h3>
      <div className="mt-2 text-[14px] text-subtext leading-relaxed">
        {supportingText}
      </div>
    </div>
  );
};
