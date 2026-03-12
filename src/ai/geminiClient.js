// Lightweight Gemini client scaffold.
// This module validates API key availability and returns mocked data for now.

import { getApiKey } from "./apiKeyManager";
import {
  GEMINI_API_BASE_URL,
  GEMINI_MODEL,
  DEFAULT_GENERATION_CONFIG,
} from "../config/aiConfig";

export async function callGemini(prompt, options = {}) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error(
      "Missing Gemini API key. Set VITE_GEMINI_KEY/REACT_APP_GEMINI_KEY or store one in localStorage as \"gemini_api_key\"."
    );
  }

  const mergedOptions = { ...DEFAULT_GENERATION_CONFIG, ...options };

  // Placeholder for the future request implementation:
  const url = `${GEMINI_API_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: mergedOptions,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${errorText}`);
  }

  const data = await response.json();

  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    "";

  return {
    ok: true,
    text,
    raw: data,
  };
}
