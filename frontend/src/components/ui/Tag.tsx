import React from 'react';

export interface TagProps {
  children: React.ReactNode;
  tone?: 'default' | 'brand' | 'amber' | 'neutral';
  className?: string;
}

export const Tag: React.FC<TagProps> = ({
  children,
  tone = 'default',
  className = '',
}) => {
  let toneClass = 'bg-[rgba(43,42,42,0.06)] text-subtext border-transparent';
  if (tone === 'brand') {
    toneClass = 'bg-[rgba(20,137,55,0.12)] text-brand border-transparent';
  } else if (tone === 'amber') {
    toneClass = 'bg-[rgba(217,119,6,0.12)] text-[#b45309] border-transparent';
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-[0.25rem] text-[11px] font-mono uppercase tracking-wider font-semibold border ${toneClass} ${className}`}
    >
      {children}
    </span>
  );
};
