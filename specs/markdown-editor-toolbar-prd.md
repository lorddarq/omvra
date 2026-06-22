# Markdown Editor Toolbar PRD

## Summary

Omvra currently edits task notes with a plain textarea and renders them later as markdown. This feature adds a dedicated markdown editor component for task notes in edit mode, with toolbar-driven formatting, preview controls, and markdown-string persistence.

The read surface in task details should continue to render from `task.notes` using the existing markdown renderer.

## Goals

- Replace the plain notes textarea in task edit mode with a dedicated markdown editor component.
- Keep `task.notes` stored as plain markdown, not HTML or editor-specific JSON.
- Support selection-driven formatting for common GitHub-flavored markdown flows.
- Keep the toolbar/editor integration in a separate component so styling and future changes remain localized.
- Preserve compatibility with the current markdown read surface.

## Non-Goals

- Collaborative editing.
- Attachments or media upload workflows.
- Replacing the read-only task details surface with a live editor.
- Introducing an editor-specific persisted document format.

## Current State

- Task editing uses a plain textarea in [`src/app/components/TaskDialog.tsx`](/Users/sorin.jurcut/Documents/GitHub/Omvra/src/app/components/TaskDialog.tsx).
- Task details render markdown through [`src/app/components/MarkdownContent.tsx`](/Users/sorin.jurcut/Documents/GitHub/Omvra/src/app/components/MarkdownContent.tsx).
- `task.notes` is stored and updated as a plain string via [`src/app/hooks/useTaskActions.ts`](/Users/sorin.jurcut/Documents/GitHub/Omvra/src/app/hooks/useTaskActions.ts).

## Package Research

### Option 1: `@uiw/react-md-editor`

- Fit: best match for a low-risk markdown-native editing upgrade in Omvra.
- Pros:
  - Simple React + TypeScript API with markdown string state.
  - Toolbar and preview are built in.
  - Supports selection-based formatting without Omvra owning custom transform logic for V1.
  - Lower dependency surface than richer editor frameworks.
- Cons:
  - More textarea-oriented than a richer document editor.
  - Toolbar customization is possible, but the package still brings its own shell and interaction model.
- Integration complexity: low to medium.

### Option 2: `@mdxeditor/editor`

- Fit: strongest match if Omvra later wants a more advanced markdown document editor.
- Pros:
  - React-first editor built around markdown as the primary format.
  - Supports customizable toolbar, tables, code blocks, source mode, markdown shortcuts, and richer block workflows.
  - Cleaner long-term path for a fully custom toolbar.
- Cons:
  - Much heavier dependency surface including Lexical, CodeMirror, Sandpack-related packages, and extra Radix primitives.
  - Introduces more editor infrastructure than a task-note dialog needs today.
  - Higher styling and integration cost for this repo.
- Integration complexity: medium to high.

### Option 3: Tiptap with `@tiptap/markdown`

- Fit: strong long-term foundation if Omvra expects deep editor customization later.
- Pros:
  - Mature extension model and large ecosystem.
  - Markdown parse/serialize support exists with `getMarkdown()` and markdown-aware commands.
  - Fine-grained control over menus and node behavior.
- Cons:
  - Higher integration cost for a task editor.
  - Toolbar and markdown feature parity require more assembly work.
  - More infrastructure than Omvra currently needs for notes editing.
- Integration complexity: high.

### Option 4: Toast UI Editor

- Fit: acceptable if Omvra wanted an all-in-one markdown/WYSIWYG package quickly.
- Pros:
  - Mature markdown + WYSIWYG editor with toolbar concepts.
  - Broad feature coverage.
- Cons:
  - Heavier UI opinionation.
  - Harder to make visually consistent with the existing Tailwind/Radix dialog.
  - Toolbar customization and native-feeling integration are weaker fits than a lighter wrapper approach.
- Integration complexity: medium to high.

## Recommended Direction

Use `@uiw/react-md-editor` wrapped in a Omvra-owned `MarkdownEditor` component.

Reasoning:

- It preserves `task.notes` as a plain markdown string with minimal adapter code.
- It delivers the requested toolbar and selection-driven markdown formatting without introducing a heavyweight editor stack.
- A Omvra wrapper component still gives us a separate styling and integration boundary for the toolbar/editor surface.
- `@mdxeditor/editor` remains a valid future upgrade if Omvra later needs more advanced document-authoring behavior.

## Proposed UX

- The `Notes & Details` field in task edit mode becomes a dedicated markdown editor panel.
- The editor exposes core markdown actions for:
  - headings
  - bold, italic, strikethrough, inline code
  - links
  - image markdown template insertion
  - bullet, numbered, and task lists
  - code block insertion
  - table insertion
  - horizontal rule insertion
  - edit/live/preview mode toggles
