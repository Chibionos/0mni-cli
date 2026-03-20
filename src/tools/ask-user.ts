import { tool } from 'ai';
import { z } from 'zod';

export const askUserTool = tool({
  description:
    'Ask the user a question when you need clarification, confirmation, or additional information ' +
    'to proceed. The TUI will display the question and wait for a response.',
  parameters: z.object({
    question: z.string().describe('The question to ask the user'),
  }),
  execute: async ({ question }) => {
    // The TUI layer intercepts this tool call and presents the question to the user.
    // The return value here acts as a fallback / signal.
    return question;
  },
});
