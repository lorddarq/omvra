# Provider evidence for authoritative persona delivery

Research date: 2026-10-20. Status: research input for a proposed specification, not an implemented contract. Sources below are primary documentation, protocol schemas, and an explicitly labelled issue report. Installed runtime behavior still needs version-specific validation.

## What the available channels establish

Provider-native instruction channels are materially different from a persona returned as MCP tool data or embedded in a task user message. Omvra can use the runtime's intended instruction surface to establish that an explicitly selected, user-authored persona is operating configuration. This reduces ambiguity about whether it is task reference material or an instruction injection. It does not prove semantic obedience, and it cannot override provider policy, security, permissions, or organization controls. No source reviewed promises perfect compliance for arbitrary persona text.

## Codex app-server

The official generated [`ThreadStartParams`](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/schema/typescript/v2/ThreadStartParams.ts) exposes top-level `developerInstructions`, separately from `baseInstructions`, model selection, working directory, and permissions. This is the appropriate candidate for additive persona instructions while preserving the normal harness. Do not implement the historical analysis's older `settings.developer_instructions` on `turn/start` without checking the installed schema.

The official [`ThreadResumeParams`](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/schema/typescript/v2/ThreadResumeParams.ts) also exposes `developerInstructions`. Schema acceptance is not evidence that a changed persona becomes effective on the very next resumed turn. [Issue #19045](https://github.com/openai/codex/issues/19045) reports old instructions surviving the first resumed turn after an override; this is a user reproduction in the official repository, not an official guarantee or locally reproduced defect. Treat it as a required regression scenario. Start a fresh provider thread on persona switches/revisions unless the exact supported runtime passes a probe.

The [app-server documentation](https://developers.openai.com/codex/app-server/) describes generating protocol types/schemas from the executable and returns `instructionSources` on thread lifecycle responses. This can aid compatibility and file provenance checks. Loaded-file paths do not prove that persona text was obeyed. Required MCP initialization failure can block thread creation, but MCP readiness is distinct from skill loading or compliance.

## Claude Code

The [CLI reference](https://code.claude.com/docs/en/cli-reference#system-prompt-flags) documents `--append-system-prompt-file` for adding instructions while retaining the default harness, and `--system-prompt-file` for replacing it. Replacement removes default prompt guidance, so a broad non-coding identity may need deliberate replacement, whereas additive instructions are the lower-cost choice for a compatible persona. The same page documents snapshot behavior: the first system prompt can persist across resume/continue until compaction; supported versions offer `--system-prompt-snapshot off`. Therefore editing a source file and resuming is insufficient evidence of a changed persona. Version checks and a fresh-session fallback are necessary.

The [custom-subagent documentation](https://code.claude.com/docs/en/sub-agents) offers a stronger native persona packaging mechanism. A custom agent has a system prompt and can specify tools and skills. `--agent <name>` runs the main session as that agent, making selection explicit rather than leaving delegation to model choice. A nonempty custom prompt replaces the default prompt. The `skills` list preloads full content, with documented limits and missing/disabled skill warnings; it does not restrict all skill access. Tool restrictions and model selection can persist on resume, while prompt reuse follows system-prompt snapshot rules. Omvra must verify required skills separately because provider preloading may skip unavailable entries.

The [output-style documentation](https://code.claude.com/docs/en/output-styles) explicitly supports persistent user-defined roles beyond engineering and says instruction-based styles do not guarantee behavior. It directs always-required actions or blocking rules toward hooks. This is direct evidence that arbitrary user identities are supported without a fixed engineering/marketing/design taxonomy, and that native system-level customization still needs behavioral evaluation.

The [skills documentation](https://code.claude.com/docs/en/skills) distinguishes discovery from loading: a regular session normally sees descriptions, and bodies load upon invocation; subagent preloading loads bodies at startup. Supporting scripts and references are separate assets. It also explicitly discusses skills ceasing to be followed and recommends hooks for rules that must occur on every matching event. Consequently, “skill installed,” “body delivered,” “script invoked,” and “procedure followed” must remain separate observations.

The [hook reference](https://code.claude.com/docs/en/hooks) documents runtime-controlled lifecycle callbacks and blocking decisions, including before tool use. Command checks can enforce concrete conditions within hook coverage. An LLM-based hook adds another probabilistic judgment rather than a deterministic guarantee. Hook coverage, failure behavior, and bypass paths must be validated for the supported runtime.

## Generic ACP

The stable [session setup contract](https://agentclientprotocol.com/protocol/v1/session-setup) specifies the working directory, MCP connections, and lifecycle/session configuration. The stable [prompt-turn contract](https://agentclientprotocol.com/protocol/v1/prompt-turn) defines `session/prompt` content as a user message. These reviewed stable surfaces do not provide a portable top-level system/developer persona field equivalent to Codex's field or Claude's launch customization. Agent-specific extensions or advertised configuration may exist, but must be discovered and verified for each adapter; ACP compatibility alone cannot establish privileged persona installation.

For Omvra, advertise an explicit delivery capability such as native instruction delivery versus conversational context delivery. A strict persona execution request should reject an unsupported native path or ask the user to choose a supported runtime; it should never silently downgrade authority. This is a proposed product contract inferred from the protocol gap, not an ACP requirement.

## Specification implications

1. Keep one user-editable canonical persona artifact, independent of tasks. Resolve an explicit revision and content digest for each execution. Task context must not rewrite it.
2. Feed approved persona instructions through a native instruction channel. Keep task notes, history, retrieved documents, and arbitrary tool results out of that channel.
3. Resolve selected skill bodies and necessary supporting assets before work. Record exact resolution and delivery outcomes. Do not equate body delivery with model use or compliance.
4. Preserve the same model when switching personas. Quiesce the current turn and create a fresh provider session when reliable native prompt replacement cannot be established. Carry bounded task state, not the previous persona's whole transcript.
5. Publish runtime/version capability limits. Verify start, resume, compaction, subprocess recovery, and persona changes with the actual installed executable.
6. Keep permissions and checkable rules enforced by the harness where supported; preserve arbitrary prose for workflow, judgment, role, and exceptions. An acknowledgement or model-produced compliance checklist is supplementary evidence only.
7. Back up canonical persona text, manifest, pinned skill content/assets or explicit dependency locks, and schema versions. Exclude tokens, provider session data, and credentials. Imported executable assets require explicit trust before execution; a content digest establishes identity, not trust.
8. Evaluate behavioral adherence against the current conversational contract using conflicting task text, long contexts, compaction, missing skills, persona switches, and genuinely different user-defined identities. Report measured outcomes by runtime/version; do not turn design scores into invented compliance percentages.

## Uncertainty

This investigation establishes available transport/configuration mechanisms and documented limitations. It does not measure an adherence improvement, reproduce the Codex resume report, confirm the installed Claude version supports every cited flag, or prove arbitrary skill transitive dependencies are portable. Those are implementation spikes and evaluation requirements before a shipped guarantee.
