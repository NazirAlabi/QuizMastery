import katex from 'katex';

export const applySafeLatexFixes = (text) => {
  if (typeof text !== 'string') return text;

  let fixed = text;
  fixed = fixed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  fixed = fixed.replace(/[\uFF3C\u2216\u29F5\u27CD\u27CE]/g, '\\');
  fixed = fixed.replace(/([a-zA-Z])\$\^([0-9]+)\$/g, (_, unit, power) => `$${unit}^${power}$`);
  fixed = fixed.replace(/\$\s*\$/g, '');
  fixed = fixed.replace(/\$\$\s+/g, '$$').replace(/\s+\$\$/g, '$$');
  fixed = fixed.replace(/\$\s+/g, '$').replace(/\s+\$/g, '$');

  return fixed;
};

export const hasUnbalancedDelimiters = (text) => {
  if (typeof text !== 'string') return false;

  let inMath = false;
  let inDisplayMath = false;
  let index = 0;

  while (index < text.length) {
    if (text.startsWith('$$', index)) {
      if (inDisplayMath) {
        inDisplayMath = false;
        index += 2;
      } else if (!inMath) {
        inDisplayMath = true;
        index += 2;
      } else {
        index += 1;
      }
    } else if (text[index] === '$' && !inDisplayMath) {
      inMath = !inMath;
      index += 1;
    } else {
      index += 1;
    }
  }

  return inMath || inDisplayMath;
};

export const extractLatexChunks = (text) => {
  if (typeof text !== 'string') return [];
  const regex = /\$\$[\s\S]+?\$\$|\$[^\$]+\$/g;
  return (text.match(regex) || []).map((chunk) => chunk.trim());
};

export const detectLatexHeuristics = (latex) => {
  const issues = [];
  const cleaned = String(latex || '').trim();

  const bareCommands = [
    'alpha', 'beta', 'gamma', 'delta', 'theta', 'lambda', 'mu',
    'pi', 'rho', 'sigma', 'phi', 'omega',
    'sin', 'cos', 'tan', 'log', 'ln',
    'frac', 'sqrt', 'sum', 'int', 'lim',
    'rightarrow', 'leftarrow', 'leftrightarrow',
  ];

  const regex = new RegExp(`(^|[^\\\\])\\b(${bareCommands.join('|')})\\b`, 'g');
  if (regex.test(cleaned)) {
    issues.push({
      type: 'missing_backslash',
      message: 'Possible missing \\ before LaTeX command.',
    });
  }

  const open = (cleaned.match(/{/g) || []).length;
  const close = (cleaned.match(/}/g) || []).length;
  if (open !== close) {
    issues.push({
      type: 'unbalanced_braces',
      message: 'Unbalanced { } braces.',
    });
  }

  const left = (cleaned.match(/\\left/g) || []).length;
  const right = (cleaned.match(/\\right/g) || []).length;
  if (left !== right) {
    issues.push({
      type: 'delimiter_mismatch',
      message: 'Mismatched \\left and \\right.',
    });
  }

  if (/(^|[^\\])[_^](?!\{?[A-Za-z0-9\\])/.test(cleaned)) {
    issues.push({
      type: 'broken_script',
      message: 'Suspicious subscript or superscript.',
    });
  }

  return issues;
};

export const validateLatex = (latex) => {
  try {
    katex.renderToString(latex, { throwOnError: true });
    return null;
  } catch (error) {
    return error.message;
  }
};

export const fixAllSafeLatexIssues = (questions) =>
  (Array.isArray(questions) ? questions : []).map((question) => {
    const fixField = (value) => {
      if (!value) return value;
      return applySafeLatexFixes(value);
    };

    const updated = {
      ...question,
      question_text: fixField(question.question_text),
      explanation: fixField(question.explanation),
    };

    if (question.metadata) {
      const metadata = { ...question.metadata };
      if (metadata.options) {
        metadata.options = metadata.options.map((option) => ({
          ...option,
          text: fixField(option.text),
        }));
      }
      if (metadata.accepted_answers) {
        metadata.accepted_answers = (metadata.accepted_answers || []).map((answer) => fixField(answer));
      }
      updated.metadata = metadata;
    }

    if (question.metadataJson) {
      try {
        const metadata = JSON.parse(question.metadataJson);
        if (metadata.options) {
          metadata.options = metadata.options.map((option) => ({
            ...option,
            text: fixField(option.text),
          }));
        }
        if (metadata.accepted_answers) {
          metadata.accepted_answers = (metadata.accepted_answers || []).map((answer) => fixField(answer));
        }
        updated.metadataJson = JSON.stringify(metadata, null, 2);
      } catch {
        // Preserve original JSON text when it is invalid.
      }
    }

    return updated;
  });
