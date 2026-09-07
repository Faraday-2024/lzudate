import { appInstance } from '../cloudbase';

export interface AIMessage {
  role: 'user' | 'model' | 'system';
  text: string;
}

interface ChatOptions {
  messages: AIMessage[];
  systemInstruction?: string;
  model?: string;
}

interface EmbeddingOptions {
  input: string;
  model?: string;
}

function normalizeRole(role: AIMessage['role']): 'user' | 'assistant' | 'system' {
  if (role === 'model') return 'assistant';
  return role;
}

async function callGLMFunction(action: 'chat' | 'embedding', payload: Record<string, unknown>) {
  const functionName = import.meta.env.VITE_GLM_FUNCTION_NAME || 'glmProxy';
  const response = await appInstance.callFunction({
    name: functionName,
    parse: true,
    data: {
      action,
      ...payload
    }
  });

  const result = response?.result;
  if (!result) {
    throw new Error('Cloud function returned empty result');
  }

  if (typeof result === 'string') {
    try {
      return JSON.parse(result);
    } catch {
      throw new Error(result || 'Cloud function returned invalid response');
    }
  }

  return result;
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

function isTimeoutError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('timed out') || m.includes('timeout') || m.includes('status 433');
}

export function toUserFriendlyAIError(error: unknown): string {
  const message = normalizeErrorMessage(error);
  const lower = message.toLowerCase();

  if (message.includes('余额不足') || lower.includes('status 429')) {
    return 'AI服务暂时不可用（额度或限流），请稍后重试。';
  }
  if (isTimeoutError(message)) {
    return 'AI响应超时（对话内容较长），请重试或缩短单条消息。';
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('unreachable')) {
    return '网络请求失败，请检查网络后重试。';
  }
  return 'AI暂时不可用，请稍后重试。';
}

export async function callAIChat(options: ChatOptions): Promise<string> {
  const defaultChatModel = import.meta.env.VITE_GLM_CHAT_MODEL || 'glm-4.6v-flashx';
  const { messages, systemInstruction, model = defaultChatModel } = options;

  const glmMessages = messages.map((message) => ({
    role: normalizeRole(message.role),
    content: message.text
  }));

  if (systemInstruction) {
    glmMessages.unshift({
      role: 'system',
      content: systemInstruction
    });
  }

  try {
    const result = await callGLMFunction('chat', {
      model,
      messages: glmMessages
    });

    if (!result.success) {
      throw new Error(result.error || 'AI chat failed');
    }

    return result.text || '';
  } catch (error) {
    const fallbackModel = import.meta.env.VITE_GLM_CHAT_FALLBACK_MODEL;
    const message = normalizeErrorMessage(error);

    if (fallbackModel && fallbackModel !== model && isTimeoutError(message)) {
      const fallbackResult = await callGLMFunction('chat', {
        model: fallbackModel,
        messages: glmMessages
      });

      if (!fallbackResult.success) {
        throw new Error(fallbackResult.error || 'AI chat failed');
      }

      return fallbackResult.text || '';
    }

    throw error;
  }
}

export async function callAIEmbedding(options: EmbeddingOptions): Promise<number[]> {
  const { input, model = 'embedding-3' } = options;
  const result = await callGLMFunction('embedding', {
    model,
    input
  });

  if (!result.success) {
    throw new Error(result.error || 'AI embedding failed');
  }

  return Array.isArray(result.embedding) ? result.embedding : [];
}