import { tool } from 'ai';
import { z } from 'zod';

export const webSearchTool = tool({
  description:
    'Search the web for information. Note: this tool requires external API configuration to function.',
  parameters: z.object({
    query: z.string().describe('The search query'),
  }),
  execute: async ({ query }) => {
    return (
      `Web search is not yet configured. To enable web search, configure a search API provider ` +
      `in your 0mni settings.\n\nQuery received: "${query}"`
    );
  },
});
