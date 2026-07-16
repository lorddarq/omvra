---
name: ui-ux-guardrails
description: Enforce strict UX/UI implementation guardrails for web and app interfaces, including accessibility, motion, visual hierarchy, and interaction feedback constraints. Use when creating, editing, reviewing, or refactoring frontend components, screens, design systems, Tailwind/CSS styles, or design-to-code output where consistent decisions and high usability are required.
---

# UI UX Guardrails

## Core Workflow

1. Determine the user goal for the view and prioritize only the minimum set of actions needed to complete it.
2. Define one consistent visual and interaction pattern for each control type and propagate it across the full surface.
3. Implement layout, accessibility, and feedback states together (default, loading, empty, error, success, disabled).
4. Run the compliance checklist in this skill before returning output.

## Non-Negotiable Requirements

- Use structural skeletons for loading states.
- Keep UI choices consistent and propagate each choice across related components and views.
- Add proper ARIA labels to controls and meaningful `alt` text to informative images.
- Show errors next to where the action occurs (inline/local errors first).
- Use an `AlertDialog` for destructive or irreversible actions.

## UX Heuristics To Apply

Apply these principles during every design or implementation pass:

- Aesthetic Usability Effect
- Avoid Choice Overload
- Chunk Information
- Avoid Cognitive Bias
- Avoid Cognitive Load
- Doherty Threshold (target <400ms system response pacing)
- Fitt's Law
- Flow
- Goal-Gradient Effect
- Hick's Law
- Jakob's Law
- Law of Common Region
- Law of Proximity
- Law of Prägnanz
- Law of Similarity
- Law of Uniform Connectedness
- Mental Models
- Miller's Law
- Occam's Razor
- Paradox of the Active User
- Pareto Principle
- Parkinson's Law
- Peak-End Rule
- Postel's Law
- Selective Attention
- Serial Position Effect
- Tesler's Law
- Von Restorff Effect
- Working Memory
- Zeigarnik Effect

## Implementation Constraints

### Layout and Density

- Use `truncate` or `line-clamp` for dense UI text.
- Use `size-*` for square elements instead of separate `w-*` and `h-*`.
- Use Tailwind default shadow scale unless explicitly asked otherwise.
- Use only one accent color per view.

### Motion and Performance

- Prefer CSS animations over `motion.dev`.
- Animate only compositor properties: `transform` and `opacity`.
- Pause looping animations when off-screen.
- Keep interaction feedback animation duration at or below `200ms`.

Never:

- Animate layout properties: `width`, `height`, `top`, `left`, `margin`, `padding`.
- Add animation unless explicitly requested.
- Animate large `blur()` or `backdrop-filter` surfaces.
- Use `will-change` outside active animation windows.
- Introduce custom easing curves unless explicitly requested.

### React Logic Constraint

Never use `useEffect` for logic expressible as render logic or derived state.

## Visual System Rules

- Use brand palette tokens when available.
- Use icon libraries in this order: Heroicons, then Lucide.
- Maintain explicit text hierarchy (`h1`, `h2`, `h3`, body, subtext).
- Meet WCAG AA contrast minimum; prefer AAA when feasible.
- Maintain minimum control heights: `38px` desktop, `44px` mobile.
- Keep inputs visibly defined in default state (border or 5-10% darker field surface than background).
- Use consistent padding patterns; allow top/bottom exceptions for buttons and inputs only.
- Use color intentionally to direct attention toward key actions.
- Compute nested radii with: `RadiusInner = RadiusOuter - padding`.

Never:

- Mix more than one font family in a view.
- Use text transparency unless explicitly requested.
- Create rainbow CTA patterns or multiple competing action colors.
- Use repetitive texture/noise treatments that hurt performance.
- Use emojis as icon substitutes.

## State Patterns

For interactive components, implement these states consistently:

- Default/up: clear affordance and legible labels.
- Hover/focus: visible, accessible, non-jittery feedback.
- Active/pressed: immediate response under `200ms`.
- Disabled: visibly disabled with retained readability.
- Loading: structural skeleton.
- Error: inline message at point of failure.
- Success: concise confirmation near the completed action.

## Final Compliance Checklist

Before returning output, verify:

- Accessibility tags and `alt` text are present.
- Destructive actions use `AlertDialog`.
- Errors are colocated with actions.
- Loading uses skeleton structure.
- Motion constraints are respected.
- Accent-color count per view is one.
- Typography and spacing are consistent across related UI.
