# Omvra MCP agent benchmark protocol

Status: rollout protocol for `milestone-73f74e74-be2f-4620-8370-45e3389ad1cf`

This protocol evaluates changes within each agent product. It must not be used to rank Codex, Claude, and Copilot against one another.

## Comparison design

Run two arms independently for each agent product:

- **Control:** the existing task workflow, workspace context, and operational instructions.
- **Treatment:** the same task families and workspace state with the observability-aware contract, redacted telemetry, and handoff guidance enabled.

Keep the agent product, client version, model/settings, workspace fixture, task family, and task order balanced between arms. Randomize task order where practical. Do not mix products in one score or treat a product label as a quality ranking.

Use three task-complexity bands:

- **Low:** one read or simple single-field write, no dependency or revision choice.
- **Medium:** multi-step task with one target and ordinary validation or handoff.
- **High:** multi-step roadmap, revision/conflict, dependency, or review workflow.

The benchmark manifest may contain only opaque `runId`, `taskId`, arm, agent, client version, complexity band, fixture/version, and timestamps. It must not contain prompts, arguments, response bodies, task titles, descriptions, comments, tokens, or headers. The manifest is separate from `omvra.mcp.audit.v1`; the current event contract does not need an experiment-arm field for this rollout.

## Sample and metric rules

The minimum reportable cell is one agent × arm × complexity band × task family with **10 valid episodes**. Fewer than 10 is reported as underpowered, not as zero. Thirty valid episodes per cell is the preferred follow-up target.

Required dimensions for every report:

- agent/provenance, client name and version when supplied
- control or treatment arm from the redacted manifest
- complexity band and opaque task identity
- transport, tool name, origin, outcome, failure class
- event count, success/failure/denied counts and rates
- `durationMs` median and p95
- median logical calls when available

Interpret values as follows:

- `0` means the metric was measured and the count/rate is zero.
- `null`, `n/a`, or an absent dimension means no usable measurement; never coerce it to zero.
- `unknown` is a real reported dimension for missing or unsupported provenance; exclude unknown-dimension rows from arm comparisons unless the report explicitly studies missingness.
- Success rate uses all eligible episodes. Denied and failed episodes remain visible in their own rates.
- Duration is calculated only from events with valid non-negative timing. Report denied/authentication failures separately when they do not complete the requested action.
- Exclude initialization, health checks, duplicate audit IDs, malformed events, retries without a distinct episode identity, and episodes missing the manifest join key. Do not silently discard them; record exclusion counts.

The primary within-product comparison is treatment versus control for the same cell. Use directional language such as “median duration decreased in the treatment arm”; do not claim causality or compare absolute scores between agent products.

## Reproducible verification procedure

1. Start the local app or use the repository fixtures.
2. Run equivalent HTTP and stdio actions for each selected task family and complexity band.
3. Export only the bounded `mcp/get-audit-summary` projection or `diagnostics.audit_summary`; never export raw audit events for a benchmark report.
4. Join summaries to the redacted manifest by opaque task/run identity.
5. Validate required dimensions, sample counts, exclusions, missing-versus-zero semantics, and privacy assertions before calculating arm deltas.
6. Store the report beside the manifest with the fixture/version, commands, date, and known gaps.

The repository verification commands for this rollout are:

```bash
npm run build
npm run test:mcp
npm run test:workspace-contracts
git diff --check
```

The UI acceptance path is Preferences → MCP Activity. The empty state must remain accessible when the listener is disabled or no activity exists; a populated run must show bounded sample size, success/failure/denied rates, median duration, and provenance grouping without payloads.

## Acceptance review and WBS handoff

Recommended implementation order and dependency chain:

1. Event contract/privacy boundary — `task-683e8f59-6fa1-457a-b98e-242fef5066d3`
2. Runtime provenance/timing/target capture — `task-acffaa27-3f9b-4a31-a43a-b7fd02f9016b`, depends on 1
3. Summary aggregation — `task-28c8f720-7e3e-40d1-bd14-29dccdbddc9a`, depends on 2
4. Diagnostics/activity projection — `task-bb6592fb-e434-4be7-8b97-e3932f96e7ab`, depends on 3
5. Contract, fixture, and privacy regression coverage — `task-787ac6f0-c563-445f-89f1-d8e459fe8b39`, depends on 2, 3, and 4
6. Benchmark protocol and rollout handoff — `task-2bc7d1d7-b7e2-420e-bf90-e02e2ba58442`, depends on 5

Current acceptance evidence:

- Contract/privacy: documented allow-list, payload exclusion, sensitive-header/token regression coverage.
- Runtime/aggregation: normalized provenance, timing, targets, outcomes, failure classes, bounded summaries, and legacy transport fallback.
- UI: empty/loading-compatible activity surface with benchmark summary rendering and no raw payload display.
- Verification: `npm run test:mcp` passes 100 tests; `npm run test:workspace-contracts` passes 100 MCP tests plus 17 app contract tests; `npm run build` passes; `git diff --check` passes.

## Open decisions and rollout risks

- The current audit writer does not attach a benchmark arm, run ID, complexity band, or logical-call count to every event. This rollout uses a separate redacted manifest; a future contract version can add explicit run/arm fields if productized experiments need durable joins.
- Populated UI metrics still require live MCP traffic. Local browser QA verifies the disabled-listener empty state; it does not replace a populated production-like run.
- Local machine load, client/model version, task ordering, fixture drift, and retry behavior can bias results. Reports must retain these fields and avoid cross-product rankings.
- Legacy events are summarized with compatibility defaults; they should be labeled as legacy coverage rather than mixed invisibly with new events.
