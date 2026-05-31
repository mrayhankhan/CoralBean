# Social / showcase copy — Tell the Tale

Ready-to-post text for the **Tell the Tale** bounty. Replace `<video>` with the
real demo link before posting (the repo URL and blog URL are already filled in).
Attach the 60-second
video and 2–3 dashboard screenshots (landing page, a 🔴 drill-down, and the
`coral sql` terminal output).

---

## Discord `#show-and-tell` (primary)

> 🏴‍☠️ **Dependency Risk Auditor** — paste any GitHub repo, get every npm
> dependency scored 🟢/🟡/🔴 in ~15 seconds.
>
> The trick: one Coral SQL query that JOINs **three separate live systems** —
> OSV's vulnerability feed, the npm registry, and npm's download API. That
> cross-source JOIN is the whole reason it needs Coral; no single API (and no
> LLM) can answer "which deps are vulnerable AND abandoned AND losing users" in
> one shot.
>
> I shipped **three custom source specs** (`osv`, `npm`, `npm_downloads`) — all
> public, no-auth, and validated with `coral source test`. Ran it on
> `chalk/chalk` and it instantly flagged `color-convert` red on the real 2025
> supply-chain CVEs. 😬
>
> Repo: https://github.com/mrayhankhan/CoralBean · 60-sec demo: https://www.youtube.com/watch?v=N6_6rdnuB7k · build log: https://dev.to/m_rayhankhan_71c3f2ed50c/how-i-built-a-dependency-risk-scanner-with-coral-in-7-days-4p9
>
> Built with Claude Code + Coral for the Pirates of the Coral-bean hackathon. 🪸

---

## X / Twitter (thread)

**Tweet 1**
> I built a tool that catches the *next* xz-utils.
>
> Paste a GitHub repo → every npm dependency scored 🟢/🟡/🔴 in seconds.
>
> The engine is ONE @withcoral SQL query joining 3 separate live systems. 🧵

**Tweet 2**
> Snyk/Dependabot fire *after* a CVE is published.
>
> The signals that predict an attack *before* the CVE: active advisories + an
> abandoned maintainer + collapsing downloads.
>
> You can only see all three at once if you JOIN OSV + npm registry + npm
> downloads. That's what Coral does.

**Tweet 3**
> I wrote 3 custom Coral source specs to make it happen — OSV, npm registry,
> npm downloads. All public APIs, no auth, ~200 lines of YAML each, validated
> with `coral source test`.
>
> The hard part wasn't writing them. It was reading the API docs accurately.

**Tweet 4**
> Ran it on chalk/chalk → instantly flagged `color-convert` 🔴 on the real 2025
> supply-chain compromise.
>
> Demo (60s): https://www.youtube.com/watch?v=N6_6rdnuB7k
> Code (MIT): https://github.com/mrayhankhan/CoralBean
> Build log: https://dev.to/m_rayhankhan_71c3f2ed50c/how-i-built-a-dependency-risk-scanner-with-coral-in-7-days-4p9
>
> Built with Claude Code + @withcoral 🏴‍☠️ #PiratesOfTheCoralbean

---

## LinkedIn

> **What if you could spot a supply-chain attack before the CVE drops?**
>
> Over a week for the Pirates of the Coral-bean hackathon I built a Dependency
> Risk Auditor: paste a GitHub repo URL and every npm dependency is scored
> healthy / watch / danger in about 15 seconds.
>
> Tools like Snyk and Dependabot catch known CVEs *after* they're published.
> But the signals that together predict a future attack — an active advisory, a
> maintainer who's gone silent, and collapsing download numbers — live in three
> completely separate systems. The only way to see them together is to JOIN
> across them.
>
> That's exactly what Coral does. The entire engine is a single SQL query that
> joins OSV's vulnerability database, the npm registry, and npm's download API.
> To make it work I wrote three custom Coral source specs (all public, no-auth
> APIs) and a small Next.js app on top. A pure, unit-tested scoring function
> turns the joined row into a red/yellow/green verdict.
>
> The most satisfying moment: running it on a popular repo and watching it
> instantly flag a dependency caught in the real 2025 npm supply-chain
> compromise — vulnerable, and quietly drifting.
>
> Code is MIT-licensed: https://github.com/mrayhankhan/CoralBean
> 60-second demo: https://www.youtube.com/watch?v=N6_6rdnuB7k
> Full build log: https://dev.to/m_rayhankhan_71c3f2ed50c/how-i-built-a-dependency-risk-scanner-with-coral-in-7-days-4p9
>
> Built with Claude Code + Coral. 🏴‍☠️ #PiratesOfTheCoralbean #DevTools #SupplyChainSecurity

---

## Screenshot caption ideas (burn-in)

- "47 dependencies. 2 dangerous. 5 to watch. One Coral query."
- "Three live data sources. One result set. Zero glue code."
- "This is the query running under the hood — it can't exist without Coral."
