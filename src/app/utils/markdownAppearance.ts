import type { CSSProperties } from 'react';

export interface MarkdownAppearance {
  listIndent: string;
  taskIndent: string;
  blockSpacing: string;
  listBlockSpacing: string;
  listItemSpacing: string;
  codeBlockSpacing: string;
  inlineCodePaddingX: string;
  inlineCodePaddingY: string;
  inlineCodeBg: string;
  inlineCodeColor: string;
  inlineCodeRadius: string;
  inlineCodeMarginX: string;
  inlineCodeMarginY: string;
  preformattedPaddingX: string;
  preformattedPaddingY: string;
  preformattedBg: string;
  preformattedColor: string;
  preformattedRadius: string;
}

export const DEFAULT_MARKDOWN_APPEARANCE: MarkdownAppearance = {
  listIndent: '0rem',
  taskIndent: '1rem',
  blockSpacing: '1rem',
  listBlockSpacing: '1rem',
  listItemSpacing: '1rem',
  codeBlockSpacing: '1rem',
  inlineCodePaddingX: '0.25rem',
  inlineCodePaddingY: '0.125rem',
  inlineCodeBg: '#000000',
  inlineCodeColor: '#9feec8',
  inlineCodeRadius: '0.25rem',
  inlineCodeMarginX: '0.125rem',
  inlineCodeMarginY: '0',
  preformattedPaddingX: '0',
  preformattedPaddingY: '0',
  preformattedBg: '#ffffff00',
  preformattedColor: '#1f2937',
  preformattedRadius: '0',
};

function normalizeAppearanceValue(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

export function sanitizeMarkdownAppearance(
  value: Partial<MarkdownAppearance> | undefined,
  fallback: MarkdownAppearance = DEFAULT_MARKDOWN_APPEARANCE
): MarkdownAppearance {
  if (!value) {
    return { ...fallback };
  }

  return {
    listIndent: normalizeAppearanceValue(value.listIndent, fallback.listIndent),
    taskIndent: normalizeAppearanceValue(value.taskIndent, fallback.taskIndent),
    blockSpacing: normalizeAppearanceValue(value.blockSpacing, fallback.blockSpacing),
    listBlockSpacing: normalizeAppearanceValue(value.listBlockSpacing, fallback.listBlockSpacing),
    listItemSpacing: normalizeAppearanceValue(value.listItemSpacing, fallback.listItemSpacing),
    codeBlockSpacing: normalizeAppearanceValue(value.codeBlockSpacing, fallback.codeBlockSpacing),
    inlineCodePaddingX: normalizeAppearanceValue(value.inlineCodePaddingX, fallback.inlineCodePaddingX),
    inlineCodePaddingY: normalizeAppearanceValue(value.inlineCodePaddingY, fallback.inlineCodePaddingY),
    inlineCodeBg: normalizeAppearanceValue(value.inlineCodeBg, fallback.inlineCodeBg),
    inlineCodeColor: normalizeAppearanceValue(value.inlineCodeColor, fallback.inlineCodeColor),
    inlineCodeRadius: normalizeAppearanceValue(value.inlineCodeRadius, fallback.inlineCodeRadius),
    inlineCodeMarginX: normalizeAppearanceValue(value.inlineCodeMarginX, fallback.inlineCodeMarginX),
    inlineCodeMarginY: normalizeAppearanceValue(value.inlineCodeMarginY, fallback.inlineCodeMarginY),
    preformattedPaddingX: normalizeAppearanceValue(value.preformattedPaddingX, fallback.preformattedPaddingX),
    preformattedPaddingY: normalizeAppearanceValue(value.preformattedPaddingY, fallback.preformattedPaddingY),
    preformattedBg: normalizeAppearanceValue(value.preformattedBg, fallback.preformattedBg),
    preformattedColor: normalizeAppearanceValue(value.preformattedColor, fallback.preformattedColor),
    preformattedRadius: normalizeAppearanceValue(value.preformattedRadius, fallback.preformattedRadius),
  };
}

export function getMarkdownAppearanceCssVariables(
  appearance: MarkdownAppearance
): CSSProperties {
  return {
    '--omvra-markdown-list-indent': appearance.listIndent,
    '--omvra-markdown-task-indent': appearance.taskIndent,
    '--omvra-markdown-block-spacing': appearance.blockSpacing,
    '--omvra-markdown-list-block-spacing': appearance.listBlockSpacing,
    '--omvra-markdown-list-item-spacing': appearance.listItemSpacing,
    '--omvra-markdown-code-block-spacing': appearance.codeBlockSpacing,
    '--omvra-markdown-inline-code-padding-x': appearance.inlineCodePaddingX,
    '--omvra-markdown-inline-code-padding-y': appearance.inlineCodePaddingY,
    '--omvra-markdown-inline-code-bg': appearance.inlineCodeBg,
    '--omvra-markdown-inline-code-color': appearance.inlineCodeColor,
    '--omvra-markdown-inline-code-radius': appearance.inlineCodeRadius,
    '--omvra-markdown-inline-code-margin-x': appearance.inlineCodeMarginX,
    '--omvra-markdown-inline-code-margin-y': appearance.inlineCodeMarginY,
    '--omvra-markdown-preformatted-padding-x': appearance.preformattedPaddingX,
    '--omvra-markdown-preformatted-padding-y': appearance.preformattedPaddingY,
    '--omvra-markdown-preformatted-bg': appearance.preformattedBg,
    '--omvra-markdown-preformatted-color': appearance.preformattedColor,
    '--omvra-markdown-preformatted-radius': appearance.preformattedRadius,
  } as CSSProperties;
}
