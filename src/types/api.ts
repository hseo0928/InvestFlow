/**
 * API-related type definitions
 */

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public source?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export interface APIResponse<T> {
  data: T;
  success: boolean;
  error?: string;
  timestamp: string;
}

export interface APIConfig {
  TWELVEDATA_API_KEY: string;
  GEMINI_API_KEY: string;
  OPENROUTER_API_KEY: string;
  KIS_APP_KEY: string;
  KIS_APP_SECRET: string;
  BACKEND_URL: string;
}
