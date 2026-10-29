import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-border bg-surface py-6">
      <div className="max-w-[80rem] mx-auto px-4 md:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[13px] text-subtext">
        <p>
          Data: Elexon BMRS (FUELHH, WINDFOR) snapshot.
        </p>
        <div className="flex items-center gap-4 text-[12px] font-mono">
          <span>GB Power Market</span>
          <span>•</span>
          <span>January 2026</span>
        </div>
      </div>
    </footer>
  );
};
