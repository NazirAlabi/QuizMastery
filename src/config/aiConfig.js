// Centralized Gemini configuration values for future API integration.

export const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";
export const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export const DEFAULT_GENERATION_CONFIG = {
  temperature: 0.7,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 1024,
};
