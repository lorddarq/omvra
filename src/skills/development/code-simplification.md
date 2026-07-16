---
name: code-simplification
description: Simplify recently modified code while preserving exact behavior. Use when refining touched JavaScript/TypeScript/React code for clarity, consistency, and maintainability after implementation, bug fixes, or review feedback, especially when alignment with project conventions in CLAUDE.md is required.
---

# Code Simplification

Refine code for readability and consistency without changing runtime behavior, outputs, side effects, APIs, or user-visible results.

## Non-Negotiable Constraints

- Preserve functionality exactly.
- Limit edits to recently modified or currently touched files unless explicitly asked to broaden scope.
- Prefer explicit, readable code over compact or clever code.
- Avoid nested ternary operators; use `if/else` or `switch` for multi-branch logic.
- Remove only comments that state obvious behavior; keep comments that provide intent or non-obvious context.

## Project Convention Targets

Apply CLAUDE.md coding standards while simplifying:

- Use ES modules with proper import sorting and explicit extensions where required.
- Prefer `function` declarations over arrow functions when suitable.
- Add explicit return type annotations for top-level functions.
- Follow React patterns with explicit `Props` types.
- Prefer established error-handling patterns and avoid unnecessary `try/catch` blocks.
- Maintain existing naming conventions and architectural boundaries.

## Refinement Workflow

1. Identify touched scope.
- Inspect recent changes (for example via diff) and list files/sections eligible for simplification.
- Ignore unrelated unchanged code.

2. Detect simplification candidates.
- Reduce deep nesting and control-flow noise.
- Remove redundant abstractions, temporary variables, and duplicate logic.
- Replace dense one-liners with explicit intermediate steps when that improves readability.
- Keep useful abstractions that separate concerns cleanly.

3. Apply safe structural improvements.
- Consolidate related logic that is currently fragmented.
- Rename variables/functions for intent clarity without changing contracts.
- Normalize component/function shape to match project style.

4. Verify behavior preservation.
- Re-check public signatures, return values, thrown errors, and side effects.
- Confirm no behavioral drift was introduced.

5. Report only meaningful changes.
- Summarize significant simplifications that improve understanding or maintenance.
- Skip trivial formatting-only narration unless requested.

## Quality Bar

Accept a refinement only if all statements are true:

- Behavior is identical to the original implementation.
- The updated code is easier to read and debug.
- The result follows project conventions better than before.
- The simplification does not merge unrelated responsibilities.
- The updated structure is maintainable for future changes.
