import { appInstance } from '../cloudbase';

export interface GLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Calls the GLM AI API via the `glm-proxy` CloudBase cloud function.
 * The actual API key is stored server-side; it is never sent to the browser.
 *
 * @param messages - The conversation messages to send.
 * @param model    - The GLM model to use (default: 'glm-4.7').
 * @returns The assistant's reply text, or an empty string on failure.
 */
export async function callGLM(messages: GLMMessage[], model = 'glm-4.7'): Promise<string> {
  try {
    const result = await appInstance.callFunction({
      name: 'glm-proxy',
      data: { messages, model }
    });

    const res = result?.result as { content?: string; error?: string } | undefined;
    if (res?.error) {
      console.error('glm-proxy error:', res.error);
      return '';
    }
    return res?.content || '';
  } catch (err) {
    console.error('Failed to call glm-proxy cloud function:', err);
    return '';
  }
}
