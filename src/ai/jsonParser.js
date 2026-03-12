// Resilient JSON parsing helpers for AI responses.
// Tries direct JSON first, then looks for JSON inside markdown code blocks.

function tryParseJson(candidate) {
  return JSON.parse(candidate);
}

function extractJsonFromMarkdown(text) {
  const blockRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match;

  while ((match = blockRegex.exec(text)) !== null) {
    const candidate = match[1].trim();

    if (!candidate) {
      continue;
    }

    try {
      return tryParseJson(candidate);
    } catch (error) {
      // Keep searching other blocks.
    }
  }

  return null;
}

export function safeParseJSON(text) {
  if (typeof text !== "string") {
    throw new Error("Expected a JSON string.");
  }

  try {
    return tryParseJson(text);
  } catch (error) {
    const extracted = extractJsonFromMarkdown(text);

    if (extracted !== null) {
      return extracted;
    }

    throw new Error("Unable to parse JSON from response text.");
  }
}
