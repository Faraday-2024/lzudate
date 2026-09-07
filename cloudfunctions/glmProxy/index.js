const https = require('https');

const GLM_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4';

function requestGLM(path, apiKey, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request(
      `${GLM_BASE_URL}${path}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          Authorization: `Bearer ${apiKey}`
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const statusCode = res.statusCode || 500;
          if (statusCode < 200 || statusCode >= 300) {
            return reject(new Error(`GLM request failed with status ${statusCode}: ${data}`));
          }
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(new Error('Failed to parse GLM response JSON'));
          }
        });
      }
    );

    req.on('error', (err) => {
      reject(err);
    });

    req.write(body);
    req.end();
  });
}

exports.main = async (event) => {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: 'GLM_API_KEY is not configured in cloud function environment variables.'
    };
  }

  const action = event && event.action;
  try {
    if (action === 'chat') {
      const model = event.model || process.env.GLM_CHAT_MODEL || 'glm-4.6v-flashx';
      const messages = Array.isArray(event.messages) ? event.messages : [];
      if (messages.length === 0) {
        return { success: false, error: 'messages is required for chat action' };
      }

      const result = await requestGLM('/chat/completions', apiKey, {
        model,
        messages
      });

      const text =
        result && result.choices && result.choices[0] && result.choices[0].message
          ? result.choices[0].message.content || ''
          : '';

      return {
        success: true,
        text,
        raw: result
      };
    }

    if (action === 'embedding') {
      const model = event.model || 'embedding-3';
      const input = event.input || '';
      if (!input) {
        return { success: false, error: 'input is required for embedding action' };
      }

      const result = await requestGLM('/embeddings', apiKey, {
        model,
        input
      });

      const embedding =
        result && result.data && result.data[0] && Array.isArray(result.data[0].embedding)
          ? result.data[0].embedding
          : [];

      return {
        success: true,
        embedding,
        raw: result
      };
    }

    return {
      success: false,
      error: 'Unsupported action. Use "chat" or "embedding".'
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown cloud function error'
    };
  }
};