- Keyboard markdown shortcuts remain enabled through the editor package.
- Saving writes markdown back to `task.notes`.

## Architecture

### New component

- `MarkdownEditor`
  - wraps the editor package
  - accepts `value`, `onChange`, and field metadata
  - owns package configuration, toolbar selection, and preview parity with the read surface

### Existing components affected

- `TaskDialog`
  - replace the textarea with `MarkdownEditor`
  - preserve the `notes` state as a string
  - avoid destructive trimming that would remove markdown-significant trailing newlines
- `MarkdownContent`
  - remain the canonical read-only renderer
  - export shared markdown rendering components so editor preview and read mode stay aligned
- `TaskCard`
  - keep card previews readable as markdown usage becomes richer

### Data model

- No schema changes.
- Continue storing markdown in `Task.notes`.

## Risks and Review Notes

### Risk 1: Markdown persistence drift

- Risk:
  editor output could drift away from what `MarkdownContent` renders safely
- Mitigation:
  keep markdown string persistence, reuse shared markdown rendering config for preview, and constrain toolbar features to what round-trips cleanly

### Risk 2: Focus and selection inside the dialog

- Risk:
  toolbar actions inside the Radix dialog can feel broken if focus or selection is lost
- Mitigation:
  use the package’s built-in command handling and verify keyboard behavior manually in the dialog

### Risk 3: Save-path normalization

- Risk:
  trimming note content too aggressively can remove meaningful markdown whitespace
- Mitigation:
  normalize whitespace-only notes to an empty string while preserving meaningful trailing newlines

### Risk 4: Preview surfaces becoming noisy

- Risk:
  task-card previews can degrade as users author richer markdown
- Mitigation:
  add focused preview extraction tests against markdown-heavy fixtures

## Fixtures

### Fixture A: basic prose

```md
# Launch checklist

Ship the markdown editor toolbar without breaking task save behavior.
```

### Fixture B: lists and task lists

```md
## Work items

- Editor wrapper
- Toolbar wiring
- Preview parity

- [x] Research package options
- [ ] Implement dialog integration
- [ ] Verify rendering
```

### Fixture C: links, code, and table

```md
Read the [ARIA toolbar example](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/examples/toolbar/).

Use `task.notes` as the source of truth.

| Area | Status |
| --- | --- |
| Toolbar | In progress |
| Rendering | Pending |
```

## Acceptance Criteria

- Task edit mode uses a dedicated markdown editor component instead of a plain textarea.
- The markdown editing experience is encapsulated in a separate reusable component.
- Toolbar actions update the selected content and preserve markdown output.
- Saving a task persists markdown into `task.notes`.
- The task details dialog still renders saved markdown correctly.
- Existing notes remain editable without migration.
- The production build succeeds.

## Test Plan

### Manual verification

1. Open a task with existing markdown and confirm the editor loads the saved content.
2. Select plain text and apply bold, italic, link, and list formatting from the toolbar.
3. Insert a heading, code block, table, and horizontal rule.
4. Toggle edit, live, and preview modes.
5. Save the task, reopen it, and confirm the markdown persists unchanged.
6. Open the task details dialog and confirm the read-only render matches the authored content.
7. Confirm keyboard navigation inside the dialog still feels coherent.

### Automated verification

- `npm run build`
- `node --experimental-strip-types --experimental-specifier-resolution=node --test src/app/utils/taskNotes.test.ts`

## Ranked Implementation Tasks

Ranked from lower effort / higher ROI toward higher effort / lower ROI.

1. Add `@uiw/react-md-editor` and scaffold the `MarkdownEditor` wrapper.
2. Replace the `TaskDialog` textarea with the new component while preserving markdown-string state.
3. Preserve markdown-sensitive note persistence and guard against whitespace-only saves.
4. Verify task details and task-card previews still behave well with markdown-heavy notes.
5. Add focused regression tests for note normalization and markdown-heavy task previews.
6. Refine styling and keyboard accessibility based on manual dialog testing.
7. Revisit a heavier editor such as `@mdxeditor/editor` only if future requirements outgrow the lighter wrapper approach.

## Review Outcome

Two parallel review passes agreed on the core constraint: `task.notes` must remain plain markdown, and toolbar behavior must be selection-safe inside the dialog. The main disagreement was package choice. One review preferred `@mdxeditor/editor` for long-term editor flexibility; the chosen V1 implementation uses `@uiw/react-md-editor` because it is materially lighter and better matched to a dialog-scoped task-note editor.
