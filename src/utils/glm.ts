import { appInstance } from '../cloudbase';

export interface GLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Calls the GLM Chat Completions API via the `glm-proxy` CloudBase cloud
 * function. The actual API key is stored server-side and never sent to the
 * browser.
 *
 * @param messages - The conversation messages to send.
 * @param model    - The GLM model to use (default: 'glm-4.7').
 * @returns The assistant's reply text, or an empty string on failure.
 */
export async function callGLM(messages: GLMMessage[], model = 'glm-4.7'): Promise<string> {
  try {
    const result = await appInstance.callFunction({
      name: 'glm-proxy',
      data: { action: 'chat', messages, model }
    });

    const res = result?.result as { content?: string; error?: string } | undefined;
    if (res?.error) {
      console.error('glm-proxy chat error:', res.error);
      return '';
    }
    return res?.content || '';
  } catch (err) {
    console.error('Failed to call glm-proxy (chat):', err);
    return '';
  }
}

/**
 * Converts an array of internal `{ role, text }` Message objects (as used in
 * chat components) into the `GLMMessage[]` format expected by `callGLM`.
 *
 * @param msgs             - The component-level message array.
 * @param systemInstruction - Optional system instruction prepended as the
 *                           first message.
 */
export function buildGLMMessages(
  msgs: Array<{ role: 'user' | 'model'; text: string }>,
  systemInstruction?: string
): GLMMessage[] {
  const result: GLMMessage[] = [];
  if (systemInstruction) result.push({ role: 'system', content: systemInstruction });
  msgs.forEach(m => result.push({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text }));
  return result;
}

/**
 * Generates a text embedding via the `glm-proxy` CloudBase cloud function.
 * The actual API key is stored server-side and never sent to the browser.
 *
 * @param input - The text to embed.
 * @param model - The embedding model to use (default: 'embedding-3').
 * @returns The embedding vector, or an empty array on failure.
 */
export async function generateEmbedding(input: string, model = 'embedding-3'): Promise<number[]> {
  try {
    const result = await appInstance.callFunction({
      name: 'glm-proxy',
      data: { action: 'embed', input, model }
    });

    const res = result?.result as { embedding?: number[]; error?: string } | undefined;
    if (res?.error) {
      console.error('glm-proxy embed error:', res.error);
      return [];
    }
    return res?.embedding || [];
  } catch (err) {
    console.error('Failed to call glm-proxy (embed):', err);
    return [];
  }
}
