const normalizeAnswer = (value, metadata = {}) => {
  if (value == null) return '';

  let normalized = String(value);
  const {
    caseSensitive = false,
    case_sensitive = caseSensitive,
    ignoreWhitespace = false,
    ignore_whitespace = ignoreWhitespace,
    stripLeadingEquals = false,
  } = metadata;

  if (stripLeadingEquals) {
    normalized = normalized.replace(/^=/, '');
  }

  if (ignore_whitespace) {
    normalized = normalized.replace(/\s+/g, '');
  } else {
    normalized = normalized.trim();
  }

  if (!case_sensitive) {
    normalized = normalized.toLowerCase();
  }

  return normalized;
};

const getQuestionType = (question) => String(question?.type || '').toLowerCase();

export const isQuestionAutoGraded = (question) => {
  const type = getQuestionType(question);
  return ['mcq', 'short_answer', 'numeric'].includes(type);
};

export const evaluateAnswer = (question, userAnswer) => {
  if (!question) return false;
  const metadata = question.metadata || {};
  const type = getQuestionType(question);

  if (type === 'mcq') {
    const correctAnswer = metadata.correct_answer ?? metadata.correctOption ?? '';
    return String(userAnswer ?? '') === String(correctAnswer);
  }

  if (type === 'short_answer') {
    const acceptedAnswers = metadata.accepted_answers || metadata.acceptedAnswers || [];
    const normalizedUserAnswer = normalizeAnswer(userAnswer, question.metadata);

    return acceptedAnswers.some((accepted) => {
      const normalizedAccepted = normalizeAnswer(accepted, question.metadata);
      return normalizedAccepted === normalizedUserAnswer;
    });
  }

  if (type === 'numeric') {
    const expected = Number(metadata.numeric_answer ?? metadata.numericAnswer);
    const submitted = Number(userAnswer);
    const tolerance = Number(metadata.tolerance ?? 0);

    if (!Number.isFinite(expected) || !Number.isFinite(submitted)) {
      return false;
    }

    if (Number.isFinite(tolerance) && tolerance >= 0) {
      return Math.abs(submitted - expected) <= tolerance;
    }

    return submitted === expected;
  }

  if (type === 'long_answer') {
    // Long answers require manual grading.
    return null;
  }

  return false;
};

export const normalizeUserAnswer = normalizeAnswer;
