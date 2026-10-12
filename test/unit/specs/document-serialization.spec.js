import documentSerializationSvc from '../../../src/services/documentSerializationSvc';

describe('document serialization', () => {
  it('round-trips Markdown and supported embedded metadata through its public interface', () => {
    const content = {
      id: 'serialized-note/content',
      type: 'content',
      text: '## Café 🖋️\n\nA Unicode note: αβγ.\n',
      properties: 'title: Café notes\ntags:\n  - journal\n',
      discussions: {
        thread: { start: 4, end: 10, author: 'Writer' },
      },
      comments: {
        reply: { discussionId: 'thread', text: 'Keep this annotation.' },
      },
      history: [{ text: 'Earlier version' }],
    };

    const markdown = documentSerializationSvc.serializeContent(content);
    const parsed = documentSerializationSvc.parseContent(markdown, content.id);

    expect(markdown).toContain(content.text);
    expect(parsed).toMatchObject({
      id: content.id,
      type: 'content',
      text: content.text,
      properties: content.properties,
      discussions: content.discussions,
      comments: content.comments,
      history: content.history,
    });
  });

  it('preserves prior metadata when Markdown has no embedded metadata', () => {
    const previousContent = {
      id: 'plain-note/content',
      type: 'content',
      text: 'Old body\n',
      properties: 'title: Saved title\n',
      discussions: { thread: { start: 0, end: 3 } },
      comments: { note: { discussionId: 'thread', text: 'Saved comment' } },
      history: [{ text: 'Older body' }],
    };

    const parsed = documentSerializationSvc.parseContent(
      'Updated body',
      previousContent.id,
      previousContent,
    );

    expect(parsed).toMatchObject({
      id: previousContent.id,
      text: 'Updated body\n',
      properties: previousContent.properties,
      discussions: previousContent.discussions,
      comments: previousContent.comments,
      history: previousContent.history,
    });
  });

  it('keeps readable Markdown when an embedded metadata trailer is malformed', () => {
    const malformedMarkdown = 'Readable body\n\n<!--stackedit_data:e2Jyb2tlbg==-->';

    const parsed = documentSerializationSvc.parseContent(
      malformedMarkdown,
      'malformed-note/content',
    );

    expect(parsed.text).toBe(`${malformedMarkdown}\n`);
    expect(parsed.properties).toBe('\n');
    expect(parsed.discussions).toEqual({});
    expect(parsed.comments).toEqual({});
  });
});
