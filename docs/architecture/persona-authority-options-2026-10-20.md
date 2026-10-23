# User-defined persona authority: research and specification handoff

Date: 2026-10-20. Status: research recommendation; not an accepted architecture change or implemented feature.

## Summary

Keep the existing user-defined persona concept and its arbitrary prose. Change how Omvra installs the selected persona into execution. Recommended: deliver an explicitly user-approved, versioned persona through a runtime's actual additive developer/system instruction channel, preload its required skill content, and bind that immutable revision to the provider session. Deliver task details separately as user work. Use fresh provider sessions for persona switches. Add external checks only for requirements that are observable and under Omvra's control.

This changes instruction authority, not merely wording, ordering, naming, or JSON structure. No provider guarantees perfect adherence to arbitrary language. The achievable guarantee is that approved instructions are supplied through the supported privileged channel, not accidentally classified as an unsolicited tool-result instruction. Semantic obedience remains probabilistic and must be evaluated. If eliminating every possible ignored instruction is a literal acceptance requirement, none of the three options meets it.

Companion evidence: [provider research](./persona-authority-provider-research-2026-10-20.md). Historical context: [previous analysis](./persona-instruction-authority-analysis.md). This document supersedes historical API placement suggestions for this proposal, without changing the existing accepted trust contract.

## Decision drivers and requirements

1. Flexibility: users author any persona, skills, workflow, judgment rules, and permitted exceptions. No engineering/marketing/design taxonomy is required. One model can execute several different personas.
2. Authority: selected, approved persona instructions occupy an actual runtime instruction channel; they are not only MCP data or ordinary task prose. Do not silently label unsupported delivery as equivalent.
3. Stability: tasks never rewrite or synthesize the persona. Users can edit it; an execution pins a revision. Conditional instructions can apply differently to tasks while the definition stays identical.
4. Portability: export the definition, revision, dependency manifest, and permitted local assets; restore without machine-specific paths or secrets.
5. Isolation and switching: old persona instructions must not remain authoritative after a switch. Preserve task progress without replaying the old persona's transcript.
6. Skill determinism: distinguish available, loaded, invoked, applied, and verified. These are different claims. Resolve required dependencies before launch; loading text alone proves neither invocation nor thoughtful application.
7. Trust and user control: only explicitly approved persona revisions and approved dependencies can enter privileged channels. Task notes, MCP output, attachments, and retrieved webpages do not gain authority through this route.
8. Compatibility and cost: reuse the existing resolver, runtime adapters, context ledger, supervision, and skill trust checks. Keep provider credentials and registries provider-owned.
9. Evidence: report delivery mode and unsupported controls honestly. Validate actual behavior across tasks, distractions, resume, compaction, and switches; acknowledgement is not proof.

## Current-state evidence

Inspected current checkout on 2026-10-20; unrelated changes under pages/ were present and preserved.

| Source | Verified behavior | Implication |
| --- | --- | --- |
| `electron/domain/person-context-service.cjs`, `resolveTaskExecutionContext` | Resolves exact assignee; missing/incomplete persona may allow standard operation | A launch can proceed without the intended full persona |
| `electron/services/workspace-service.cjs`, `resolveTaskExecutionContext` | Composes persona, operational instructions, skills, task context, and execution contract | Reuse this canonical resolution seam |
| Same file, boundary constants and field semantics | Calls operational guidance a preferred work approach; preserves higher client/developer/task authority | Optional language and precedence are product decisions, not unavoidable provider restrictions |
| `electron/domain/agent-runtime-context-pack.cjs`, `build` | Places profile before tasks and calls it execution constraints, but flattens everything into one text pack | Stronger wording already exists; moving paragraphs alone is insufficient |
| `electron/services/agent-runtime-session-runner.cjs`, start/buildCurrentTaskContext/continue/resume | Managed task turns already include the resolved profile; continue/resume resolve current state again | Earlier chat claim that managed personas require a separate MCP fetch was incorrect. Current resolution also lacks the proposed immutable persona binding |
| `electron/services/agent-runtime-protocol-client.cjs`, Codex start/resume/prompt | Starts threads without persona developer instructions; sends context as ordinary text input | Privileged channel is unused for this purpose |
| Same file, Claude startSession | Builds stream-json CLI arguments without an appended persona system prompt | Same authority opportunity through a different adapter |
| Same file, ACP prompt | Uses session/prompt | Standard portable turn is user input, not a privileged persona setter |
| `docs/agentic/agent-instructions.md`, lifecycle and supervisor contracts | Workspace guidance stays below developer instructions; singleton supervision and task lifecycle remain separate | Recommendation requires explicit authority-contract changes, not an unnoticed adapter-only patch |

