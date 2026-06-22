# Omvra Landing Page Audit

Date: 2026-03-27

Scope:
- Reviewed the current GitHub Pages landing page implementation in `pages/src/components/*` and `pages/index.html`
- Audited positioning, copy clarity, trust signals, conversion flow, and missing content
- Synthesized feedback from two specialist passes:
  - Senior marketing consultant
  - Senior copywriter

## Executive Summary

The landing page feels clean and credible, but it currently reads more like a product capability inventory than a persuasive reason to install Omvra. The biggest gap is message clarity: the page does not quickly explain who Omvra is for, why it is better than lighter or heavier alternatives, and why a visitor should trust it enough to download now.

The strongest raw differentiators already exist in the product and codebase:
- local-first
- open source
- no account required
- no telemetry
- cross-platform desktop
- visual planning with both timeline and Kanban
- MCP support for AI-assisted workflows

Those strengths are currently underused or introduced too late. The page leads with a generic promise, spreads itself across too many audiences, and uses feature labels that explain mechanics more than outcomes.

## What Is Working

- The overall visual tone feels simple, calm, and approachable.
- The privacy story is unusually strong and believable.
- The feature set is real and specific enough to support a solid value proposition.
- The page is short and easy to scan.
- The product already has several trust-building differentiators that many competitors cannot claim.

## Core Problems

1. The hero is too generic.
The current headline, `Project management, simplified`, is pleasant but non-distinctive. It does not communicate the specific value of Omvra or why someone should switch.

2. The subhead is overloaded and feature-led.
The hero paragraph reads like a spec list. It explains what the app contains, but not the outcome users get from it.

3. The audience is too broad.
The page tries to speak to product teams, design teams, agency managers, and AI-assisted teams at the same time. That weakens positioning and makes the message feel less tailored.

4. Trust is strong but incomplete.
The privacy section is good, but the page does not surface open-source proof, GitHub proof, release activity, or an obvious path for cautious visitors who want validation before downloading.

5. Conversion support is thin.
There is only one real action path, and it is not surrounded by enough reassurance, product understanding, or objection handling.

6. Some terminology feels internal instead of human.
Examples include `Dual-View System`, `Team Load Visibility`, `No Data Collection`, and early use of `MCP support`.

## Debate Conclusion

Both specialist reviews converged on the same priorities:
- Rewrite the hero around a sharper promise
- Move open-source and local-first higher
- Translate features into outcomes
- Reframe privacy as a positive value statement
- Add one or two trust-and-adoption sections before the final CTA

The main debate points and final decisions:
- Audience focus:
  - Marketing recommended narrowing to 1 to 2 core segments
  - Copy agreed the page should speak to pain points more than job titles
  - Conclusion: keep broad compatibility, but anchor the page around one primary buyer story
- Secondary CTA:
  - Copy recommended adding one
  - Marketing agreed, but only if it supports trust
  - Conclusion: add a secondary CTA only if it points to proof, such as GitHub or a product walkthrough
- Comparison section:
  - Marketing suggested comparison positioning
  - Copy did not center it
  - Conclusion: avoid a brittle competitor table; instead add a softer section like `Why teams switch` or `When Omvra is the better fit`

## Full Todo List

### P0: Highest Impact

- Rewrite the hero headline and subhead around a clear outcome.
  Why:
  The first screen currently explains the product vaguely and too generically.
  Recommendation:
  Lead with a promise built from the real differentiators, such as local-first planning, clear visual execution, and low overhead.

- Surface `open source`, `local-first`, and `no account required` above the fold.
  Why:
  These are trust and differentiation signals, not footer details.
  Recommendation:
  Add a short proof row or compact trust badges below the hero copy or CTA.

- Replace feature names and descriptions with outcome-first language.
  Why:
  Several feature labels sound like internal product naming rather than user value.
  Recommendation:
  Replace labels like `Dual-View System` with user-facing language like `Plan on a timeline, execute in Kanban`.

