import React, { useMemo, useState } from 'react';
import { Tag } from '../components/ui/Tag';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { StatTile } from '../components/ui/StatTile';
import { InsightCard } from '../components/ui/InsightCard';
import { Chart } from '../components/ui/Chart';
import { Button } from '../components/ui/Button';
import { useApi } from '../hooks/useApi';
import { apiClient } from '../api/client';
import type { AccuracyResponse, ByDayMetric } from '../api/types';
import type { ActiveTab } from '../components/Header';
import {
  fmtDateShort,
  fmtGW,
  fmtMW,
  fmtPct,
  fmtSigned,
  fmtSignedGW,
} from '../lib/format';
import { CHART_COLORS } from '../lib/chartTheme';
import { CaretDown, CaretUp, WarningCircle } from '@phosphor-icons/react';

export interface AccuracyPageProps {
  cutoff: string;
  onSelectDate?: (date: string) => void;
  onTabChange?: (tab: ActiveTab) => void;
}

export const AccuracyPage: React.FC<AccuracyPageProps> = ({
  cutoff,
  onSelectDate,
  onTabChange,
}) => {
  const [percentilesOpen, setPercentilesOpen] = useState(false);
  const percentilesId = 'percentiles-table';

  const { data, loading, error, reload } = useApi<AccuracyResponse>(
    (signal) => apiClient.getAccuracy(cutoff, signal),
    [cutoff]
  );

  // ─── d) When is it wrong? (Diurnal) chart option ────────────────────────────
  const diurnalChartOption = useMemo(() => {
    if (!data?.by_hour) return null;
    const hours = data.by_hour.map((h) => `${String(h.hour_utc).padStart(2, '0')}:00`);
    const biasVals = data.by_hour.map((h) => (h.bias !== null ? Math.round(h.bias) : null));
    const maeVals = data.by_hour.map((h) => (h.mae !== null ? Math.round(h.mae) : null));

    return {
      grid: {
        top: 36,
        right: 20,
        bottom: 36,
        left: 56,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: hours,
        axisLabel: {
          interval: (idx: number) => idx % 2 === 0,
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (v: number) => `${(v / 1000).toFixed(1)} GW`,
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: CHART_COLORS.gridLine,
            type: 'dashed',
          },
        },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: { dataIndex: number }[]) => {
          if (!params || params.length === 0) return '';
          const idx = params[0].dataIndex;
          const h = data.by_hour[idx];
          if (!h) return '';
          return `
            <div style="font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.65;padding:2px 0">
              <div style="font-weight:600;font-size:13px;border-bottom:1px solid rgba(43,42,42,0.10);padding-bottom:4px;margin-bottom:6px">
                ${String(h.hour_utc).padStart(2, '0')}:00 UTC
              </div>
              <div>Bias: <b>${fmtSigned(h.bias, 'MW')}</b> (${fmtSignedGW(h.bias)})</div>
              <div>MAE: <b>${fmtMW(h.mae)} MW</b> (${fmtGW(h.mae)} GW)</div>
              <div>RMSE: <b>${fmtMW(h.rmse)} MW</b> (${fmtGW(h.rmse)} GW)</div>
              <div>Mean Actual: <b>${fmtMW(h.mean_actual)} MW</b></div>
              <div>Mean Forecast: <b>${fmtMW(h.mean_forecast)} MW</b></div>
            </div>
          `;
        },
      },
      series: [
        {
          name: 'Bias',
          type: 'bar',
          data: biasVals,
          itemStyle: {
            color: 'rgba(43, 42, 42, 0.70)',
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: {
              color: CHART_COLORS.ink,
              width: 1,
            },
            data: [{ yAxis: 0 }],
          },
        },
        {
          name: 'MAE',
          type: 'line',
          data: maeVals,
          symbol: 'circle',
          symbolSize: 5,
          itemStyle: {
            color: CHART_COLORS.forecast,
          },
          lineStyle: {
            color: CHART_COLORS.forecast,
            width: 2.2,
          },
        },
      ],
    };
  }, [data?.by_hour]);

  // ─── e) Does it depend on wind level? (Quintiles) chart option ─────────────
  const levelChartOption = useMemo(() => {
    if (!data?.by_forecast_level) return null;
    const xLabels = data.by_forecast_level.map((bin) => {
      const parts = bin.bin_range.replace(/MW/g, '').split('-');
      if (parts.length === 2) {
        const lo = (parseFloat(parts[0].replace(/,/g, '').trim()) / 1000).toFixed(1);
        const hi = (parseFloat(parts[1].replace(/,/g, '').trim()) / 1000).toFixed(1);
        return `${lo}–${hi} GW`;
      }
      return bin.bin_range;
    });

    const fcVals = data.by_forecast_level.map((b) => Math.round(b.mean_forecast));
    const actVals = data.by_forecast_level.map((b) => Math.round(b.mean_actual));

    return {
      grid: {
        top: 40,
        right: 20,
        bottom: 36,
        left: 56,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: xLabels,
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (v: number) => `${(v / 1000).toFixed(1)} GW`,
        },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: { dataIndex: number }[]) => {
          if (!params || params.length === 0) return '';
          const idx = params[0].dataIndex;
          const b = data.by_forecast_level[idx];
          if (!b) return '';
          return `
            <div style="font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.65;padding:2px 0">
              <div style="font-weight:600;font-size:13px;border-bottom:1px solid rgba(43,42,42,0.10);padding-bottom:4px;margin-bottom:6px">
                Quintile ${b.bin_index}: ${b.bin_range}
              </div>
              <div>Mean Forecast: <b>${fmtMW(b.mean_forecast)} MW</b> (${fmtGW(b.mean_forecast)} GW)</div>
              <div>Mean Actual: <b>${fmtMW(b.mean_actual)} MW</b> (${fmtGW(b.mean_actual)} GW)</div>
              <div>Mean Error: <b>${fmtSigned(b.mean_error, 'MW')}</b> (${fmtSignedGW(b.mean_error)})</div>
              <div>Ratio (Actual / Forecast): <b>${b.ratio.toFixed(4)}</b> (${(b.ratio * 100).toFixed(1)}%)</div>
            </div>
          `;
        },
      },
      series: [
        {
          name: 'Forecast',
          type: 'bar',
          data: fcVals,
          barGap: '15%',
          itemStyle: {
            color: CHART_COLORS.forecast,
          },
          label: {
            show: true,
            position: 'top',
            distance: 6,
            formatter: (p: { dataIndex: number }) => {
              const b = data.by_forecast_level[p.dataIndex];
              return b ? `ratio ${b.ratio.toFixed(2)}` : '';
            },
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 11,
            color: CHART_COLORS.ink,
            fontWeight: 600,
          },
        },
        {
          name: 'Actual',
          type: 'bar',
          data: actVals,
          itemStyle: {
            color: CHART_COLORS.ink,
          },
        },
      ],
    };
  }, [data?.by_forecast_level]);

  // ─── f) Day by day timeline chart option ────────────────────────────────────
  const dayChartOption = useMemo(() => {
    if (!data?.by_day) return null;
    const dates = data.by_day.map((d) => fmtDateShort(d.delivery_date));
    const biasData = data.by_day.map((d) => {
      const v = d.bias !== null ? Math.round(d.bias) : 0;
      return {
        value: v,
        itemStyle: {
          color: v < 0 ? '#b91c1c' : CHART_COLORS.forecast,
        },
      };
    });
    const maeVals = data.by_day.map((d) => (d.mae !== null ? Math.round(d.mae) : null));

    return {
      grid: {
        top: 36,
        right: 20,
        bottom: 36,
        left: 56,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: {
          interval: (idx: number) => idx % 5 === 0,
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (v: number) => `${(v / 1000).toFixed(1)} GW`,
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: CHART_COLORS.gridLine,
            type: 'dashed',
          },
        },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: { dataIndex: number }[]) => {
          if (!params || params.length === 0) return '';
          const idx = params[0].dataIndex;
          const d = data.by_day[idx];
          if (!d) return '';
          return `
            <div style="font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.65;padding:2px 0">
              <div style="font-weight:600;font-size:13px;border-bottom:1px solid rgba(43,42,42,0.10);padding-bottom:4px;margin-bottom:6px">
                ${d.delivery_date}
              </div>
              <div>Bias: <b>${fmtSigned(d.bias, 'MW')}</b> (${fmtSignedGW(d.bias)})</div>
              <div>MAE: <b>${fmtMW(d.mae)} MW</b> (${fmtGW(d.mae)} GW)</div>
              <div>Mean Actual: <b>${fmtMW(d.mean_actual)} MW</b></div>
              <div>Mean Forecast: <b>${fmtMW(d.mean_forecast)} MW</b></div>
              <div style="color:${CHART_COLORS.forecast};font-weight:600;margin-top:4px">Click to open Decision Brief &rarr;</div>
            </div>
          `;
        },
      },
      series: [
        {
          name: 'Bias',
          type: 'bar',
          data: biasData,
          cursor: 'pointer',
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: {
              color: CHART_COLORS.ink,
              width: 1,
            },
            data: [{ yAxis: 0 }],
          },
        },
        {
          name: 'MAE',
          type: 'line',
          data: maeVals,
          symbol: 'circle',
          symbolSize: 4,
          itemStyle: {
            color: CHART_COLORS.forecast,
          },
          lineStyle: {
            color: CHART_COLORS.forecast,
            width: 2,
          },
        },
      ],
    };
  }, [data?.by_day]);

  // Click handler for Day by Day bar chart
  const handleDayChartClick = (params: { dataIndex: number }) => {
    if (!data?.by_day) return;
    const clickedDay: ByDayMetric | undefined = data.by_day[params.dataIndex];
    if (clickedDay && onSelectDate && onTabChange) {
      onSelectDate(clickedDay.delivery_date);
      window.location.hash = '#brief';
      onTabChange('brief');
    }
  };

  if (loading) {
    return (
      <div className="max-w-[80rem] mx-auto px-4 md:px-6 py-8 space-y-6">
        <Skeleton height={80} className="rounded-card" />
        <Skeleton height={110} className="rounded-card" />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={100} className="rounded-card" />
          ))}
        </div>
        <Skeleton height={340} className="rounded-card" />
        <Skeleton height={340} className="rounded-card" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-[80rem] mx-auto px-4 md:px-6 py-12">
        <ErrorState
          title="Unable to load historical accuracy data"
          message={error?.message || 'Failed to retrieve /api/accuracy'}
          onRetry={reload}
        />
      </div>
    );
  }

  // ─── b) Insight headline & metrics calculations ──────────────────────────────
  const mf = data.metrics.mean_forecast ?? 0;
  const ma = data.metrics.mean_actual ?? 1;
  const ratio = mf / (ma === 0 ? 1 : ma);
  const pct = Math.round(Math.abs(ratio - 1) * 100);
  const dir = ratio >= 1 ? 'above' : 'below';
  const biasSharePct = Math.round((data.metrics.bias_share_of_mse ?? 0) * 100);

  const headline = `At the ${data.cutoff} cutoff the wind forecast ran about ${pct}% ${dir} metered output on average. About ${biasSharePct}% of the squared error is that one-directional bias, not random noise.`;
  const supportingText =
    'FUELHH reports transmission-metered output and WINDFOR is a national forecast. The gap is consistent with embedded generation and curtailment, but the cause is not isolated.';

  // ─── d) Diurnal sentence computation ─────────────────────────────────────────
  const validByHour = data.by_hour.filter((h) => h.bias !== null);
  const sortedByAbsBias = [...validByHour].sort(
    (a, b) => Math.abs(b.bias!) - Math.abs(a.bias!)
  );
  const largestGapHour = sortedByAbsBias[0];
  const smallestGapHour = sortedByAbsBias[sortedByAbsBias.length - 1];

  const diurnalSentence =
    largestGapHour && smallestGapHour
      ? `Largest average gap at ${String(largestGapHour.hour_utc).padStart(2, '0')}:00 (${fmtSignedGW(
          largestGapHour.bias
        )}); smallest at ${String(smallestGapHour.hour_utc).padStart(2, '0')}:00 (${fmtSignedGW(
          smallestGapHour.bias
        )}).`
      : '';

  // ─── e) Notes extraction for quintiles ───────────────────────────────────────
  const quintileNote = data.notes.find((n) => n.toLowerCase().includes('quintile')) || '';

  // ─── g) Cutoff comparison calculations ──────────────────────────────────────
  const r0920 = data.cutoff_comparison.find((c) => c.cutoff === '09:20');
  const r0950 = data.cutoff_comparison.find((c) => c.cutoff === '09:50');
  const r1530 = data.cutoff_comparison.find((c) => c.cutoff === '15:30');

  const xVal =
    r0920?.mae && r1530?.mae
      ? Math.abs(((r1530.mae - r0920.mae) / r0920.mae) * 100).toFixed(1)
      : '0.0';

  const yDiff =
    r0920?.mae && r0950?.mae
      ? (((r0950.mae - r0920.mae) / r0920.mae) * 100).toFixed(1)
      : '0.0';
  const yFormatted = Number(yDiff) < 0 ? yDiff : `+${yDiff}`;

  const zDiff =
    r0920?.rmse && r0950?.rmse
      ? (((r0950.rmse - r0920.rmse) / r0920.rmse) * 100).toFixed(1)
      : '0.0';
  const zFormatted = Number(zDiff) < 0 ? zDiff : `+${zDiff}`;

  const comparisonSentence = `Waiting until 15:30 cuts MAE by ${xVal}% versus 09:20. Waiting until 09:50 changes MAE by ${yFormatted}% and RMSE by ${zFormatted}%.`;

  // ─── h) Band backtest values ────────────────────────────────────────────────
  const bb = data.band_backtest;
  const belowPct = (bb.share_below_firm * 100).toFixed(1);
  const withinPct = (bb.share_within_band * 100).toFixed(1);
  const abovePct = (bb.share_above_upside * 100).toFixed(1);

  // ─── i) Leakage values ──────────────────────────────────────────────────────
  const decMae = data.leakage.decision_time.mae ?? 0;
  const naiveMae = data.leakage.naive.mae ?? 0;
  const maxLeakageMae = Math.max(decMae, naiveMae) * 1.08;
  const decWidthPct = maxLeakageMae > 0 ? (decMae / maxLeakageMae) * 100 : 0;
  const naiveWidthPct = maxLeakageMae > 0 ? (naiveMae / maxLeakageMae) * 100 : 0;

  // ─── j) Percentiles table list ──────────────────────────────────────────────
  const percentileKeys = ['p05', 'p10', 'p25', 'p50', 'p75', 'p90', 'p95'];

  return (
    <div className="max-w-[80rem] mx-auto px-4 md:px-6 py-8 space-y-8">
      {/* a) Page Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Tag tone="brand">ACCURACY LAB</Tag>
        </div>
        <h1 className="text-[28px] md:text-[34px] font-sans font-bold text-ink tracking-tight">
          How wrong is the forecast?
        </h1>
        <p className="text-[14px] text-subtext mt-1.5 font-sans">
          {data.metrics.n} hourly points across {data.window.n_days} delivery days, decision cutoff{' '}
          <span className="font-mono text-ink font-semibold">{data.cutoff}</span> London time.
        </p>
      </div>

      {/* b) InsightCard */}
      <InsightCard
        tagText="SYSTEMIC PATTERN"
        headline={headline}
        supportingText={supportingText}
      />

      {/* c) Six StatTiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatTile
          label="Bias"
          value={fmtGW(data.metrics.bias)}
          unit="GW"
          tone="negative"
          subtext="Negative = wind fell short"
        />
        <StatTile
          label="MAE"
          value={fmtGW(data.metrics.mae)}
          unit="GW"
          subtext={`${data.metrics.mae_pct_of_mean_actual ?? '–'}% of mean actual`}
        />
        <StatTile
          label="RMSE"
          value={fmtGW(data.metrics.rmse)}
          unit="GW"
          subtext="Penalises large swings"
        />
        <StatTile
          label="Median error (P50)"
          value={fmtGW(data.metrics.error_percentiles?.['p50'])}
          unit="GW"
          tone={(data.metrics.error_percentiles?.['p50'] ?? 0) < 0 ? 'negative' : 'default'}
          subtext="Typical hourly bias"
        />
        <StatTile
          label="P10 to P90 error range"
          value={`${fmtGW(data.metrics.error_percentiles?.['p10'])} to ${fmtGW(
            data.metrics.error_percentiles?.['p90']
          )} GW`}
          subtext="80% of hourly errors"
        />
        <StatTile
          label="Bias share of MSE"
          value={`${biasSharePct}%`}
          subtext="One-directional bias vs noise"
        />
      </div>

      {/* d) "When is it wrong?" Card */}
      <Card className="p-5 md:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[12px] font-mono text-subtext uppercase tracking-wider font-semibold">
              DIURNAL ERROR PATTERN (00–23 UTC)
            </span>
            <h3 className="text-[18px] font-sans font-bold text-ink mt-0.5">
              When is it wrong?
            </h3>
          </div>
          <div className="flex items-center gap-4 text-[12px] font-mono text-subtext">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-sm bg-[rgba(43,42,42,0.70)]" />
              Bias (MW)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3.5 h-1 rounded-sm bg-brand" />
              MAE (MW)
            </span>
          </div>
        </div>

        {diurnalChartOption && (
          <Chart
            option={diurnalChartOption}
            className="h-[280px] md:h-[340px]"
            aria-label="Diurnal forecast error pattern by hour of day in UTC"
          />
        )}

        {diurnalSentence && (
          <p className="text-[13px] text-subtext font-sans pt-2 border-t border-border/40">
            {diurnalSentence}
          </p>
        )}
      </Card>

      {/* e) "Does it depend on wind level?" Card */}
      <Card className="p-5 md:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[12px] font-mono text-subtext uppercase tracking-wider font-semibold">
              WIND GENERATION QUINTILES
            </span>
            <h3 className="text-[18px] font-sans font-bold text-ink mt-0.5">
              Does it depend on wind level?
            </h3>
          </div>
          <div className="flex items-center gap-4 text-[12px] font-mono text-subtext">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-sm bg-brand" />
              Forecast
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-sm bg-ink" />
              Actual
            </span>
          </div>
        </div>

        {levelChartOption && (
          <Chart
            option={levelChartOption}
            className="h-[280px] md:h-[340px]"
            aria-label="Accuracy grouped by wind forecast level quintiles"
          />
        )}

        <div className="p-4 rounded-[0.5rem] border border-amber/60 bg-[rgba(217,119,6,0.04)] text-[13px] text-ink space-y-2">
          <div className="flex items-center gap-2 font-semibold text-amber">
            <WarningCircle size={17} weight="bold" />
            <span>Read with care</span>
          </div>
          {quintileNote && (
            <p className="text-subtext leading-relaxed font-sans">{quintileNote}</p>
          )}
          <p className="text-subtext leading-relaxed font-sans">
            Binning by forecast value builds in a statistical effect (the highest forecasts are more
            likely to be overestimates), so part of this pattern would appear even without
            curtailment.
          </p>
        </div>
      </Card>

      {/* f) "Day by day" Card */}
      <Card className="p-5 md:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[12px] font-mono text-subtext uppercase tracking-wider font-semibold">
              JANUARY 2026 TIMELINE
            </span>
            <h3 className="text-[18px] font-sans font-bold text-ink mt-0.5">
              Day by day
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-mono text-brand font-medium hidden sm:inline">
              Click a day to open its brief
            </span>
            <div className="flex items-center gap-4 text-[12px] font-mono text-subtext">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-sm bg-[#b91c1c]" />
                Bias (MW)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-1 rounded-sm bg-brand" />
                MAE (MW)
              </span>
            </div>
          </div>
        </div>

        {dayChartOption && (
          <Chart
            option={dayChartOption}
            className="h-[280px] md:h-[340px]"
            onEvents={{ click: handleDayChartClick }}
            aria-label="Daily accuracy timeline for January 2026. Click a day to open its Decision Brief."
          />
        )}

        <p className="text-[12px] font-mono text-subtext pt-1 border-t border-border/40">
          Hint: Click any day bar to open that date in the Decision Brief.
        </p>
      </Card>

      {/* g) "What does waiting buy?" Card */}
      <Card className="p-5 md:p-6 space-y-4">
        <div>
          <span className="text-[12px] font-mono text-subtext uppercase tracking-wider font-semibold">
            AUCTION TIMING BENCHMARKS
          </span>
          <h3 className="text-[18px] font-sans font-bold text-ink mt-0.5">
            What does waiting buy?
          </h3>
        </div>

        <div className="overflow-x-auto rounded-[0.5rem] border border-border shadow-[inset_-12px_0_8px_-4px_rgba(43,42,42,0.12)]">
          <table className="w-full text-left border-collapse text-[13px] min-w-[700px]">
            <thead>
              <tr className="border-b border-border bg-[rgba(43,42,42,0.02)] text-subtext font-mono uppercase text-[11px] tracking-wider">
                <th className="py-3 px-4 font-semibold">Gate Preset</th>
                <th className="py-3 px-4 font-semibold">Typical Publish Run</th>
                <th className="py-3 px-4 font-semibold text-right">Bias (GW)</th>
                <th className="py-3 px-4 font-semibold text-right">MAE (GW)</th>
                <th className="py-3 px-4 font-semibold text-right">RMSE (GW)</th>
                <th className="py-3 px-4 font-semibold text-right">MAE %</th>
                <th className="py-3 px-4 font-semibold text-right">MAE vs 09:20</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(43,42,42,0.06)] bg-surface font-mono">
              {data.cutoff_comparison.map((row) => {
                const isSelected = row.cutoff === data.cutoff;
                const baseMae = r0920?.mae ?? 1;
                const diffPct = row.mae ? ((row.mae - baseMae) / baseMae) * 100 : 0;

                return (
                  <tr
                    key={row.preset_id}
                    className={`transition-standard ${
                      isSelected
                        ? 'bg-[rgba(20,137,55,0.08)] font-semibold text-ink'
                        : 'hover:bg-[rgba(43,42,42,0.01)] text-subtext'
                    }`}
                  >
                    <td className="py-3 px-4 text-ink font-medium">
                      {row.cutoff} London ({row.preset_id})
                    </td>
                    <td className="py-3 px-4 text-[12px]">{row.typical_publish_run}</td>
                    <td className="py-3 px-4 text-right text-[#b91c1c]">
                      {fmtSignedGW(row.bias)}
                    </td>
                    <td className="py-3 px-4 text-right">{fmtGW(row.mae)} GW</td>
                    <td className="py-3 px-4 text-right">{fmtGW(row.rmse)} GW</td>
                    <td className="py-3 px-4 text-right">{fmtPct(row.mae_pct)}</td>
                    <td
                      className={`py-3 px-4 text-right ${
                        diffPct < 0
                          ? 'text-brand font-semibold'
                          : diffPct > 0
                          ? 'text-[#b91c1c]'
                          : 'text-subtext'
                      }`}
                    >
                      {fmtPct(diffPct, true)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-[13px] text-ink font-sans pt-1 leading-relaxed">
          {comparisonSentence}
        </p>
        <p className="text-[12px] text-subtext font-sans">
          One month of data: small differences between nearby cutoffs should not be over-read.
        </p>
      </Card>

      {/* h) "Is the risk band honest?" Card */}
      <Card className="p-5 md:p-6 space-y-4">
        <div>
          <span className="text-[12px] font-mono text-subtext uppercase tracking-wider font-semibold">
            LEAVE-ONE-DAY-OUT CALIBRATION
          </span>
          <h3 className="text-[18px] font-sans font-bold text-ink mt-0.5">
            Is the risk band honest?
          </h3>
        </div>

        {/* Stacked percentage bar */}
        <div className="space-y-1.5">
          <div className="relative h-10 w-full rounded-[0.5rem] overflow-hidden flex text-[12px] font-mono font-semibold shadow-inner border border-border">
            {/* Below firm segment */}
            <div
              style={{ width: `${belowPct}%` }}
              className="bg-amber text-white flex items-center justify-center transition-all"
              title={`Below firm: ${belowPct}% (nominal 10%)`}
            >
              {belowPct}%
            </div>
            {/* Within band segment */}
            <div
              style={{ width: `${withinPct}%` }}
              className="bg-[rgba(20,137,55,0.18)] text-[#0f6f2d] flex items-center justify-center transition-all"
              title={`Within band: ${withinPct}% (nominal 80%)`}
            >
              {withinPct}% inside band
            </div>
            {/* Above upside segment */}
            <div
              style={{ width: `${abovePct}%` }}
              className="bg-amber text-white flex items-center justify-center transition-all"
              title={`Above upside: ${abovePct}% (nominal 10%)`}
            >
              {abovePct}%
            </div>

            {/* Nominal 10% and 90% split marker ticks */}
            <div
              className="absolute top-0 bottom-0 left-[10%] w-[2px] bg-ink/75 z-10 pointer-events-none"
              title="Nominal 10% target"
            />
            <div
              className="absolute top-0 bottom-0 left-[90%] w-[2px] bg-ink/75 z-10 pointer-events-none"
              title="Nominal 90% target"
            />
          </div>

          <div className="flex justify-between text-[11px] font-mono text-subtext px-1">
            <span>Below firm (nominal 10%)</span>
            <span>Inside P10–P90 (nominal 80%)</span>
            <span>Above upside (nominal 10%)</span>
          </div>
        </div>

        <div className="space-y-1.5 text-[13px] text-subtext leading-relaxed font-sans pt-2 border-t border-border/40">
          <p>{bb.note}</p>
          <p className="font-medium text-ink">
            {bb.days_avg_actual_below_avg_firm} of {bb.n_days} days had an average below the day&apos;s
            firm level.
          </p>
          <p className="text-[12px]">
            Calibrated by leave-one-day-out cross-validation on January 2026; not a live
            out-of-sample test.
          </p>
        </div>
      </Card>

      {/* i) "The look-ahead trap" Card (showpiece with amber accent border) */}
      <Card className="p-5 md:p-6 space-y-4 border-2 border-amber bg-surface">
        <div className="flex items-center gap-2">
          <Tag tone="amber">LEAKAGE BENCHMARK</Tag>
        </div>
        <div>
          <h3 className="text-[20px] font-sans font-bold text-ink">
            The look-ahead trap
          </h3>
          <p className="text-[13px] text-subtext mt-1 leading-relaxed">
            Comparing the strictly available decision-time forecast against a retrospective naive join.
          </p>
        </div>

        {/* Two proportional horizontal bars */}
        <div className="space-y-3 pt-2">
          <div>
            <div className="flex justify-between text-[12px] font-mono text-ink mb-1">
              <span className="font-semibold text-brand">Decision-time forecast (clean)</span>
              <span>{fmtMW(decMae)} MW</span>
            </div>
            <div className="h-6 w-full bg-[rgba(43,42,42,0.06)] rounded-sm overflow-hidden">
              <div
                style={{ width: `${decWidthPct}%` }}
                className="h-full bg-brand rounded-sm transition-all"
              />
            </div>
            <div className="text-[11px] font-mono text-subtext mt-0.5">
              Bias: {fmtSigned(data.leakage.decision_time.bias, 'MW')} | RMSE:{' '}
              {fmtMW(data.leakage.decision_time.rmse)} MW
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[12px] font-mono text-ink mb-1">
              <span className="font-semibold text-amber">Naive latest forecast (leaky)</span>
              <span>{fmtMW(naiveMae)} MW</span>
            </div>
            <div className="h-6 w-full bg-[rgba(43,42,42,0.06)] rounded-sm overflow-hidden">
              <div
                style={{ width: `${naiveWidthPct}%` }}
                className="h-full bg-amber rounded-sm transition-all"
              />
            </div>
            <div className="text-[11px] font-mono text-subtext mt-0.5">
              Bias: {fmtSigned(data.leakage.naive.bias, 'MW')} | RMSE:{' '}
              {fmtMW(data.leakage.naive.rmse)} MW
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-[0.5rem] bg-[rgba(217,119,6,0.08)] border border-amber/30 text-[13px] leading-relaxed text-ink font-sans">
          A naive join that uses the latest forecast ever published makes the forecast look{' '}
          <b className="font-mono text-amber font-bold">{data.leakage.mae_gap_pct}%</b> more accurate
          than anything a buyer could have used on the day.
        </div>

        <div className="text-[12px] text-subtext leading-relaxed space-y-1 font-sans">
          <p>
            <b className="text-ink">Naive definition:</b> {data.leakage.naive_definition}
          </p>
          <p>
            <b className="text-ink">Decision-time forecast:</b> The latest run published strictly
            before the cutoff.
          </p>
        </div>
      </Card>

      {/* j) Collapsible "All error percentiles" */}
      <div>
        <Button
          id="toggle-percentiles-btn"
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setPercentilesOpen((v) => !v)}
          aria-expanded={percentilesOpen}
          aria-controls={percentilesId}
        >
          {percentilesOpen ? <CaretUp size={14} weight="bold" /> : <CaretDown size={14} weight="bold" />}
          All error percentiles
        </Button>

        {percentilesOpen && (
          <div id={percentilesId} className="mt-3 overflow-x-auto rounded-[0.5rem] border border-border shadow-[inset_-12px_0_8px_-4px_rgba(43,42,42,0.12)]">
            <table className="w-full text-left border-collapse text-[13px] min-w-[600px]">
              <thead>
                <tr className="border-b border-border bg-[rgba(43,42,42,0.02)] text-subtext font-mono uppercase text-[11px] tracking-wider">
                  <th className="py-2.5 px-4 font-semibold">Metric</th>
                  {percentileKeys.map((p) => (
                    <th key={p} className="py-2.5 px-4 font-semibold text-right uppercase">
                      {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(43,42,42,0.06)] bg-surface font-mono">
                <tr>
                  <td className="py-3 px-4 font-medium text-ink">Error (MW)</td>
                  {percentileKeys.map((p) => (
                    <td key={p} className="py-3 px-4 text-right text-ink">
                      {fmtSigned(data.metrics.error_percentiles?.[p], 'MW')}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium text-ink">Ratio (Actual / Forecast)</td>
                  {percentileKeys.map((p) => {
                    const val = data.metrics.ratio_percentiles?.[p];
                    return (
                      <td key={p} className="py-3 px-4 text-right text-ink">
                        {val !== null && val !== undefined ? val.toFixed(3) : '–'}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* k) Footer notes & disclosures */}
      <footer className="pt-6 border-t border-border/50 text-[12px] text-subtext leading-relaxed space-y-2">
        {data.notes.map((note, idx) => (
          <p key={idx}>{note}</p>
        ))}
        <p>
          Calibrated by leave-one-day-out cross-validation on January 2026; not a live out-of-sample
          forecast.
        </p>
      </footer>
    </div>
  );
};
