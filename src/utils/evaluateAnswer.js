const normalizeAnswer = (value, metadata = {}) => {
  if (value == null) return '';

  let normalized = String(value);
  const {
    caseSensitive = false,
    ignoreWhitespace = false,
    stripLeadingEquals = false,
  } = metadata;

  if (stripLeadingEquals) {
    normalized = normalized.replace(/^=/, '');
  }

  if (ignoreWhitespace) {
    normalized = normalized.replace(/\s+/g, '');
  } else {
    normalized = normalized.trim();
  }

  if (!caseSensitive) {
    normalized = normalized.toLowerCase();
  }

  return normalized;
};

export const evaluateAnswer = (question, userAnswer) => {
  if (!question) return false;

  if (question.type === 'mcq') {
    return String(userAnswer ?? '') === String(question.metadata?.correctOption ?? '');
  }

  if (question.type === 'short_answer' || question.type === 'numeric') {
    const acceptedAnswers = question.metadata?.acceptedAnswers || [];
    const normalizedUserAnswer = normalizeAnswer(userAnswer, question.metadata);

    return acceptedAnswers.some((accepted) => {
      const normalizedAccepted = normalizeAnswer(accepted, question.metadata);
      return normalizedAccepted === normalizedUserAnswer;
    });
  }

  return false;
};

export const normalizeUserAnswer = normalizeAnswer;