- Add a benefits-first `Why Omvra` section.
  Why:
  The page jumps from hero to feature grid without first framing why the product matters.
  Recommendation:
  Add 3 to 4 concise benefit blocks that translate the product into outcomes like less context switching, clearer ownership, and private-by-default planning.

- Add a trust block near the final CTA.
  Why:
  The conversion moment should reinforce the reasons it is safe to install.
  Recommendation:
  Repeat high-confidence proof points near download: open source, no account, no telemetry, local backups, cross-platform.

### P1: Strong Conversion Improvements

- Reframe `No Data Collection` as a positive value statement.
  Why:
  The current section is credible but sounds defensive and legalistic.
  Recommendation:
  Rename it to something like `Local by design` or `Private by default`, then explain the user benefit: ownership, control, and fewer surprises.

- Narrow the `Best For` section to clearer primary use cases.
  Why:
  The current targeting is broad enough to dilute the message.
  Recommendation:
  Lead with one primary use case narrative, then support secondary audiences below it.

- Add a simple `How it works` section.
  Why:
  Visitors need a fast mental model before downloading.
  Recommendation:
  Use 3 steps such as `Plan`, `Execute`, `Review and hand off`.

- Add a proof-oriented secondary CTA.
  Why:
  Some visitors will want validation before downloading.
  Recommendation:
  Link to GitHub, releases, or a guided product walkthrough. Do not add a secondary CTA unless it supports trust.

- Add an FAQ or lightweight objections section.
  Why:
  The page does not currently answer adoption questions.
  Recommendation:
  Address platform support, whether an account is needed, where data is stored, whether it works offline, and how backups behave.

### P2: Important Supporting Improvements

- Introduce open-source proof explicitly.
  Why:
  The brand keywords include open source, but the page barely says so.
  Recommendation:
  Mention source availability, contribution openness, and GitHub access in at least two places.

- Reposition MCP lower in the page or explain it in plain language first.
  Why:
  `MCP` is meaningful to some users, but it is jargon to many others.
  Recommendation:
  Frame it as an advanced capability that helps AI assistants work with structured task context while keeping humans in control.

- Tighten repeated claims across sections.
  Why:
  Privacy, local-first behavior, and download assurances appear multiple times without a clear hierarchy.
  Recommendation:
  Give each section a single communication job and reduce overlap.

- Replace placeholder footer links with real trust paths.
  Why:
  `href="#"` support and legal links can reduce credibility.
  Recommendation:
  Add real GitHub, license, changelog, and documentation targets or remove the links until they exist.

- Add metadata for discovery and shareability.
  Why:
  `pages/index.html` currently uses a generic title and lacks marketing metadata.
  Recommendation:
  Add a meaningful meta description and social preview tags aligned with the updated positioning.

## Suggested Top 5 For Task Description

1. Rewrite the hero to clearly communicate Omvra's main outcome and differentiators instead of using generic project-management language.
2. Move `open source`, `local-first`, and `no account required` above the fold so the page earns trust earlier.
3. Replace feature-led section copy with benefit-first messaging that explains why Timeline plus Kanban is useful in practice.
4. Reframe the privacy section into a positive trust section and repeat those trust guarantees near the download CTA.
5. Add one or two missing conversion sections, preferably `Why Omvra` plus `How it works` or FAQ, to reduce friction before download.

## Optional Rewrite Direction

Illustrative direction only, not final copy:

- Hero headline:
  `Plan work visually. Keep it local.`
- Hero subhead:
  `Omvra is an open-source, local-first desktop planner for teams that want clear timelines, fast Kanban execution, and helpful AI workflows without accounts or telemetry.`
- Privacy section title:
  `Local by design`
- Best-for section title:
  `Built for teams that want less overhead`

## Files Reviewed

- `pages/src/App.tsx`
- `pages/src/components/Hero.tsx`
- `pages/src/components/Features.tsx`
- `pages/src/components/BestFor.tsx`
- `pages/src/components/PrivacyProof.tsx`
- `pages/src/components/Download.tsx`
- `pages/src/components/Footer.tsx`
- `pages/index.html`
