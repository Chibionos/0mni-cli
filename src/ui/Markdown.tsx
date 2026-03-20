import React from 'react';
import { Text } from 'ink';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';

marked.use(markedTerminal());

export interface MarkdownProps {
  text: string;
}

export function Markdown({ text }: MarkdownProps) {
  if (!text) {
    return null;
  }

  const rendered = marked.parse(text) as string;
  // Strip trailing newlines that marked adds
  const trimmed = rendered.replace(/\n+$/, '');

  return <Text>{trimmed}</Text>;
}
