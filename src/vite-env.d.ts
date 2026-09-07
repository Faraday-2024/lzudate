/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_CLOUDBASE_ENV_ID?: string;
	readonly VITE_CLOUDBASE_REGION?: string;
	readonly VITE_CLOUDBASE_TIMEOUT_MS?: string;
	readonly VITE_GLM_FUNCTION_NAME?: string;
	readonly VITE_GLM_CHAT_MODEL?: string;
	readonly VITE_GLM_CHAT_FALLBACK_MODEL?: string;
	readonly VITE_GLM_HIGH_QUALITY_MODEL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
