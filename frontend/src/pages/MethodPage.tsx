import React, { useCallback } from 'react';
import type { MetaResponse } from '../api/types';
import { Card } from '../components/ui/Card';
import { Tag } from '../components/ui/Tag';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { fmtMW, fmtFullUtcDateTime } from '../lib/format';
import { ArrowRight, CheckCircle, Copy, Database, GitCommit } from '@phosphor-icons/react';

export interface MethodPageProps {
  meta: MetaResponse | null;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}

function CopyableHash({ hash }: { hash: string }) {
  const shortened = hash.length >= 16
    ? `${hash.slice(0, 8)}…${hash.slice(-8)}`
    : hash;

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(hash);
  }, [hash]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={hash}
      aria-label={`Copy full SHA-256 checksum: ${hash}`}
      className="inline-flex items-center gap-1 font-mono text-xs text-ink underline decoration-dotted decoration-subtext cursor-pointer hover:text-brand transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1"
    >
      <span>{shortened}</span>
      <Copy size={11} className="text-subtext" />
    </button>
  );
}

export const MethodPage: React.FC<MethodPageProps> = ({
  meta,
  loading,
  error,
  onRetry,
}) => {
  if (loading) {
    return (
      <div className="max-w-[80rem] mx-auto px-4 md:px-6 py-8 space-y-8">
        <Skeleton height={140} className="rounded-card" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton height={120} className="rounded-card" />
          <Skeleton height={120} className="rounded-card" />
          <Skeleton height={120} className="rounded-card" />
          <Skeleton height={120} className="rounded-card" />
        </div>
        <Skeleton height={200} className="rounded-card" />
      </div>
    );
  }

  if (error || !meta) {
    return (
      <div className="max-w-[80rem] mx-auto px-4 md:px-6 py-12">
        <ErrorState
          title="Unable to load methodology metadata"
          message={error?.message || 'Failed to retrieve /api/meta'}
          onRetry={onRetry}
        />
      </div>
    );
  }

  const manifest = meta.manifest;
  const actualsSha = manifest.sha256?.['actuals_halfhourly.csv'] || '';
  const forecastsSha = manifest.sha256?.['forecasts.csv'] || '';

  return (
    <div className="max-w-[80rem] mx-auto px-4 md:px-6 py-8 space-y-10">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Tag tone="brand">SYSTEM ARCHITECTURE &amp; METHODOLOGY</Tag>
        </div>
        <h2 className="text-[28px] md:text-[34px] font-sans font-bold text-ink tracking-tight">
          Method &amp; Governance
        </h2>
        <p className="text-[15px] text-subtext max-w-3xl mt-1 leading-relaxed">
          Comprehensive explanation of the day-ahead wind purchasing decision framework,
          decision cutoff timing rules, uncertainty band calibration, and snapshot data provenance.
        </p>
      </div>

      {/* 1. What this tool does */}
      <section className="space-y-4">
        <h3 className="text-[18px] font-sans font-bold text-ink tracking-tight">
          What this tool does
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card className="p-5 flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded-full bg-[rgba(20,137,55,0.12)] text-brand flex items-center justify-center font-mono font-bold text-[14px] mb-3">
                01
              </div>
              <h4 className="font-semibold text-ink text-[16px] mb-1.5">
                Decision-Time Reconstruction
              </h4>
              <p className="text-[14px] text-subtext leading-relaxed">
                Reconstructs the national wind forecast run (Elexon WINDFOR) that was strictly
                available to day-ahead power buyers prior to market auction cutoffs.
              </p>
            </div>
          </Card>

          <Card className="p-5 flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded-full bg-[rgba(20,137,55,0.12)] text-brand flex items-center justify-center font-mono font-bold text-[14px] mb-3">
                02
              </div>
              <h4 className="font-semibold text-ink text-[16px] mb-1.5">
                Calibrated Uncertainty Bands
              </h4>
              <p className="text-[14px] text-subtext leading-relaxed">
                Applies leave-one-day-out ratio calibration on historic actuals to generate empirical
                firm (p10), expected (p50), and upside (p90) purchasing bands for unhedged wind volumes.
              </p>
            </div>
          </Card>

          <Card className="p-5 flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded-full bg-[rgba(20,137,55,0.12)] text-brand flex items-center justify-center font-mono font-bold text-[14px] mb-3">
                03
              </div>
              <h4 className="font-semibold text-ink text-[16px] mb-1.5">
                Bias &amp; Over-Forecast Analysis
              </h4>
              <p className="text-[14px] text-subtext leading-relaxed">
                Measures the systematic over-forecast against metered output, how it varies by hour and
                by wind level, and what that implies for how much wind to rely on. The cause is
                consistent with curtailment and embedded generation but is not isolated. See the Accuracy Lab.
              </p>
            </div>
          </Card>
        </div>
      </section>

      {/* 2. The decision rule */}
      <section className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-[18px] font-sans font-bold text-ink tracking-tight">
            The Decision Rule
          </h3>
          <span className="text-[12px] font-mono text-subtext">
            Timezone: {meta.timezone} (strict &lt; cutoff)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          <Card className="p-5 border-l-4 border-l-brand relative">
            <span className="text-[11px] font-mono uppercase tracking-wider text-subtext font-semibold">
              Step 1
            </span>
            <h4 className="font-semibold text-[15px] text-ink mt-1 mb-2">
              Decision Cutoff
            </h4>
            <p className="text-[13px] text-subtext leading-relaxed">
              Order submission deadline on D-1 in London time (09:20 for EPEX Day-Ahead, 09:50 for N2EX, or 15:30 for EPEX HH).
            </p>
            <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-subtext bg-surface p-1 rounded-full border border-border">
              <ArrowRight size={14} weight="bold" />
            </div>
          </Card>

          <Card className="p-5 border-l-4 border-l-brand relative">
            <span className="text-[11px] font-mono uppercase tracking-wider text-subtext font-semibold">
              Step 2
            </span>
            <h4 className="font-semibold text-[15px] text-ink mt-1 mb-2">
              Eligible Forecast Run
            </h4>
            <p className="text-[13px] text-subtext leading-relaxed">
              Filter WINDFOR publication runs strictly published before cutoff (<code className="text-xs bg-[rgba(43,42,42,0.06)] px-1 py-0.5 rounded font-mono">publish_time &lt; cutoff</code>). The latest run is selected.
            </p>
            <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-subtext bg-surface p-1 rounded-full border border-border">
              <ArrowRight size={14} weight="bold" />
            </div>
          </Card>

          <Card className="p-5 border-l-4 border-l-brand relative">
            <span className="text-[11px] font-mono uppercase tracking-wider text-subtext font-semibold">
              Step 3
            </span>
            <h4 className="font-semibold text-[15px] text-ink mt-1 mb-2">
              Hourly Delivery Grid
            </h4>
            <p className="text-[13px] text-subtext leading-relaxed">
              Extract 24 hourly delivery points (00:00 to 23:00 UTC) for delivery day D with
              forward lead times of roughly 12 to 40 hours, depending on the cutoff.
            </p>
            <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-subtext bg-surface p-1 rounded-full border border-border">
              <ArrowRight size={14} weight="bold" />
            </div>
          </Card>

          <Card className="p-5 border-l-4 border-l-brand">
            <span className="text-[11px] font-mono uppercase tracking-wider text-subtext font-semibold">
              Step 4
            </span>
            <h4 className="font-semibold text-[15px] text-ink mt-1 mb-2">
              Outturn Evaluation
            </h4>
            <p className="text-[13px] text-subtext leading-relaxed">
              Compare with actual metered generation (FUELHH 30-minute pairs averaged hourly). Calculate errors and ratio percentiles.
            </p>
          </Card>
        </div>
      </section>

      {/* 3. Assumptions */}
      <section className="space-y-4">
        <h3 className="text-[18px] font-sans font-bold text-ink tracking-tight">
          Operational Assumptions
        </h3>
        <Card className="p-6">
          <ul className="space-y-3">
            {meta.assumptions.map((item, index) => (
              <li key={index} className="flex items-start gap-3 text-[14px] text-ink">
                <CheckCircle
                  size={18}
                  weight="fill"
                  className="text-brand shrink-0 mt-0.5"
                />
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* 4. Data provenance */}
      <section className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-[18px] font-sans font-bold text-ink tracking-tight flex items-center gap-2">
            <Database size={20} className="text-brand" />
            <span>Data Provenance &amp; Checksums</span>
          </h3>
          <span className="text-[12px] font-mono text-subtext">
            Committed Snapshot: data/snapshot/
          </span>
        </div>

        <div className="overflow-x-auto rounded-[0.75rem] border border-border shadow-[inset_-14px_0_10px_-6px_rgba(43,42,42,0.18)]">
          <table className="w-full text-left border-collapse text-[13px] min-w-[700px]">
            <thead>
              <tr className="border-b border-border bg-[rgba(43,42,42,0.02)] text-subtext font-mono uppercase text-[11px] tracking-wider">
                <th className="py-3 px-4 font-semibold">Dataset</th>
                <th className="py-3 px-4 font-semibold">Source Endpoint</th>
                <th className="py-3 px-4 font-semibold text-right">Rows</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Fetched (UTC)</th>
                <th className="py-3 px-4 font-semibold">SHA-256</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(43,42,42,0.06)] bg-surface">
              <tr className="hover:bg-[rgba(43,42,42,0.01)] transition-standard">
                <td className="py-3.5 px-4 font-medium text-ink whitespace-nowrap">
                  FUELHH
                  <div className="text-[11px] text-subtext font-normal font-sans font-normal">
                    Actual Wind (30-min)
                  </div>
                </td>
                <td className="py-3.5 px-4 font-mono text-[11px] text-subtext break-all max-w-[260px]">
                  <a
                    href={manifest.source_endpoint_urls.actuals}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-brand hover:underline"
                  >
                    {manifest.source_endpoint_urls.actuals}
                  </a>
                </td>
                <td className="py-3.5 px-4 font-mono text-right font-medium text-ink">
                  {fmtMW(manifest.row_counts.actuals_halfhourly)}
                </td>
                <td className="py-3.5 px-4 font-mono text-[11px] text-subtext whitespace-nowrap">
                  {fmtFullUtcDateTime(manifest.fetched_at_utc)}
                </td>
                <td className="py-3.5 px-4">
                  <CopyableHash hash={actualsSha} />
                </td>
              </tr>

              <tr className="hover:bg-[rgba(43,42,42,0.01)] transition-standard">
                <td className="py-3.5 px-4 font-medium text-ink whitespace-nowrap">
                  WINDFOR
                  <div className="text-[11px] text-subtext font-normal font-sans">
                    Wind Forecast (Hourly)
                  </div>
                </td>
                <td className="py-3.5 px-4 font-mono text-[11px] text-subtext break-all max-w-[260px]">
                  <a
                    href={manifest.source_endpoint_urls.forecasts}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-brand hover:underline"
                  >
                    {manifest.source_endpoint_urls.forecasts}
                  </a>
                </td>
                <td className="py-3.5 px-4 font-mono text-right font-medium text-ink">
                  {fmtMW(manifest.row_counts.forecasts)}
                </td>
                <td className="py-3.5 px-4 font-mono text-[11px] text-subtext whitespace-nowrap">
                  {fmtFullUtcDateTime(manifest.fetched_at_utc)}
                </td>
                <td className="py-3.5 px-4">
                  <CopyableHash hash={forecastsSha} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[11px] font-mono text-subtext md:hidden text-right mt-1">
          scroll &rarr;
        </p>
      </section>

      {/* 5. Reproduce */}
      <section className="space-y-4">
        <h3 className="text-[18px] font-sans font-bold text-ink tracking-tight flex items-center gap-2">
          <GitCommit size={20} className="text-brand" />
          <span>Reproducibility &amp; Execution</span>
        </h3>
        <Card className="p-5 bg-surface">
          <p className="text-[14px] text-subtext mb-3 leading-relaxed">
            Run the entire data ingestion, validation, test suite, backend API, and React frontend using the following commands:
          </p>
          <div className="overflow-x-auto rounded-[0.5rem] border border-border shadow-[inset_-14px_0_10px_-6px_rgba(43,42,42,0.18)]">
            <pre className="p-4 bg-[rgba(43,42,42,0.04)] font-mono text-[12px] leading-relaxed text-ink whitespace-pre select-all">
{`# 0. Regenerate the snapshot from Elexon
python backend/scripts/ingest.py

# 1. Run backend verification & golden benchmark test suites (pytest)
pytest

# 2. Verify code hygiene & style compliance (ruff)
ruff check backend
ruff format --check backend

# 3. Start the FastAPI decision backend (runs on :8000)
uvicorn backend.app.main:app --port 8000

# 4. In a separate shell, start the React frontend (runs on :5173)
npm run dev`}
            </pre>
          </div>
          <p className="text-[11px] font-mono text-subtext md:hidden text-right mt-1">
            scroll &rarr;
          </p>
        </Card>
      </section>
    </div>
  );
};
