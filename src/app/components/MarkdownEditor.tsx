import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  MDXEditor,
  type MDXEditorMethods,
  codeBlockPlugin,
  diffSourcePlugin,
  headingsPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
} from '@mdxeditor/editor';
import { MarkdownEditorToolbar } from './MarkdownEditorToolbar';
import { normalizeMarkdownEditorValue } from '../utils/markdownEditorValue';
import '@mdxeditor/editor/style.css';

interface MarkdownEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function MarkdownEditor({
  id,
  value,
  onChange,
  placeholder = 'Write notes in markdown...',
  autoFocus = false,
}: MarkdownEditorProps) {
  const editorRef = useRef<MDXEditorMethods>(null);
  const normalizedValue = useMemo(() => normalizeMarkdownEditorValue(value), [value]);
  const lastSyncedValueRef = useRef(normalizedValue);

  useEffect(() => {
    if (!editorRef.current) return;
    if (normalizedValue === lastSyncedValueRef.current) return;
    editorRef.current.setMarkdown(normalizedValue);
    lastSyncedValueRef.current = normalizedValue;
  }, [normalizedValue]);

  const handleChange = useCallback(
    (nextMarkdown: string) => {
      lastSyncedValueRef.current = nextMarkdown;
      onChange(nextMarkdown);
    },
    [onChange]
  );

  const plugins = useMemo(
    () => [
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      codeBlockPlugin(),
      tablePlugin(),
      thematicBreakPlugin(),
      markdownShortcutPlugin(),
      diffSourcePlugin({ viewMode: 'rich-text' }),
      toolbarPlugin({
        toolbarClassName: 'plumy-markdown-toolbar',
        toolbarContents: () => <MarkdownEditorToolbar />,
      }),
    ],
    []
  );

  return (
    <div id={id} className="plumy-markdown-editor overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <MDXEditor
        ref={editorRef}
        markdown={normalizedValue}
        onChange={handleChange}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className="plumy-markdown-editor-root"
        contentEditableClassName="plumy-markdown-editor-content"
        plugins={plugins}
      />
    </div>
  );
}
