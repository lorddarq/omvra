# Human-centered capacity across multiple projects

Research date: 2026-10-26. Status: research and product proposal; no application behavior changed.

The question is how much work a person can sustainably undertake across projects, including the cost of divided attention, rather than how much work an organization would like to allocate. This is a targeted review of primary research and occupational-health guidance, not a systematic review or a clinical assessment. Findings, limitations, and proposed Omvra defaults are distinguished below.

**Recommendation:** define capacity as commitments that fit agreed working time, preserve recovery and usable focus, and remain acceptable to the person over successive weeks. Report time fit, fragmentation, and experienced sustainability separately. No single percentage establishes that a workload is healthy.

## What the evidence supports

### 1. Project count is an incomplete measure

Van de Brake and colleagues studied 1,345 knowledge workers across 4,329 project teams. Their weekly distribution-of-time measure was associated with emotional exhaustion; membership count alone did not explain the same outcomes. A core membership's relationship with exhaustion depended on colleague familiarity. Importantly, the study's “switching” measure was a weekly allocation index, not observed hourly interruptions. It was observational, from one organization, largely during the pandemic. The discussion suggests limiting active work to one or two projects per week, but does not establish a universal healthy cutoff. [Published paper, 2024](https://pure.rug.nl/ws/files/1012912160/2024-38517-001.pdf).

**Product implication:** distinguish portfolio membership, active weekly commitments, and actual within-day switching. Five memberships need not mean five simultaneous demands; a single project can contain several incompatible contexts.

### 2. Unchanged output can conceal additional strain

Mark, Gudith, and Klocke's laboratory experiment found increased self-reported stress, frustration, time pressure, and effort in interrupted conditions. Participants compensated by performing the primary email task faster; the time comparison excluded time spent handling interruptions. This short experiment does not demonstrate long-term sustainability or quantify software-development delay. It does show why output and speed alone cannot establish acceptable workload. [Original paper, 2008, full-text mirror](https://www.interruptions.net/literature/Mark-CHI08.pdf).

**Product implication:** meeting a deadline through rushing, skipped breaks, or extra hours must not count as evidence of spare capacity.

### 3. Unfinished work can continue to occupy attention

Leroy's two experiments investigated attention residue during transitions and found that unfinished work can interfere with subsequent performance. These are task-transition experiments, not a validated conversion from project count into lost hours. [Journal abstract and study descriptions, 2009](https://www.sciencedirect.com/science/article/pii/S0749597809000399).

Leroy and Glomb subsequently studied a brief “ready-to-resume” plan: record where the work stopped and how to continue. Their studies supported reduced residue and better performance on the interrupting task. They did not test improved performance on the original task after returning. [University of Washington's account of the researchers' four studies, 2018](https://www.washington.edu/news/2018/01/16/task-interrupted-a-plan-for-returning-helps-you-move-on/).

**Product implication:** enable short resumption notes and explicit deferral. Do not treat a paused project as demanding constant mental availability.

### 4. Developer work requires context-sensitive interpretation

Abad and colleagues analyzed 4,910 recorded tasks from 17 professional developers and surveyed 132 developers. Interruption context, type, timing, and task characteristics mattered. Their retrospective results also complicate the assumption that voluntary switches are always harmless. This was not a health-threshold experiment, and its task-log measures cannot supply a universal per-switch penalty. [Research paper, 2018](https://arxiv.org/html/1805.05508).

Meyer and colleagues analyzed 5,971 developer responses about good and typical days. Agency over the workday mattered; collaboration and meetings could be constructive in planning and release phases while disruptive during development work. Responses are not 5,971 independent participants, and the study does not establish a fixed number of healthy focus hours. [Research publication, online 2019](https://www.microsoft.com/en-us/research/publication/today-was-a-good-day-the-daily-life-of-software-developers/).

**Product implication:** reviewing, mentoring, planning, testing, and coordination are legitimate work. Switching between an editor, documentation, and tests for the same objective is not automatically a harmful project switch. A break is recovery, not a context-switch failure.

### 5. Recovery has value independently of output

A meta-analysis of 22 independent samples, totaling 2,335 participants, found small beneficial effects of micro-breaks on vigor and fatigue. The overall performance effect was not statistically significant. Tasks and populations varied; it does not establish one optimum break interval or prove that a short break fully restores capacity after demanding work. [Albulescu et al., 2022](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0272460).

In a survey of 392 project workers across nine Swedish companies, inadequate recuperation was the strongest of four reported explanatory factors for project overload; simultaneous project count ranked fourth. The model explained 21% of variance. This cross-sectional study supports considering recovery, but cannot establish causation or a safe project count. [Zika-Viktorsson et al., 2006](https://www.sciencedirect.com/science/article/abs/pii/S0263786306000329).

A workplace-group randomized study of 580 public-sector employees found small improvements in sleep and perceived stress following reduced hours with retained pay over 18 months. Additional staffing funding was provided to avoid workload compression; one workplace was assigned to control for practical reasons. It supports genuine demand reduction, not squeezing unchanged commitments into fewer hours. Its population does not establish an optimum developer workweek. [Schiller et al., 2017](https://www.sjweh.fi/article/3610).

**Product implication:** preserve breaks because people need recovery. Do not require a productivity increase to justify them or turn protected focus into a demand for continuous concentration.

### 6. Workload should fit agreed hours and personal control

The UK Health and Safety Executive's guidance calls for achievable demands within agreed working hours and employee influence over pace and breaks. Its workbook explicitly advises against letting people cope through longer hours or working through breaks; it also advises against detailed monitoring of movements and breaks. These are occupational-health design principles, not a numerical capacity formula or a statement of applicable local law. [Demands standard](https://www.hse.gov.uk/stress/standards/demands.htm), [Control standard](https://www.hse.gov.uk/stress/standards/control.htm), [workbook, printed pp. 48–49](https://www.hse.gov.uk/pubns/wbk01.pdf).

WHO/ILO evidence associates working at least 55 hours weekly with increased cardiovascular risk compared with 35–40 hours. This does not make 54 hours safe or establish 40 as an optimal individual workweek. [WHO/ILO explanation of the evidence, 2021](https://www.who.int/news-room/questions-and-answers/item/global-regional-and-national-burdens-of-ischemic-heart-disease-and-stroke-attributable-to-exposure-to-long-working-hours-for-194-countries-2000-2016).

**Product implication:** use the person's agreed sustainable schedule, including part-time or reduced hours. Overtime is additional demand to expose, not capacity to normalize.

### 7. Output studies do not establish healthy project limits

A 2016 GitHub study reported output associations up to four projects per week, using added lines of code as its principal productivity proxy. It did not establish health or sustainable capacity. A 2020 industry replication found a different pattern, including associations favoring focus and day-to-day continuity without the same benefit from increased multitasking. Both rely on observational repository activity. [Vasilescu et al., 2016](https://kblincoe.github.io/publications/2016_icse_multitasking.pdf), [Kohl et al., 2020](https://cmustrudel.github.io/papers/chase20multitasking.pdf).

**Product implication:** do not adopt “four projects is fine” from an output study, and do not optimize individual commit counts or lines of code.

## Claims this review does not justify

- A universal healthy limit of two, three, or four projects.
- A fixed 20% loss for each additional project, or a fixed 23-minute cognitive recovery charge for every switch. Time until returning to a task also includes intervening work; it is not all lost recovery time.
- A medically established 80% utilization target, four-hour focus ceiling, or universally optimal 90-minute work block.
- Inferring actual switching frequency from date overlap, a weekly allocation index, app-window changes, or commit timestamps.
- Concluding that a person is healthy because their workload percentage is below 100%, or that their reported difficulty is invalid because delivery remains on time.

Some of these numbers can be explicit planning assumptions. They must stay adjustable and must not be presented as scientific limits.

## Proposed capacity model

This is a planning model informed by the evidence, not a validated health prediction.

### A. Calculate time available for project commitments

For one person and one planning week:

```text
H = agreed working hours actually available after leave and holidays
O = known non-project duties: organizational meetings, support, administration,
    mentoring or learning not already included in project estimates
B = breaks/recovery inside H
T = explicit allowance for preparation, handoffs, and reorientation
U = uncommitted allowance for uncertainty and unplanned demands

C = max(0, H - O - B - T - U)
D = sum of that person's planned project effort in the week
time-fit ratio = D / C, when C > 0 and inputs are known
```

All inputs are hours over the same week. Count every obligation once. Project-specific meetings, reviews, and coordination belong in project demand; they must not also be subtracted in O. If the working-hours definition already excludes unpaid lunch, do not subtract lunch again. Show an existing deficit if O + B + T + U exceeds H; clamping C to zero must not hide it. For zero or unknown capacity, display unavailable/unknown with a reason rather than a fabricated percentage.

T and U should be person-agreed estimates or informed by a short, voluntary review of ordinary weeks. Do not derive T from a universal penalty per switch. Do not add an arbitrary second “80% efficiency” multiplier after accounting for these allowances. If a reserve is consumed repeatedly, adjust the commitments or work design rather than treating the reserve as routinely allocatable.

**Illustrative example, not a recommended universal workweek:**

| Weekly item | Hours |
| --- | ---: |
| Agreed available working time | 40 |
| Known organizational duties and support | -8 |
| Breaks within those hours | -3 |
| Preparation and transition allowance | -2 |
| Uncommitted uncertainty allowance | -5 |
| Available project commitment budget | **22** |
| Project A, including its coordination/review | 14 |
| Project B, including its coordination/review | 8 |

The person has 22 hours available for those project commitments, not 40 hours of coding. The remaining time includes useful work and protected recovery. Adding a third project requiring six hours gives 28/22 = 127% of the project commitment budget, or a six-hour shortfall. This identifies an arithmetic conflict, not a stress diagnosis.

If effort is supplied as a range, show a range of time-fit outcomes. If only task size or dates exist, report a heuristic or missing estimate; do not silently turn calendar duration into working effort.

### B. Check whether the schedule provides usable attention

Even D <= C does not prove that the plan works. Separately inspect:

- Active projects and distinct delivery commitments during the week.
- Planned cross-project transitions per day, if actual block planning exists.
- Whether the person has the uninterrupted windows they say their current work needs.
- Competing response-time expectations, deadline clusters, and unplanned interruptions.
- Familiarity of the codebase/domain/team and the cognitive demands of the task.
- Whether pending work is genuinely parked or still creates an expectation of immediate response.

Without intraday data, label fragmentation as unknown and use overlap only as potential exposure. Do not make optional self-report or invasive tracking a requirement to obtain a reasonable workload.

### C. Check sustainability with the person

A brief optional check-in can ask whether work fitted agreed hours, whether adequate focus and recovery were possible, and whether the pace feels repeatable. The person must be able to reduce commitments or flag a plan for review even when arithmetic says it fits. A positive score cannot certify health; a concern should trigger a planning response.

Store only what is needed for the agreed planning purpose. Personal wellbeing notes should remain private by default; a report can expose a person-approved operational signal such as “reduce commitments” without exposing sensitive explanations. Use these signals to change work design, not rank employee resilience.

## Starting policy for Omvra

These are proposed protective defaults, not established biological thresholds:

| Decision | Proposed starting behavior |
| --- | --- |
| Active commitments | Prefer one primary project; allow one secondary project with a bounded scope and planned time. |
| Additional commitments | A third independently demanding project prompts a workload discussion and an explicit tradeoff; it is not automatically declared unsafe. Membership alone does not trigger the rule. |
| Daily scheduling | Prefer blocks on one project and switches at natural stopping points; let the person choose suitable block lengths and breaks. |
| Incoming demands | Agree response windows, batch non-urgent requests, and make urgent interruptions explicit. |
| Switching away | Capture a short resumption note: current state, next step, unresolved question. |
| Shared priorities | Maintain one reconciled priority order across projects so separate owners cannot each assume first claim on the same person. |
| Spare time | Preserve the uncertainty allowance; do not label it poor utilization. |
| Recalibration | Review after roughly 2–4 ordinary weeks as a proposed pilot period, then periodically. Reduce immediately when the person reports the plan is not sustainable. Do not wait for a sample size before addressing a problem. |
| Capacity increases | Require the person's agreement and evidence of a repeatable schedule without routine overtime or skipped recovery. A burst of delivery is insufficient. |

Roles differ. A support engineer, architect, or consultant may legitimately work across more contexts than a developer doing a difficult refactor. Adjust work organization and expectations with the person; do not force all roles into an identical count.

## Consequences for Omvra reporting and delivery forecasts

The existing load score is a weighted task count divided by a fixed 12-point budget. It is useful as a relative commitment indicator, but should be labelled accordingly. It is not a human capacity denominator. See [taskLoad.ts](../../src/app/utils/taskLoad.ts), [Person/Task types](../../src/app/types.ts), and [milestone calculations](../../src/app/domain/roadmap.ts).

The initial MCP projection over existing data can still report active assignments, milestone overlap, blocked work, and deadline conflicts. Sustainable-capacity reporting additionally needs a small explicit planning contract: person-agreed available hours, known duties and protected allowances, and effort assigned to each person within the reporting period. A simple manual weekly budget is sufficient to begin; calendar integrations and automatic activity collection are not prerequisites.

Recommended report dimensions:

| Dimension | Meaning |
| --- | --- |
| Time fit | Planned demand versus the person's agreed project budget, including estimation uncertainty. |
| Competing commitments | Active projects/milestones, primary versus secondary role, deadline concentration, and conflicting priorities. |
| Focus feasibility | Planned windows and transitions, or explicitly unknown where only date ranges exist. |
| Sustainability | Optional, person-approved planning concern, kept separate from calculated workload. |
| Delivery exposure | Milestones whose work exceeds available capacity or depends on the same constrained person. |
| Evidence quality | Which values are authored estimates, current observations, heuristic assumptions, or missing. |

Count a task's person-effort once in total demand even if it serves several milestones or projects. Show all affected milestones as exposure without duplicating workload. Assignment, collaboration, review, and orchestration may represent different work; ownership alone is not a valid effort split. Unscheduled work remains visible as an unplaced commitment. Human cognitive limits must not be reused as an agent-runtime capacity model, and agent work still creates human review/supervision demand.

For a milestone, compare its person-specific remaining work with that person's agreed allocation before the deadline. Reconcile allocations across all projects first: the same week cannot be promised independently to several milestones. If effort exceeds the available allocation, identify the shortfall and candidate sequencing, scope, or ownership changes. Dependency/resource simulation can come later. Even an arithmetic fit does not establish a reliable finish date without dependency and uncertainty handling.

The preferred response to pressure is to reduce simultaneous commitments, reconcile priorities, sequence delivery, change scope or dates, or add appropriate support with onboarding costs acknowledged. Omvra should make the conflict visible rather than silently expanding working hours or treating recovery as available capacity.
