import React from 'react';

interface MarkdownContentProps {
  content: string;
}

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${match.index}-${token}`;

    if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code key={key} className="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono text-gray-800">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
      const splitIndex = token.indexOf('](');
      const label = token.slice(1, splitIndex);
      const href = token.slice(splitIndex + 2, -1);
      const isSafeHref = href.startsWith('http://') || href.startsWith('https://');
      parts.push(
        isSafeHref ? (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 underline"
          >
            {label}
          </a>
        ) : (
          label
        )
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  const lines = content.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length && lines[i].startsWith('```')) i += 1;

      blocks.push(
        <pre key={`code-${blocks.length}`} className="overflow-x-auto rounded-md bg-gray-100 p-3 text-xs text-gray-900">
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const sizeClass =
        level === 1 ? 'text-xl' :
        level === 2 ? 'text-lg' :
        level === 3 ? 'text-base' : 'text-sm';

      blocks.push(
        <div key={`h-${blocks.length}`} className={`${sizeClass} font-semibold text-gray-900`}>
          {renderInline(text)}
        </div>
      );
      i += 1;
      continue;
    }

    const unorderedMatch = line.match(/^[-*]\s+(.+)$/);
    if (unorderedMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^[-*]\s+(.+)$/);
        if (!m) break;
        items.push(m[1]);
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="list-disc space-y-1 pl-5">
          {items.map((item, idx) => (
            <li key={`ul-item-${idx}`} className="text-sm text-gray-800">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\d+\.\s+(.+)$/);
        if (!m) break;
        items.push(m[1]);
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${blocks.length}`} className="list-decimal space-y-1 pl-5">
          {items.map((item, idx) => (
            <li key={`ol-item-${idx}`} className="text-sm text-gray-800">
              {renderInline(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push(
        <blockquote key={`q-${blocks.length}`} className="border-l-2 border-gray-300 pl-3 text-sm text-gray-700">
          {quoteLines.map((quoteLine, idx) => (
            <p key={`q-line-${idx}`}>{renderInline(quoteLine)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith('```') &&
      !lines[i].match(/^(#{1,6})\s+(.+)$/) &&
      !lines[i].match(/^[-*]\s+(.+)$/) &&
      !lines[i].match(/^\d+\.\s+(.+)$/) &&
      !lines[i].startsWith('>')
    ) {
      paragraphLines.push(lines[i]);
      i += 1;
    }

    blocks.push(
      <p key={`p-${blocks.length}`} className="text-sm leading-relaxed text-gray-800">
        {renderInline(paragraphLines.join(' '))}
      </p>
    );
  }

  return <div className="space-y-3">{blocks}</div>;
}
