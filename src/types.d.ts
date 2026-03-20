declare module 'marked-terminal' {
  import type { MarkedExtension } from 'marked';

  export interface TerminalRendererOptions {
    code?: (code: string, lang?: string) => string;
    blockquote?: (text: string) => string;
    html?: (html: string) => string;
    heading?: (text: string, level: number) => string;
    firstHeading?: (text: string, level: number) => string;
    hr?: () => string;
    listitem?: (text: string) => string;
    table?: (header: string, body: string) => string;
    paragraph?: (text: string) => string;
    strong?: (text: string) => string;
    em?: (text: string) => string;
    codespan?: (text: string) => string;
    del?: (text: string) => string;
    link?: (href: string, title: string, text: string) => string;
    image?: (href: string, title: string, text: string) => string;
    reflowText?: boolean;
    showSectionPrefix?: boolean;
    width?: number;
    unescape?: boolean;
    emoji?: boolean;
    tab?: number | string;
  }

  export default class Renderer {
    constructor(options?: TerminalRendererOptions, highlightOptions?: unknown);
  }

  export function markedTerminal(
    options?: TerminalRendererOptions,
    highlightOptions?: unknown,
  ): MarkedExtension;
}
