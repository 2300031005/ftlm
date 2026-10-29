import React from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { fmtDate } from '../../lib/format';

export interface DayPickerProps {
  dates: string[];
  selectedDate: string;
  onChange: (date: string) => void;
  className?: string;
}

export const DayPicker: React.FC<DayPickerProps> = ({
  dates,
  selectedDate,
  onChange,
  className = '',
}) => {
  const currentIndex = dates.indexOf(selectedDate);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < dates.length - 1;

  const handlePrev = () => {
    if (hasPrev) {
      const prevDate = dates[currentIndex - 1];
      if (prevDate) onChange(prevDate);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      const nextDate = dates[currentIndex + 1];
      if (nextDate) onChange(nextDate);
    }
  };

  return (
    <div
      className={`inline-flex items-center bg-surface border border-border rounded-[0.375rem] shadow-[0_1px_2px_rgba(43,42,42,0.05)] overflow-hidden ${className}`}
    >
      <button
        type="button"
        onClick={handlePrev}
        disabled={!hasPrev}
        aria-label="Previous delivery day"
        className="px-2 py-1.5 text-subtext hover:text-ink hover:bg-[rgba(43,42,42,0.04)] disabled:opacity-30 disabled:pointer-events-none transition-standard border-r border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:z-10"
      >
        <CaretLeft size={16} weight="bold" />
      </button>

      <div className="relative flex items-center px-3 py-1.5">
        <select
          value={selectedDate}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Select delivery date"
          className="appearance-none bg-transparent text-[13px] font-mono tabular-nums font-semibold text-ink pr-5 cursor-pointer focus-visible:outline-none"
        >
          {dates.map((d) => (
            <option key={d} value={d}>
              {fmtDate(d)}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2 text-subtext text-[11px]">
          ▼
        </span>
      </div>

      <button
        type="button"
        onClick={handleNext}
        disabled={!hasNext}
        aria-label="Next delivery day"
        className="px-2 py-1.5 text-subtext hover:text-ink hover:bg-[rgba(43,42,42,0.04)] disabled:opacity-30 disabled:pointer-events-none transition-standard border-l border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:z-10"
      >
        <CaretRight size={16} weight="bold" />
      </button>
    </div>
  );
};
