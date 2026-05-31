# 60-second demo script

The whole demo runs in under a minute. Time it. If it's longer, cut.

---

## Setup (off-camera, 30 sec before recording)

```bash
bash scripts/install-coral.sh   # one-time
npm run dev                     # leave running on :3000
```

Open two windows:

1. **Browser** at http://localhost:3000
2. **Terminal** with this cross-source query ready to paste. It joins **three
   separate live systems** (npm registry + OSV + npm downloads) in one query —
   this is the moment everyone leans forward:

```bash
coral sql --format json -- "
WITH pkg AS (
  SELECT name, latest_version, time__modified
  FROM npm.packages WHERE package_name = 'minimist'),
cves AS (
  SELECT affected__package__name AS pname,
         COUNT(*) AS cve_count,
         MAX(CASE database_specific__severity
               WHEN 'CRITICAL' THEN 4 WHEN 'HIGH' THEN 3
               WHEN 'MODERATE' THEN 2 WHEN 'LOW' THEN 1 ELSE 0 END) AS worst_sev_rank
  FROM osv.vulnerabilities
  WHERE package_name = 'minimist' AND ecosystem = 'npm'
  GROUP BY affected__package__name),
dl AS (
  SELECT downloads FROM npm_downloads.downloads_last_month
  WHERE package_name = 'minimist')
SELECT pkg.name, pkg.latest_version, dl.downloads AS monthly_downloads,
       cves.cve_count, cves.worst_sev_rank
FROM pkg
LEFT JOIN cves ON cves.pname = pkg.name
LEFT JOIN dl   ON 1 = 1"
```

> Verified output: `minimist · 1.2.8 · 531,001,061 downloads · 2 CVEs · worst_sev_rank 4 (CRITICAL)`.
> For a single-source warm-up you can also run:
> `coral sql --format json -- "SELECT id, summary, database_specific__severity FROM osv.vulnerabilities WHERE package_name = 'minimist' AND ecosystem = 'npm' LIMIT 5"`

---

## The 60-second script

| Time | What's on screen | What you say |
|---|---|---|
| 0–5 s | Landing page, examples chips visible | *"Every developer has side projects with rotting dependencies and doesn't know it. xz-utils almost killed every Linux server in 2024. I built a tool that catches the next one."* |
| 5–10 s | Type `expressjs/express` in the input | *"Paste any GitHub repo URL."* |
| 10–22 s | Loading shimmer → 3-column dashboard renders | *"In ~15 seconds: every dependency scored. Dangerous, watch-worthy, healthy. Coral just joined OSV's vulnerability feed, the npm registry, and npm's download API in one query — across three completely separate systems."* |
| 22–32 s | Click a 🔴 card → drill-down opens | *"Click any red dependency. Active CVEs with severity. Months since the last npm publish. Downloads trend. Every signal that something is wrong — in one place."* |
| 32–45 s | Switch to terminal, paste the `coral sql` command, hit enter | *"This is what Coral runs under the hood. One SQL query, three live data sources. No ChatGPT can do this — it needs Coral's cross-source JOIN."* |
| 45–55 s | Switch back to browser, scroll down to `CoralQueryDisplay` | *"The full query is right here in the dashboard. Three custom source specs — OSV, npm registry, npm downloads — all in `sources/`. All bounty entries."* |
| 55–60 s | Pan to README on screen, or just stop | *"Three custom source specs, one query that genuinely can't exist without Coral. That's the project. 🏴‍☠️"* |

---

## Suggested repos to type live (in order of demo strength)

| Repo | Why it makes a good demo |
|---|---|
| `expressjs/express` | Mature, has a couple of known-low CVEs, clean mix of red/yellow/green |
| `facebook/react` | Big & green — proves the tool doesn't false-positive everything |
| Your own side project | The "oh sh\*\*" moment if it's been a while since you updated it |
| `webpack/webpack` | Wide dependency surface area, dramatic 3-column split |

**Do not** demo on a freshly-generated `create-next-app` — it's too clean and the dashboard looks empty.

---

## Things that will go wrong (and how to recover)

| Failure | Recovery |
|---|---|
| GitHub rate-limited (60/hr without token) | Set `GITHUB_TOKEN` in `.env.local`. The header pill will say `direct HTTP fallback` if you forget, but it'll still work. |
| OSV slow response | The `mapWithConcurrency` is capped at 6 — fine for most repos. If a single OSV call hangs, the row shows up in the "couldn't be audited" details panel — keep going. |
| Coral isn't installed during the live demo | The app shows `direct HTTP fallback` instead of `coral CLI`. Demo still works end-to-end. Mention it openly: *"This is the fallback path — Coral is the production path, both return identical data."* |

---

## Recording tips

- **Use OBS or QuickTime, not Loom.** Loom compresses fonts badly; the SQL query needs to be readable.
- **Record at 1920×1080.** Coral's SQL is the centrepiece; it needs the resolution.
- **Caption every shot.** Submissions get auto-captioned poorly. Burn in your own.
- **End on the query, not the dashboard.** Judges remember the last frame.

---

## Submission checklist

- [ ] Source specs validated: `npm run coral:test` (osv + npm + npm_downloads)
- [ ] Unit tests pass: `npm test`
- [ ] Dashboard works end-to-end against `facebook/react` AND a deliberately-bad repo (try `chalk/chalk` — `color-convert` flags red — or one with `minimist@0.x` / `event-stream@3.3.6`)
- [ ] 60-second video recorded at 1080p
- [ ] Posted in Coral Discord `#show-and-tell` with screenshots
- [ ] Cross-posted on LinkedIn + X tagging Coral
- [ ] BLOG.md published as a public blog post
- [ ] Source specs submitted via the Coral bounty form
