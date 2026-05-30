import { describe, it, expect } from 'vitest';
import { scoreDependency, daysBetween } from './risk';
import type { AuditRow } from './types';

const NOW = new Date('2026-05-13T00:00:00Z');

function row(overrides: Partial<AuditRow> = {}): AuditRow {
  return {
    package_name: 'example',
    declared_range: '^1.0.0',
    latest_version: '1.0.0',
    license: 'MIT',
    repository__url: 'git+https://github.com/example/example.git',
    last_publish_at: '2026-04-01T00:00:00Z',
    first_publish_at: '2020-01-01T00:00:00Z',
    deprecated: null,
    cve_count: 0,
    worst_severity_rank: 0,
    cve_list: [],
    downloads_last_month: 1_000_000,
    downloads_last_week: 250_000,
    downloads_trend_pct: 0,
    gh_last_push_at: '2026-05-01T00:00:00Z',
    gh_last_updated_at: '2026-05-01T00:00:00Z',
    open_issues_count: 10,
    stargazers_count: 1000,
    gh_archived: false,
    days_since_last_publish: null,
    days_since_github_push: null,
    ...overrides,
  };
}

describe('scoreDependency', () => {
  it('flags HIGH/CRITICAL CVE as danger', () => {
    const r = scoreDependency(row({ cve_count: 1, worst_severity_rank: 3 }), NOW);
    expect(r.risk).toBe('danger');
    expect(r.headline).toMatch(/CVE/);
  });

  it('flags CRITICAL CVE with multiple advisories', () => {
    const r = scoreDependency(row({ cve_count: 3, worst_severity_rank: 4 }), NOW);
    expect(r.risk).toBe('danger');
    expect(r.headline).toMatch(/3 critical/i);
  });

  it('low-severity CVE stays as watch, not danger', () => {
    const r = scoreDependency(row({ cve_count: 1, worst_severity_rank: 1 }), NOW);
    expect(r.risk).toBe('watch');
  });

  it('deprecated package is danger even with no CVE', () => {
    const r = scoreDependency(row({ deprecated: 'use package-y instead' }), NOW);
    expect(r.risk).toBe('danger');
    expect(r.signals.join(' ')).toMatch(/Deprecated/);
  });

  it('archived upstream repo is danger even with no CVE', () => {
    const r = scoreDependency(row({ gh_archived: true }), NOW);
    expect(r.risk).toBe('danger');
    expect(r.signals.join(' ')).toMatch(/archived/i);
  });

  it('abandoned + collapsing downloads escalates to danger', () => {
    const r = scoreDependency(
      row({
        last_publish_at: '2024-01-01T00:00:00Z',
        days_since_last_publish: 500,
        downloads_trend_pct: -55,
      }),
      NOW,
    );
    expect(r.risk).toBe('danger');
    expect(r.headline).toMatch(/abandonment/i);
  });

  it('publish 90-365 days ago without CVE is watch', () => {
    const r = scoreDependency(
      row({ last_publish_at: '2025-09-01T00:00:00Z', days_since_last_publish: 250 }),
      NOW,
    );
    expect(r.risk).toBe('watch');
  });

  it('fresh publish, no CVE, stable downloads is healthy', () => {
    const r = scoreDependency(
      row({
        last_publish_at: '2026-05-01T00:00:00Z',
        days_since_last_publish: 12,
        downloads_trend_pct: 2,
      }),
      NOW,
    );
    expect(r.risk).toBe('healthy');
    expect(r.headline).toMatch(/No issues/i);
  });

  it('mild download dip alone does not flag danger', () => {
    const r = scoreDependency(
      row({
        days_since_last_publish: 30,
        downloads_trend_pct: -50,
      }),
      NOW,
    );
    expect(r.risk).toBe('watch');
  });
});

describe('daysBetween', () => {
  it('returns null for null input', () => {
    expect(daysBetween(null, NOW)).toBeNull();
  });

  it('computes whole-day difference', () => {
    expect(daysBetween('2026-05-03T00:00:00Z', NOW)).toBe(10);
  });

  it('returns null for invalid ISO', () => {
    expect(daysBetween('not-a-date', NOW)).toBeNull();
  });
});
