/**
 * Configuration validation and type-safe environment variables
 */

interface EnvironmentConfig {
  // API Keys
  geminiApiKey: string;
  openrouterApiKey: string;
  twelvedataApiKey: string;
  kisAppKey: string;
  kisAppSecret: string;
  
  // URLs
  backendUrl: string;
  financialJuiceRss: string;
  savetickerApi: string;
  
  // App Settings
  appName: string;
  defaultMarket: string;
  
  // Feature Flags
  isDevelopment: boolean;
  isProduction: boolean;
}

/**
 * Validate required environment variables
 */
function validateEnv(): void {
  const required = [
    'VITE_BACKEND_URL',
  ];
  
  const missing = required.filter(key => !import.meta.env[key]);
  
  if (missing.length > 0) {
    console.warn(
      `Missing environment variables: ${missing.join(', ')}\n` +
      'Some features may not work correctly. Please check .env.example for required variables.'
    );
  }
}

/**
 * Get typed environment configuration
 */
export function getEnvConfig(): EnvironmentConfig {
  validateEnv();
  
  return {
    // API Keys (optional - will use backend)
    geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
    openrouterApiKey: import.meta.env.VITE_OPENROUTER_API_KEY || '',
    twelvedataApiKey: import.meta.env.VITE_TWELVEDATA_API_KEY || '',
    kisAppKey: import.meta.env.VITE_KIS_APP_KEY || '',
    kisAppSecret: import.meta.env.VITE_KIS_APP_SECRET || '',
    
    // URLs
    backendUrl: import.meta.env.VITE_BACKEND_URL || 'http://localhost:5002',
    financialJuiceRss: import.meta.env.VITE_FINANCIAL_JUICE_RSS || '',
    savetickerApi: import.meta.env.VITE_SAVETICKER_API || '',
    
    // App Settings
    appName: import.meta.env.VITE_APP_NAME || 'AI Stock Insights',
    defaultMarket: import.meta.env.VITE_DEFAULT_MARKET || 'US',
    
    // Environment
    isDevelopment: import.meta.env.DEV,
    isProduction: import.meta.env.PROD,
  };
}

// Export singleton config
export const env = getEnvConfig();

// Log configuration in development
if (env.isDevelopment) {
  console.log('Environment Configuration:', {
    backendUrl: env.backendUrl,
    appName: env.appName,
    hasGeminiKey: !!env.geminiApiKey,
    hasOpenrouterKey: !!env.openrouterApiKey,
    hasTwelvedataKey: !!env.twelvedataApiKey,
    hasKisKeys: !!env.kisAppKey && !!env.kisAppSecret,
  });
}
