'use client';

import { useEffect } from 'react';
import type { ScoredDependency } from '@/lib/types';

const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: 'bg-risk-danger/30 text-risk-danger',
  HIGH:     'bg-risk-danger/20 text-risk-danger',
  MODERATE: 'bg-risk-watch/20  text-risk-watch',
  LOW:      'bg-[var(--skeleton)]   text-[var(--fg-2)]',
  UNKNOWN:  'bg-[var(--skeleton-2)] text-[var(--fg-2)]',
};

export function RiskDrillDown({
  dep,
  onClose,
}: {
  dep: ScoredDependency;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const repoUrl = (dep.repository__url ?? '')
    .replace(/^git\+/, '')
    .replace(/\.git$/, '');

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--overlay)] p-4 sm:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-2xl"
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-mono text-xl text-[var(--fg)]">{dep.package_name}</h2>
            <p className="mt-1 text-sm text-[var(--fg-3)]">
              {dep.declared_range} → {dep.latest_version ?? 'unknown'}
              {dep.license && <> · {dep.license}</>}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--fg-2)] hover:bg-[var(--surface)]"
          >
            esc
          </button>
        </header>

        <p className={`mb-5 text-sm ${
          dep.risk === 'danger'  ? 'text-risk-danger'  :
          dep.risk === 'watch'   ? 'text-risk-watch'   :
          dep.risk === 'healthy' ? 'text-risk-healthy' : 'text-[var(--fg-2)]'
        }`}>
          {dep.headline}
        </p>

        <section className="mb-6">
          <h3 className="mb-2 text-xs uppercase tracking-wider text-[var(--fg-3)]">Signals</h3>
          <ul className="space-y-1 text-sm text-[var(--fg-2)]">
            {dep.signals.length === 0
              ? <li className="text-[var(--fg-3)]">No notable signals.</li>
              : dep.signals.map((s, i) => <li key={i}>· {s}</li>)}
          </ul>
        </section>

        {dep.cve_list.length > 0 && (
          <section className="mb-6">
            <h3 className="mb-2 text-xs uppercase tracking-wider text-[var(--fg-3)]">
              Vulnerabilities ({dep.cve_list.length})
            </h3>
            <ul className="space-y-2">
              {dep.cve_list.map((cve) => (
                <li
                  key={cve.id}
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <a
                      href={`https://osv.dev/vulnerability/${cve.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-sm text-[var(--fg)] underline-offset-2 hover:underline"
                    >
                      {cve.id}
                    </a>
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                        SEVERITY_STYLE[cve.severity] ?? SEVERITY_STYLE.UNKNOWN
                      }`}
                    >
                      {cve.severity}
                    </span>
                  </div>
                  {cve.summary && (
                    <p className="mt-1 text-xs text-[var(--fg-2)]">{cve.summary}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="grid grid-cols-2 gap-4 text-sm text-[var(--fg-2)]">
          <Detail
            label="Last npm publish"
            value={fmtDays(dep.days_since_last_publish, dep.last_publish_at)}
          />
          <Detail
            label="Last GitHub push"
            value={fmtDays(dep.days_since_github_push, dep.gh_last_push_at)}
          />
          <Detail
            label="Downloads / month"
            value={dep.downloads_last_month?.toLocaleString() ?? '—'}
          />
          <Detail
            label="Download trend"
            value={dep.downloads_trend_pct === null
              ? '—'
              : `${dep.downloads_trend_pct > 0 ? '+' : ''}${dep.downloads_trend_pct.toFixed(1)}%`}
          />
          <Detail label="GitHub stars" value={dep.stargazers_count?.toLocaleString() ?? '—'} />
          <Detail label="Open issues"  value={dep.open_issues_count?.toLocaleString() ?? '—'} />
        </section>

        <footer className="mt-6 flex items-center gap-3 border-t border-[var(--border)] pt-4 text-xs text-[var(--fg-3)]">
          {repoUrl && (
            <a href={repoUrl} target="_blank" rel="noreferrer" className="hover:text-coral-400">
              GitHub →
            </a>
          )}
          <a
            href={`https://www.npmjs.com/package/${dep.package_name}`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-coral-400"
          >
            npm →
          </a>
          <a
            href={`https://osv.dev/list?q=${encodeURIComponent(dep.package_name)}&ecosystem=npm`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-coral-400"
          >
            OSV →
          </a>
        </footer>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-[var(--fg-3)]">{label}</div>
      <div className="mt-0.5 font-mono text-sm text-[var(--fg)]">{value}</div>
    </div>
  );
}

function fmtDays(days: number | null, iso: string | null): string {
  if (days === null && !iso) return '—';
  if (days !== null) {
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    if (days < 365) return `${Math.round(days / 30)} months ago`;
    return `${(days / 365).toFixed(1)} years ago`;
  }
  return iso ?? '—';
}
