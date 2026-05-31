'use client';

import type { ScoredDependency } from '@/lib/types';

const RISK_STYLES: Record<ScoredDependency['risk'], string> = {
  danger:  'border-risk-danger/40  bg-risk-danger/5  hover:bg-risk-danger/10',
  watch:   'border-risk-watch/40   bg-risk-watch/5   hover:bg-risk-watch/10',
  healthy: 'border-risk-healthy/30 bg-risk-healthy/5 hover:bg-risk-healthy/10',
  unknown: 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-strong)]',
};

const RISK_TEXT: Record<ScoredDependency['risk'], string> = {
  danger:  'text-risk-danger',
  watch:   'text-risk-watch',
  healthy: 'text-risk-healthy',
  unknown: 'text-[var(--fg-2)]',
};

export function DependencyCard({
  dep,
  onClick,
}: {
  dep: ScoredDependency;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-lg border p-3 text-left transition ${RISK_STYLES[dep.risk]}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="truncate font-mono text-sm font-medium text-[var(--fg)]">
          {dep.package_name}
        </div>
        <div className="shrink-0 font-mono text-xs text-[var(--fg-3)]">
          {dep.declared_range}
          {dep.latest_version && dep.latest_version !== dep.declared_range && (
            <> → <span className="text-[var(--fg-2)]">{dep.latest_version}</span></>
          )}
        </div>
      </div>
      <div className={`mt-1 text-xs ${RISK_TEXT[dep.risk]}`}>
        {dep.headline}
      </div>
      {dep.cve_count > 0 && (
        <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-risk-danger/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-risk-danger">
          {dep.cve_count} CVE{dep.cve_count > 1 ? 's' : ''}
        </div>
      )}
    </button>
  );
}
