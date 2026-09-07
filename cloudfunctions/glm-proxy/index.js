'use strict';

const fetch = require('node-fetch');

/**
 * GLM AI Proxy Cloud Function
 *
 * Proxies requests to the GLM API so that the API key is never
 * exposed to the browser. The key is stored as a cloud-function
 * environment variable named GLM_API_KEY.
 *
 * Supported actions (set via event.action):
 *
 * 1. "chat" (default) — Chat Completions
 *    Payload: { messages: Array<{ role, content }>, model?: string }
 *    Returns: { content: string }
 *
 * 2. "embed" — Text Embeddings
 *    Payload: { input: string, model?: string }
 *    Returns: { embedding: number[] }
 */
exports.main = async (event) => {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) {
    return { error: 'GLM_API_KEY environment variable is not configured.' };
  }

  const { action = 'chat' } = event || {};

  if (action === 'embed') {
    // ── Embeddings ──────────────────────────────────────────────────────────
    const { input, model = 'embedding-3' } = event;
    if (!input || typeof input !== 'string' || input.trim() === '') {
      return { error: 'input string is required for embed action.' };
    }

    try {
      const response = await fetch('https://open.bigmodel.cn/api/paas/v4/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ model, input })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { error: `GLM Embeddings API error ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      const embedding = data.data?.[0]?.embedding;
      if (!embedding || !Array.isArray(embedding)) {
        console.error('Unexpected GLM Embeddings response:', JSON.stringify(data));
        return { error: 'GLM Embeddings API returned an unexpected response structure.' };
      }
      return { embedding };
    } catch (err) {
      return { error: `Embeddings request failed: ${err.message}` };
    }
  }

  // ── Chat Completions (default) ─────────────────────────────────────────────
  const { messages, model = 'glm-4.7' } = event || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { error: 'messages array is required for chat action.' };
  }

  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { error: `GLM Chat API error ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    return { content };
  } catch (err) {
    return { error: `Chat request failed: ${err.message}` };
  }
};
