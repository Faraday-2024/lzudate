'use strict';

const fetch = require('node-fetch');

/**
 * GLM AI Proxy Cloud Function
 *
 * Proxies requests to the GLM API so that the API key is never
 * exposed to the browser. The key is stored as a cloud-function
 * environment variable named GLM_API_KEY.
 *
 * Expected event payload:
 * {
 *   messages: Array<{ role: 'user' | 'assistant' | 'system', content: string }>,
 *   model?: string   // defaults to 'glm-4.7'
 * }
 */
exports.main = async (event) => {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) {
    return { error: 'GLM_API_KEY environment variable is not configured.' };
  }

  const { messages, model = 'glm-4.7' } = event || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { error: 'messages array is required.' };
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
      return { error: `GLM API error ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    return { content };
  } catch (err) {
    return { error: `Request failed: ${err.message}` };
  }
};
