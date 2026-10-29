import { useEffect, useMemo, useState } from 'react';
import { Header, type ActiveTab } from './components/Header';
import { Footer } from './components/Footer';
import { MethodPage } from './pages/MethodPage';
import { BriefPage } from './pages/BriefPage';
import { AccuracyPage } from './pages/AccuracyPage';
import { useApi } from './hooks/useApi';
import { apiClient } from './api/client';
import type { MetaResponse } from './api/types';

function generateDateRange(startStr: string, endStr: string): string[] {
  if (!startStr || !endStr) return [];
  const dates: string[] = [];
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return [];

  const cur = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));

  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cur.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

const DEFAULT_DATE = '2026-01-07';

export function App() {
  // Shared state living in App as required
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash === 'brief' || hash === 'accuracy' || hash === 'method') {
      return hash;
    }
    return 'brief';
  });

  const [cutoff, setCutoff] = useState<string>('09:20');
  const [deliveryDate, setDeliveryDate] = useState<string>(DEFAULT_DATE);
  const [revealActuals, setRevealActuals] = useState<boolean>(false);

  // Load system metadata for window dates, cutoff presets, and method provenance
  const { data: meta, loading: metaLoading, error: metaError, reload: reloadMeta } = useApi<MetaResponse>(
    (signal) => apiClient.getMeta(signal),
    [],
  );

  // Synchronize hash with active tab
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#/, '');
      if (hash === 'brief' || hash === 'accuracy' || hash === 'method') {
        setActiveTab(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleTabChange = (newTab: ActiveTab) => {
    setActiveTab(newTab);
    window.location.hash = `#${newTab}`;
  };

  // Set default cutoff from metadata if available
  useEffect(() => {
    if (meta?.default_cutoff) {
      setCutoff((prev) => prev || meta.default_cutoff);
    }
  }, [meta]);

  // Set delivery date to first available date in window (only if needed)
  useEffect(() => {
    if (!meta?.window) return;
    const { first_delivery_date, last_delivery_date } = meta.window;
    if (deliveryDate < first_delivery_date || deliveryDate > last_delivery_date) {
      setDeliveryDate(first_delivery_date);
    }
  }, [meta, deliveryDate]);

  // Generate list of all available delivery dates from metadata window
  const allDates = useMemo(() => {
    if (!meta?.window) return [];
    return generateDateRange(meta.window.first_delivery_date, meta.window.last_delivery_date);
  }, [meta]);

  const presets = meta?.cutoff_presets ?? [
    { id: 'epex-0920', label: 'EPEX Day-Ahead (09:20)', time_london: '09:20' },
    { id: 'n2ex-0950', label: 'N2EX Day-Ahead (09:50)', time_london: '09:50' },
    { id: 'epex-hh-1530', label: 'EPEX Half-Hourly (15:30)', time_london: '15:30' },
  ];

  // Reset reveal when date/cutoff changes
  const handleDateChange = (date: string) => {
    setRevealActuals(false);
    setDeliveryDate(date);
  };

  const handleCutoffChange = (c: string) => {
    setRevealActuals(false);
    setCutoff(c);
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg text-ink">
      <Header
        activeTab={activeTab}
        onTabChange={handleTabChange}
        cutoff={cutoff}
        onCutoffChange={handleCutoffChange}
        cutoffPresets={presets}
        deliveryDate={deliveryDate}
        onDateChange={handleDateChange}
        allDates={allDates}
      />

      <main className="flex-1">
        {activeTab === 'brief' && (
          <BriefPage
            deliveryDate={deliveryDate}
            cutoff={cutoff}
            allDates={allDates}
            onDateChange={handleDateChange}
            onCutoffChange={handleCutoffChange}
            cutoffPresets={presets}
            revealActuals={revealActuals}
            onRevealChange={setRevealActuals}
          />
        )}
        {activeTab === 'accuracy' && (
          <AccuracyPage
            cutoff={cutoff}
            onSelectDate={handleDateChange}
            onTabChange={handleTabChange}
          />
        )}
        {activeTab === 'method' && (
          <MethodPage
            meta={meta}
            loading={metaLoading}
            error={metaError}
            onRetry={reloadMeta}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}

export default App;
