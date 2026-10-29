import React, { useRef } from 'react';

export interface SegmentedOption {
  value: string;
  label: string;
  sublabel?: string;
}

export interface SegmentedProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
}

export const Segmented: React.FC<SegmentedProps> = ({
  options,
  value,
  onChange,
  className = '',
  ariaLabel = 'Options',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (index + 1) % options.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (index - 1 + options.length) % options.length;
    }

    if (nextIndex >= 0) {
      const nextOption = options[nextIndex];
      if (nextOption) {
        onChange(nextOption.value);
        // Focus the newly active button
        const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>('button');
        buttons?.[nextIndex]?.focus();
      }
    }
  };

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex items-center p-1 bg-[rgba(43,42,42,0.05)] border border-border rounded-[0.5rem] gap-0.5 ${className}`}
    >
      {options.map((opt, idx) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`px-3 py-1.5 text-[13px] font-mono leading-none rounded-[0.375rem] transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 select-none flex items-center gap-1.5 ${
              isSelected
                ? 'bg-surface text-ink font-semibold shadow-[0_1px_2px_rgba(43,42,42,0.08)] border border-border/80'
                : 'text-subtext hover:text-ink hover:bg-surface/50 border border-transparent'
            }`}
          >
            <span>{opt.label}</span>
            {opt.sublabel && (
              <span className="text-[11px] opacity-75 font-normal">
                {opt.sublabel}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
