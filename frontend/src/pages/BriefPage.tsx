import React, { useMemo, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { apiClient } from '../api/client';
import type { AccuracyResponse, BriefResponse, DriftResponse, HourlyBriefItem, DriftRunItem } from '../api/types';
import { Card } from '../components/ui/Card';
import { Tag } from '../components/ui/Tag';
import { StatTile } from '../components/ui/StatTile';
import { InsightCard } from '../components/ui/InsightCard';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { Chart } from '../components/ui/Chart';
import { DayPicker } from '../components/ui/DayPicker';
import { Button } from '../components/ui/Button';
import {
  fmtDate,
  fmtDateShort,
  fmtGW,
  fmtGWh,
  fmtMW,
  fmtPct,
  fmtPublishTime,
  fmtSigned,
  fmtUtcTime,
} from '../lib/format';
import { CHART_COLORS } from '../lib/chartTheme';
import { CaretDown, CaretUp } from '@phosphor-icons/react';
import type { CutoffPreset } from '../api/types';

// ─── helpers ─────────────────────────────────────────────────────────────────

// Derive decision day from delivery date string (D-1)
function decisionDateStr(deliveryDate: string): string {
  if (!deliveryDate) return '';
  const [y, m, d] = deliveryDate.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  const dy = dt.getUTCFullYear();
  const dm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${dy}-${dm}-${dd}`;
}

// ─── custom hook: parallel fetch ─────────────────────────────────────────────

function useBriefAndDrift(deliveryDate: string, cutoff: string) {
  const { data: brief, loading: bl, error: be, reload: br } = useApi<BriefResponse>(
    (sig) => apiClient.getBrief(deliveryDate, cutoff, sig),
    [deliveryDate, cutoff],
  );
  const { data: drift, loading: dl, error: de, reload: dr } = useApi<DriftResponse>(
    (sig) => apiClient.getDrift(deliveryDate, cutoff, sig),
    [deliveryDate, cutoff],
  );
  return { brief, briefLoading: bl, briefError: be, reloadBrief: br, drift, driftLoading: dl, driftError: de, reloadDrift: dr };
}

// ─── Insight headline builder ─────────────────────────────────────────────────

function buildHeadline(brief: BriefResponse, deliveryDate: string): string {
  const day = fmtDate(deliveryDate);
  const cutoffTime = brief.cutoff.time_london;
  const fcGW = `${fmtGW(brief.summary.avg_forecast_mw)} GW`;
  const p50 = brief.calibration.ratio_p50;
  const avgFirm = `${fmtGW(brief.summary.avg_firm_mw)} GW`;

  let middleClause: string;
  const pct = Math.round((1 - p50) * 100);
  if (Math.abs(pct) <= 1) {
    middleClause = 'close to the forecast';
  } else if (p50 > 1) {
    const higherPct = Math.round((p50 - 1) * 100);
    middleClause = `about ${higherPct}% higher`;
  } else {
    middleClause = `about ${pct}% lower`;
  }

  return `${day}: the ${cutoffTime} forecast averages ${fcGW}. Actual wind has typically come in ${middleClause}, so plan on at least ${avgFirm}.`;
}

function buildSupportingText(brief: BriefResponse): string {
  const pub = brief.selected_run.publish_time ? fmtPublishTime(brief.selected_run.publish_time) : 'N/A';
  const daysUsed = brief.calibration.days_used;
  const p10 = brief.calibration.ratio_p10.toFixed(2);
  const p50 = brief.calibration.ratio_p50.toFixed(2);
  const p90 = brief.calibration.ratio_p90.toFixed(2);
  return `Based on the forecast run published ${pub}. Range calibrated on the other ${daysUsed} days (P10 ${p10}, P50 ${p50}, P90 ${p90} of actual divided by forecast). 'Plan on at least' is the P10 level: on the other ${daysUsed} days, actual wind met or beat it in about nine of ten hours.`;
}

// ─── RevisionTile: computed client-side from drift data ───────────────────────

interface RevisionResult {
  revision: number | null;
  pct: number | null;
  latestRunTime: string | null;
  isSelected: boolean;
}

function computeRevision(drift: DriftResponse, brief: BriefResponse): RevisionResult | null {
  // Find full-day runs (all 24 values are non-null)
  const fullRuns = drift.runs
    .filter((r) => r.values.length === 24 && r.values.every((v) => v !== null))
    .sort((a, b) => b.publish_time.localeCompare(a.publish_time));

  if (fullRuns.length === 0) {
    return null;
  }

  const latestFullRun = fullRuns[0];
  const selectedRun =
    drift.runs.find((r) => r.selected) ??
    drift.runs.find((r) => r.publish_time === brief.selected_run.publish_time);

  // If the selected run is itself the latest full-day run
  if (selectedRun && latestFullRun.publish_time === selectedRun.publish_time) {
    return {
      revision: null,
      pct: null,
      latestRunTime: fmtUtcTime(latestFullRun.publish_time),
      isSelected: true,
    };
  }

  // Calculate means
  const selVals = selectedRun
    ? selectedRun.values.filter((v): v is number => v !== null)
    : brief.hours.map((h) => h.forecast_mw).filter((v): v is number => v !== null);

  const latVals = latestFullRun.values.filter((v): v is number => v !== null);

  if (selVals.length === 0 || latVals.length === 0) {
    return {
      revision: null,
      pct: null,
      latestRunTime: fmtUtcTime(latestFullRun.publish_time),
      isSelected: false,
    };
  }

  const selMean = selVals.reduce((a, b) => a + b, 0) / selVals.length;
  const latMean = latVals.reduce((a, b) => a + b, 0) / latVals.length;
  const revision = latMean - selMean;
  const pct = selMean > 0 ? (revision / selMean) * 100 : 0;

  return {
    revision,
    pct,
    latestRunTime: fmtUtcTime(latestFullRun.publish_time),
    isSelected: false,
  };
}

// ─── Main chart ECharts option builder ───────────────────────────────────────

function buildMainChartOption(
  hours: HourlyBriefItem[],
  revealActuals: boolean,
): object {
  const xLabels = hours.map((h) => String(h.hour_utc).padStart(2, '0'));
  const firm = hours.map((h) => (h.missing || h.firm_mw === null ? null : h.firm_mw / 1000));
  const bandDelta = hours.map((h) =>
    h.missing || h.firm_mw === null || h.upside_mw === null
      ? null
      : (h.upside_mw - h.firm_mw) / 1000,
  );
  const forecast = hours.map((h) => (h.missing || h.forecast_mw === null ? null : h.forecast_mw / 1000));
  const expected = hours.map((h) => (h.missing || h.expected_mw === null ? null : h.expected_mw / 1000));
  const actual = hours.map((h) => (h.missing || h.actual_mw === null ? null : h.actual_mw / 1000));

  const series: object[] = [
    // 1) firm base: line, data firm_mw, stack "band", lineStyle opacity 0, areaStyle opacity 0, no symbols, excluded from tooltip
    {
      name: '__firm_base',
      type: 'line',
      data: firm,
      stack: 'band',
      lineStyle: { opacity: 0 },
      areaStyle: { opacity: 0 },
      symbol: 'none',
      connectNulls: false,
      tooltip: { show: false },
      legendHoverLink: false,
      silent: true,
    },
    // 2) band: data (upside_mw - firm_mw), stack "band", lineStyle opacity 0, areaStyle colour brand-soft. Name "P10-P90 band"
    {
      name: 'P10–P90 band',
      type: 'line',
      data: bandDelta,
      stack: 'band',
      lineStyle: { opacity: 0 },
      areaStyle: { color: CHART_COLORS.bandFill, opacity: 1 },
      symbol: 'none',
      connectNulls: false,
      tooltip: { show: false },
      legendHoverLink: false,
      silent: true,
    },
    // 3) Forecast: brand solid 2.5px
    {
      name: 'Forecast',
      type: 'line',
      data: forecast,
      lineStyle: { color: CHART_COLORS.forecast, width: 2.5 },
      itemStyle: { color: CHART_COLORS.forecast },
      symbol: 'none',
      connectNulls: false,
    },
    // 4) Expected (P50): ink dashed 1.5px
    {
      name: 'Expected (P50)',
      type: 'line',
      data: expected,
      lineStyle: { color: CHART_COLORS.expected, width: 1.5, type: 'dashed' },
      itemStyle: { color: CHART_COLORS.expected },
      symbol: 'none',
      connectNulls: false,
    },
  ];

  // 5) Actual: ONLY when Reveal is on: ink solid 2px
  if (revealActuals) {
    series.push({
      name: 'Actual',
      type: 'line',
      data: actual,
      lineStyle: { color: CHART_COLORS.ink, width: 2 },
      itemStyle: { color: CHART_COLORS.ink },
      symbol: 'none',
      connectNulls: false,
    });
  }

  return {
    legend: { show: false },
    xAxis: {
      type: 'category',
      data: xLabels,
      axisLabel: {
        color: CHART_COLORS.subtext,
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 11,
      },
      name: 'Hour (UTC = UK time in January)',
      nameTextStyle: {
        color: CHART_COLORS.subtext,
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 10,
      },
      nameLocation: 'middle',
      nameGap: 28,
    },
    yAxis: {
      type: 'value',
      min: 0,
      axisLabel: {
        color: CHART_COLORS.subtext,
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 11,
        formatter: (v: number) => `${v.toFixed(0)} GW`,
      },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line' },
      backgroundColor: '#ffffff',
      borderColor: 'rgba(43,42,42,0.10)',
      borderWidth: 1,
      borderRadius: 12,
      padding: [10, 14],
      textStyle: {
        color: '#2b2a2a',
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 12,
      },
      formatter: (params: { dataIndex: number }[]) => {
        if (!params || params.length === 0) return '';
        const idx = params[0].dataIndex;
        const h = hours[idx];
        if (!h) return '';
        const formatVal = (v: number | null) => {
          if (h.missing) return 'missing';
          if (v === null) return '\u2013';
          return `${(v / 1000).toFixed(2)} GW`;
        };
        const missingBadge = h.missing
          ? '<span style="color:#d97706;font-weight:600;margin-left:8px">(missing)</span>'
          : '';
        let html = `<div style="font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.75;padding:2px 0">`;
        html += `<div style="font-weight:600;font-size:13px;border-bottom:1px solid rgba(43,42,42,0.10);padding-bottom:4px;margin-bottom:6px">${String(h.hour_utc).padStart(2, '0')}:00 UTC${missingBadge}</div>`;
        html += `<div>Forecast: ${formatVal(h.forecast_mw)}</div>`;
        html += `<div>Expected (P50): ${formatVal(h.expected_mw)}</div>`;
        html += `<div>Firm (P10): ${formatVal(h.firm_mw)}</div>`;
        html += `<div>Upside (P90): ${formatVal(h.upside_mw)}</div>`;
        if (revealActuals) {
          html += `<div>Actual: ${formatVal(h.actual_mw)}</div>`;
        }
        html += '</div>';
        return html;
      },
    },
    series,
  };
}

// ─── Drift chart option builder ───────────────────────────────────────────────

function buildDriftChartOption(drift: DriftResponse, revealActuals: boolean): object {
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

  const sortedRuns = [...drift.runs].sort((a, b) => a.publish_time.localeCompare(b.publish_time));

  const series: object[] = sortedRuns.map((run: DriftRunItem) => {
    const vals = run.values.map((v) => (v !== null ? v / 1000 : null));
    let color: string;
    let width: number;
    let opacity: number;
    let z: number;

    if (run.selected) {
      color = CHART_COLORS.forecast;
      width = 2.5;
      opacity = 1;
      z = 10;
    } else if (!run.before_cutoff) {
      color = CHART_COLORS.amber;
      width = 1;
      opacity = 0.4;
      z = 2;
    } else {
      color = CHART_COLORS.ink;
      width = 1;
      opacity = 0.18;
      z = 1;
    }

    const pubLabel = fmtUtcTime(run.publish_time);

    return {
      name: pubLabel,
      type: 'line',
      data: vals,
      connectNulls: false,
      symbol: 'none',
      lineStyle: { color, width, opacity },
      itemStyle: { color },
      z,
      tooltip: {
        trigger: 'item',
      },
      emphasis: {
        focus: 'series',
        lineStyle: { width: width + 1, opacity: 1 },
      },
    };
  });

  if (revealActuals && drift.actual) {
    series.push({
      name: 'Actual',
      type: 'line',
      data: drift.actual.map((v) => (v !== null ? v / 1000 : null)),
      connectNulls: false,
      symbol: 'none',
      lineStyle: { color: CHART_COLORS.ink, width: 2 },
      itemStyle: { color: CHART_COLORS.ink },
      z: 20,
      tooltip: {
        trigger: 'item',
      },
      emphasis: {
        focus: 'series',
        lineStyle: { width: 3, opacity: 1 },
      },
    });
  }

  return {
    legend: { show: false },
    xAxis: {
      type: 'category',
      data: hours,
      axisLabel: {
        color: CHART_COLORS.subtext,
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 11,
      },
      name: 'Hour (UTC = UK time in January)',
      nameTextStyle: {
        color: CHART_COLORS.subtext,
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 10,
      },
      nameLocation: 'middle',
      nameGap: 28,
    },
    yAxis: {
      type: 'value',
      min: 0,
      axisLabel: {
        color: CHART_COLORS.subtext,
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 11,
        formatter: (v: number) => `${v.toFixed(0)} GW`,
      },
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: '#ffffff',
      borderColor: 'rgba(43,42,42,0.10)',
      borderWidth: 1,
      borderRadius: 12,
      padding: [8, 12],
      textStyle: {
        color: '#2b2a2a',
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 12,
      },
      formatter: (p: { seriesName: string; dataIndex: number; value: number | null }) => {
        if (!p) return '';
        const hour = String(p.dataIndex).padStart(2, '0');
        const val = p.value !== null && p.value !== undefined ? `${Number(p.value).toFixed(2)} GW` : '–';
        return `<div style="font-family:'JetBrains Mono',monospace;font-size:12px">` +
               `<div style="color:#5a5856;margin-bottom:2px">Run: ${p.seriesName}</div>` +
               `<div>Hour ${hour}:00 \u2192 <strong>${val}</strong></div>` +
               `</div>`;
      },
    },
    series,
  };
}

// ─── ChartKey: a small inline legend ─────────────────────────────────────────

function KeyDot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-subtext">
      <svg width="20" height="2" viewBox="0 0 20 2" style={{ display: 'inline', verticalAlign: 'middle', flexShrink: 0 }}>
        <line
          x1="0" y1="1" x2="20" y2="1"
          stroke={color}
          strokeWidth="2"
          strokeDasharray={dashed ? '4 3' : undefined}
        />
      </svg>
      <span>{label}</span>
    </span>
  );
}

// ─── HourlyTable ─────────────────────────────────────────────────────────────

function HourlyTable({ hours, revealActuals }: { hours: HourlyBriefItem[]; revealActuals: boolean }) {
  return (
    <div className="overflow-x-auto rounded-[0.5rem] border border-border max-h-[480px] overflow-y-auto">
      <table className="w-full text-left text-[12px] font-mono min-w-[640px]" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead className="sticky top-0 z-10 bg-[rgba(252,252,252,0.98)] border-b border-border shadow-[0_1px_0_rgba(43,42,42,0.08)]">
          <tr className="text-[10px] uppercase tracking-wider text-subtext">
            <th className="py-2.5 px-3 font-semibold text-right">Hour</th>
            <th className="py-2.5 px-3 font-semibold text-right">Forecast</th>
            <th className="py-2.5 px-3 font-semibold text-right">Firm</th>
            <th className="py-2.5 px-3 font-semibold text-right">Expected</th>
            <th className="py-2.5 px-3 font-semibold text-right">Upside</th>
            <th className="py-2.5 px-3 font-semibold text-right">Run published</th>
            <th className="py-2.5 px-3 font-semibold text-right">Lead (h)</th>
            {revealActuals && <th className="py-2.5 px-3 font-semibold text-right">Actual</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[rgba(43,42,42,0.05)]">
          {hours.map((h) => (
            <tr key={h.hour_utc} className={`hover:bg-[rgba(43,42,42,0.015)] transition-standard ${h.missing ? 'opacity-50' : ''}`}>
              <td className="py-2 px-3 text-right tabular-nums text-ink font-medium">
                {String(h.hour_utc).padStart(2, '0')}:00
              </td>
              <td className="py-2 px-3 text-right tabular-nums text-brand font-medium">
                {h.forecast_mw !== null ? fmtMW(h.forecast_mw) : '–'}
              </td>
              <td className="py-2 px-3 text-right tabular-nums text-ink">
                {h.firm_mw !== null ? fmtMW(h.firm_mw) : '–'}
              </td>
              <td className="py-2 px-3 text-right tabular-nums text-ink">
                {h.expected_mw !== null ? fmtMW(h.expected_mw) : '–'}
              </td>
              <td className="py-2 px-3 text-right tabular-nums text-ink">
                {h.upside_mw !== null ? fmtMW(h.upside_mw) : '–'}
              </td>
              <td className="py-2 px-3 text-right text-subtext text-[11px] tabular-nums">
                {h.publish_time ? fmtUtcTime(h.publish_time) : (h.missing ? 'missing' : '–')}
              </td>
              <td className="py-2 px-3 text-right tabular-nums text-subtext">
                {h.lead_hours !== null ? h.lead_hours.toFixed(1) : '–'}
              </td>
              {revealActuals && (
                <td className="py-2 px-3 text-right tabular-nums text-ink font-medium">
                  {h.actual_mw !== null ? fmtMW(h.actual_mw) : '–'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── CustomCutoffInput ────────────────────────────────────────────────────────

interface CustomCutoffProps {
  value: string;
  onChange: (v: string) => void;
  presets: CutoffPreset[];
}

function CustomCutoffInput({ value, onChange, presets }: CustomCutoffProps) {
  const [localVal, setLocalVal] = useState(value);
  const isPreset = presets.some((p) => p.time_london === value);

  // Sync local input value when parent prop changes (e.g. user clicked preset)
  React.useEffect(() => {
    setLocalVal(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocalVal(v);
    if (/^\d{2}:\d{2}$/.test(v)) {
      const [hh, mm] = v.split(':').map(Number);
      if (hh !== undefined && hh >= 0 && hh <= 23 && mm !== undefined && mm >= 0 && mm <= 59) {
        onChange(v);
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="custom-cutoff-input" className="text-[12px] font-mono text-subtext uppercase tracking-wider whitespace-nowrap">
        Custom cutoff (London):
      </label>
      <div className="relative">
        <input
          id="custom-cutoff-input"
          type="text"
          maxLength={5}
          placeholder="HH:MM"
          value={localVal}
          onChange={handleChange}
          className={`w-[80px] px-2 py-1 text-[13px] font-mono tabular-nums rounded-[0.375rem] border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 ${
            isPreset
              ? 'border-border text-subtext bg-surface'
              : 'border-brand text-ink bg-surface font-semibold'
          }`}
        />
        {!isPreset && (
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-brand" />
        )}
      </div>
    </div>
  );
}

// ─── ActualsSwitch ────────────────────────────────────────────────────────────

function ActualsSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!checked);
    }
  };

  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        onKeyDown={handleKeyDown}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 cursor-pointer border ${
          checked ? 'bg-brand border-brand' : 'bg-[rgba(43,42,42,0.10)] border-border'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150 ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <div>
        <span className="text-[13px] font-sans text-ink font-medium select-none">
          Reveal actuals
        </span>
        <p className="text-[11px] text-subtext">Actuals were not known at decision time</p>
      </div>
    </div>
  );
}

// ─── BriefPageContent ─────────────────────────────────────────────────────────

interface BriefPageContentProps {
  brief: BriefResponse;
  drift: DriftResponse | null;
  deliveryDate: string;
  allDates: string[];
  cutoff: string;
  onDateChange: (d: string) => void;
  onCutoffChange: (c: string) => void;
  presets: CutoffPreset[];
  revealActuals: boolean;
  onRevealChange: (v: boolean) => void;
}

function BriefPageContent({
  brief,
  drift,
  deliveryDate,
  allDates,
  cutoff,
  onDateChange,
  onCutoffChange,
  presets,
  revealActuals,
  onRevealChange,
}: BriefPageContentProps) {
  const [tableOpen, setTableOpen] = useState(false);
  const tableId = 'hourly-detail-table';

  const { data: accData, loading: accLoading, error: accError } = useApi<AccuracyResponse>(
    revealActuals ? (sig) => apiClient.getAccuracy(cutoff, sig) : () => Promise.resolve(null as unknown as AccuracyResponse),
    [revealActuals, cutoff],
  );

  // Compute lead hour range from hours[]
  const leadHours = brief.hours
    .map((h) => h.lead_hours)
    .filter((l): l is number => l !== null);
  const minLead = leadHours.length > 0 ? Math.min(...leadHours) : null;
  const maxLead = leadHours.length > 0 ? Math.max(...leadHours) : null;
  const leadRange =
    minLead !== null && maxLead !== null
      ? `${minLead % 1 === 0 ? minLead.toFixed(0) : minLead.toFixed(1)}–${maxLead % 1 === 0 ? maxLead.toFixed(0) : maxLead.toFixed(1)} h`
      : '–';

  // Revision tile computed client-side from drift
  const revision = drift ? computeRevision(drift, brief) : null;

  // Outcome card stats (only when revealed)
  const validHours = brief.hours.filter(
    (h) => !h.missing && h.actual_mw !== null && h.firm_mw !== null && h.upside_mw !== null,
  );
  const hoursInsideBand = validHours.filter(
    (h) => h.actual_mw! >= h.firm_mw! && h.actual_mw! <= h.upside_mw!,
  ).length;
  const hoursBelowFirm = validHours.filter((h) => h.actual_mw! < h.firm_mw!).length;

  const takeaway =
    validHours.length > 0
      ? `Outturn: ${hoursInsideBand} of ${validHours.length} hours landed inside the calibrated P10–P90 band${
          hoursBelowFirm > 0
            ? `, with ${hoursBelowFirm} hour${hoursBelowFirm !== 1 ? 's' : ''} falling below the firm floor`
            : ' with zero hours falling below the firm floor'
        }.`
      : '';

  // Chart options
  const mainChartOption = useMemo(
    () => buildMainChartOption(brief.hours, revealActuals),
    [brief.hours, revealActuals],
  );
  const driftChartOption = useMemo(
    () => (drift ? buildDriftChartOption(drift, revealActuals) : null),
    [drift, revealActuals],
  );

  const decisionDate = decisionDateStr(deliveryDate);

  return (
    <div className="max-w-[80rem] mx-auto px-4 md:px-6 py-8 space-y-6">
      {/* a) Page header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Tag tone="brand">DECISION BRIEF</Tag>
        </div>
        <h2 className="text-[28px] md:text-[34px] font-sans font-bold text-ink tracking-tight leading-tight">
          Day-ahead wind brief
        </h2>
        <p className="text-[14px] text-subtext mt-1.5 font-sans">
          Delivery{' '}
          <span className="font-mono text-ink font-medium">{fmtDate(deliveryDate)}</span>.{' '}
          Decision made{' '}
          <span className="font-mono text-ink font-medium">{fmtDateShort(decisionDate)}</span> at{' '}
          <span className="font-mono text-ink font-medium">{brief.cutoff.time_london}</span> London time (cutoff{' '}
          <span className="font-mono text-ink font-medium">{fmtUtcTime(brief.cutoff.cutoff_utc)}</span>).
        </p>
      </div>

      {/* b) Controls row */}
      <div className="flex flex-wrap items-end gap-5 py-4 border-y border-border/50">
        {allDates.length > 0 && (
          <DayPicker
            dates={allDates}
            selectedDate={deliveryDate}
            onChange={onDateChange}
          />
        )}
        <CustomCutoffInput value={cutoff} onChange={onCutoffChange} presets={presets} />
        <ActualsSwitch checked={revealActuals} onChange={onRevealChange} />
      </div>

      {/* c) InsightCard */}
      <InsightCard
        tagText="MODEL SIGNAL"
        headline={buildHeadline(brief, deliveryDate)}
        supportingText={buildSupportingText(brief)}
      />

      {/* d) Five StatTiles + Sixth Revision Tile */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatTile
          label="Forecast run used"
          value={
            <span className="font-mono text-[20px]">
              {brief.selected_run.publish_time ? fmtUtcTime(brief.selected_run.publish_time) : '–'}
            </span>
          }
          subtext={`lead range ${leadRange}`}
        />
        <StatTile
          label="Average forecast"
          value={fmtGW(brief.summary.avg_forecast_mw)}
          unit="GW"
          subtext={`Peak: ${fmtGW(brief.summary.peak_forecast_mw)} GW at ${String(
            brief.summary.peak_hour_utc ?? '–',
          ).padStart(2, '0')}:00`}
        />
        <StatTile
          label="Expected, P50"
          value={fmtGW(brief.summary.avg_expected_mw)}
          unit="GW"
          subtext={`Ratio P50: ${brief.calibration.ratio_p50.toFixed(2)}`}
        />
        <StatTile
          label="Firm, P10 — plan on at least"
          value={fmtGW(brief.summary.avg_firm_mw)}
          unit="GW"
          tone="brand"
          subtext={`Ratio P10: ${brief.calibration.ratio_p10.toFixed(2)}`}
        />
        <StatTile
          label="Total forecast energy"
          value={fmtGWh(brief.summary.total_forecast_mwh)}
          unit="GWh"
          subtext="Sum of 24 hourly forecasts"
        />
        <StatTile
          label="Revision after cutoff"
          value={
            revision === null ? (
              '–'
            ) : revision.isSelected ? (
              <span className="text-[14px] font-sans font-medium text-subtext leading-tight block">
                No later full-day run
              </span>
            ) : (
              <span className={`font-mono text-[18px] ${revision.revision! >= 0 ? 'text-brand' : 'text-ink'}`}>
                {fmtSigned(revision.revision, 'MW')}{' '}
                <span className="text-[13px] font-normal text-subtext">
                  ({fmtPct(revision.pct, true)})
                </span>
              </span>
            )
          }
          subtext={
            revision && !revision.isSelected && revision.latestRunTime
              ? `latest full-day run ${revision.latestRunTime}`
              : revision?.isSelected && revision.latestRunTime
              ? `latest full-day run ${revision.latestRunTime}`
              : '–'
          }
        />
      </div>

      {/* e) Main chart */}
      <Card className="p-4 md:p-5">
        {/* Custom key */}
        <div className="flex flex-wrap gap-3 mb-3 items-center justify-between">
          <span className="text-[12px] font-mono text-subtext uppercase tracking-wider font-semibold">
            24-hour delivery profile
          </span>
          <div className="flex flex-wrap gap-4">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-subtext">
              <span
                className="inline-block w-5 h-[10px] rounded-sm"
                style={{ background: CHART_COLORS.bandFill, border: `1px solid ${CHART_COLORS.bandBorder}` }}
              />
              P10–P90 band
            </span>
            <KeyDot color={CHART_COLORS.forecast} label="Forecast" />
            <KeyDot color={CHART_COLORS.expected} label="Expected (P50)" dashed />
            {revealActuals && <KeyDot color={CHART_COLORS.ink} label="Actual" />}
          </div>
        </div>
        <div className="relative">
          <Chart
            option={mainChartOption}
            className="h-[280px] md:h-[360px]"
            aria-label={`24-hour wind delivery profile for ${fmtDate(deliveryDate)}`}
          />
          {!revealActuals && (
            <div className="absolute top-2 right-2 text-[11px] font-mono text-subtext bg-surface/95 border border-border px-2 py-1 rounded-[0.25rem] pointer-events-none shadow-sm">
              Actuals hidden
            </div>
          )}
        </div>
      </Card>

      {/* f) Drift chart */}
      {driftChartOption && (
        <Card className="p-4 md:p-5">
          <div className="flex flex-wrap gap-3 mb-3 items-center justify-between">
            <div>
              <span className="text-[12px] font-mono text-subtext uppercase tracking-wider font-semibold">
                How the forecast changed after you decided
              </span>
            </div>
            <div className="flex flex-wrap gap-4">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-subtext">
                <svg width="20" height="2" viewBox="0 0 20 2">
                  <line x1="0" y1="1" x2="20" y2="1" stroke={CHART_COLORS.ink} strokeWidth="2" strokeOpacity="0.18" />
                </svg>
                Before cutoff
              </span>
              <KeyDot color={CHART_COLORS.forecast} label="Selected run" />
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-subtext">
                <svg width="20" height="2" viewBox="0 0 20 2">
                  <line x1="0" y1="1" x2="20" y2="1" stroke={CHART_COLORS.amber} strokeWidth="2" strokeOpacity="0.4" />
                </svg>
                After cutoff
              </span>
              {revealActuals && <KeyDot color={CHART_COLORS.ink} label="Actual" />}
            </div>
          </div>
          <Chart
            option={driftChartOption}
            className="h-[280px] md:h-[360px]"
            aria-label="Forecast drift across publication runs"
          />
        </Card>
      )}

      {/* g) Outcome card — only when revealed */}
      {revealActuals && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Tag tone="neutral">OUTCOME &amp; OUTTURN</Tag>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile
              label="Average actual"
              value={fmtGW(brief.actual_summary.avg_actual_mw)}
              unit="GW"
            />
            <StatTile
              label="Bias (actual − forecast)"
              value={fmtGW(brief.actual_summary.bias_mw)}
              unit="GW"
              tone={
                brief.actual_summary.bias_mw !== null && brief.actual_summary.bias_mw < 0
                  ? 'negative'
                  : 'brand'
              }
            />
            <StatTile
              label="MAE"
              value={fmtGW(brief.actual_summary.mae_mw)}
              unit="GW"
            />
            <StatTile
              label="Hours inside band"
              value={`${hoursInsideBand} / ${validHours.length}`}
              subtext={`${hoursBelowFirm} hour${hoursBelowFirm !== 1 ? 's' : ''} below firm`}
            />
          </div>
          {takeaway && (
            <p className="text-[13px] text-subtext leading-relaxed font-sans pt-1 border-t border-border/40">
              {takeaway}
            </p>
          )}
          {revealActuals && accLoading && (
            <div className="pt-1">
              <Skeleton height={16} width="85%" />
            </div>
          )}
          {revealActuals && !accLoading && !accError && accData?.band_backtest && (
            <p className="text-[12px] text-subtext leading-relaxed font-sans pt-1">
              For context: across all {accData.band_backtest.n_days} days at this cutoff,{' '}
              {(accData.band_backtest.share_within_band * 100).toFixed(1)}% of hours landed inside the band (nominal{' '}
              {Math.round(accData.band_backtest.nominal.within * 100)}%) and{' '}
              {(accData.band_backtest.share_below_firm * 100).toFixed(1)}% fell below the firm level (nominal{' '}
              {Math.round(accData.band_backtest.nominal.below * 100)}%).
            </p>
          )}
        </Card>
      )}

      {/* h) Hourly detail toggle */}
      <div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setTableOpen((v) => !v)}
          aria-expanded={tableOpen}
          aria-controls={tableId}
        >
          {tableOpen ? <CaretUp size={14} weight="bold" /> : <CaretDown size={14} weight="bold" />}
          Hourly detail
        </Button>

        {tableOpen && (
          <div id={tableId} className="mt-3">
            <HourlyTable hours={brief.hours} revealActuals={revealActuals} />
          </div>
        )}
      </div>

      {/* i) Footer note */}
      <p className="text-[12px] text-subtext leading-relaxed border-t border-border/50 pt-4">
        {brief.calibration.note}{' '}
        Band is calibrated by leave-one-day-out cross-validation on January 2026 and is not a live out-of-sample forecast.
      </p>
    </div>
  );
}

// ─── Skeleton layout ──────────────────────────────────────────────────────────

function BriefSkeleton() {
  return (
    <div className="max-w-[80rem] mx-auto px-4 md:px-6 py-8 space-y-6">
      <Skeleton height={80} className="rounded-card" />
      <Skeleton height={52} className="rounded-sm" />
      <Skeleton height={96} className="rounded-card" />
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={96} className="rounded-card" />
        ))}
      </div>
      <Skeleton height={360} className="rounded-card" />
      <Skeleton height={360} className="rounded-card" />
    </div>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

export interface BriefPageProps {
  deliveryDate: string;
  cutoff: string;
  allDates: string[];
  onDateChange: (d: string) => void;
  onCutoffChange: (c: string) => void;
  cutoffPresets: CutoffPreset[];
  revealActuals: boolean;
  onRevealChange: (v: boolean) => void;
}

export const BriefPage: React.FC<BriefPageProps> = ({
  deliveryDate,
  cutoff,
  allDates,
  onDateChange,
  onCutoffChange,
  cutoffPresets,
  revealActuals,
  onRevealChange,
}) => {
  const { brief, briefLoading, briefError, reloadBrief, drift, driftLoading, driftError, reloadDrift } =
    useBriefAndDrift(deliveryDate, cutoff);

  const loading = briefLoading || driftLoading;
  const error = briefError || driftError;

  if (loading) return <BriefSkeleton />;

  if (error || !brief) {
    const detail = error?.message || 'Failed to load /api/brief';
    return (
      <div className="max-w-[80rem] mx-auto px-4 md:px-6 py-12">
        <ErrorState
          title={error?.message?.includes('422') ? 'Date out of window' : 'Failed to load brief'}
          message={detail}
          onRetry={() => { reloadBrief(); reloadDrift(); }}
        />
      </div>
    );
  }

  return (
    <BriefPageContent
      brief={brief}
      drift={drift}
      deliveryDate={deliveryDate}
      allDates={allDates}
      cutoff={cutoff}
      onDateChange={onDateChange}
      onCutoffChange={onCutoffChange}
      presets={cutoffPresets}
      revealActuals={revealActuals}
      onRevealChange={onRevealChange}
    />
  );
};
