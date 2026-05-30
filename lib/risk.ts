import type { AuditRow, RiskLevel, ScoredDependency, Severity } from './types';

const SEVERITY_RANK: Record<Severity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MODERATE: 2,
  LOW: 1,
  UNKNOWN: 0,
};

const DAY = 1000 * 60 * 60 * 24;

export function daysBetween(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / DAY);
}

/**
 * Pure risk scorer. Given the joined row from Coral, return a badge + the
 * signals that drove it. Order matters: CVE severity always wins.
 */
export function scoreDependency(row: AuditRow, now: Date = new Date()): ScoredDependency {
  const signals: string[] = [];
  let risk: RiskLevel = 'healthy';
  let headline = 'No issues detected.';

  // ── 1. Active high/critical CVE → instant danger.
  if (row.cve_count > 0 && row.worst_severity_rank >= SEVERITY_RANK.HIGH) {
    risk = 'danger';
    const worst = worstLabel(row.worst_severity_rank);
    headline = `${row.cve_count} ${worst.toLowerCase()} CVE${row.cve_count > 1 ? 's' : ''} affecting this package.`;
    signals.push(`${row.cve_count} active CVE(s), worst severity: ${worst}`);
  } else if (row.cve_count > 0) {
    risk = 'watch';
    headline = `${row.cve_count} known advisor${row.cve_count > 1 ? 'ies' : 'y'} (severity ${worstLabel(row.worst_severity_rank).toLowerCase()}).`;
    signals.push(`${row.cve_count} advisory record(s), worst severity: ${worstLabel(row.worst_severity_rank)}`);
  }

  // ── 2. Deprecation message in the registry.
  if (row.deprecated) {
    if (risk === 'healthy') {
      risk = 'danger';
      headline = 'Package is marked deprecated on npm.';
    }
    signals.push(`Deprecated on npm: "${truncate(row.deprecated, 80)}"`);
  }

  // ── 3. Archived upstream GitHub repo — the maintainer has explicitly stopped.
  if (row.gh_archived) {
    if (risk === 'healthy') {
      risk = 'danger';
      headline = 'Upstream GitHub repo has been archived by its maintainer.';
    }
    signals.push('Upstream GitHub repo is archived.');
  }

  // ── 4. Maintainer activity. npm publish dates are the strongest signal;
  // GitHub push date is the corroborating one.
  const sincePublish = row.days_since_last_publish ?? daysBetween(row.last_publish_at, now);
  const sincePush = row.days_since_github_push ?? daysBetween(row.gh_last_push_at, now);

  if (sincePublish !== null) {
    if (sincePublish > 365) {
      if (risk === 'healthy') {
        risk = 'watch';
        headline = `No npm publish in ${formatMonths(sincePublish)}.`;
      }
      signals.push(`Last npm publish: ${formatMonths(sincePublish)} ago`);
    } else if (sincePublish > 180) {
      if (risk === 'healthy') {
        risk = 'watch';
        headline = `Last npm publish was ${formatMonths(sincePublish)} ago.`;
      }
      signals.push(`Last npm publish: ${formatMonths(sincePublish)} ago`);
    } else {
      signals.push(`Last npm publish: ${formatMonths(sincePublish)} ago`);
    }
  }

  if (sincePush !== null && sincePush > 365) {
    if (risk === 'healthy') {
      risk = 'watch';
      headline = `Upstream GitHub repo silent for ${formatMonths(sincePush)}.`;
    }
    signals.push(`Last GitHub push: ${formatMonths(sincePush)} ago`);
  }

  // ── 5. Download trend collapse. Only escalates to "watch"; never alone to "danger".
  if (row.downloads_trend_pct !== null && row.downloads_trend_pct < -40) {
    if (risk === 'healthy') {
      risk = 'watch';
      headline = `Downloads dropped ${Math.abs(row.downloads_trend_pct).toFixed(0)}% over the last month.`;
    }
    signals.push(`Download trend: ${row.downloads_trend_pct.toFixed(0)}% week-over-month`);
  }

  // ── 6. Compound: stale + declining + no CVE = still danger.
  // This catches the abandoned-but-not-yet-CVE'd case (the xz-utils pattern).
  if (
    risk !== 'danger' &&
    sincePublish !== null && sincePublish > 365 &&
    row.downloads_trend_pct !== null && row.downloads_trend_pct < -30
  ) {
    risk = 'danger';
    headline = `Maintainer silent for ${formatMonths(sincePublish)} AND downloads collapsing — abandonment signal.`;
  }

  return { ...row, risk, headline, signals };
}

function worstLabel(rank: number): Severity {
  const entries = Object.entries(SEVERITY_RANK) as [Severity, number][];
  const match = entries.find(([, r]) => r === rank);
  return match ? match[0] : 'UNKNOWN';
}

function formatMonths(days: number): string {
  if (days < 30) return `${days} day${days === 1 ? '' : 's'}`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`;
  const years = (days / 365).toFixed(1).replace(/\.0$/, '');
  return `${years} year${years === '1' ? '' : 's'}`;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

export const __testing = { SEVERITY_RANK, formatMonths };
