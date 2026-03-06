import React from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownContentProps {
  content: string;
}

const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="text-xl font-semibold text-gray-900">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-semibold text-gray-900">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-semibold text-gray-900">{children}</h3>,
  h4: ({ children }) => <h4 className="text-sm font-semibold text-gray-900">{children}</h4>,
  h5: ({ children }) => <h5 className="text-sm font-semibold text-gray-900">{children}</h5>,
  h6: ({ children }) => <h6 className="text-sm font-semibold text-gray-900">{children}</h6>,
  p: ({ children }) => <p className="text-sm leading-relaxed text-gray-800">{children}</p>,
  ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children, className }) => {
    const isTaskItem = className?.includes('task-list-item');
    return (
      <li className={`text-sm text-gray-800 ${isTaskItem ? 'list-none pl-0' : ''}`.trim()}>
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
        className="mr-2 h-4 w-4 rounded border-gray-300 align-middle"
      />
    );
  },
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-gray-300 pl-3 text-sm text-gray-700">{children}</blockquote>
  ),
  code: ({ inline, className, children }) => {
    if (inline) {
      return (
        <code className="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono text-gray-800">
          {children}
        </code>
      );
    }
    return (
      <pre className="overflow-x-auto rounded-md bg-gray-100 p-3 text-xs text-gray-900">
        <code className={className}>{children}</code>
      </pre>
    );
  },
  a: ({ href, children }) => {
    const safeHref = href || '';
    const isSafe =
      safeHref.startsWith('http://') ||
      safeHref.startsWith('https://') ||
      safeHref.startsWith('mailto:');
    if (!isSafe) return <span>{children}</span>;
    return (
      <a href={safeHref} target="_blank" rel="noreferrer" className="text-blue-600 underline">
        {children}
      </a>
    );
  },
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-gray-200 bg-gray-50 px-2 py-1 text-left font-medium">{children}</th>,
  td: ({ children }) => <td className="border border-gray-200 px-2 py-1">{children}</td>,
  hr: () => <hr className="border-gray-200" />,
};

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="space-y-3">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
