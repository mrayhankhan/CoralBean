// Shared types for the dependency risk auditor.

export type RiskLevel = 'healthy' | 'watch' | 'danger' | 'unknown';

export type Severity = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' | 'UNKNOWN';

export interface OsvCveSummary {
  id: string;
  severity: Severity;
  summary: string;
}

/**
 * One row of the Coral JOIN — the shape the SQL in sql/audit-query.sql
 * returns, after JSON columns have been parsed back into objects/arrays.
 */
export interface AuditRow {
  package_name: string;
  declared_range: string;          // value from package.json (e.g. "^4.17.21")
  latest_version: string | null;
  license: string | null;
  repository__url: string | null;
  last_publish_at: string | null;  // ISO timestamp
  first_publish_at: string | null;
  deprecated: string | null;
  cve_count: number;
  worst_severity_rank: number;     // 0..4, see sql/audit-query.sql
  cve_list: OsvCveSummary[];
  downloads_last_month: number | null;
  downloads_last_week: number | null;
  downloads_trend_pct: number | null;
  gh_last_push_at: string | null;
  gh_last_updated_at: string | null;
  open_issues_count: number | null;
  stargazers_count: number | null;
  gh_archived: boolean | null;
  days_since_last_publish: number | null;
  days_since_github_push: number | null;
}

export interface ScoredDependency extends AuditRow {
  risk: RiskLevel;
  /** One-sentence reason for the badge — shown on the card. */
  headline: string;
  /** All signals that contributed to the score, for the drill-down. */
  signals: string[];
}

export interface AuditResponse {
  repo: { owner: string; repo: string };
  generatedAt: string;
  durationMs: number;
  /** The actual SQL Coral ran — surfaced in the UI for the demo. */
  query: string;
  /** Source of the data (real Coral CLI vs. HTTP fallback). */
  mode: 'coral' | 'fallback';
  dependencies: ScoredDependency[];
  errors: string[];
}
