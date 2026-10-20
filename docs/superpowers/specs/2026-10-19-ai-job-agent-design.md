# AI Job Agent — Design Spec
**Date:** 2026-10-19

Class final project component 1 of 2 (the paywall is component 2).

## Overview
Students upload resumes; Claude (`claude-opus-5-5`) builds a career profile. A scheduled tool-using agent
finds jobs from the existing Greenhouse/Ashby catalog plus LinkedIn and Indeed using free search
(LinkedIn guest API, DuckDuckGo HTML), scores fit against the profile, and saves strong matches.
For each match a one-page ATS-safe DOCX resume is tailored from the profile (resume-tailor skill rules:
only true facts) and emailed through Resend.

## Agentic loop
Claude tool runner with tools `list_catalog_jobs`, `search_linkedin`, `search_web`, `read_job`, `save_match`.
Capped at 15 iterations, 5 matches, minimum score 75.

## Schedule
`/api/cron/agent` is hit hourly. Pro users are due every hour, free users every 12 hours.

See the plan file in `docs/superpowers/plans/` for file-level detail.
