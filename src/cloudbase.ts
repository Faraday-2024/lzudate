import cloudbase from '@cloudbase/js-sdk';

const app = cloudbase.init({
  env: import.meta.env.VITE_CLOUDBASE_ENV_ID || 'a123-4gxazzxl6f2c4fa7',
  // Chat with longer context can exceed the SDK default 15s timeout.
  timeout: Number(import.meta.env.VITE_CLOUDBASE_TIMEOUT_MS || 65000)
});

export const auth = app.auth({ persistence: 'local' });
export const db = app.database();
export const appInstance = app;