Local model-free inspection: installed Codex CLI 0.146.0 generated schemas containing top-level `developerInstructions` in both v2 ThreadStartParams and ThreadResumeParams. Installed Claude Code 2.1.281 help exposes `--append-system-prompt`, `--agent`, `--agents`, and system-prompt snapshot semantics. These confirm available interfaces, not successful behavioral adoption or all documentation features. No model session was launched for this research.

## What authoritative delivery means

OpenAI documents developer messages as higher priority than user messages. The instruction-hierarchy research motivates separating privileged application instructions from untrusted input. Those sources support channel choice; they do not establish an Omvra adherence rate. [OpenAI text guide](https://developers.openai.com/api/docs/guides/text), [instruction hierarchy research](https://arxiv.org/abs/2404.13208).

The application deliberately adopts a user-selected persona revision as application execution instructions. User authorship alone does not make content an injection. Origin, explicit selection, approval, and transport establish the intended authority. Automatically promoting whatever an agent reads from a task or tool would destroy that distinction.

Recommended scope of precedence: provider/platform rules and actual permission controls remain binding; Omvra's small application contract delegates operating method to the approved persona. Task content specifies the desired work and acceptance criteria. It cannot silently redefine the persona. If the task and persona cannot both be satisfied, report the conflict and let the user explicitly switch/edit/authorize an allowed exception. Do not let the model resolve every conflict by treating task acceptance as a blanket excuse to discard persona instructions.

Users may define exceptions to their own preferences and workflow rules. They cannot use a persona to disable provider restrictions, sandbox controls, or permissions. Record authorized exceptions with scope and revision rather than having the agent rewrite the persona.

## Three options

### 1. Install native persona files and explicit skill invocations

Export persona instructions to runtime-native discovery surfaces such as AGENTS.md / CLAUDE.md and skill bundles. Launch in a controlled scope, explicitly select or invoke the intended persona rather than relying only on model selection.

Benefits: portable text assets; familiar tooling; relatively small integration; usable outside Omvra. Users retain arbitrary instructions and skills.

Drawbacks: discovery, precedence, cached context, and project instructions vary by provider; existing files can conflict; generated files can pollute repositories or leak across work; a skill may remain lazily selected. Claude explicitly distinguishes contextual memory instructions from enforcement. Native files alone do not establish equivalent privileged authority across runtimes. Scope temporary/generated material carefully and never overwrite user files. [Claude memory documentation](https://code.claude.com/docs/en/memory).

Use when external portability matters more than consistent authority. Retain current MCP/context delivery as an openly weaker compatibility path, not evidence this option meets the strongest authority requirement.

### 2. Install the selected persona in the runtime's privileged channel — recommended

Keep canonical persona prose and skill dependencies in Omvra. After explicit approval, resolve an immutable revision and send it through additive developer/system configuration before the first task turn. Use Codex top-level `developerInstructions` at thread creation and Claude's supported additive system-prompt mechanism. Keep built-in runtime instructions. Avoid replacing the complete base prompt. Resolve and include approved mandatory skill instructions up front, with their dependent assets accessible in a scoped package.

Benefits: actual channel distinction; arbitrary user-authored behavior remains intact; reuses current runtimes, models, authentication, resolver, and supervisor. Stable persona payload is distinct from changing task state. Best balance for this desktop app.

For a persona that deliberately replaces the runtime's coding role, additive delivery may still conflict with built-in instructions. Claude offers a selected custom main agent with its own system prompt and preloaded skills; an explicit replacement mode is therefore a credible adapter-specific variant. It must preserve needed tool-use and application lifecycle rules deliberately. Codex exposes a separate base-instruction replacement surface, whose exact behavior needs a version-specific probe. Do not assume appending arbitrary prose universally displaces a runtime's identity. Offer replacement only where supported and verified, with a clear compatibility report. [Claude custom agents](https://code.claude.com/docs/en/sub-agents), [Claude user-defined output styles](https://code.claude.com/docs/en/output-styles).

Drawbacks: model adherence remains probabilistic; runtime APIs and persistence differ; resume/compaction need verification. Generic ACP and external MCP clients may not expose a privileged channel. Prompt size and skill conflicts need visible resolution. Approved persona text is more powerful, so task-writing agents must not be able to modify or approve it implicitly.

Expose runtime support explicitly: privileged delivery supported/unsupported, dependencies resolved/unresolved, and actual adapter version. A strict persona launch should not silently fall back to a user prompt. The user may choose a compatible runtime or explicitly accept weaker delivery. Direct MCP alone cannot set another application's system/developer instructions; parity requires an installed client integration or an explicit user invocation recognized by that client.

### 3. Omvra owns the model/tool execution loop

Build an Omvra harness using model APIs or agent SDKs. Omvra supplies system/developer instructions for each model request, controls skill expansion and context assembly, and mediates every exposed tool and completion gate.

Benefits: most control over instruction placement, context persistence, skill loading, observable rules, and alternate tool routes. Easier to enforce process rules when every effectful operation is mediated. Arbitrary persona prose remains possible; portable bundles remain provider-neutral at the definition level.

Drawbacks: substantial new execution architecture, credentials/billing integration, provider-specific behavior, tool implementations, sandboxing, cancellation, streaming, recovery, and support burden. Existing coding-runtime subscription authentication cannot be assumed usable for direct APIs. Even full loop ownership cannot force subjective judgment or universal prose obedience. Any unmediated shell/network tool can undermine claimed rule enforcement.

Use when universal tool mediation or consistent control across unsupported runtimes becomes a demonstrated product requirement. It provides the highest control ceiling, but its delivery and maintenance costs make it a weaker present fit than option 2.

## Grading

Scores are engineering judgments, 1 weak to 5 strong; not measured compliance probabilities. Weighted total = sum(weight × score) / 5, out of 100. All options assume a properly implemented export bundle. Complexity is scored higher when delivery/maintenance is easier.

| Criterion | Weight | 1: Native files | 2: Privileged runtime | 3: Own loop |
| --- | ---: | ---: | ---: | ---: |
| Arbitrary user definition | 15 | 5 | 5 | 5 |
| Authority separation | 25 | 2 | 4 | 5 |
| Editable, stable definition | 10 | 4 | 5 | 5 |
| Backup and portability | 10 | 5 | 5 | 5 |
| Skills and observable controls | 15 | 2 | 4 | 5 |
| Switching isolation | 10 | 2 | 4 | 5 |
| Fit, delivery and maintenance | 15 | 4 | 4 | 1 |
| **Weighted total** | **100** | **65** | **87** | **88** |

Option 3 narrowly leads the raw control-weighted score, but option 2 is the recommendation under the existing provider-owned-runtime constraint. Option 3 changes that constraint and requires a separate architecture decision. The recommendation optimizes confidence of delivering useful authority in this codebase; option 3 has the highest eventual control ceiling if the user accepts the larger harness project. Option 1 fails the authority driver for consistent cross-provider support. Option 2 meets it on explicitly supported adapters; it cannot claim universal ACP parity. No score means semantic obedience is guaranteed.

## Recommended contract for specification work

### Definition, approval, and portability

Reuse Person identity and existing behavior/operational fields as the authoring source. Do not add a parallel persona catalogue without an independent need. Specify a versioned portable envelope containing stable persona ID, revision, name, both prose bodies, approved skill references with content hashes/versions, bundled eligible assets, and optional explicit controls/check references. No fixed profession list, task instructions, model credentials, provider session IDs, or automatic task-generated edits.

Export locally authored canonical definitions intentionally; continue prohibiting composed prompts, provider transcripts, and runtime responses in workspace audit/backups. A spec must distinguish authored source assets from composed runtime payloads so it does not accidentally violate existing privacy rules. Use the established versioned-key migration convention if persisted shapes change. Old records remain valid until migrated; legacy launches retain clearly disclosed advisory behavior.

Skill scripts, references, and assets need relative paths within the package; external/nonredistributable dependencies need explicit manifests and restore diagnostics. A hash establishes integrity, not safety. Imported packages become drafts until reviewed/approved; backup restore retains source bytes but must not silently execute scripts. Machine-specific executable bindings stay local and are resolved after restore. A bare skill name or absolute path alone is not a portable backup.

Only user-authorized editing/approval can publish a privileged revision. Agents may propose changes without activating them. Editing creates a new revision; it does not mutate in-flight sessions. Pin approved dependency content too: otherwise a stable persona can drift when a skill changes.

### Resolution and launch

Resolve the explicitly selected persona (default may be the task's assigned person) without rewriting it from task content. Keep execution-persona selection distinct from assignment/accountability if user overrides are allowed. Existing runtime-profile selection identifies an executable, not a persona; avoid overloading its IDs.

Reuse skill-service trust/integrity checks. Mandatory versus best-effort dependencies must be explicit user settings; do not infer them from vague prose or convert all historical references into blockers. Required unresolved dependencies block strict launch with a clear explanation. Provider-private dependencies may require runtime-native preload support or a supported availability check; do not inspect private directories or install missing skills automatically. File loading and tool invocation are separate operations.

Compose two payloads: stable privileged persona/approved required skill material and changing task context. Preserve the persona text; add only the application-owned framing needed for provenance, precedence, and conflict handling. Optional skills remain available by reference. Skill assets and scripts retain their normal permissions; loading a skill does not authorize external messages, destructive commands, or broader access.

Bind persona ID/revision/digest, dependency digest, delivery channel, adapter version and support status to the execution/session metadata. Do not persist raw composed prompts or claim the adapter's successful send proves model compliance. Oversize input must produce a visible error or explicit user choice; current context-pack slicing must not silently truncate mandatory instructions and still report full fidelity.

### Continue, edit, switch, resume, and compaction

Continue uses the pinned persona and current task context. A user edit affects new launches; offer an explicit apply-to-session action. A switch or applied revision waits for a safe turn boundary, ends the old provider session, and starts a fresh session with the selected persona and a bounded factual task checkpoint. Keep the same model if compatible. Reuse the supervisor and one-active-session rule; do not create concurrent sessions for this feature.

Do not replay the old persona transcript or replace it with an uncontrolled model-generated persona summary. Checkpoint factual progress, evidence and blockers only. Checkpoints remain lower-priority reference data. Distinguish persona-session replacement from contribution retry; changing persona alone must not submit, accept, complete, or silently abandon work.

Resume only when the runtime can establish the same pinned persona revision and skill payload. Otherwise create a fresh provider session using the same recovery contract. Test compaction explicitly. Claude's system-prompt snapshot behavior and reported Codex resume issues make hot replacement unsafe to assume; consult companion research. Runtime updates require compatibility checks, not automatic confidence.

### Observable rules and exceptions

Support prose first. Optional host controls complement it: tool allow/deny rules where the adapter really supports them, required artifacts, trusted executable checks, and governed review gates. Label each rule as runtime-enforced, Omvra-gated, or instruction-only. An MCP review gate cannot stop an agent from changing local files through its own shell. Enforcing a tool restriction requires covering alternate routes or reducing the claim.

User-defined preference exceptions may be explicit or conditional in the persona. Task content cannot widen permissions or authorize breaking a binding rule just by demanding an incompatible result. Record scoped exception authorization separately; do not edit the canonical persona. Host controls remain independently validated.

## Proposed evaluation and acceptance evidence

These are future implementation acceptance probes; no behavioral success rate has been measured in this research.

1. Transport inspection proves approved bytes and skill digests reach the actual privileged field before the first turn. Plain task text and retrieved content never enter it. An acknowledgement alone is insufficient.
2. Two arbitrary personas run on the same model: one requires a distinctive skill/procedure; another requires a different approach. Evaluate observed actions and deliverables, not a claim that the persona was followed. Include an unconventional user-authored persona to detect hidden profession assumptions.
3. Use at least 30 fixed representative scenarios per supported runtime and repeat each 3 times. Compare current delivery against option 2 with the same model, permissions, task and sampling settings. Include distracting text, hostile tool-result instructions, conflicting task requests, conditional rules, unavailable skills and long context. Record failures per requirement and run; do not infer broad reliability from easy cases.
4. Launch, continue, native resume, crash recovery, compaction and user switch must retain or explicitly replace the pinned revision. Changing task notes must not change persona bytes. Edits and dependency updates must not alter an active execution silently.
5. Required loading is verified from adapter/resolver evidence. Required invocation, where meaningful, uses tool events. Application uses action/output review. Report these states separately.
6. Export/import on another directory/machine preserves approved definition and dependency hashes; restores require no source-machine absolute paths. Missing assets/runtime support must be visible. Inspect actual backup round trips, not only manifest schemas.
7. Strict unsupported launches and unresolved mandatory dependencies are blocked; weaker fallback requires explicit user choice. All declared host controls reject bypasses within their claimed scope; permission and acceptance authority remain unchanged.
8. Proposed release gate: zero observed wrong-persona or silent-downgrade launches; no regression in task success; at least 95% observed adherence for predeclared objectively checkable persona requirements and improvement over baseline. Report raw counts and uncertainty; 95% is a proposed product target, not proof of zero risk or a research result. Subjective judgment uses a predefined human rubric and separately reported ratings.

## Implementation sequence and open decisions

First write an accepted authority/precedence decision, including approval and conflict behavior. Then specify persona revision/bundle/backup semantics and session binding. Extend existing adapters for privileged additive delivery and explicit support reporting. Apply the same binding to task and Goal-node launch paths; inspect Goal dispatch end to end rather than assuming task integration covers it. Retain direct MCP as disclosed advisory delivery unless the external client integration establishes authority. Add switching/recovery and bounded observability, then run the behavioral comparison before claiming increased reliability.

Open decisions for the technical spec: exact persona override UX; whether required skills can be provider-private in strict mode; maximum accepted prompt size; revision retention/backup ownership; minimum runtime versions; supported tool controls; acceptable behavioral threshold; and whether unsupported ACP is blocked by default or offered as explicit advisory mode. None requires renaming personas or generating task-specific replacements.

Recommended next work: an ADR for the authority change, then a technical spec tracing resolver → approval/revision → dependency resolution → adapter → session binding → recovery/switch → backup. Current strongest confidence is in the channel mechanism and architectural fit. Reliability improvement remains an inference until the above model/runtime evaluations are performed.
