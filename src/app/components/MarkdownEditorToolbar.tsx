import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CodeToggle,
  DiffSourceToggleWrapper,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  Separator,
  StrikeThroughSupSubToggles,
} from '@mdxeditor/editor';

export function MarkdownEditorToolbar() {
  return (
    <DiffSourceToggleWrapper options={['rich-text', 'source']}>
      <>
        <BlockTypeSelect />
        <Separator />
        <BoldItalicUnderlineToggles options={['Bold', 'Italic']} />
        <CodeToggle />
        <StrikeThroughSupSubToggles options={['Strikethrough']} />
        <Separator />
        <ListsToggle options={['bullet', 'number', 'check']} />
        <Separator />
        <InsertTable />
        <InsertThematicBreak />
      </>
    </DiffSourceToggleWrapper>
  );
}
