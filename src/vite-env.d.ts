/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_TWELVEDATA_API_KEY: string;
  readonly VITE_OPENROUTER_API_KEY: string;
  readonly VITE_BACKEND_URL: string;
  readonly VITE_FINANCIAL_JUICE_RSS: string;
  readonly VITE_SAVETICKER_API: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_DEFAULT_MARKET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}