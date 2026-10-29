import React from 'react';

export interface StatTileProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  subtext?: React.ReactNode;
  tone?: 'default' | 'brand' | 'amber' | 'negative';
  className?: string;
}

export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  unit,
  subtext,
  tone = 'default',
  className = '',
}) => {
  let valueColor = 'text-ink';
  if (tone === 'brand') {
    valueColor = 'text-brand';
  } else if (tone === 'amber') {
    valueColor = 'text-amber';
  } else if (tone === 'negative') {
    valueColor = 'text-[#b91c1c]';
  }

  return (
    <div className={`p-4 bg-surface border border-border rounded-[0.75rem] shadow-[0_1px_2px_rgba(43,42,42,0.06)] flex flex-col justify-between ${className}`}>
      <span className="text-[12px] font-mono uppercase tracking-wider text-subtext font-medium">
        {label}
      </span>
      <div className="mt-2 flex items-baseline">
        <span className={`text-[28px] font-mono tabular-nums font-semibold tracking-tight leading-none ${valueColor}`}>
          {value}
        </span>
        {unit && (
          <span className="ml-1.5 text-[14px] font-sans text-subtext font-normal">
            {unit}
          </span>
        )}
      </div>
      {subtext && (
        <div className="mt-2 text-[13px] text-subtext leading-normal">
          {subtext}
        </div>
      )}
    </div>
  );
};
