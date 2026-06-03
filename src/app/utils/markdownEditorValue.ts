function escapeMarkdownTextLine(line: string): string {
  return line.replace(/([\\`*_{}[\]()#+\-.!|<>~])/g, '\\$1');
}

function escapeFencedCodeBlocks(value: string): string {
  return value.replace(
    /(^|\n)([ \t]*)(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)\n[ \t]*\3[ \t]*(?=\n|$)/g,
    (match, prefix: string, indent: string, fence: string, meta: string, code: string) => {
      const escapedLines = [
        escapeMarkdownTextLine(`${indent}${fence}${meta}`),
        ...code.split('\n').map(escapeMarkdownTextLine),
        escapeMarkdownTextLine(`${indent}${fence}`),
      ];

      return `${prefix}${escapedLines.join('\n')}`;
    }
  );
}

export function normalizeMarkdownEditorValue(value: string): string {
  if (value.trim().length === 0) return '';

  return escapeFencedCodeBlocks(value);
}
