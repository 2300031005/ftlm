import React from 'react';
import { Tag } from './ui/Tag';
import { Segmented } from './ui/Segmented';
import type { CutoffPreset } from '../api/types';

export type ActiveTab = 'brief' | 'accuracy' | 'method';

export interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  cutoff: string;
  onCutoffChange: (cutoff: string) => void;
  cutoffPresets: CutoffPreset[];
  deliveryDate: string;
  onDateChange: (date: string) => void;
  allDates: string[];
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  cutoff,
  onCutoffChange,
  cutoffPresets,
}) => {
  // Build segmented options; header shows presets only.
  // If cutoff is a custom value (not matching any preset), Segmented shows no selection.
  const segmentedOptions = cutoffPresets.map((p) => ({
    value: p.time_london,
    label: p.time_london,
    sublabel: p.id === 'epex-0920' ? 'EPEX' : p.id === 'n2ex-0950' ? 'N2EX' : '30-min',
  }));

  const isPreset = cutoffPresets.some((p) => p.time_london === cutoff);
  // If it's not a preset, pass a value that won't match any option so none appear selected.
  const segmentedValue = isPreset ? cutoff : '__custom__';

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'brief', label: 'Decision Brief' },
    { id: 'accuracy', label: 'Accuracy Lab' },
    { id: 'method', label: 'Method' },
  ];

  return (
    <header className="bg-surface border-b border-border static md:sticky top-0 z-30 shadow-[0_1px_2px_rgba(43,42,42,0.03)]">
      <div className="max-w-[80rem] mx-auto px-4 md:px-6">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2.5 border-b border-border/40">
          <div className="flex items-center gap-3">
            <h1 className="text-[19px] md:text-[21px] font-sans font-bold tracking-tight text-ink leading-none">
              Wind Forecast Desk
            </h1>
            <Tag tone="brand">PILOT / GB / JAN 2026</Tag>
          </div>

          {/* Cutoff preset selector (hidden on Method tab) */}
          {activeTab !== 'method' && segmentedOptions.length > 0 && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[11px] font-mono text-subtext uppercase tracking-wider hidden sm:inline">
                Cutoff:
              </span>
              <Segmented
                options={segmentedOptions}
                value={segmentedValue}
                onChange={onCutoffChange}
                ariaLabel="Select decision cutoff preset"
              />
              {!isPreset && (
                <span className="text-[11px] font-mono text-brand font-semibold ml-1">
                  {cutoff}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <nav
          className="flex space-x-6 overflow-x-auto"
          aria-label="Application tabs"
          style={{ scrollbarWidth: 'none' }}
        >
          {tabs.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTabChange(t.id)}
                className={`py-3 text-[14px] font-sans whitespace-nowrap transition-standard border-b-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 ${
                  isActive
                    ? 'border-brand text-brand font-semibold'
                    : 'border-transparent text-subtext hover:text-ink hover:border-border font-medium'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
