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

  let rendered: string;
  try {
    rendered = marked.parse(text) as string;
  } catch {
    // If markdown parsing fails, render raw text
    return <Text>{text}</Text>;
  }
  // Strip trailing newlines that marked adds
  const trimmed = rendered.replace(/\n+$/, '');

  return <Text>{trimmed}</Text>;
}
