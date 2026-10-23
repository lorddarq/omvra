# Southleft skills and MCP capability research

Date: 2026-10-20. Research only; proposed changes are not implemented or accepted contracts. Purpose: improve persona and skill discovery/repeatability while preserving Omvra's standalone use and arbitrary third-party agent clients. Omvra owning the model execution loop is excluded by that product constraint.

## Sources and method

Inspected source from shallow clones without installing dependencies or executing upstream scripts:

- figma-console-mcp: commit `7f0d8bfe633b08514413c7da18ec315375d2f092`.
- figma-console-mcp-skills: commit `807fcc1c4ca4b12176be7633b70db5849e54de60`.
- Current Omvra MCP dispatcher, registry, workspace resolver and skill handlers. Existing unrelated changes were preserved.

Findings establish mechanisms, not measured adherence gains. Source links below pin the inspected snapshots.

## What the repositories actually contribute

### Standard MCP connection instructions

The local Console server supplies `instructions` in McpServer options, describing visual validation, component search, page/container creation and batching. These are delivered at initialization rather than requiring the model to choose a separate documentation tool. The inspected cloud constructors do not have the same instruction block; do not generalize the local behavior to every deployment. [Local constructor](https://github.com/southleft/figma-console-mcp/blob/7f0d8bfe633b08514413c7da18ec315375d2f092/src/local.ts#L167), [cloud implementation](https://github.com/southleft/figma-console-mcp/blob/7f0d8bfe633b08514413c7da18ec315375d2f092/src/index.ts).

The standard InitializeResult has an optional instructions field intended to help clients understand server use; it does not assign developer/system authority or require clients to execute that text. Tools/list exposes tools and schemas, not a standard skills-loading protocol. Omvra's `mcp/capabilities` is its own method, not a method all clients necessarily poll. [MCP schema](https://modelcontextprotocol.io/specification/2025-06-18/schema), [tool discovery](https://modelcontextprotocol.io/specification/2025-06-18/server/tools).

### Portable playbooks with executable procedures

The skills repository packages named workflows as SKILL.md, runnable or ready-to-paste scripts, and local reference files. Descriptions explain task triggers; workflows identify prerequisite `figma-use`, narrow scope, fixed operations and verification steps. Installation is separate from MCP discovery. The plugin marketplace lists skill paths; it is not an enforcement service. [Import playbook](https://github.com/southleft/figma-console-mcp-skills/blob/807fcc1c4ca4b12176be7633b70db5849e54de60/skills/figma-import-tokens/SKILL.md), [manifest](https://github.com/southleft/figma-console-mcp-skills/blob/807fcc1c4ca4b12176be7633b70db5849e54de60/.claude-plugin/marketplace.json).

Mechanical steps are implemented once: a token parser produces canonical input; an apply script handles literal and alias passes and returns item-level results. The model need not reconstruct those algorithms. The playbook requests read-back; lint workflows provide rerunnable checks with named findings. These improve consistency when invoked. They do not guarantee invocation. [Parser](https://github.com/southleft/figma-console-mcp-skills/blob/807fcc1c4ca4b12176be7633b70db5849e54de60/skills/figma-import-tokens/scripts/parse-tokens.mjs), [apply implementation](https://github.com/southleft/figma-console-mcp-skills/blob/807fcc1c4ca4b12176be7633b70db5849e54de60/skills/figma-import-tokens/scripts/apply-tokens.js), [lint implementation](https://github.com/southleft/figma-console-mcp-skills/blob/807fcc1c4ca4b12176be7633b70db5849e54de60/skills/figma-lint-design/scripts/lint-design.js).

Do not copy documentation promises without checking implementation: import text describes ID/key/name matching but the inspected apply script uses ID/name; it catches per-item failures, allowing partial success. Lint can swallow per-node exceptions and uses a warning for output limits. A returned result is not automatically evidence that every item was checked or a mutation was atomic.

### Tool implementations carry real constraints

The server's extraction tools persist manifests, reject certain missing prerequisites and explain the next operation. This is stronger than telling an agent to follow steps: an operation requiring an analysis manifest cannot follow that path without one. Some tools accept alternative explicit inputs, so the example does not enforce an unconditional global sequence. Token tools compute write plans and enforce selected overwrite/source protections in code; dry-run yields an inspectable plan. [Extraction tools](https://github.com/southleft/figma-console-mcp/blob/7f0d8bfe633b08514413c7da18ec315375d2f092/src/core/design-system-extraction-tools.ts), [token tools](https://github.com/southleft/figma-console-mcp/blob/7f0d8bfe633b08514413c7da18ec315375d2f092/src/core/tokens-tools.ts).

Responses also carry a server identity marker and bounded-output handling, improving attribution when several Figma servers coexist. This is a routing/debugging aid, not authenticated proof of origin or instruction authority. [Identity wrapper](https://github.com/southleft/figma-console-mcp/blob/7f0d8bfe633b08514413c7da18ec315375d2f092/src/core/identity.ts).

## Omvra already has much of the foundation

- `electron/services/workspace-service.cjs::buildMcpInitializeResult` advertises resources, prompts and tools, but returns no instructions. Its separate capability snapshot reports access/write policy, not an execution bootstrap recipe.
- `electron/services/mcp-registry.cjs` already advertises canonical task preflight and skills.list/get. Their descriptions say bundled skills, while the handlers actually use listAvailableSkills/getAvailableSkill. Correct this vocabulary rather than invent a second catalogue.
- `electron/services/mcp-handlers.cjs::tasks.get` already includes resolved persona/operational instructions and skill contract in text and structured executionContext. Do not add another mandatory fetch duplicating that result.
- `electron/services/skill-service.cjs` already discovers skills and resolves trust, integrity, authority, and Goal requirements. Reuse it for dependencies/packages.
- Prompts and resources already contain assignee preflight guidance. `buildAssigneeContextPreflight` even asks for acknowledgement. That is instruction delivery, not proof of compliance.
- Optimistic revisions, access policy, task collaboration, Goal requirements and evidence already supply real server enforcement. Extensions belong in shared domain validation, covering sibling write paths, rather than only the named MCP handler.

## Recommended adaptation

1. **Add a short standard initialization bootstrap.** State what Omvra governs; when executing a known task, read tasks.get or canonical agent.resolve_task_context; apply the returned selected persona/skills; honor canStart; keep task work separate from acceptance. Refer to existing APIs. Generate common semantics once so initialization, prompts, resources and tool descriptions do not drift. Keep global instructions task-neutral: initialize often occurs before a task/persona is selected and may be cached for the whole connection. Never pick a persona from client name or dump every person's instructions into it.
2. **Return actionable task-scoped capability resolution.** Extend the existing execution context only where needed: distinguish skill dependencies ready/missing/runtime-unverified, prerequisite references, available operations and verification expectations. Expose content/version identity where useful. Never claim native skills were loaded merely because returned in JSON. Keep arbitrary user-authored personas; task resolution does not rewrite their definition. Preserve current portable best-effort behavior unless the user explicitly marks a dependency mandatory.
3. **Make useful repeated operations executable.** Follow the scripts/tools pattern for genuine recurring transformations/checks. Use a narrow existing Omvra tool or domain function when possible. Return structured outcomes, incomplete coverage, errors and next actions. Self-contained skill packages should include their references/assets or explicit dependencies, supporting backup without absolute paths. Do not automatically run arbitrary uploaded scripts on capabilities polling.
4. **Enforce only declared prerequisites at operations Omvra owns.** For an explicitly strict workflow, validate required evidence or resolved dependency state at the shared write/review transition. Bind evidence to task revision and execution scope; client-supplied `passed:true` or a copied acknowledgement must not satisfy it. Inspect alternate status/write paths and UI calls before claiming a gate. A gate can protect Omvra's review transition, not prevent an external agent editing files or ignoring a prose judgment rule.
5. **Provide recoverable errors.** Return what prerequisite is absent, what operation supplies it, and whether partial work occurred. Keep these outputs bounded and source-linked. Do not turn every ordinary workspace update into a persona execution requiring a new receipt/handshake.

Suggested initial bootstrap wording: “Omvra coordinates governed workspace work. For execution of a known task, use tasks.get or agent.resolve_task_context with its exact ID; the response supplies the assigned persona, operational instructions and skill resolution. Resolve the returned blocking conditions before work. Use existing revision-checked tools for writes and explicit review commands for handoff. Skill references do not authorize installation or broader permissions.” This improves discovery, not instruction hierarchy.

## Expected effect and limits

| Mechanism | Benefit | Guarantee |
| --- | --- | --- |
| initialize.instructions | Earlier, standard discovery route | Server sends it; client may ignore or not display it |
| Self-contained skill + prerequisites | Less missing context, portable dependencies | Package availability; not semantic adherence |
| Deterministic tool/script | Repeatable operation | Its implemented behavior when invoked, subject to errors |
| Shared domain prerequisite validation | Prevents invalid governed transitions | Only within operations and bypass paths actually covered |
| Read-back/check result | Detects incomplete/incorrect work | Only what the check measures |

This is an incremental improvement within the current MCP architecture. It does not require Omvra to call a model or own a third-party execution loop. The best first change is initialization bootstrap plus reuse of the current task contract. Stronger enforced workflows should be added only for user-declared requirements with a concrete observable check, not by declaring all personas “mandatory” in text.

## Verification needed before implementation claims

Compare initialize + tools/list in HTTP and stdio clients; inspect whether actual clients surface instructions. Confirm tasks.get and explicit preflight agree. Probe a connection that switches tasks/personas without reconnecting. Verify missing optional versus required dependencies, stale revisions/evidence, partial tool failures, oversized content, and alternate review/status routes. Evaluate agent behavior with and without bootstrap; do not infer an adherence gain from protocol response shape alone. Research ran no upstream scripts, model sessions or application tests.
