import ReactMarkdown, { Components } from 'react-markdown';
import type { ComponentPropsWithoutRef } from 'react';
import remarkGfm from 'remark-gfm';

interface MarkdownContentProps {
  content: string;
}

type CodeComponentProps = ComponentPropsWithoutRef<'code'> & {
  inline?: boolean;
  node?: {
    properties?: {
      className?: string[] | string;
    };
  };
};

export const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="break-words text-xl font-semibold text-gray-900 [overflow-wrap:anywhere]">{children}</h1>,
  h2: ({ children }) => <h2 className="break-words text-lg font-semibold text-gray-900 [overflow-wrap:anywhere]">{children}</h2>,
  h3: ({ children }) => <h3 className="break-words text-base font-semibold text-gray-900 [overflow-wrap:anywhere]">{children}</h3>,
  h4: ({ children }) => <h4 className="break-words text-sm font-semibold text-gray-900 [overflow-wrap:anywhere]">{children}</h4>,
  h5: ({ children }) => <h5 className="break-words text-sm font-semibold text-gray-900 [overflow-wrap:anywhere]">{children}</h5>,
  h6: ({ children }) => <h6 className="break-words text-sm font-semibold text-gray-900 [overflow-wrap:anywhere]">{children}</h6>,
  p: ({ children }) => <p className="break-words text-sm leading-relaxed text-gray-800 [overflow-wrap:anywhere]">{children}</p>,
  ul: ({ children }) => <ul className="min-w-0 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="min-w-0 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children, className }) => {
    const isTaskItem = className?.includes('task-list-item');
    return (
      <li
        className={`min-w-0 break-words text-sm text-gray-800 [overflow-wrap:anywhere] ${
          isTaskItem ? 'flex items-start gap-2 list-none pl-0' : ''
        }`.trim()}
      >
        {children}
      </li>
    );
  },
  input: ({ type, checked, disabled }) => {
    if (type !== 'checkbox') return null;
    return (
      <input
        type="checkbox"
        checked={Boolean(checked)}
        disabled={disabled ?? true}
        readOnly
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300"
      />
    );
  },
  blockquote: ({ children }) => (
    <blockquote className="min-w-0 break-words border-l-2 border-gray-300 pl-3 text-sm text-gray-700 [overflow-wrap:anywhere]">{children}</blockquote>
  ),
  pre: ({ children }) => (
    <pre className="max-w-full overflow-x-auto rounded-md bg-gray-100 p-3 text-xs text-gray-900">
      {children}
    </pre>
  ),
  code: ({ inline, className, children, node }: CodeComponentProps) => {
    const nodeClassName = node?.properties?.className;
    const normalizedClassName = Array.isArray(nodeClassName)
      ? nodeClassName.join(' ')
      : (nodeClassName || className || '');
    const childText = typeof children === 'string' ? children : String(children ?? '');
    const isBlockCode = Boolean(inline === false || normalizedClassName || childText.includes('\n'));

    if (!isBlockCode) {
      return (
        <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs text-gray-800 [overflow-wrap:anywhere]">
          {children}
        </code>
      );
    }

    return <code className={normalizedClassName}>{children}</code>;
  },
  a: ({ href, children }) => {
    const safeHref = href || '';
    const isSafe =
      safeHref.startsWith('http://') ||
      safeHref.startsWith('https://') ||
      safeHref.startsWith('mailto:');
    if (!isSafe) return <span>{children}</span>;
    return (
      <a href={safeHref} target="_blank" rel="noreferrer" className="break-words text-blue-600 underline [overflow-wrap:anywhere]">
        {children}
      </a>
    );
  },
  table: ({ children }) => (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="break-words border border-gray-200 bg-gray-50 px-2 py-1 text-left font-medium [overflow-wrap:anywhere]">{children}</th>,
  td: ({ children }) => <td className="break-words border border-gray-200 px-2 py-1 [overflow-wrap:anywhere]">{children}</td>,
  hr: () => <hr className="border-gray-200" />,
};

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="min-w-0 max-w-full space-y-3 overflow-hidden">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
