-- ─────────────────────────────────────────────────────────────────────────
-- Dependency Risk Auditor — the killer Coral JOIN
-- ─────────────────────────────────────────────────────────────────────────
-- Joins THREE genuinely separate live systems in one query:
--   1. npm.packages                       — latest version, maintainer activity, repo URL
--      (registry.npmjs.org)
--   2. osv.vulnerabilities                — known CVEs for the package (npm ecosystem)
--      (api.osv.dev)
--   3. npm_downloads.downloads_last_month — current download popularity
--      + npm_downloads.downloads_last_week for short-term momentum
--      (api.npmjs.org — a DIFFERENT host than the registry, hence its own source)
--
-- GitHub maintainer-activity (last push, archived) is layered on top by the
-- application via the bundled `github` source when a token is configured; it
-- is intentionally NOT in this query so the headline demo runs with zero auth.
--
-- The host application substitutes :pkg with each dependency name parsed from
-- package.json. The risk badge (healthy/watch/danger) is computed in
-- TypeScript (lib/risk.ts) from the columns returned here.
--
-- This is the query that judges see in the demo terminal. Read it aloud.
-- ─────────────────────────────────────────────────────────────────────────

WITH pkg AS (
  SELECT
    name                                              AS package_name,
    latest_version,
    repository__url,
    license,
    time__modified                                    AS last_publish_at,
    time__created                                     AS first_publish_at
  FROM npm.packages
  WHERE package_name = :pkg
),

cves AS (
  -- Aggregate every advisory into one row per package, keeping the worst
  -- severity. database_specific__severity is the GHSA label
  -- (LOW/MODERATE/HIGH/CRITICAL).
  SELECT
    affected__package__name                            AS package_name,
    COUNT(*)                                           AS cve_count,
    MAX(CASE database_specific__severity
          WHEN 'CRITICAL' THEN 4
          WHEN 'HIGH'     THEN 3
          WHEN 'MODERATE' THEN 2
          WHEN 'MEDIUM'   THEN 2
          WHEN 'LOW'      THEN 1
          ELSE 0
        END)                                           AS worst_sev_rank,
    MAX(modified)                                      AS latest_cve_modified,
    -- Array of {id, severity, summary} structs for the drill-down panel.
    array_agg(
      named_struct(
        'id',       id,
        'severity', COALESCE(database_specific__severity, 'UNKNOWN'),
        'summary',  summary
      )
    )                                                  AS cve_list
  FROM osv.vulnerabilities
  WHERE package_name = :pkg AND ecosystem = 'npm'
    AND withdrawn IS NULL
  GROUP BY affected__package__name
),

dl_month AS (
  SELECT downloads AS downloads_last_month
  FROM npm_downloads.downloads_last_month
  WHERE package_name = :pkg
),

dl_week AS (
  SELECT downloads AS downloads_last_week
  FROM npm_downloads.downloads_last_week
  WHERE package_name = :pkg
)

SELECT
  pkg.package_name,
  pkg.latest_version,
  pkg.license,
  pkg.repository__url,
  pkg.last_publish_at,
  pkg.first_publish_at,

  COALESCE(cves.cve_count, 0)                          AS cve_count,
  COALESCE(cves.worst_sev_rank, 0)                     AS worst_severity_rank,
  cves.cve_list,

  dl_month.downloads_last_month,
  dl_week.downloads_last_week,
  -- Annualised projection from last week vs. last month — a fast proxy for
  -- "are people abandoning this package right now?"
  CASE
    WHEN dl_month.downloads_last_month > 0 THEN
      ROUND(
        100.0 *
        ( (dl_week.downloads_last_week * 4.0) - dl_month.downloads_last_month )
        / dl_month.downloads_last_month,
        1
      )
    ELSE NULL
  END                                                  AS downloads_trend_pct,

  -- Days since the maintainer last shipped on npm. The auditor's primary
  -- "maintainer is dark" signal.
  CAST(
    date_part('day', now() - to_timestamp(pkg.last_publish_at)) AS INTEGER
  )                                                    AS days_since_last_publish

FROM pkg
LEFT JOIN cves     ON cves.package_name = pkg.package_name
LEFT JOIN dl_month ON 1 = 1
LEFT JOIN dl_week  ON 1 = 1
ORDER BY
  COALESCE(cves.worst_sev_rank, 0) DESC,
  days_since_last_publish DESC;
