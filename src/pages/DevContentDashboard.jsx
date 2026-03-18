import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Navigate } from 'react-router-dom';
import { Archive, ArchiveRestore, Loader2, Plus, Trash2, Upload, ChevronDown, Copy, CheckCircle2, Search, AlertTriangle } from 'lucide-react';
import Navbar from '@/components/layout/Navbar.jsx';
import SettingsModal from '@/components/layout/SettingsModal.jsx';
import DataStatusOverlay from '@/components/layout/DataStatusOverlay.jsx';
import QuestionCard from '@/components/quiz/QuestionCard';
import { useAuth } from '@/hooks/useAuth.js';
import { useToast } from '@/components/ui/use-toast.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import {
  addQuestionsToQuiz,
  archiveAdminCourse,
  archiveAdminQuestion,
  archiveAdminQuiz,
  createAdminCourse,
  createAdminQuestion,
  createAdminQuiz,
  createQuizFromQuestionUpload,
  getAdminContentSnapshot,
  getDeleteImpact,
  hardDeleteCourse,
  hardDeleteQuestion,
  hardDeleteQuiz,
  removeDuplicateAdminContent,
  removeQuestionFromQuiz,
  updateAdminCourse,
  updateAdminQuestion,
  updateAdminQuiz,
} from '@/api/api.js';
import {
  applySafeLatexFixes,
  detectLatexHeuristics,
  extractLatexChunks,
  fixAllSafeLatexIssues,
  hasUnbalancedDelimiters,
  validateLatex,
} from '@/utils/latexDiagnostics.js';
import { measureAsync } from '@/utils/performance.js';
import { useQueryClient } from '@tanstack/react-query';
import { getUserFriendlyErrorMessage, isConnectionRelatedError } from '@/utils/errorHandling.js';

const COURSE_DEFAULTS = {
  title: '',
  shortDescription: '',
  longDescription: '',
  topic: '',
  courseCode: '',
  quizIds: '',
  isArchived: false,
};

const QUIZ_DEFAULTS = {
  title: '',
  shortDescription: '',
  longDescription: '',
  topic: '',
  difficulty: 2,
  estimatedTime: 15,
  isTimePerQuestion: false,
  questionIds: '',
  isArchived: false,
  courseIds: '',
};

const QUIZ_DIFFICULTY_LABELS = {
  1: 'beginner',
  2: 'intermediate',
  3: 'advanced',
};

const QUESTION_DEFAULTS = {
  type: 'mcq',
  question_text: '',
  metadataJson: '{\n  "options": [\n    { "id": "A", "text": "" },\n    { "id": "B", "text": "" }\n  ],\n  "correct_answer": "A"\n}',
  difficulty: 2,
  topic: '',
  skillCategory: 2,
  explanation: '',
  isArchived: false,
};

const EXPECTED_SCHEMA_TEXT = `{"questions": [
  {
    "type": "mcq",
    "question_text": "What is the time complexity of binary search?",
    "metadata": {
      "options": [
        { "id": "A", "text": "O(n)" },
        { "id": "B", "text": "O(log n)" },
        { "id": "C", "text": "O(n log n)" },
        { "id": "D", "text": "O(1)" }
      ],
      "correct_answer": "B"
    },
    "difficulty": 1,
    "topic": "Algorithms",
    "skillCategory": 2,
    "explanation": "Binary search halves the search space each iteration."
  }
]}

for mcq
"type": "mcq",
"metadata": {
  "options": [{ "id": "A", "text": "..." }],
  "correct_answer": "A"
}

for short answer
"type": "short_answer",
"metadata": {
  "accepted_answers": ["stack", "a stack"],
  "case_sensitive": false,
  "ignore_whitespace": true
}

for numeric
"type": "numeric",
"metadata": {
  "numeric_answer": 3.14,
  "tolerance": 0.01
}

for long answer
"type": "long_answer",
"metadata": {}
`;

const AQUS_SCHEMA_TEXT = `{
    "title" : "Title of the quiz",
    "estimatedTime" : integer,
    "questions" : {"questions": [
  {
    "type": "mcq",
    "question_text": "What is the time complexity of binary search?",
    "metadata": {
      "options": [
        { "id": "A", "text": "O(n)" },
        { "id": "B", "text": "O(log n)" },
        { "id": "C", "text": "O(n log n)" },
        { "id": "D", "text": "O(1)" }
      ],
      "correct_answer": "B"
    },
    "difficulty": 1,
    "topic": "Algorithms",
    "skillCategory": 2,
    "explanation": "Binary search halves the search space each iteration."
  }
]}

for mcq
"type": "mcq",
"metadata": {
  "options": [{ "id": "A", "text": "..." }],
  "correct_answer": "A"
}

for short answer
"type": "short_answer",
"metadata": {
  "accepted_answers": ["stack", "a stack"],
  "case_sensitive": false,
  "ignore_whitespace": true
}

for numeric
"type": "numeric",
"metadata": {
  "numeric_answer": 3.14,
  "tolerance": 0.01
}

for long answer
"type": "long_answer",
"metadata": {}`;

const QUIZ_GENERATION_PROMPT_TEMPLATE = `Generate a quiz question set based on the following quiz description:

[INSERT QUIZ DESCRIPTION HERE]

Return only one valid JSON object with this structure:

{
  "title": "string",
  "estimatedTime": 12,
  "questions": [
    {
      "type": "mcq | short_answer | numeric",
      "question_text": "string",
      "metadata": {},
      "difficulty": 1,
      "topic": "concise topic identifier",
      "skillCategory": 1,
      "explanation": "brief explanation"
    }
  ]
}

Do not include any extra text, markdown, or code fences. No additional keys are allowed anywhere in the output.

INTERNAL TASK
1) Create the full quiz first.
2) Then estimate the completion time in whole minutes at a reasonably quick but attentive pace, based on question count, type mix, and difficulty.

QUESTION COUNT
Generate between a few less or more of the estimated questions if given otherwise, generate exactly 10 questions.

TITLE
- The title must be concise and descriptive.
- If the quiz description includes a Topic: line, derive the title from it.
- Otherwise create a short title from the description.

COVERAGE
- Cover all focus topics explicitly stated in the quiz description.
- Do not omit any stated topic.
- Use each question’s topic field as a concise 1–2 word identifier that clearly maps to one focus topic.
- Do not invent unrelated topics.

QUESTION TYPES
- Use MCQ and numeric as the primary types.
- Use short_answer sparingly, only when the expected answer is short and unambiguous (1–2 words).

METADATA FORMATS

MCQ:
{
  "options": [
    { "id": "A", "text": "option text" },
    { "id": "B", "text": "option text" },
    { "id": "C", "text": "option text" },
    { "id": "D", "text": "option text" }
  ],
  "correct_answer": "A"
}

Rules:
- Exactly 4 options in order A, B, C, D
- Exactly one correct answer
- Distractors must be plausible

Short answer:
{
  "accepted_answers": ["answer1", "alternate phrasing"],
  "case_sensitive": false,
  "ignore_whitespace": true
}

Numeric:
{
  "numeric_answer": 123.45,
  "tolerance": 0.01
}

Rules:
- numeric_answer must be a number
- Include tolerance when approximation is acceptable
- Make tolerance 0 when required

LATEX
- Use $...$ for inline math and $$...$$ for display math
- Escape all backslashes as \\ in JSON

DIFFICULTY
- 1 = basic recall or direct calculation
- 2 = conceptual understanding or multi-step reasoning
- 3 = complex analysis or problem-solving

SKILL CATEGORY
- 1 = Recall
- 2 = Conceptual
- 3 = Application

Use values consistent with the question’s cognitive demand.

ORDERING
- Prefer generally increasing difficulty, but not required

QUALITY
- Questions must be original, clear, and factually correct
- Explanations must clearly justify the correct answer
- All questions must be distinct

ESTIMATED TIME
- Whole number of minutes
- Realistic lower-end estimate based on quiz complexity

FINAL CHECK
- Valid JSON (no trailing commas)
- Exactly [estimated_questions] questions
- All focus topics covered
- Short answers used minimally
- MCQs properly structured
- Numeric tolerance appropriate
- Difficulty and skillCategory consistent
- Topic labels concise and aligned
- LaTeX properly escaped
- Title is concise
- estimatedTime is reasonable

Now generate the quiz JSON object.`;

const QUIZ_VARIATION_GENERATION_PROMPT_TEMPLATE = `You are an expert educator and curriculum designer. Your task is to generate a new set of quiz questions in JSON format based on a provided sample question set and a target overall difficulty level.

INPUT:
- A JSON object containing:
  - "questions": an array of sample questions
- Each question includes:
  "type", "question_text", "metadata", "difficulty" (1–3), "topic", "skillCategory" (1–3), "explanation"
- The current overall difficulty of the given set: "beginner", "intermediate", or "advanced"
- A target overall difficulty: "beginner", "intermediate", or "advanced"

IF TARGET DIFFICULTY AND CURRENT DIFFICULTY ARE THE SAME, IGNORE THE REST OF THE PROMPT AND RETURN AN EMPTY LIST!!!

OUTPUT:
Return only one valid JSON object:
{
  "questions": [ ... ]
}

Do not include any extra text or markdown. Do not add or remove fields. Each question must contain exactly:
"type", "question_text", "metadata", "difficulty", "topic", "skillCategory", "explanation"

---

TOPIC RULES
- Extract the set of unique topics strictly from the sample’s "topic" field.
- Every generated question’s "topic" must exactly match one of these topics.
- Every topic must appear at least once.
- Do not create or infer new topics.

---

QUESTION COUNT
Let N = number of sample questions.

- If target difficulty is "easy": generate exactly N questions
- If "intermediate": generate N to N+1 questions
- If "advanced": generate N+1 to N+2 questions

---

DIFFICULTY (CORE LOGIC)
- Use BOTH:
  1) the provided sample "overallDifficulty"
  2) the per-question difficulty values

- Determine the relative shift:
  easy < intermediate < advanced

- Apply transformation:
  - If target = sample → keep similar distribution
  - If target is one level higher → shift most questions up by ~1 level (cap at 3)
  - If target is one level lower → shift most questions down by ~1 level (floor at 1)
  - If target differs by two levels → shift aggressively toward target

- Preserve relative structure where possible (e.g., harder questions remain relatively harder than others)

- Difficulty scale:
  1 = basic recall / direct application  
  2 = conceptual / multi-step reasoning  
  3 = complex analysis / synthesis  

---

SKILL CATEGORY (INDEPENDENT)
- 1 = Recall
- 2 = Conceptual
- 3 = Application

Rules:
- Assign skillCategory independently from difficulty
- Do not enforce fixed mappings
- Maintain variety in pairings where educationally valid
- Ensure assignments still make sense for the question

---

QUESTION TYPES

Primary:
- mcq
- numeric

Secondary:
- short_answer

Constraint:
- short_answer ≤ 20% of total questions

---

METADATA FORMATS

MCQ:
{
  "options": [
    { "id": "A", "text": "..." },
    { "id": "B", "text": "..." },
    { "id": "C", "text": "..." },
    { "id": "D", "text": "..." }
  ],
  "correct_answer": "A"
}

Rules:
- Exactly 4 options in order A–D
- Exactly one correct answer
- Distractors must be plausible

Short Answer:
{
  "accepted_answers": ["answer1", "answer2"],
  "case_sensitive": false,
  "ignore_whitespace": true
}

Numeric:
{
  "numeric_answer": 123.45,
  "tolerance": 0.01
}

- Include tolerance when appropriate
- Omit only if exact answer is required

---

LATEX
- Use $...$ or $$...$$ where appropriate
- Escape backslashes as \\

---

ORIGINALITY
- Questions must be mostly original
- At most 10% may be light paraphrases of sample questions
- The rest must test the same concepts in new ways

---

QUALITY
- Questions must be clear, accurate, and educationally sound
- Explanations must clearly justify the correct answer
- All questions must be distinct

---

FINAL CHECK
Ensure before output:
- Valid JSON (no trailing commas)
- Correct number of questions
- All sample topics covered
- No new topics introduced
- short_answer within limit
- MCQs properly structured
- Numeric answers reasonable
- Difficulty appropriately shifted relative to input overallDifficulty
- SkillCategory varied and sensible
- Explanations accurate

---

Now generate the new question set with this input:

INPUT: Current Set = [INSERT SAMPLE QUESTION SET]
      Current Difficulty = [CURRENT DIFFICULTY]
      Target Difficulty = [TARGET DIFFICULTY]`;

const QUIZ_DESCRIPTION_PROMPT_TEMPLATE = `Role
You are an expert instructional designer and educational researcher specializing in cognitive load theory and curriculum development.

Task
Given the provided learning material (e.g., slides, notes, or text), analyze the content and generate a structured, multi-tier quiz blueprint that optimizes for learning, retention, and conceptual transfer.

Autonomy Requirement (CRITICAL)

Do NOT ask clarifying questions.

Infer all structure directly from the material.

If ambiguity exists, make the most pedagogically reasonable assumption.

If the material is incomplete, still produce the best possible structured output.

Design Framework
Step 1 - Extract Conceptual Zones

Identify 5-8 distinct conceptual zones from the material.

Each zone must:

Represent a coherent chunk of knowledge

Be mutually distinct (minimal overlap)

Be collectively exhaustive (cover the material)

Tier 1 - Fundamentals (Decomposition)

Create 1 quiz per conceptual zone

Each quiz must:

Cover 1-2 tightly related subtopics

Focus on core definitions, mechanisms, or principles

Include 6-8 questions (recommended)

Tier 2 - Integration (Connection)

Create 2-3 quizzes total

Each quiz must:

Combine 2-3 conceptual zones

Emphasize:

Relationships between concepts

Multi-step reasoning

Application scenarios

Tier 3 - Capstone (Synthesis)

Create 1 comprehensive quiz

Must:

Cover the entire material

Emphasize deep understanding and transfer

Constraints

Maximum 3 major concepts per quiz

Avoid vague or generic topic names (e.g., "Overview", "Miscellaneous")

Focus topics must be:

Specific

Testable

Derived from the material (not invented externally)

Output Format (STRICT - DO NOT DEVIATE)
subject_name: "<inferred subject name>"

conceptual_zones:
  - "<zone name>"
  - "<zone name>"

tier_1_quizzes:
  - quiz_name: "<name>"
    zone: "<corresponding conceptual zone>"
    focus_topics: ["<specific subtopic>", "<specific subtopic>"]
    estimated_questions: 6-8

tier_2_quizzes:
  - quiz_name: "<name>"
    integrated_zones: ["<zone>", "<zone>"]
    focus_topics: ["<applied or integrative task>", "<...>"]

tier_3_capstone:
  quiz_name: "<name>"
  scope: "Comprehensive"
  focus: ["<synthesis area>", "<...>"]
Behavior Rules

Do NOT generate actual questions.

Do NOT paraphrase the material - extract structure from it.

Ensure:

Every Tier 1 quiz maps to exactly one conceptual zone

Every Tier 2 quiz explicitly combines zones listed above

Keep naming:

Clear

Consistent

Instructionally meaningful`;

const BULK_UPLOAD_TEMPLATE = '{\n  "questions": []\n}';

const BULK_DEFAULTS = {
  selectedQuizId: '',
  title: '',
  shortDescription: '',
  longDescription: '',
  topic: '',
  difficulty: 2,
  estimatedTime: 15,
  isTimePerQuestion: false,
  courseIds: '',
  uploadText: BULK_UPLOAD_TEMPLATE,
};
const BULK_QUESTION_DEFAULTS = {
  uploadText: BULK_UPLOAD_TEMPLATE,
};

const QUIZ_SHORT_DESC_EXAMPLE = 'Deep dive into Big O notation, time complexity, and algorithm optimization techniques in this quiz';
const QUIZ_LONG_DESC_EXAMPLE =
  'Test your mastery of Python fundamentals through a series of real-world logic puzzles and syntax challenges. This quiz measures your readiness for advanced development projects and technical interviews.';
const COURSE_SHORT_DESC_EXAMPLE =
  'Master the high-stakes art of constructive feedback with a repeatable 4-step framework designed to turn difficult conversations into collaborative growth plans. Bridge the gap between performance and professional relationships by transforming vague "criticism" into a strategic roadmap for success. Built specifically for new managers and team leads, this is your blueprint for driving elite results without damaging trust.';
const COURSE_LONG_DESC_EXAMPLE =
  'Navigate the high-stakes landscape of the global energy transition—from the mechanical heart of solar and wind to the complex political machinery of decarbonization. Deconstruct the technical foundations of energy storage while tackling the structural puzzles of grid integration and market design. Move beyond pure engineering to analyze the socioeconomic forces and environmental regulations shaping our world. Emerge with the power to model energy outputs, evaluate massive infrastructure projects, and architect the data-driven policies required to secure a sustainable future.';

const QUIZ_DIFFICULTY_OPTIONS = [
  { value: 1, label: 'Beginner' },
  { value: 2, label: 'Intermediate' },
  { value: 3, label: 'Advanced' },
];

const SKILL_CATEGORY_OPTIONS = [
  { value: 1, label: 'Recall' },
  { value: 2, label: 'Conceptual' },
  { value: 3, label: 'Application' },
];


const parseCsvIds = (value) =>
  String(value || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
const uniqueStringIds = (items) =>
  Array.from(
    new Set(
      (Array.isArray(items) ? items : [])
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )
  );

const prettyJson = (value) => JSON.stringify(value || {}, null, 2);

const compareAlphabetically = (a, b) =>
  String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base' });

const truncateText = (value, maxLength = 56) => {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
};

const formatQuestionLabel = (question, maxLength = 72) =>
  `${question?.topic || 'General'} - ${truncateText(question?.question_text || '', maxLength)}`;

const normalizeQuestionUploadPayload = (payload) => {
  const candidate = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.questions)
      ? payload.questions
      : null;

  if (!candidate) {
    throw new Error('Uploaded JSON must be an array or an object with a "questions" array');
  }

  if (candidate.length === 0) {
    throw new Error('Uploaded questions array is empty');
  }

  return candidate;
};
const toQuestionUploadEntry = (question) => ({
  type: String(question?.type || 'mcq'),
  question_text: String(question?.question_text || ''),
  metadata: question?.metadata && typeof question.metadata === 'object' ? question.metadata : {},
  difficulty: Number(question?.difficulty) || 2,
  topic: String(question?.topic || ''),
  skillCategory: Number(question?.skillCategory) || 2,
  explanation: String(question?.explanation || ''),
});

function flattenQuestion(apiQuestion) {
  // Map numeric difficulty to string labels
  const difficultyMap = {
    1: 'easy',
    2: 'medium',
    3: 'hard'
  };

  // Base properties common to all question types
  const base = {
    id: apiQuestion.id,                     // optional but useful for keys
    type: apiQuestion.type,
    text: apiQuestion.question_text,         // rename from question_text to text
    difficulty: difficultyMap[apiQuestion.difficulty] || 'medium',
    topic: apiQuestion.topic || '',
    explanation: apiQuestion.explanation,
  };

  // If no metadata, just return the base object
  if (!apiQuestion.metadata || typeof apiQuestion.metadata !== 'object') {
    return base;
  }

  const metadata = apiQuestion.metadata;

  // Add type‑specific fields from metadata
  switch (apiQuestion.type) {
    case 'mcq':
      return {
        ...base,
        options: Array.isArray(metadata.options) ? metadata.options : [],
        correctAnswer: metadata.correct_answer || '',
      };

    case 'short_answer':
      return {
        ...base,
        acceptedAnswers: Array.isArray(metadata.accepted_answers) ? metadata.accepted_answers : [],
      };

    case 'numeric':
      return {
        ...base,
        numericAnswer: metadata.numeric_answer,
        tolerance: metadata.tolerance,
      };

    default:
      // For long_answer or any other type, just return base
      return base;
  }
}

const DEDUPE_IDLE_MESSAGE = 'Ready to scan for strict semantic duplicates.';
const DASHBOARD_SELECT_PAGE_SIZE = 50;

const DevContentDashboard = () => {
  const { isDevFeaturesEnabled } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [contentLoadError, setContentLoadError] = useState(null);
  const [showRefreshPrompt, setShowRefreshPrompt] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeduping, setIsDeduping] = useState(false);
  const [schema, setSchema] = useState(false);
  const [courses, setCourses] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [selectedQuestionId, setSelectedQuestionId] = useState('');
  const [displayQuestions, setDisplayQuestions] = useState([]);
  const [editDisplayedQuestions, setEditDisplayedQuestions] = useState(false);
  const [latexScanProgress, setLatexScanProgress] = useState(0);
  const [latexScanStatus, setLatexScanStatus] = useState('');
  const [latexScanLogs, setLatexScanLogs] = useState([]);
  const [latexErrorQuestions, setLatexErrorQuestions] = useState([]);
  const [editingQuestions, setEditingQuestions] = useState({});   
  const [courseForm, setCourseForm] = useState(COURSE_DEFAULTS);
  const [quizForm, setQuizForm] = useState(QUIZ_DEFAULTS);
  const [questionForm, setQuestionForm] = useState(QUESTION_DEFAULTS);
  const [bulkForm, setBulkForm] = useState(BULK_DEFAULTS);
  const [bulkQuestionForm, setBulkQuestionForm] = useState(BULK_QUESTION_DEFAULTS);
  const [questionToAddId, setQuestionToAddId] = useState('');
  const [quizToAddToCourseId, setQuizToAddToCourseId] = useState('');
  const [quizCourseToAddId, setQuizCourseToAddId] = useState('');
  const [bulkCourseToAddId, setBulkCourseToAddId] = useState('');
  const [quizLinkedCourseIds, setQuizLinkedCourseIds] = useState([]);
  const [bulkLinkedCourseIds, setBulkLinkedCourseIds] = useState([]);
  const [bulkUploadMode, setBulkUploadMode] = useState('manual');
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [promptInput, setPromptInput] = useState('');
  const [originalDifficulty, setOriginalDifficulty] = useState('intermediate');
  const [dedupeProgress, setDedupeProgress] = useState(0);
  const [dedupeStatus, setDedupeStatus] = useState(DEDUPE_IDLE_MESSAGE);
  const [dedupeLogs, setDedupeLogs] = useState([DEDUPE_IDLE_MESSAGE]);
  const [visibleCourseCount, setVisibleCourseCount] = useState(DASHBOARD_SELECT_PAGE_SIZE);
  const [visibleQuizCount, setVisibleQuizCount] = useState(DASHBOARD_SELECT_PAGE_SIZE);
  const [visibleQuestionCount, setVisibleQuestionCount] = useState(DASHBOARD_SELECT_PAGE_SIZE);
  const [savingAction, setSavingAction] = useState({ key: '', label: '', progress: 0 });
  const [aiStatus, setAiStatus] = useState({
    quizShort: false,
    quizLong: false,
    courseShort: false,
    courseLong: false,
  });
  const [showVariationPromptOptions, setShowVariationPromptOptions] = useState(false);
  const [targetVariationDifficulty, setTargetVariationDifficulty] = useState(2);

  // Delete Manager state
  const [deleteManagerType, setDeleteManagerType] = useState('course');
  const [deleteManagerSearch, setDeleteManagerSearch] = useState('');
  const [itemToDelete, setItemToDelete] = useState(null);
  const [multipleItemsToDelete, setMultipleItemsToDelete] = useState([]);
  const [selectedDeleteIds, setSelectedDeleteIds] = useState(new Set());
  const [deleteImpact, setDeleteImpact] = useState(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) || null,
    [courses, selectedCourseId]
  );
  const selectedQuiz = useMemo(
    () => quizzes.find((quiz) => quiz.id === selectedQuizId) || null,
    [quizzes, selectedQuizId]
  );
  const selectedQuestion = useMemo(
    () => questions.find((question) => question.id === selectedQuestionId) || null,
    [questions, selectedQuestionId]
  );
  const selectedBulkQuiz = useMemo(
    () => quizzes.find((quiz) => quiz.id === bulkForm.selectedQuizId) || null,
    [quizzes, bulkForm.selectedQuizId]
  );
  const questionById = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions]
  );
  const quizById = useMemo(
    () => new Map(quizzes.map((quiz) => [quiz.id, quiz])),
    [quizzes]
  );
  const sortedCourses = useMemo(
    () =>
      [...courses].sort((a, b) =>
        compareAlphabetically(a?.title || a?.courseCode || '', b?.title || b?.courseCode || '')
      ),
    [courses]
  );
  const sortedQuizzes = useMemo(
    () => [...quizzes].sort((a, b) => compareAlphabetically(a?.title || '', b?.title || '')),
    [quizzes]
  );
  const sortedQuestions = useMemo(
    () =>
      [...questions].sort((a, b) =>
        compareAlphabetically(formatQuestionLabel(a, 120), formatQuestionLabel(b, 120))
      ),
    [questions]
  );

const groupedQuizzes = useMemo(() => {
  const groups = new Map();
  quizzes.forEach((quiz) => {
    const key = `${String(quiz.title || '').trim().toLowerCase()}|${String(quiz.topic || 'General').trim().toLowerCase()}`;
    if (!groups.has(key)) {
      groups.set(key, {
        title: quiz.title,
        topic: quiz.topic || 'General',
        variations: [],
      });
    }
    groups.get(key).variations.push(quiz);
  });
  
  return Array.from(groups.values())
    .map(group => ({
      ...group,
      variations: group.variations.sort((a, b) => Number(a.difficulty) - Number(b.difficulty))
    }))
    .sort((a, b) => compareAlphabetically(a.title, b.title));
}, [quizzes]);
  const visibleSortedCourses = useMemo(
    () => sortedCourses.slice(0, visibleCourseCount),
    [sortedCourses, visibleCourseCount]
  );
  const visibleSortedQuizzes = useMemo(
    () => sortedQuizzes.slice(0, visibleQuizCount),
    [sortedQuizzes, visibleQuizCount]
  );
  const visibleSortedQuestions = useMemo(
    () => sortedQuestions.slice(0, visibleQuestionCount),
    [sortedQuestions, visibleQuestionCount]
  );
  const hasMoreCourses = visibleSortedCourses.length < sortedCourses.length;
  const hasMoreQuizzes = visibleSortedQuizzes.length < sortedQuizzes.length;
  const hasMoreQuestions = visibleSortedQuestions.length < sortedQuestions.length;
  const selectedQuizCourseIds = useMemo(
    () =>
      selectedQuiz
        ? sortedCourses
          .filter((course) => (course.quizIds || []).includes(selectedQuiz.id))
          .map((course) => course.id)
        : [],
    [selectedQuiz, sortedCourses]
  );
  const courseQuizIds = useMemo(() => parseCsvIds(courseForm.quizIds), [courseForm.quizIds]);
  const availableQuizzesForCourse = useMemo(
    () => sortedQuizzes.filter((quiz) => !courseQuizIds.includes(quiz.id)),
    [sortedQuizzes, courseQuizIds]
  );
  const availableCoursesForQuiz = useMemo(
    () => sortedCourses.filter((course) => !quizLinkedCourseIds.includes(course.id)),
    [sortedCourses, quizLinkedCourseIds]
  );
  const availableCoursesForBulkQuiz = useMemo(
    () => sortedCourses.filter((course) => !bulkLinkedCourseIds.includes(course.id)),
    [sortedCourses, bulkLinkedCourseIds]
  );

  // Handle bulk fixing safe LaTeX issues
  const handleFixAllLatex = () => {
    const editingCount = Object.keys(editingQuestions).length;
    // Use editing buffer as source if it exists, otherwise use display state
    const sourceArr = editingCount > 0 
      ? Object.entries(editingQuestions).map(([id, data]) => ({ id, ...data }))
      : displayQuestions;
      
    const fixedArr = fixAllSafeLatexIssues(sourceArr);
    const newEditing = { ...editingQuestions };

    fixedArr.forEach(q => {
      newEditing[q.id] = {
        type: q.type,
        question_text: q.question_text,
        explanation: q.explanation || '',
        metadataJson: q.metadataJson || (q.metadata ? JSON.stringify(q.metadata, null, 2) : '{}'),
        difficulty: q.difficulty,
        topic: q.topic,
        skillCategory: q.skillCategory,
        isArchived: q.isArchived,
      };
    });

    setEditingQuestions(newEditing);
    setEditDisplayedQuestions(true);
    toast({
      title: 'Safe fixes applied to edit state',
      description: 'Review the changes and save them when ready.',
    });
  };

  // Handle individual safe fix
  const handleApplySafeFix = (questionId, fieldName, fixedValue) => {
    setEditingQuestions(prev => {
      const question = displayQuestions.find(q => q.id === questionId);
      if (!question && !prev[questionId]) return prev;

      const current = prev[questionId] || {
        type: question.type,
        question_text: question.question_text,
        explanation: question.explanation || '',
        metadataJson: JSON.stringify(question.metadata || {}, null, 2),
        difficulty: question.difficulty,
        topic: question.topic,
        skillCategory: question.skillCategory,
        isArchived: question.isArchived,
      };

      const updated = { ...current };

      if (fieldName === 'question_text' || fieldName === 'explanation') {
        updated[fieldName] = fixedValue;
      } else if (fieldName.startsWith('option_')) {
        const optionId = fieldName.replace('option_', '');
        try {
          const metadata = JSON.parse(updated.metadataJson);
          const options = (metadata.options || []).map(opt => {
            if ((opt.id || '').toString() === optionId) {
              return { ...opt, text: fixedValue };
            }
            return opt;
          });
          updated.metadataJson = JSON.stringify({ ...metadata, options }, null, 2);
        } catch (e) {
          console.error('Error updating option JSON', e);
        }
      } else if (fieldName.startsWith('accepted_answer_')) {
        const idx = parseInt(fieldName.replace('accepted_answer_', ''), 10);
        try {
          const metadata = JSON.parse(updated.metadataJson);
          const accepted_answers = [...(metadata.accepted_answers || [])];
          accepted_answers[idx] = fixedValue;
          updated.metadataJson = JSON.stringify({ ...metadata, accepted_answers }, null, 2);
        } catch (e) {
          console.error('Error updating accepted answer JSON', e);
        }
      }

      return {
        ...prev,
        [questionId]: updated
      };
    });

    setEditDisplayedQuestions(true);
    toast({
      title: 'Fix applied to edit state',
      description: `Updated ${fieldName} for ${questionId}.`,
    });
  };

  const loadAllContent = async (showLoader = true) => {
    if (showLoader) {
      setIsLoading(true);
    }
    try {
      const snapshot = await measureAsync('query:admin-content-snapshot', () =>
        getAdminContentSnapshot()
      );
      setCourses(snapshot.courses || []);
      setQuizzes(snapshot.quizzes || []);
      setQuestions(snapshot.questions || []);
      setContentLoadError(null);
      setShowRefreshPrompt(false);
    } catch (error) {
      setContentLoadError(error);
      toast({
        title: 'Failed to load content',
        description: getUserFriendlyErrorMessage(error, 'Could not fetch dashboard data.'),
        variant: 'destructive',
      });
    } finally {
      if (showLoader) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadAllContent();
  }, []);

  useEffect(() => {
    if (!selectedCourse) {
      setCourseForm(COURSE_DEFAULTS);
      return;
    }
    setCourseForm({
      title: selectedCourse.title || '',
      shortDescription: selectedCourse.shortDescription || selectedCourse.description || '',
      longDescription:
        selectedCourse.longDescription || selectedCourse.description || selectedCourse.shortDescription || '',
      topic: selectedCourse.topic || '',
      courseCode: selectedCourse.courseCode || '',
      quizIds: (selectedCourse.quizIds || []).join(', '),
      isArchived: Boolean(selectedCourse.isArchived),
    });
  }, [selectedCourse]);

  useEffect(() => {
    if (!selectedQuiz) {
      setQuizForm(QUIZ_DEFAULTS);
      setQuizLinkedCourseIds([]);
      return;
    }
    setQuizForm({
      title: selectedQuiz.title || '',
      shortDescription: selectedQuiz.shortDescription || selectedQuiz.description || '',
      longDescription:
        selectedQuiz.longDescription || selectedQuiz.description || selectedQuiz.shortDescription || '',
      topic: selectedQuiz.topic || '',
      difficulty: Number(selectedQuiz.difficulty) || 2,
      estimatedTime: Number(selectedQuiz.estimatedTime) || 15,
      isTimePerQuestion: Boolean(selectedQuiz.isTimePerQuestion),
      questionIds: (selectedQuiz.questionIds || []).join(', '),
      isArchived: Boolean(selectedQuiz.isArchived),
      courseIds: selectedQuizCourseIds.join(', '),
    });
    setQuizLinkedCourseIds(selectedQuizCourseIds);
    setQuizCourseToAddId('');
  }, [selectedQuiz, selectedQuizCourseIds]);

  useEffect(() => {
    if (!selectedQuestion) {
      setQuestionForm(QUESTION_DEFAULTS);
      return;
    }
    setQuestionForm({
      type: selectedQuestion.type || 'mcq',
      question_text: selectedQuestion.question_text || '',
      metadataJson: prettyJson(selectedQuestion.metadata || {}),
      difficulty: Number(selectedQuestion.difficulty) || 2,
      topic: selectedQuestion.topic || '',
      skillCategory: Number(selectedQuestion.skillCategory) || 2,
      explanation: selectedQuestion.explanation || '',
      isArchived: Boolean(selectedQuestion.isArchived),
    });
  }, [selectedQuestion]);

  useEffect(() => {
    setQuizToAddToCourseId('');
  }, [selectedCourseId]);

  useEffect(() => {
    // Priority: Selected question > Selected quiz > Selected course
    let questionsList = [];
    setEditDisplayedQuestions(false);
    
    if (selectedQuestionId) {
      // Case 1: Specific question selected
      const question = questions.find(q => q.id === selectedQuestionId);
      if (question) {
        questionsList = [question];
      }
    } else if (selectedQuizId) {
      // Case 2: Quiz selected - get all questions in that quiz
      const quiz = quizzes.find(q => q.id === selectedQuizId);
      if (quiz && Array.isArray(quiz.questionIds)) {
        questionsList = quiz.questionIds
          .map(id => questionById.get(id))
          .filter(Boolean); // Remove any null/undefined
      }
    } else if (selectedCourseId) {
      // Case 3: Course selected - get all questions from all quizzes in the course
      const course = courses.find(c => c.id === selectedCourseId);
      if (course && Array.isArray(course.quizIds)) {
        // Get all unique question IDs from all quizzes in the course
        const questionIdSet = new Set();
        course.quizIds.forEach(quizId => {
          const quiz = quizzes.find(q => q.id === quizId);
          if (quiz && Array.isArray(quiz.questionIds)) {
            quiz.questionIds.forEach(qId => questionIdSet.add(qId));
          }
        });
        
        // Convert IDs to question objects
        questionsList = Array.from(questionIdSet)
          .map(id => questionById.get(id))
          .filter(Boolean);
      }
    }
    
    setDisplayQuestions(questionsList);
  }, [selectedCourseId, selectedQuizId, selectedQuestionId, courses, quizzes, questionById]);

  useEffect(() => {
    setBulkCourseToAddId('');
  }, [bulkForm.selectedQuizId]);

  useEffect(() => {
    setVisibleCourseCount(DASHBOARD_SELECT_PAGE_SIZE);
  }, [courses.length]);

  useEffect(() => {
    setVisibleQuizCount(DASHBOARD_SELECT_PAGE_SIZE);
  }, [quizzes.length]);

  useEffect(() => {
    setVisibleQuestionCount(DASHBOARD_SELECT_PAGE_SIZE);
  }, [questions.length]);

  useEffect(() => {
    if (!isSaving) return undefined;

    const timerId = setInterval(() => {
      setSavingAction((previous) => {
        if (previous.progress >= 92) return previous;
        const increment = previous.progress < 35 ? 12 : previous.progress < 70 ? 6 : 3;
        return {
          ...previous,
          progress: Math.min(92, previous.progress + increment),
        };
      });
    }, 180);

    return () => clearInterval(timerId);
  }, [isSaving]);

  if (!isDevFeaturesEnabled) {
    return <Navigate to="/quizzes" replace />;
  }

  const isActionRunning = (actionKey) => isSaving && savingAction.key === actionKey;

  const clampedSavingProgress = Math.max(0, Math.min(100, savingAction.progress));

  const withSaving = async (actionDetails, callback) => {
    const { actionKey, pendingLabel, successTitle } = actionDetails;
    setIsSaving(true);
    setSavingAction({
      key: actionKey,
      label: pendingLabel,
      progress: 8,
    });
    try {
      await callback();
      setSavingAction((previous) => ({ ...previous, progress: 76 }));
      await loadAllContent(false);
      await queryClient.invalidateQueries();
      setSavingAction((previous) => ({ ...previous, progress: 100 }));
      setShowRefreshPrompt(true);
      toast({ title: successTitle });
    } catch (error) {
      toast({
        title: 'Action failed',
        description: getUserFriendlyErrorMessage(error, 'Please check your input and try again.'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
      setSavingAction({ key: '', label: '', progress: 0 });
    }
  };

  const handleCreateCourse = async () => {
    await withSaving(
      {
        actionKey: 'create-course',
        pendingLabel: 'Creating course...',
        successTitle: 'Course created',
      },
      async () => {
        await createAdminCourse({
          title: courseForm.title,
          shortDescription: courseForm.shortDescription,
          longDescription: courseForm.longDescription,
          topic: courseForm.topic,
          courseCode: courseForm.courseCode || undefined,
          quizIds: parseCsvIds(courseForm.quizIds),
          isArchived: Boolean(courseForm.isArchived),
        });
        setSelectedCourseId('');
        setCourseForm(COURSE_DEFAULTS);
      }
    );
  };

  const handleUpdateCourse = async () => {
    if (!selectedCourseId) return;
    await withSaving(
      {
        actionKey: 'update-course',
        pendingLabel: 'Saving course changes...',
        successTitle: 'Course updated',
      },
      async () => {
        await updateAdminCourse(selectedCourseId, {
          title: courseForm.title,
          shortDescription: courseForm.shortDescription,
          longDescription: courseForm.longDescription,
          topic: courseForm.topic,
          courseCode: courseForm.courseCode || undefined,
          quizIds: parseCsvIds(courseForm.quizIds),
          isArchived: Boolean(courseForm.isArchived),
        });
      }
    );
  };

  const handleToggleArchiveCourse = async () => {
    if (!selectedCourseId || !selectedCourse) return;
    await withSaving(
      {
        actionKey: 'toggle-archive-course',
        pendingLabel: selectedCourse.isArchived ? 'Restoring course...' : 'Archiving course...',
        successTitle: selectedCourse.isArchived ? 'Course restored' : 'Course archived',
      },
      async () => {
        await archiveAdminCourse(selectedCourseId, !selectedCourse.isArchived);
      }
    );
  };

  const handleAddQuizToCourse = () => {
    if (!quizToAddToCourseId) return;

    const nextQuizIds = Array.from(new Set([...courseQuizIds, quizToAddToCourseId]));
    setCourseForm((previous) => ({
      ...previous,
      quizIds: nextQuizIds.join(', '),
    }));
    setQuizToAddToCourseId('');
  };

  const handleRemoveQuizFromCourse = (quizIdToRemove) => {
    const nextQuizIds = courseQuizIds.filter((quizId) => quizId !== quizIdToRemove);
    setCourseForm((previous) => ({
      ...previous,
      quizIds: nextQuizIds.join(', '),
    }));
  };

  const syncQuizCourseAssociations = async (quizId, targetCourseIdsRaw = []) => {
    const normalizedTargetIds = uniqueStringIds(targetCourseIdsRaw);
    const targetSet = new Set(normalizedTargetIds);

    const missingCourseIds = normalizedTargetIds.filter(
      (courseId) => !courses.some((course) => course.id === courseId)
    );
    if (missingCourseIds.length > 0) {
      throw new Error(`Selected course not found: ${missingCourseIds[0]}`);
    }

    for (const course of courses) {
      const sourceQuizIds = Array.isArray(course.quizIds) ? course.quizIds : [];
      const hasQuiz = sourceQuizIds.includes(quizId);
      const shouldHaveQuiz = targetSet.has(course.id);

      if (hasQuiz === shouldHaveQuiz) continue;

      const nextQuizIds = shouldHaveQuiz
        ? uniqueStringIds([...sourceQuizIds, quizId])
        : sourceQuizIds.filter((entryId) => entryId !== quizId);

      await updateAdminCourse(course.id, {
        ...course,
        quizIds: nextQuizIds,
      });
    }
  };

  const handleAddCourseToQuiz = () => {
    if (!quizCourseToAddId) return;
    const nextCourseIds = uniqueStringIds([...quizLinkedCourseIds, quizCourseToAddId]);
    setQuizLinkedCourseIds(nextCourseIds);
    setQuizForm((previous) => ({ ...previous, courseIds: nextCourseIds.join(', ') }));
    setQuizCourseToAddId('');
  };

  const handleRemoveCourseFromQuiz = (courseIdToRemove) => {
    const nextCourseIds = quizLinkedCourseIds.filter((courseId) => courseId !== courseIdToRemove);
    setQuizLinkedCourseIds(nextCourseIds);
    setQuizForm((previous) => ({ ...previous, courseIds: nextCourseIds.join(', ') }));
  };

  const handleAddCourseToBulkQuiz = () => {
    if (!bulkCourseToAddId) return;
    const nextCourseIds = uniqueStringIds([...bulkLinkedCourseIds, bulkCourseToAddId]);
    setBulkLinkedCourseIds(nextCourseIds);
    setBulkForm((previous) => ({ ...previous, courseIds: nextCourseIds.join(', ') }));
    setBulkCourseToAddId('');
  };

  const handleAutoDifficultyFromQuestions = () => {
    if (!selectedQuiz) {
      toast({
        title: 'Select a quiz first',
        description: 'Choose a quiz to compute its difficulty.',
        variant: 'destructive',
      });
      return;
    }

    const questionIds = Array.isArray(selectedQuiz.questionIds) ? selectedQuiz.questionIds : [];
    const difficulties = questionIds
      .map((questionId) => questionById.get(questionId))
      .filter(Boolean)
      .map((question) => Number(question.difficulty))
      .filter((value) => Number.isFinite(value));

    if (difficulties.length === 0) {
      toast({
        title: 'No question difficulties found',
        description: 'Link questions with difficulty values before computing a quiz difficulty.',
        variant: 'destructive',
      });
      return;
    }

    const average = difficulties.reduce((sum, value) => sum + value, 0) / difficulties.length;
    const rounded = Math.round(average);
    const clamped = Math.max(1, Math.min(3, rounded));

    setQuizForm((previous) => ({ ...previous, difficulty: clamped }));
    toast({
      title: 'Difficulty updated',
      description: `Computed difficulty ${clamped} from ${difficulties.length} question(s).`,
    });
  };

  const handleAutoBulkDifficultyFromQuestions = () => {
    const quiz = selectedBulkQuiz;
    if (!quiz) {
      toast({
        title: 'Select a quiz first',
        description: 'Choose a quiz to compute its difficulty.',
        variant: 'destructive',
      });
      return;
    }

    const questionIds = Array.isArray(quiz.questionIds) ? quiz.questionIds : [];
    const difficulties = questionIds
      .map((questionId) => questionById.get(questionId))
      .filter(Boolean)
      .map((question) => Number(question.difficulty))
      .filter((value) => Number.isFinite(value));

    if (difficulties.length === 0) {
      toast({
        title: 'No question difficulties found',
        description: 'Link questions with difficulty values before computing a quiz difficulty.',
        variant: 'destructive',
      });
      return;
    }

    const average = difficulties.reduce((sum, value) => sum + value, 0) / difficulties.length;
    const rounded = Math.round(average);
    const clamped = Math.max(1, Math.min(3, rounded));

    setBulkForm((previous) => ({ ...previous, difficulty: clamped }));
    toast({
      title: 'Difficulty updated',
      description: `Computed difficulty ${clamped} from ${difficulties.length} question(s).`,
    });
  };

  const handleRemoveCourseFromBulkQuiz = (courseIdToRemove) => {
    const nextCourseIds = bulkLinkedCourseIds.filter((courseId) => courseId !== courseIdToRemove);
    setBulkLinkedCourseIds(nextCourseIds);
    setBulkForm((previous) => ({ ...previous, courseIds: nextCourseIds.join(', ') }));
  };

  const handleCreateQuiz = async () => {
    await withSaving(
      {
        actionKey: 'create-quiz',
        pendingLabel: 'Creating quiz...',
        successTitle: 'Quiz created',
      },
      async () => {
        const createdQuiz = await createAdminQuiz({
          quiz: {
            title: quizForm.title,
            shortDescription: quizForm.shortDescription,
            longDescription: quizForm.longDescription,
            topic: quizForm.topic,
            difficulty: Number(quizForm.difficulty),
            estimatedTime: Number(quizForm.estimatedTime),
            isTimePerQuestion: Boolean(quizForm.isTimePerQuestion),
            questionIds: [],
            isArchived: Boolean(quizForm.isArchived),
          },
          courseId: '',
        });
        await syncQuizCourseAssociations(createdQuiz.id, quizLinkedCourseIds);
        setSelectedQuizId('');
        setQuizLinkedCourseIds([]);
        setQuizCourseToAddId('');
        setQuizForm(QUIZ_DEFAULTS);
      }
    );
  };
  const handleUpdateQuiz = async () => {
    if (!selectedQuizId) return;
    await withSaving(
      {
        actionKey: 'update-quiz',
        pendingLabel: 'Saving quiz changes...',
        successTitle: 'Quiz updated',
      },
      async () => {
        const variations = quizzes.filter(q => 
          String(q.title || '').trim().toLowerCase() === String(selectedQuiz.title || '').trim().toLowerCase() && 
          String(q.topic || 'General').trim().toLowerCase() === String(selectedQuiz.topic || 'General').trim().toLowerCase()
        );

        for (const quizToUpdate of variations) {
          const isTarget = quizToUpdate.id === selectedQuizId;
          
          await updateAdminQuiz(quizToUpdate.id, {
            title: quizForm.title,
            shortDescription: quizForm.shortDescription,
            longDescription: quizForm.longDescription,
            topic: quizForm.topic,
            // Only update difficulty and questions for the active variation
            difficulty: isTarget ? Number(quizForm.difficulty) : Number(quizToUpdate.difficulty),
            estimatedTime: isTarget ? Number(quizForm.estimatedTime) : Number(quizToUpdate.estimatedTime),
            isTimePerQuestion: isTarget ? Boolean(quizForm.isTimePerQuestion) : Boolean(quizToUpdate.isTimePerQuestion),
            questionIds: isTarget 
              ? (Array.isArray(selectedQuiz?.questionIds) ? selectedQuiz.questionIds : [])
              : (Array.isArray(quizToUpdate.questionIds) ? quizToUpdate.questionIds : []),
            isArchived: isTarget ? Boolean(quizForm.isArchived) : Boolean(quizToUpdate.isArchived),
          });
          
          // Sync course associations for all variations
          await syncQuizCourseAssociations(quizToUpdate.id, quizLinkedCourseIds);
        }
      }
    );
  };

  const handleToggleArchiveQuiz = async () => {
    if (!selectedQuizId || !selectedQuiz) return;
    await withSaving(
      {
        actionKey: 'toggle-archive-quiz',
        pendingLabel: selectedQuiz.isArchived ? 'Restoring quiz...' : 'Archiving quiz...',
        successTitle: selectedQuiz.isArchived ? 'Quiz restored' : 'Quiz archived',
      },
      async () => {
        await archiveAdminQuiz(selectedQuizId, !selectedQuiz.isArchived);
      }
    );
  };

  const handleAddQuestionToQuiz = async () => {
    if (!selectedQuizId || !questionToAddId) return;
    await withSaving(
      {
        actionKey: 'add-question-to-quiz',
        pendingLabel: 'Adding question to quiz...',
        successTitle: 'Question added to quiz',
      },
      async () => {
        await addQuestionsToQuiz(selectedQuizId, [questionToAddId]);
        setQuestionToAddId('');
      }
    );
  };

  const handleRemoveQuestionFromQuiz = async (questionId) => {
    if (!selectedQuizId) return;
    await withSaving(
      {
        actionKey: 'remove-question-from-quiz',
        pendingLabel: 'Removing question from quiz...',
        successTitle: 'Question removed from quiz',
      },
      async () => {
        await removeQuestionFromQuiz(selectedQuizId, questionId);
      }
    );
  };

  const handleCreateQuestion = async () => {
    await withSaving(
      {
        actionKey: 'create-question',
        pendingLabel: 'Creating question...',
        successTitle: 'Question created',
      },
      async () => {
        const metadata = JSON.parse(questionForm.metadataJson);
        await createAdminQuestion({
          type: questionForm.type,
          question_text: questionForm.question_text,
          metadata,
          difficulty: Number(questionForm.difficulty),
          topic: questionForm.topic,
          skillCategory: Number(questionForm.skillCategory),
          explanation: questionForm.explanation,
          isArchived: Boolean(questionForm.isArchived),
        });
        setSelectedQuestionId('');
        setQuestionForm(QUESTION_DEFAULTS);
      }
    );
  };

  const handleUpdateQuestion = async () => {
    if (!selectedQuestionId) return;
    await withSaving(
      {
        actionKey: 'update-question',
        pendingLabel: 'Saving question changes...',
        successTitle: 'Question updated',
      },
      async () => {
        const metadata = JSON.parse(questionForm.metadataJson);
        await updateAdminQuestion(selectedQuestionId, {
          type: questionForm.type,
          question_text: questionForm.question_text,
          metadata,
          difficulty: Number(questionForm.difficulty),
          topic: questionForm.topic,
          skillCategory: Number(questionForm.skillCategory),
          explanation: questionForm.explanation,
          isArchived: Boolean(questionForm.isArchived),
        });
      }
    );
  };

  const handleToggleArchiveQuestion = async () => {
    if (!selectedQuestionId || !selectedQuestion) return;
    await withSaving(
      {
        actionKey: 'toggle-archive-question',
        pendingLabel: selectedQuestion.isArchived ? 'Restoring question...' : 'Archiving question...',
        successTitle: selectedQuestion.isArchived ? 'Question restored' : 'Question archived',
      },
      async () => {
        await archiveAdminQuestion(selectedQuestionId, !selectedQuestion.isArchived);
      }
    );
  };

  const handleSaveAllQuestionChanges = async () => {
    const questionIds = Object.keys(editingQuestions);
    if (questionIds.length === 0) {
      toast({ title: 'No changes', description: 'No question changes to save.', variant: 'outline' });
      return;
    }

    setSavingAction({ label: 'Saving all question changes...', progress: 0 });
    setIsSaving(true);

    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < questionIds.length; i++) {
        const qid = questionIds[i];
        const data = editingQuestions[qid];
        
        try {
          const metadata = JSON.parse(data.metadataJson);
          await updateAdminQuestion(qid, {
            type: data.type,
            question_text: data.question_text,
            metadata,
            difficulty: Number(data.difficulty),
            topic: data.topic,
            skillCategory: Number(data.skillCategory),
            explanation: data.explanation,
            isArchived: Boolean(data.isArchived),
          });
          successCount++;
        } catch (err) {
          console.error(`Failed to save question ${qid}:`, err);
          failCount++;
        }

        setSavingAction(prev => ({
          ...prev,
          progress: ((i + 1) / questionIds.length) * 100
        }));
      }

      if (successCount > 0) {
        toast({ 
          title: 'Bulk save complete', 
          description: `Successfully saved ${successCount} questions.${failCount > 0 ? ` Failed to save ${failCount} questions.` : ''}` 
        });
        await loadAllContent(false);
        setShowRefreshPrompt(true);
        // We don't clear editingQuestions here because the user might want to keep some context, 
        // but loadAllContent will refresh the displayQuestions.
      } else if (failCount > 0) {
        toast({ 
          title: 'Save failed', 
          description: `Failed to save ${failCount} questions. Check console or JSON format.`, 
          variant: 'destructive' 
        });
      }
    } finally {
      setIsSaving(false);
      setSavingAction({ label: '', progress: 0 });
    }
  };

  const handleBulkQuizUploadFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setBulkForm((previous) => ({ ...previous, uploadText: content }));
    event.target.value = '';
  };

  const handlePasteJson = async (setter) => {
    try {
      const text = await navigator.clipboard.readText();
      const newText = String(text || '');
      setter((previous) => ({ ...previous, uploadText: newText }));
      toast({
        title: 'Pasted successfully',
        description: 'Text pasted from clipboard.',
      });
    } catch (err) {
      toast({
        title: 'Paste failed',
        description: 'Could not read from clipboard. Please paste manually.',
        variant: 'destructive',
      });
    }
  };

  const handlePasteMetadataJson = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const newText = String(text || '');
      setQuestionForm((v) => ({ ...v, metadataJson: newText }));
      toast({
        title: 'Pasted successfully',
        description: 'Metadata pasted from clipboard.',
      });
    } catch (err) {
      toast({
        title: 'Paste failed',
        description: 'Could not read from clipboard. Please paste manually.',
        variant: 'destructive',
      });
    }
  };

  const handlePastePromptInput = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setPromptInput(String(text || ''));
      toast({
        title: 'Pasted successfully',
        description: 'Description pasted from clipboard.',
      });
    } catch (err) {
      toast({
        title: 'Paste failed',
        description: 'Could not read from clipboard. Please paste manually.',
        variant: 'destructive',
      });
    }
  };

  const handleCopyQuizGenerationPrompt = async () => {
    const generatedPrompt = QUIZ_GENERATION_PROMPT_TEMPLATE.replace(
      '[INSERT QUIZ DESCRIPTION HERE]',
      promptInput || 'No Quiz Description. Abort.'
    );
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      toast({
        title: 'Prompt Copied!',
        description: 'The generated prompt has been copied to your clipboard.',
      });
    } catch (err) {
      toast({
        title: 'Copy failed',
        description: 'Could not write to clipboard.',
        variant: 'destructive',
      });
    }
  };

  const handleCopyQuizDescriptionPrompt = async () => {
    try {
      await navigator.clipboard.writeText(QUIZ_DESCRIPTION_PROMPT_TEMPLATE);
      toast({
        title: 'Prompt copied',
        description: 'Quiz description prompt template copied to clipboard.',
      });
    } catch (err) {
      toast({
        title: 'Copy failed',
        description: 'Could not write to clipboard.',
        variant: 'destructive',
      });
    }
  };

  const handleCopyVariationPrompt = async () => {
    setBulkForm((v) => ({ ...v, difficulty: targetVariationDifficulty }));    const targetDifficultyLabel = QUIZ_DIFFICULTY_LABELS[targetVariationDifficulty] || 'intermediate';

    const generatedPrompt = QUIZ_VARIATION_GENERATION_PROMPT_TEMPLATE.replace(
      '[INSERT SAMPLE QUESTION SET]',
      bulkForm.uploadText
    ).replace(
      '[CURRENT DIFFICULTY]', 
      QUIZ_DIFFICULTY_LABELS[originalDifficulty] || 'intermediate'
    ).replace(
      '[TARGET DIFFICULTY]', 
      targetDifficultyLabel
    );

    try {
      await navigator.clipboard.writeText(generatedPrompt);
      toast({
        title: 'Variation Prompt Copied!',
        description: `Prompt for ${targetDifficultyLabel} difficulty has been copied.`,
      });
    } catch (err) {
      toast({
        title: 'Copy failed',
        description: `Could not write to clipboard. \n ${err}`,
        variant: 'destructive',
      });
    }
  };

  const handleCopyJson = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'JSON Copied!',
        description: 'The content has been copied to your clipboard.',
      });
    } catch (err) {
      toast({
        title: 'Copy failed',
        description: 'Could not write to clipboard.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateNewVariation = () => {
    setShowVariationPromptOptions(true);
    setOriginalDifficulty(bulkForm.difficulty || 'intermediate');
    setTargetVariationDifficulty(3);
    
    setBulkForm(prev => ({
      ...prev,
      selectedQuizId: ''
    }));
    
    setBulkUploadMode('manual');
    
    toast({
      title: 'Ready for New Variation',
      description: 'The ID has been cleared. Review the JSON and select a new difficulty, then click "Create from Upload".',
    });
  };

  const handleBulkQuestionUploadFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setBulkQuestionForm((previous) => ({ ...previous, uploadText: content }));
    event.target.value = '';
  };

  const handleSelectBulkQuiz = (quizId) => {
    if (!quizId) {
      setBulkForm(BULK_DEFAULTS);
      setBulkLinkedCourseIds([]);
      setBulkCourseToAddId('');
      setBulkUploadMode('manual');
      setShowVariationPromptOptions(false);
      return;
    }

    const quiz = quizzes.find((entry) => entry.id === quizId);
    if (!quiz) {
      toast({
        title: 'Quiz not found',
        description: 'Please select another quiz.',
        variant: 'destructive',
      });
      return;
    }

    const sourceQuestionIds = Array.isArray(quiz.questionIds) ? quiz.questionIds : [];
    const mappedQuestions = sourceQuestionIds
      .map((questionId) => questionById.get(questionId))
      .filter(Boolean)
      .map(toQuestionUploadEntry);
    const linkedCourseIds = sortedCourses
      .filter((course) => (course.quizIds || []).includes(quizId))
      .map((course) => course.id);

    setBulkForm({
      selectedQuizId: quiz.id,
      title: quiz.title || '',
      shortDescription: quiz.shortDescription || quiz.description || '',
      longDescription:
        quiz.longDescription || quiz.description || quiz.shortDescription || '',
      topic: quiz.topic || '',
      difficulty: Number(quiz.difficulty) || 2,
      estimatedTime: Number(quiz.estimatedTime) || 15,
      isTimePerQuestion: Boolean(quiz.isTimePerQuestion),
      courseIds: linkedCourseIds.join(', '),
      uploadText: JSON.stringify({ questions: mappedQuestions }, null, 2),
    });
    setBulkLinkedCourseIds(linkedCourseIds);
    setBulkCourseToAddId('');
    setShowVariationPromptOptions(false);

    if (mappedQuestions.length !== sourceQuestionIds.length) {
      toast({
        title: 'Some linked questions are unavailable',
        description: 'Only available questions were generated in the JSON editor.',
        variant: 'destructive',
      });
    }
  };

  const parseResilientJSON = (jsonString) => {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      if (error instanceof SyntaxError) {
        try {
          const fixedString = jsonString.replace(/(?<!\\)\\(?!["\\/bfnrtu])/g, '\\\\');
          const parsed = JSON.parse(fixedString);
          toast({
            title: 'JSON Auto-fixed',
            description: 'Invalid escape characters (like unescaped LaTeX backslashes) were found and automatically corrected. Proceeding...',
          });
          return parsed;
        } catch (innerError) {
          // If the fix didn't work, throw the original error
          throw error;
        }
      }
      throw error;
    }
  };

  const handleBulkUpsertQuiz = async () => {
    await withSaving(
      {
        actionKey: 'bulk-upsert-quiz',
        pendingLabel: bulkForm.selectedQuizId ? 'Applying bulk quiz edits...' : 'Creating quiz from upload...',
        successTitle: bulkForm.selectedQuizId ? 'Bulk quiz edits applied' : 'Bulk quiz created',
      },
      async () => {

        const uploadPayload = parseResilientJSON(bulkForm.uploadText);
        const uploadedQuestions = normalizeQuestionUploadPayload(uploadPayload);
        
        let finalQuizPayload = {
          title: bulkForm.title,
          shortDescription: bulkForm.shortDescription,
          longDescription: bulkForm.longDescription,
          topic: bulkForm.topic,
          difficulty: Number(bulkForm.difficulty),
          estimatedTime: Number(bulkForm.estimatedTime),
          isTimePerQuestion: Boolean(bulkForm.isTimePerQuestion),
          questionIds: [],
          isArchived: false,
        };

        if (!bulkForm.selectedQuizId && bulkUploadMode === 'json') {
           const numQuestions = uploadedQuestions.length;
           
           let calcDifficulty = 2;
           const difficulties = uploadedQuestions.map(q => Number(q.difficulty)).filter(Number.isFinite);
           if (difficulties.length > 0) {
             const avg = difficulties.reduce((sum, val) => sum + val, 0) / difficulties.length;
             calcDifficulty = Math.max(1, Math.min(3, Math.round(avg)));
           }

           const finalDifficulty = ('difficulty' in uploadPayload && uploadPayload.difficulty !== "")
             ? Number(uploadPayload.difficulty)
             : calcDifficulty;
             
           const calcEstimatedTime = Math.max(1, Math.ceil(numQuestions / 2));
           const finalEstimatedTime = ('estimatedTime' in uploadPayload && uploadPayload.estimatedTime !== "")
             ? Number(uploadPayload.estimatedTime)
             : calcEstimatedTime;
             
           const finalIsTimePerQuestion = ('timeIsPerQuestion' in uploadPayload)
             ? Boolean(uploadPayload.timeIsPerQuestion)
             : ('estimatedTime' in uploadPayload ? false : true);

           finalQuizPayload = {
              title: uploadPayload.title || '',
              shortDescription: uploadPayload.shortDescription || '',
              longDescription: uploadPayload.longDescription || '',
              topic: uploadPayload.topic || '',
              difficulty: finalDifficulty,
              estimatedTime: finalEstimatedTime,
              isTimePerQuestion: finalIsTimePerQuestion,
              questionIds: [],
              isArchived: false,
           };
        }

        if (!bulkForm.selectedQuizId) {

          // --- NEW CHECK: ensure no variation with same difficulty already exists ---
          const existingVariations = quizzes.filter(q => 
            String(q.title || '').trim().toLowerCase() === String(finalQuizPayload.title || '').trim().toLowerCase() && 
            String(q.topic || 'General').trim().toLowerCase() === String(finalQuizPayload.topic || 'General').trim().toLowerCase()
          );
          const existingWithSameDifficulty = existingVariations.find(v => v.difficulty === finalQuizPayload.difficulty);
          if (existingWithSameDifficulty) {
            // Use difficulty label if available, otherwise fallback to number
            const difficultyLabel = typeof QUIZ_DIFFICULTY_LABELS !== 'undefined'
              ? QUIZ_DIFFICULTY_LABELS[finalQuizPayload.difficulty]
              : finalQuizPayload.difficulty;
            throw new Error(
              `A variation with difficulty ${difficultyLabel} already exists for this quiz. ` +
              `Please choose a different difficulty or edit the existing variation.`
            );
          }
          // --- end of new check ---

          const createdQuizResult = await createQuizFromQuestionUpload({
            quizPayload: finalQuizPayload,
            uploadPayload,
            courseIds: bulkLinkedCourseIds,
          });
          setBulkForm(BULK_DEFAULTS);
          setBulkLinkedCourseIds([]);
          setBulkCourseToAddId('');
          setBulkUploadMode('manual');
          return;
        }

        const variations = quizzes.filter(q => 
          String(q.title || '').trim().toLowerCase() === String(bulkForm.title || '').trim().toLowerCase() && 
          String(q.topic || 'General').trim().toLowerCase() === String(bulkForm.topic || 'General').trim().toLowerCase()
        );

        for (const quizToUpdate of variations) {
          const isTarget = quizToUpdate.id === bulkForm.selectedQuizId;
          
          const existingQuestionIds = Array.isArray(quizToUpdate.questionIds)
            ? quizToUpdate.questionIds
            : [];

          if (isTarget) {
            if (existingQuestionIds.length !== uploadedQuestions.length) {
              throw new Error(
                `Question count mismatch: selected quiz has ${existingQuestionIds.length} linked questions but upload has ${uploadedQuestions.length}.`
              );
            }

            // Check for identical question lists across variations BEFORE updating
            const currentQuestionsJson = JSON.stringify(uploadedQuestions.map(toQuestionUploadEntry));
            const otherVariations = variations.filter(v => v.id !== quizToUpdate.id);
            for (const v of otherVariations) {
              const vQuestions = (Array.isArray(v.questionIds) ? v.questionIds : [])
                .map(id => questionById.get(id))
                .filter(Boolean)
                .map(toQuestionUploadEntry);
              if (JSON.stringify(vQuestions) === currentQuestionsJson) {
                throw new Error(`A variation with this exact question list already exists (${QUIZ_DIFFICULTY_LABELS[v.difficulty]}).`);
              }
            }

            for (let index = 0; index < existingQuestionIds.length; index += 1) {
              const questionId = existingQuestionIds[index];
              const payload = uploadedQuestions[index];
              await updateAdminQuestion(questionId, {
                ...payload,
                isArchived: Boolean(payload?.isArchived),
              });
            }
          }

          await updateAdminQuiz(quizToUpdate.id, {
            title: bulkForm.title,
            shortDescription: bulkForm.shortDescription,
            longDescription: bulkForm.longDescription,
            topic: bulkForm.topic,
            difficulty: isTarget ? Number(bulkForm.difficulty) : Number(quizToUpdate.difficulty),
            estimatedTime: isTarget ? Number(bulkForm.estimatedTime) : Number(quizToUpdate.estimatedTime),
            isTimePerQuestion: isTarget ? Boolean(bulkForm.isTimePerQuestion) : Boolean(quizToUpdate.isTimePerQuestion),
            questionIds: existingQuestionIds,
            isArchived: isTarget ? Boolean(bulkForm.isArchived || false) : Boolean(quizToUpdate.isArchived),
          });

          await syncQuizCourseAssociations(quizToUpdate.id, bulkLinkedCourseIds);
        }
      }
    );
  };

  const handleBulkCreateQuestions = async () => {
    await withSaving(
      {
        actionKey: 'bulk-create-questions',
        pendingLabel: 'Creating questions from upload...',
        successTitle: 'Questions created from upload',
      },
      async () => {
        const uploadPayload = parseResilientJSON(bulkQuestionForm.uploadText);
        const uploadedQuestions = normalizeQuestionUploadPayload(uploadPayload);

        for (const questionPayload of uploadedQuestions) {
          await createAdminQuestion({
            ...questionPayload,
            isArchived: Boolean(questionPayload?.isArchived),
          });
        }

        setBulkQuestionForm(BULK_QUESTION_DEFAULTS);
      }
    );
  };

  const extractGeminiText = (result) => {
    if (!result) return '';
    if (typeof result === 'string') return result;
    if (typeof result.text === 'string') return result.text;
    if (typeof result.message === 'string') return result.message;

    const candidateParts = result?.candidates?.[0]?.content?.parts;
    if (Array.isArray(candidateParts)) {
      const combined = candidateParts
        .map((part) => (typeof part?.text === 'string' ? part.text : ''))
        .join(' ')
        .trim();
      if (combined) return combined;
    }

    const candidateText = result?.candidates?.[0]?.content?.text;
    if (typeof candidateText === 'string') return candidateText;

    return '';
  };

  const generateQuizShortDescription = async () => {
    const questionIds = Array.isArray(selectedQuiz?.questionIds) ? selectedQuiz.questionIds : [];
    const questionContext = questionIds
      .map((questionId) => questionById.get(questionId))
      .filter(Boolean)
      .map((question) => ({
        question: String(question?.question_text || ''),
        difficulty: Number(question?.difficulty) || 2,
        topic: String(question?.topic || ''),
      }));

    const context = {
      quizTitle: quizForm.title,
      topic: quizForm.topic,
      difficulty: Number(quizForm.difficulty) || 2,
      questions: questionContext,
    };

    const prompt = `Write a short quiz description in 1 sentence with this style strictly. Style example: "${QUIZ_SHORT_DESC_EXAMPLE}".
Use this quiz context JSON:
${JSON.stringify(context, null, 2)}
Return only the description text.`;

    try {
      setAiStatus((previous) => ({ ...previous, quizShort: true }));
      const response = await callGemini(prompt);
      const generatedText = extractGeminiText(response).trim();
      if (!generatedText) {
        throw new Error('No quiz short description returned.');
      }
      setQuizForm((previous) => ({ ...previous, shortDescription: generatedText }));
    } catch (error) {
      console.error(error);
      const friendlyError = getUserFriendlyErrorMessage(error, 'AI generation failed');
      toast({
        title: 'AI Generation Failed',
        description: friendlyError,
        variant: 'destructive',
      });
    } finally {
      setAiStatus((previous) => ({ ...previous, quizShort: false }));
    }
  };

  const generateQuizLongDescription = async () => {
    const questionIds = Array.isArray(selectedQuiz?.questionIds) ? selectedQuiz.questionIds : [];
    const questionContext = questionIds
      .map((questionId) => questionById.get(questionId))
      .filter(Boolean)
      .map((question) => ({
        question: String(question?.question_text || ''),
        difficulty: Number(question?.difficulty) || 2,
        topic: String(question?.topic || ''),
      }));

    const context = {
      quizTitle: quizForm.title,
      topic: quizForm.topic,
      difficulty: Number(quizForm.difficulty) || 2,
      questions: questionContext,
    };

    const prompt = `Write a long quiz description. Style example: "${QUIZ_LONG_DESC_EXAMPLE}".
Use this quiz context JSON:
${JSON.stringify(context, null, 2)}
Return only the description text.`;

    try {
      setAiStatus((previous) => ({ ...previous, quizLong: true }));
      const response = await callGemini(prompt);
      const generatedText = extractGeminiText(response).trim();
      if (!generatedText) {
        throw new Error('No quiz long description returned.');
      }
      setQuizForm((previous) => ({ ...previous, longDescription: generatedText }));
    } catch (error) {
      console.error(error);
      const friendlyError = getUserFriendlyErrorMessage(error, 'AI generation failed');
      toast({
        title: 'AI Generation Failed',
        description: friendlyError,
        variant: 'destructive',
      });
    } finally {
      setAiStatus((previous) => ({ ...previous, quizLong: false }));
    }
  };

  const generateCourseShortDescription = async () => {
    const quizContext = courseQuizIds
      .map((quizId) => quizById.get(quizId))
      .filter(Boolean)
      .map((quiz) => ({
        title: String(quiz?.title || ''),
        shortDescription: String(quiz?.shortDescription || quiz?.description || ''),
        difficulty: Number(quiz?.difficulty) || 2,
      }));

    const context = {
      courseTitle: courseForm.title,
      topic: courseForm.topic,
      quizzes: quizContext,
    };

    const prompt = `Write a short course description in 2-3 sentences strictly by this style. Style example: "${COURSE_SHORT_DESC_EXAMPLE}".
Use this course context JSON:
${JSON.stringify(context, null, 2)}
Return only the description text.`;

    try {
      setAiStatus((previous) => ({ ...previous, courseShort: true }));
      const response = await callGemini(prompt);
      const generatedText = extractGeminiText(response).trim();
      if (!generatedText) {
        throw new Error('No course short description returned.');
      }
      setCourseForm((previous) => ({ ...previous, shortDescription: generatedText }));
    } catch (error) {
      console.error(error);
      const friendlyError = getUserFriendlyErrorMessage(error, 'AI generation failed');
      toast({
        title: 'AI Generation Failed',
        description: friendlyError,
        variant: 'destructive',
      });
    } finally {
      setAiStatus((previous) => ({ ...previous, courseShort: false }));
    }
  };

  const generateCourseLongDescription = async () => {
    const quizContext = courseQuizIds
      .map((quizId) => quizById.get(quizId))
      .filter(Boolean)
      .map((quiz) => ({
        title: String(quiz?.title || ''),
        shortDescription: String(quiz?.shortDescription || quiz?.description || ''),
        difficulty: Number(quiz?.difficulty) || 2,
      }));

    const context = {
      courseTitle: courseForm.title,
      topic: courseForm.topic,
      quizzes: quizContext,
    };

    const prompt = `Write a long course description. Style example: "${COURSE_LONG_DESC_EXAMPLE}".
Use this course context JSON:
${JSON.stringify(context, null, 2)}
Return only the description text.`;

    try {
      setAiStatus((previous) => ({ ...previous, courseLong: true }));
      const response = await callGemini(prompt);
      const generatedText = extractGeminiText(response).trim();
      if (!generatedText) {
        throw new Error('No course long description returned.');
      }
      setCourseForm((previous) => ({ ...previous, longDescription: generatedText }));
    } catch (error) {
      console.error(error);
      const friendlyError = getUserFriendlyErrorMessage(error, 'AI generation failed');
      toast({
        title: 'AI Generation Failed',
        description: friendlyError,
        variant: 'destructive',
      });
    } finally {
      setAiStatus((previous) => ({ ...previous, courseLong: false }));
    }
  };

  const handleRemoveDuplicates = async () => {
    setIsDeduping(true);
    setDedupeProgress(0);
    setDedupeStatus('Starting duplicate cleanup...');
    setDedupeLogs(['Starting duplicate cleanup...']);

    try {
      const summary = await removeDuplicateAdminContent({
        onProgress: ({ progress, message }) => {
          setDedupeProgress(progress);
          setDedupeStatus(message);
          setDedupeLogs((previous) => {
            const next = [...previous, message];
            if (next.length > 12) return next.slice(next.length - 12);
            return next;
          });
        },
      });

      await loadAllContent();

      toast({
        title: 'Duplicate cleanup completed',
        description: `Deleted ${summary.deleted.total} records (Q:${summary.deleted.questions}, Quiz:${summary.deleted.quizzes}, Course:${summary.deleted.courses}).`,
      });
    } catch (error) {
      const message = error.message || 'Duplicate cleanup failed.';
      setDedupeStatus(message);
      setDedupeLogs((previous) => [...previous, message]);
      toast({
        title: 'Duplicate cleanup failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsDeduping(false);
    }
  };

  const handleCopySchema = async () => {
    try {
      await navigator.clipboard.writeText(EXPECTED_SCHEMA_TEXT);
      toast({
        title: 'Schema copied',
        description: 'The JSON schema template has been copied to your clipboard.',
      });
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: 'Could not copy the schema to clipboard.',
        variant: 'destructive',
      });
    }
  };

  const handleCopyAqusSchema = async () => {
    try {
      await navigator.clipboard.writeText(AQUS_SCHEMA_TEXT);
      toast({
        title: 'Schema copied',
        description: 'The AQUS JSON schema template has been copied to your clipboard.',
      });
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: 'Could not copy the schema to clipboard.',
        variant: 'destructive',
      });
    }
  };

  const filteredDeleteItems = useMemo(() => {
    let source = [];
    if (deleteManagerType === 'course') source = courses;
    else if (deleteManagerType === 'quiz') source = quizzes;
    else if (deleteManagerType === 'question') source = questions;

    const term = deleteManagerSearch.toLowerCase().trim();
    if (!term) return source;

    return source.filter((item) => {
      const title = (item.title || item.question_text || '').toLowerCase();
      const id = (item.id || '').toLowerCase();
      return title.includes(term) || id.includes(term);
    });
  }, [deleteManagerType, deleteManagerSearch, courses, quizzes, questions]);

  const handleToggleSelection = (id) => {
    setSelectedDeleteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = (items) => {
    setSelectedDeleteIds((prev) => {
      const allIds = items.map((i) => i.id);
      const isAllSelected = allIds.every((id) => prev.has(id));
      const next = new Set(prev);
      
      if (isAllSelected) {
        allIds.forEach((id) => next.delete(id));
      } else {
        allIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleOpenDeleteConfirm = async (itemOrItems, type) => {
    const isMultiple = Array.isArray(itemOrItems);
    if (isMultiple) {
      setMultipleItemsToDelete(itemOrItems);
      setItemToDelete(null);
    } else {
      setItemToDelete(itemOrItems);
      setMultipleItemsToDelete([]);
    }
    
    setDeleteManagerType(type);
    setIsConfirmDeleteOpen(true);
    setDeleteImpact({ summary: 'Calculating impact...' });

    try {
      if (isMultiple) {
        setDeleteImpact({ 
          summary: `Deletes ${itemOrItems.length} selected ${type}s and all their cascading references/data.` 
        });
      } else {
        const impact = await getDeleteImpact(type, itemOrItems.id);
        setDeleteImpact(impact);
      }
    } catch (err) {
      setDeleteImpact({ summary: 'Failed to calculate impact summary.' });
    }
  };

  const handleConfirmDelete = async () => {
    const itemsToProcess = itemToDelete ? [itemToDelete] : multipleItemsToDelete;
    if (itemsToProcess.length === 0) return;

    setIsSaving(true);
    const total = itemsToProcess.length;

    try {
      for (let i = 0; i < total; i++) {
        const item = itemsToProcess[i];
        const progress = Math.round((i / total) * 90) + 10;
        
        setSavingAction({
          key: 'hard-delete',
          label: `Permanently deleting ${deleteManagerType} (${i + 1}/${total}): ${
            item.title || item.question_text || item.id
          }...`,
          progress,
        });

        if (deleteManagerType === 'course') {
          await hardDeleteCourse(item.id);
        } else if (deleteManagerType === 'quiz') {
          await hardDeleteQuiz(item.id);
        } else if (deleteManagerType === 'question') {
          await hardDeleteQuestion(item.id);
        }
      }

      toast({
        title: 'Deletion successful',
        description: `Permanently removed ${total} ${deleteManagerType}(s).`,
      });

      // Refresh all data
      await loadAllContent();
      setShowRefreshPrompt(true);

      setIsConfirmDeleteOpen(false);
      setItemToDelete(null);
      setMultipleItemsToDelete([]);
      setSelectedDeleteIds(new Set());
    } catch (err) {
      console.error('Delete failed:', err);
      toast({
        title: 'Delete failed',
        description: getUserFriendlyErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
      setSavingAction({ key: '', label: '', progress: 0 });
    }
  };

  const scanForLatexErrors = async (questionsToScan) => {
    if (!questionsToScan || questionsToScan.length === 0) {
      toast({
        title: 'No questions',
        description: 'Select a course, quiz, or question first.',
        variant: 'destructive',
      });
      return;
    }

    // Reset state
    setLatexScanProgress(0);
    setLatexScanStatus('Starting LaTeX scan...');
    setLatexScanLogs(['Starting LaTeX scan...']);
    setLatexErrorQuestions([]);

    const errors = [];
    const total = questionsToScan.length;

    for (let i = 0; i < total; i++) {
      const question = questionsToScan[i];
      const qIndex = i + 1;

      const progress = Math.round((i / total) * 100);
      setLatexScanProgress(progress);
      setLatexScanStatus(`Scanning question ${qIndex} of ${total}...`);

      setLatexScanLogs(prev => {
        const next = [...prev, `Scanning question ${qIndex}: ${question.id}`];
        return next.slice(-12);
      });

      const fieldsToCheck = [
        { name: 'question_text', value: question.question_text },
        { name: 'explanation', value: question.explanation },
      ];

      if (question.metadata?.options) {
        question.metadata.options.forEach((opt, idx) => {
          if (opt.text) {
            fieldsToCheck.push({
              name: `option_${opt.id || idx}`,
              value: opt.text
            });
          }
        });
      }

      if (question.metadata?.accepted_answers) {
        question.metadata.accepted_answers.forEach((ans, idx) => {
          if (ans) {
            fieldsToCheck.push({
              name: `accepted_answer_${idx}`,
              value: ans
            });
          }
        });
      }

      const questionErrors = [];

      for (const field of fieldsToCheck) {
        if (!field.value) continue;

        const originalValue = field.value;
        const fixedValue = applySafeLatexFixes(originalValue);

        if (fixedValue !== originalValue) {
          questionErrors.push({
            field: field.name,
            type: "safe_fix_available",
            message: "Safe LaTeX cleanup available.",
            original: originalValue,
            fixed: fixedValue
          });
        }

        const textToScan = fixedValue;

        if (hasUnbalancedDelimiters(textToScan)) {
          questionErrors.push({
            field: field.name,
            type: 'unbalanced_delimiters',
            message: 'Unbalanced $ or $$ delimiters.'
          });
        }

        const latexChunks = extractLatexChunks(textToScan);

        for (const chunk of latexChunks) {
          const cleanLatex = chunk.startsWith('$$')
            ? chunk.slice(2, -2)
            : chunk.slice(1, -1);

          // Heuristic detection first
          const heuristicIssues = detectLatexHeuristics(cleanLatex);
          heuristicIssues.forEach(issue => {
            questionErrors.push({
              field: field.name,
              type: issue.type,
              latex: chunk,
              message: issue.message
            });
          });

          // KaTeX validation second
          const katexError = validateLatex(cleanLatex);
          if (katexError) {
            questionErrors.push({
              field: field.name,
              type: 'katex_error',
              latex: chunk,
              message: `Invalid LaTeX: ${katexError}`
            });
          }
        }

        if (textToScan.includes('|') && /[^\\]\|[^\\]/.test(textToScan)) {
          questionErrors.push({
            field: field.name,
            type: 'heuristic',
            message: 'Contains a pipe character (|). Consider \\mid or \\lvert/\\rvert inside math.'
          });
        }
      }


      if (questionErrors.length > 0) {
        errors.push({
          questionId: question.id,
          questionText: question.question_text,
          errors: questionErrors,
        });

        setLatexScanLogs(prev => {
          const next = [...prev, `⚠️ Issues found in question ${question.id} (${questionErrors.length})`];
          return next.slice(-12);
        });
      }

      // Yield every 10 questions to keep UI responsive
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    setLatexScanProgress(100);
    setLatexErrorQuestions(errors);

    if (errors.length === 0) {
      setLatexScanStatus('Scan complete – no LaTeX issues found.');
      setLatexScanLogs(prev => [...prev, '✅ No issues detected.']);

      toast({
        title: 'Scan complete',
        description: 'All LaTeX appears valid.'
      });
    } else {
      const totalIssues = errors.reduce((sum, q) => sum + q.errors.length, 0);

      setLatexScanStatus(
        `Scan complete – found ${errors.length} question(s) with ${totalIssues} issue(s).`
      );

      setLatexScanLogs(prev => [...prev, `❌ Found ${totalIssues} issue(s).`]);

      toast({
        title: 'LaTeX issues detected',
        description: `${errors.length} question(s) have potential problems.`,
        variant: 'destructive'
      });
    }
  };
   

  return (
    <>
      <Helmet>
        <title>Dev Content Dashboard - QuizMaster</title>
      </Helmet>

      <div className="min-h-screen">
        <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />
        <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

        <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Dev Content Dashboard</h1>
              <p className="text-slate-600 dark:text-slate-400">
                Edit courses, quizzes, and questions. Manage associations and run bulk upload/edit workflows.
              </p>
            </div>
            {showRefreshPrompt ? (
              <Button type="button" variant="outline" onClick={() => loadAllContent(false)}>
                Refresh Data
              </Button>
            ) : null}
          </div>

          <Card className="mb-6 border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-amber-900 dark:text-amber-200">Developer mode only</CardTitle>
              <CardDescription className="text-amber-800 dark:text-amber-300">
                Includes archived records and performs direct content updates.
              </CardDescription>
            </CardHeader>
          </Card>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto dark:border-indigo-400"></div>
              <p className="mt-4 text-slate-600 dark:text-slate-400">Loading content...</p>
            </div>
          ) : (
            <DataStatusOverlay
              isVisible={Boolean(contentLoadError)}
              title={isConnectionRelatedError(contentLoadError) ? 'Connection issue' : 'Unable to load content data'}
              description={getUserFriendlyErrorMessage(contentLoadError, 'Content objects could not be loaded.')}
              onRetry={() => loadAllContent(false)}
            >
            <Tabs defaultValue="courses">
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="courses">Courses</TabsTrigger>
                <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
                <TabsTrigger value="questions">Questions</TabsTrigger>
                <TabsTrigger value="bulk-quiz">Bulk Edit/Create Quiz</TabsTrigger>
                <TabsTrigger value="bulk-questions">Bulk Upload Questions</TabsTrigger>
                <TabsTrigger value="dedupe">Bulk Remove Duplicates</TabsTrigger>
                <TabsTrigger value='question-check'>Question Check</TabsTrigger>
                <TabsTrigger value="delete-manager">Delete Manager</TabsTrigger>
              </TabsList>

              <TabsContent value="courses">
                <Card>
                  <CardHeader>
                    <CardTitle>Courses</CardTitle>
                    <CardDescription>Create, modify, archive, and manage quiz associations.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="courseSelect">Select existing course</Label>
                        <select
                          id="courseSelect"
                          className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                          value={selectedCourseId}
                          onChange={(event) => setSelectedCourseId(event.target.value)}
                        >
                          <option value="">Create new course</option>
                          {visibleSortedCourses.map((course) => (
                            <option key={course.id} value={course.id}>
                              {course.title} ({course.id}) {course.isArchived ? '[archived]' : ''}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Showing {visibleSortedCourses.length} of {sortedCourses.length} courses.
                        </p>
                        {hasMoreCourses ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => setVisibleCourseCount((previous) => previous + DASHBOARD_SELECT_PAGE_SIZE)}
                          >
                            Load more courses
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label>Title</Label>
                        <Input value={courseForm.title} onChange={(event) => setCourseForm((v) => ({ ...v, title: event.target.value }))} />
                      </div>
                      <div>
                        <Label>Course code</Label>
                        <Input value={courseForm.courseCode} onChange={(event) => setCourseForm((v) => ({ ...v, courseCode: event.target.value }))} />
                      </div>
                      <div>
                        <Label>Topic</Label>
                        <Input value={courseForm.topic} onChange={(event) => setCourseForm((v) => ({ ...v, topic: event.target.value }))} />
                      </div>
                      <div>
                        <Label>Quiz IDs (display-only)</Label>
                        <Input value={courseForm.quizIds} readOnly className="cursor-not-allowed opacity-80" />
                      </div>
                    </div>

                    <div className="space-y-2 rounded-md border border-slate-300 p-3 dark:border-slate-800">
                      <Label>Current course quizzes</Label>
                      <div className="flex flex-wrap gap-2">
                        {courseQuizIds.length === 0 ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400">No quizzes linked yet.</p>
                        ) : (
                          courseQuizIds.map((quizId) => {
                            const quiz = quizById.get(quizId);
                            return (
                              <Badge key={quizId} variant="outline" className="gap-2">
                                {quiz ? truncateText(quiz.title, 48) : quizId}
                                <button type="button" onClick={() => handleRemoveQuizFromCourse(quizId)}>
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </Badge>
                            );
                          })
                        )}
                      </div>
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="min-w-[280px] flex-1">
                          <Label>Add existing quiz</Label>
                          <select
                            className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                            value={quizToAddToCourseId}
                            onChange={(event) => setQuizToAddToCourseId(event.target.value)}
                          >
                            <option value="">Select quiz</option>
                            {availableQuizzesForCourse.map((quiz) => (
                              <option key={quiz.id} value={quiz.id}>
                                {quiz.title} ({quiz.id})
                              </option>
                            ))}
                          </select>
                        </div>
                        <Button
                          variant="outline"
                          onClick={handleAddQuizToCourse}
                          disabled={isSaving || !quizToAddToCourseId}
                        >
                          Add quiz
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label>Short description</Label>
                      <textarea
                        className="mt-1 min-h-[80px] w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                        value={courseForm.shortDescription}
                        onChange={(event) =>
                          setCourseForm((v) => ({ ...v, shortDescription: event.target.value }))
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={generateCourseShortDescription}
                        disabled={isSaving || aiStatus.courseShort}
                      >
                        {aiStatus.courseShort ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          'Generate with AI'
                        )}
                      </Button>
                    </div>
                    <div>
                      <Label>Long description</Label>
                      <textarea
                        className="mt-1 min-h-[120px] w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                        value={courseForm.longDescription}
                        onChange={(event) =>
                          setCourseForm((v) => ({ ...v, longDescription: event.target.value }))
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={generateCourseLongDescription}
                        disabled={isSaving || aiStatus.courseLong}
                      >
                        {aiStatus.courseLong ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          'Generate with AI'
                        )}
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button disabled={isSaving} onClick={handleCreateCourse}>
                        {isActionRunning('create-course') ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4 mr-2" />
                        )}
                        {isActionRunning('create-course') ? 'Creating course...' : 'Create course'}
                      </Button>
                      <Button variant="outline" disabled={isSaving || !selectedCourseId} onClick={handleUpdateCourse}>
                        {isActionRunning('update-course') ? 'Saving...' : 'Save changes'}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={isSaving || !selectedCourseId}
                        onClick={handleToggleArchiveCourse}
                      >
                        {isActionRunning('toggle-archive-course') ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {selectedCourse?.isArchived ? 'Restoring...' : 'Archiving...'}
                          </>
                        ) : selectedCourse?.isArchived ? (
                          <>
                            <ArchiveRestore className="h-4 w-4 mr-2" />
                            Restore
                          </>
                        ) : (
                          <>
                            <Archive className="h-4 w-4 mr-2" />
                            Archive
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="quizzes">
                <Card>
                  <CardHeader>
                    <CardTitle>Quizzes</CardTitle>
                    <CardDescription>Create, modify, archive, assign courses, and add/remove questions.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label>Select existing quiz</Label>
                        <select
                          className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                          value={selectedQuizId}
                          onChange={(event) => setSelectedQuizId(event.target.value)}
                        >
                          <option value="">Create new quiz</option>
                          {groupedQuizzes.map((group) => (
                            <optgroup key={`${group.title}-${group.topic}`} label={`${group.title} (${group.topic})`}>
                              {group.variations.map(quiz => (
                                <option key={quiz.id} value={quiz.id}>
                                  {QUIZ_DIFFICULTY_LABELS[quiz.difficulty] || quiz.difficulty} - {quiz.id} {quiz.isArchived ? '[archived]' : ''}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Showing {visibleSortedQuizzes.length} of {sortedQuizzes.length} quizzes.
                        </p>
                        {hasMoreQuizzes ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => setVisibleQuizCount((previous) => previous + DASHBOARD_SELECT_PAGE_SIZE)}
                          >
                            Load more quizzes
                          </Button>
                        ) : null}
                      </div>
                      <div>
                        <Label>Course IDs (display-only)</Label>
                        <Input value={quizForm.courseIds} readOnly className="cursor-not-allowed opacity-80" />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label>Title</Label>
                        <Input value={quizForm.title} onChange={(event) => setQuizForm((v) => ({ ...v, title: event.target.value }))} />
                      </div>
                      <div>
                        <Label>Topic</Label>
                        <Input value={quizForm.topic} onChange={(event) => setQuizForm((v) => ({ ...v, topic: event.target.value }))} />
                      </div>
                      <div>
                        <Label>Difficulty</Label>
                        <select
                          className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                          value={quizForm.difficulty}
                          onChange={(event) => setQuizForm((v) => ({ ...v, difficulty: Number(event.target.value) }))}
                        >
                          {QUIZ_DIFFICULTY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={handleAutoDifficultyFromQuestions}
                          disabled={!selectedQuizId}
                        >
                          Auto-calc from questions
                        </Button>
                      </div>
                      <div>
                        <Label>Estimated time (minutes)</Label>
                        <Input type="number" min="1" value={quizForm.estimatedTime} onChange={(event) => setQuizForm((v) => ({ ...v, estimatedTime: Number(event.target.value) }))} />
                      </div>
                      <div className="md:col-span-2">
                        <Label>Question IDs (display-only)</Label>
                        <Input value={quizForm.questionIds} readOnly className="cursor-not-allowed opacity-80" />
                      </div>
                    </div>

                    <div>
                      <Label>Short description</Label>
                      <textarea
                        className="mt-1 min-h-[80px] w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                        value={quizForm.shortDescription}
                        onChange={(event) =>
                          setQuizForm((v) => ({ ...v, shortDescription: event.target.value }))
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={generateQuizShortDescription}
                        disabled={isSaving || aiStatus.quizShort}
                      >
                        {aiStatus.quizShort ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          'Generate with AI'
                        )}
                      </Button>
                    </div>
                    <div>
                      <Label>Long description</Label>
                      <textarea
                        className="mt-1 min-h-[120px] w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                        value={quizForm.longDescription}
                        onChange={(event) =>
                          setQuizForm((v) => ({ ...v, longDescription: event.target.value }))
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={generateQuizLongDescription}
                        disabled={isSaving || aiStatus.quizLong}
                      >
                        {aiStatus.quizLong ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          'Generate with AI'
                        )}
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        id="isTimePerQuestion"
                        type="checkbox"
                        checked={quizForm.isTimePerQuestion}
                        onChange={(event) => setQuizForm((v) => ({ ...v, isTimePerQuestion: event.target.checked }))}
                      />
                      <Label htmlFor="isTimePerQuestion">Time is per-question</Label>
                    </div>

                    <div className="space-y-2 rounded-md border border-slate-300 p-3 dark:border-slate-800">
                      <Label>Current associated courses</Label>
                      <div className="flex flex-wrap gap-2">
                        {quizLinkedCourseIds.length === 0 ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400">No course associations yet.</p>
                        ) : (
                          quizLinkedCourseIds.map((courseId) => {
                            const course = sortedCourses.find((entry) => entry.id === courseId);
                            return (
                              <Badge key={courseId} variant="outline" className="gap-2">
                                {course ? truncateText(course.title, 48) : courseId}
                                <button type="button" onClick={() => handleRemoveCourseFromQuiz(courseId)}>
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </Badge>
                            );
                          })
                        )}
                      </div>
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="min-w-[280px] flex-1">
                          <Label>Add existing course</Label>
                          <select
                            className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                            value={quizCourseToAddId}
                            onChange={(event) => setQuizCourseToAddId(event.target.value)}
                          >
                            <option value="">Select course</option>
                            {availableCoursesForQuiz.map((course) => (
                              <option key={course.id} value={course.id}>
                                {course.title} ({course.id})
                              </option>
                            ))}
                          </select>
                        </div>
                        <Button
                          variant="outline"
                          onClick={handleAddCourseToQuiz}
                          disabled={isSaving || !quizCourseToAddId}
                        >
                          Add course
                        </Button>
                      </div>
                    </div>

                    {selectedQuiz ? (
                      <div className="space-y-2 rounded-md border border-slate-300 p-3 dark:border-slate-800">
                        <Label>Current quiz questions</Label>
                        <div className="flex flex-wrap gap-2">
                          {(selectedQuiz.questionIds || []).map((questionId) => (
                            <Badge key={questionId} variant="outline" className="gap-2">
                              {formatQuestionLabel(questionById.get(questionId), 52)}
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => handleRemoveQuestionFromQuiz(questionId)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                        <div className="flex flex-wrap items-end gap-2">
                          <div className="min-w-[280px] flex-1">
                            <Label>Add existing question</Label>
                            <select
                              className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                              value={questionToAddId}
                              onChange={(event) => setQuestionToAddId(event.target.value)}
                            >
                              <option value="">Select question</option>
                              {visibleSortedQuestions.map((question) => (
                                <option key={question.id} value={question.id}>
                                  {formatQuestionLabel(question)}
                                </option>
                              ))}
                            </select>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              Showing {visibleSortedQuestions.length} of {sortedQuestions.length} questions.
                            </p>
                            {hasMoreQuestions ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={() => setVisibleQuestionCount((previous) => previous + DASHBOARD_SELECT_PAGE_SIZE)}
                              >
                                Load more questions
                              </Button>
                            ) : null}
                          </div>
                          <Button variant="outline" onClick={handleAddQuestionToQuiz} disabled={isSaving || !questionToAddId}>
                            {isActionRunning('add-question-to-quiz') ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Adding question...
                              </>
                            ) : (
                              'Add question'
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      <Button disabled={isSaving} onClick={handleCreateQuiz}>
                        {isActionRunning('create-quiz') ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4 mr-2" />
                        )}
                        {isActionRunning('create-quiz') ? 'Creating quiz...' : 'Create quiz'}
                      </Button>
                      <Button variant="outline" disabled={isSaving || !selectedQuizId} onClick={handleUpdateQuiz}>
                        {isActionRunning('update-quiz') ? 'Saving...' : 'Save changes'}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={isSaving || !selectedQuizId}
                        onClick={handleToggleArchiveQuiz}
                      >
                        {isActionRunning('toggle-archive-quiz') ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {selectedQuiz?.isArchived ? 'Restoring...' : 'Archiving...'}
                          </>
                        ) : selectedQuiz?.isArchived ? (
                          <>
                            <ArchiveRestore className="h-4 w-4 mr-2" />
                            Restore
                          </>
                        ) : (
                          <>
                            <Archive className="h-4 w-4 mr-2" />
                            Archive
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="dedupe">
                <Card>
                  <CardHeader>
                    <CardTitle>Remove Strict Duplicates</CardTitle>
                    <CardDescription>
                      Removes duplicate questions, quizzes, and courses. A single semantic-field difference means records are kept as different.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button
                      variant="destructive"
                      disabled={isDeduping || isSaving}
                      onClick={handleRemoveDuplicates}
                    >
                      {isDeduping ? 'Removing duplicates...' : 'Remove duplicates across all objects'}
                    </Button>

                    <div className="space-y-2">
                      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div
                          className="h-full bg-red-500 transition-all duration-300 dark:bg-red-600"
                          style={{ width: `${Math.max(0, Math.min(100, dedupeProgress))}%` }}
                        />
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{dedupeStatus}</p>
                    </div>

                    <div className="rounded-md border border-slate-300 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                      <Label>Progress log</Label>
                      <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                        {dedupeLogs.map((entry, index) => (
                          <p key={`${entry}-${index}`}>{entry}</p>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="questions">
                <Card>
                  <CardHeader>
                    <CardTitle>Questions</CardTitle>
                    <CardDescription>Create, modify, and archive questions.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Select existing question</Label>
                      <select
                        className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                        value={selectedQuestionId}
                        onChange={(event) => setSelectedQuestionId(event.target.value)}
                      >
                        <option value="">Create new question</option>
                        {visibleSortedQuestions.map((question) => (
                          <option key={question.id} value={question.id}>
                            {formatQuestionLabel(question)} {question.isArchived ? '[archived]' : ''}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Showing {visibleSortedQuestions.length} of {sortedQuestions.length} questions.
                      </p>
                      {hasMoreQuestions ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => setVisibleQuestionCount((previous) => previous + DASHBOARD_SELECT_PAGE_SIZE)}
                        >
                          Load more questions
                        </Button>
                      ) : null}
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label>Type</Label>
                        <select
                          className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                          value={questionForm.type}
                          onChange={(event) => setQuestionForm((v) => ({ ...v, type: event.target.value }))}
                        >
                          <option value="mcq">mcq</option>
                          <option value="short_answer">short_answer</option>
                          <option value="numeric">numeric</option>
                          <option value="long_answer">long_answer</option>
                        </select>
                      </div>
                      <div>
                        <Label>Topic</Label>
                        <Input value={questionForm.topic} onChange={(event) => setQuestionForm((v) => ({ ...v, topic: event.target.value }))} />
                      </div>
                      <div>
                        <Label>Difficulty (1-3)</Label>
                        <Input type="number" min="1" max="3" value={questionForm.difficulty} onChange={(event) => setQuestionForm((v) => ({ ...v, difficulty: Number(event.target.value) }))} />
                      </div>
                      <div>
                        <Label>Skill category</Label>
                        <select
                          className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                          value={questionForm.skillCategory}
                          onChange={(event) => setQuestionForm((v) => ({ ...v, skillCategory: Number(event.target.value) }))}
                        >
                          {SKILL_CATEGORY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <Label>Question text</Label>
                      <textarea
                        className="mt-1 min-h-[100px] w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                        value={questionForm.question_text}
                        onChange={(event) => setQuestionForm((v) => ({ ...v, question_text: event.target.value }))}
                      />
                    </div>

                    <div>
                      <Label>Explanation</Label>
                      <textarea
                        className="mt-1 min-h-[80px] w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                        value={questionForm.explanation}
                        onChange={(event) => setQuestionForm((v) => ({ ...v, explanation: event.target.value }))}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <Label>Metadata JSON</Label>
                        <Button type="button" variant="ghost" size="sm" onClick={handlePasteMetadataJson} className="h-6 px-2 text-xs">
                          <Copy className="h-3 w-3 mr-1" /> Paste from clipboard
                        </Button>
                      </div>
                      <textarea
                        className="mt-1 min-h-[180px] w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 font-mono text-xs dark:border-slate-800 dark:bg-slate-950"
                        value={questionForm.metadataJson}
                        onChange={(event) => setQuestionForm((v) => ({ ...v, metadataJson: event.target.value }))}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button disabled={isSaving} onClick={handleCreateQuestion}>
                        {isActionRunning('create-question') ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4 mr-2" />
                        )}
                        {isActionRunning('create-question') ? 'Creating question...' : 'Create question'}
                      </Button>
                      <Button variant="outline" disabled={isSaving || !selectedQuestionId} onClick={handleUpdateQuestion}>
                        {isActionRunning('update-question') ? 'Saving...' : 'Save changes'}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={isSaving || !selectedQuestionId}
                        onClick={handleToggleArchiveQuestion}
                      >
                        {isActionRunning('toggle-archive-question') ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {selectedQuestion?.isArchived ? 'Restoring...' : 'Archiving...'}
                          </>
                        ) : selectedQuestion?.isArchived ? (
                          <>
                            <ArchiveRestore className="h-4 w-4 mr-2" />
                            Restore
                          </>
                        ) : (
                          <>
                            <Archive className="h-4 w-4 mr-2" />
                            Archive
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="bulk-quiz">
                <Card>
                  <CardHeader>
                    <CardTitle>Bulk Edit Quiz</CardTitle>
                    <CardDescription>
                      Create a new quiz from upload, or select an existing quiz to generate linked questions in upload format for bulk edits.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="md:col-span-2 space-y-2">
                        <Label>Select existing quiz (optional)</Label>
                        <select
                          className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                          value={bulkForm.selectedQuizId}
                          onChange={(event) => handleSelectBulkQuiz(event.target.value)}
                        >
                          <option value="">Create new quiz from upload</option>
                          {groupedQuizzes.map((group) => (
                            <optgroup key={`bulk-${group.title}-${group.topic}`} label={`${group.title} (${group.topic})`}>
                              {group.variations.map(quiz => (
                                <option key={quiz.id} value={quiz.id}>
                                  {QUIZ_DIFFICULTY_LABELS[quiz.difficulty] || quiz.difficulty} - {quiz.id} {quiz.isArchived ? '[archived]' : ''}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Showing {visibleSortedQuizzes.length} of {sortedQuizzes.length} quizzes.
                        </p>
                        {hasMoreQuizzes ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => setVisibleQuizCount((previous) => previous + DASHBOARD_SELECT_PAGE_SIZE)}
                          >
                            Load more quizzes
                          </Button>
                        ) : null}
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          For existing quizzes, keep uploaded question count equal to linked question count so edits can be mapped by order.
                        </p>
                        {!bulkForm.selectedQuizId && (
                           <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-md dark:bg-slate-900 dark:border-slate-800 flex items-center justify-between">
                              <div>
                                <Label className="text-base text-slate-900 dark:text-white">Upload Mode</Label>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                  Choose how to enter quiz information for the new quiz.
                                </p>
                              </div>
                              <div className="flex gap-2 bg-slate-200 dark:bg-slate-800 p-1 rounded-md">
                                <button
                                  type="button"
                                  onClick={() => setBulkUploadMode('manual')}
                                  className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${bulkUploadMode === 'manual' ? 'bg-white shadow-sm dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                                >
                                  Manual
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setBulkUploadMode('json')}
                                  className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${bulkUploadMode === 'json' ? 'bg-white shadow-sm dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                                >
                                  JSON Schema
                                </button>
                              </div>
                           </div>
                        )}
                      </div>

                      {(!bulkForm.selectedQuizId && bulkUploadMode === 'json') ? (
                        <div className="md:col-span-2">
                           <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900">
                              <button
                                type="button"
                                onClick={() => setIsPromptExpanded(!isPromptExpanded)}
                                className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                              >
                                <div>
                                   <div className="font-medium text-slate-900 dark:text-white text-sm">Generate AI Prompt</div>
                                   <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Create a prompt to generate the quiz JSON</div>
                                </div>
                                <div className="text-slate-400">
                                   <ChevronDown className={`h-5 w-5 transition-transform ${isPromptExpanded ? 'rotate-180' : ''}`} />
                                </div>
                              </button>
                              
                              {isPromptExpanded && (
                                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                                   <div className="flex justify-end">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCopyQuizDescriptionPrompt}
                                        className="h-7 px-2 text-xs"
                                      >
                                        <Copy className="h-3 w-3 mr-1" />
                                        Copy Quiz Description Prompt
                                      </Button>
                                   </div>
                                   <div className="flex items-center justify-between">
                                      <Label className="text-xs">Quiz Description / Source Text</Label>
                                      <Button type="button" variant="outline" size="sm" onClick={handlePastePromptInput} className="h-6 px-2 text-xs">
                                        <Copy className="h-3 w-3 mr-1" /> Paste Content
                                      </Button>
                                   </div>
                                   <textarea
                                     className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm min-h-[120px] dark:border-slate-700 dark:bg-slate-950 resize-y"
                                     placeholder="e.g. Generate 5 questions about React Hooks..."
                                     value={promptInput}
                                     onChange={(e) => setPromptInput(e.target.value)}
                                   />
                                   <div className="flex justify-end mt-2">
                                      <Button type="button" onClick={handleCopyQuizGenerationPrompt} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600">
                                         <Copy className="h-4 w-4 mr-1.5" />
                                         Copy Full Prompt
                                      </Button>
                                   </div>
                                </div>
                              )}
                           </div>
                        </div>
                      ) : (
                        <>
                          <div>
                            <Label>Quiz title</Label>
                            <Input value={bulkForm.title} onChange={(event) => setBulkForm((v) => ({ ...v, title: event.target.value }))} />
                          </div>
                          <div>
                            <Label>Topic <span className="text-slate-400 font-normal text-xs ml-1">(Optional)</span></Label>
                            <Input value={bulkForm.topic} onChange={(event) => setBulkForm((v) => ({ ...v, topic: event.target.value }))} />
                          </div>
                          <div>
                            <Label>Difficulty</Label>
                            <select
                              className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                              value={bulkForm.difficulty}
                              onChange={(event) => setBulkForm((v) => ({ ...v, difficulty: Number(event.target.value) }))}
                            >
                              {QUIZ_DIFFICULTY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-2"
                              onClick={handleAutoBulkDifficultyFromQuestions}
                              disabled={!bulkForm.selectedQuizId}
                            >
                              Auto-calc from questions
                            </Button>
                          </div>
                          <div>
                            <Label>Estimated time (minutes) <span className="text-slate-400 font-normal text-xs ml-1">(Optional)</span></Label>
                            <Input type="number" min="1" value={bulkForm.estimatedTime} onChange={(event) => setBulkForm((v) => ({ ...v, estimatedTime: Number(event.target.value) }))} />
                          </div>
                          {bulkForm.selectedQuizId && (
                            <div className="md:col-span-2">
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={handleCreateNewVariation}
                                className="w-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Create New Difficulty Variation
                              </Button>
                              <p className="mt-1 text-[10px] text-slate-500 text-center">
                                This will populate a new quiz with these questions. Change difficulty and JSON before upload.
                              </p>
                            </div>
                          )}
                          
                          {showVariationPromptOptions && !bulkForm.selectedQuizId && (
                            <div className="mt-4 p-4 border rounded-lg bg-slate-50 dark:bg-slate-900 border-amber-200 dark:border-amber-900">
                              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <Plus className="h-4 w-4 text-amber-600" />
                                Variation Prompt Generator
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                <div className="space-y-2">
                                  <Label>Target Difficulty</Label>
                                  <div className="flex gap-2">
                                    {QUIZ_DIFFICULTY_OPTIONS.map((opt) => (
                                      <Button
                                        key={opt.value}
                                        type="button"
                                        variant={targetVariationDifficulty === opt.value ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setTargetVariationDifficulty(opt.value)}
                                        className="flex-1"
                                      >
                                        {opt.label}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                                <Button 
                                  onClick={handleCopyVariationPrompt}
                                  className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                                >
                                  <Copy className="mr-2 h-4 w-4" />
                                  Copy Variation Prompt
                                </Button>
                              </div>
                              <p className="mt-3 text-xs text-muted-foreground">
                                Select a difficulty level and copy the prompt. Paste it into your AI tool with the current quiz JSON to generate a new variation.
                              </p>
                            </div>
                          )}
                          <div className="md:col-span-2">
                            <Label>Question IDs (display-only)</Label>
                            <Input
                              value={(selectedBulkQuiz?.questionIds || []).join(', ')}
                              readOnly
                              className="cursor-not-allowed opacity-80"
                            />
                          </div>
                          
                        </>
                      )}
                      
                      <div className="md:col-span-2">
                            <Label>Course IDs (display-only)</Label>
                            <Input value={bulkForm.courseIds} readOnly className="cursor-not-allowed opacity-80" />
                          </div>
                    </div>

                    {(!bulkForm.selectedQuizId && bulkUploadMode === 'json') ? null : (
                      <>
                    <div>
                      <Label>Short description <span className="text-slate-400 font-normal text-xs ml-1">(Optional)</span></Label>
                      <textarea
                        className="mt-1 min-h-[80px] w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                        value={bulkForm.shortDescription}
                        onChange={(event) =>
                          setBulkForm((v) => ({ ...v, shortDescription: event.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <Label>Long description <span className="text-slate-400 font-normal text-xs ml-1">(Optional)</span></Label>
                      <textarea
                        className="mt-1 min-h-[120px] w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                        value={bulkForm.longDescription}
                        onChange={(event) =>
                          setBulkForm((v) => ({ ...v, longDescription: event.target.value }))
                        }
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        id="bulkTimePerQuestion"
                        type="checkbox"
                        checked={bulkForm.isTimePerQuestion}
                        onChange={(event) => setBulkForm((v) => ({ ...v, isTimePerQuestion: event.target.checked }))}
                      />
                      <Label htmlFor="bulkTimePerQuestion">Time is per-question</Label>
                    </div>
                    </>
                    )}

                    <div className="space-y-2 rounded-md border border-slate-300 p-3 dark:border-slate-800">
                      <Label>Current associated courses</Label>
                      <div className="flex flex-wrap gap-2">
                        {bulkLinkedCourseIds.length === 0 ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400">No course associations yet.</p>
                        ) : (
                          bulkLinkedCourseIds.map((courseId) => {
                            const course = sortedCourses.find((entry) => entry.id === courseId);
                            return (
                              <Badge key={courseId} variant="outline" className="gap-2">
                                {course ? truncateText(course.title, 48) : courseId}
                                <button type="button" onClick={() => handleRemoveCourseFromBulkQuiz(courseId)}>
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </Badge>
                            );
                          })
                        )}
                      </div>
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="min-w-[280px] flex-1">
                          <Label>Add existing course</Label>
                          <select
                            className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                            value={bulkCourseToAddId}
                            onChange={(event) => setBulkCourseToAddId(event.target.value)}
                          >
                            <option value="">Select course</option>
                            {availableCoursesForBulkQuiz.map((course) => (
                              <option key={course.id} value={course.id}>
                                {course.title} ({course.id})
                              </option>
                            ))}
                          </select>
                        </div>
                        <Button
                          variant="outline"
                          onClick={handleAddCourseToBulkQuiz}
                          disabled={isSaving || !bulkCourseToAddId}
                        >
                          Add course
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Upload JSON file</Label>
                      <Input type="file" accept=".json,application/json" onChange={handleBulkQuizUploadFile} />
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <Label>{(!bulkForm.selectedQuizId && bulkUploadMode === 'json') ? 'Quiz JSON' : 'Questions JSON'}</Label>
                        <div className="flex gap-2">
                          <Button type="button" variant="ghost" size="sm" onClick={() => handleCopyJson(bulkForm.uploadText)} className="h-6 px-2 text-xs">
                            <Copy className="h-3 w-3 mr-1" /> Copy
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => handlePasteJson(setBulkForm)} className="h-6 px-2 text-xs">
                            <Plus className="h-3 w-3 mr-1" /> Paste
                          </Button>
                        </div>
                      </div>
                      <textarea
                        className="mt-1 min-h-[220px] w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 font-mono text-xs dark:border-slate-800 dark:bg-slate-950"
                        value={bulkForm.uploadText}
                        onChange={(event) => setBulkForm((v) => ({ ...v, uploadText: event.target.value }))}
                      />
                    </div>

                    <Card className="mb-6">
                      <button
                        type="button"
                        onClick={() => setSchema(!schema)}
                        className="w-full flex items-center justify-between text-left rounded-xl border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
                      >
                        <div>
                          <CardHeader className="py-4 px-2">
                            <CardTitle className="text-base text-amber-900 dark:text-amber-200">Expected Schema</CardTitle>
                          </CardHeader>
                        </div>
                        <ChevronDown className={`h-6 w-6 font-bold md:font-extrabold mr-2 text-white ${schema ? 'rotate-180' : ''}`} />
                      </button>
                    {schema && ( 
                      <CardContent className="max-h-96 overflow-auto scrollbar-thin scrollbar-thumb-amber-200 dark:scrollbar-thumb-amber-800">
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          {(!bulkForm.selectedQuizId && bulkUploadMode === 'json') ? (
                            <>
                              <pre>
{AQUS_SCHEMA_TEXT}
                              </pre>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={handleCopyAqusSchema} 
                                className="mt-4 border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
                              >
                                <Copy className="mr-2 h-4 w-4" /> Copy Schema
                              </Button>
                            </>
                          ) : (
                            <>
                              <pre>
{EXPECTED_SCHEMA_TEXT}
                              </pre>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={handleCopySchema} 
                                className="mt-4 border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
                              >
                                <Copy className="mr-2 h-4 w-4" /> Copy Schema
                              </Button>
                            </>
                          )}
                        </div>
                      </CardContent>
                    )}
                    </Card>

                    <Button disabled={isSaving} onClick={handleBulkUpsertQuiz}>
                      {isActionRunning('bulk-upsert-quiz') ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {isActionRunning('bulk-upsert-quiz')
                        ? bulkForm.selectedQuizId
                          ? 'Applying edits...'
                          : 'Creating quiz...'
                        : bulkForm.selectedQuizId
                          ? 'Apply bulk edits to selected quiz'
                          : 'Create quiz from upload'}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="bulk-questions">
                <Card>
                  <CardHeader>
                    <CardTitle>Bulk Upload Questions</CardTitle>
                    <CardDescription>
                      Upload JSON following `schemas/question.upload.json.schema.json` to batch create question objects.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Upload JSON file</Label>
                      <Input type="file" accept=".json,application/json" onChange={handleBulkQuestionUploadFile} />
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <Label>Questions JSON</Label>
                        <div className="flex gap-2">
                          <Button type="button" variant="ghost" size="sm" onClick={() => handleCopyJson(bulkQuestionForm.uploadText)} className="h-6 px-2 text-xs">
                            <Copy className="h-3 w-3 mr-1" /> Copy
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => handlePasteJson(setBulkQuestionForm)} className="h-6 px-2 text-xs">
                            <Plus className="h-3 w-3 mr-1" /> Paste
                          </Button>
                        </div>
                      </div>
                      <textarea
                        className="mt-1 min-h-[220px] w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 font-mono text-xs dark:border-slate-800 dark:bg-slate-950"
                        value={bulkQuestionForm.uploadText}
                        onChange={(event) => setBulkQuestionForm((v) => ({ ...v, uploadText: event.target.value }))}
                      />
                    </div>

                    <Card className="mb-6">
                      <button
                        type="button"
                        onClick={() => setSchema(!schema)}
                        className="w-full flex items-center justify-between text-left rounded-xl border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
                      >
                        <div>
                          <CardHeader className="py-4 px-2">
                            <CardTitle className="text-base text-amber-900 dark:text-amber-200">Expected Schema</CardTitle>
                          </CardHeader>
                        </div>
                        <ChevronDown className={`h-6 w-6 font-bold md:font-extrabold mr-2 text-white ${schema ? 'rotate-180' : ''}`} />
                      </button>
                    {schema && ( 
                      <CardContent className="max-h-96 overflow-auto scrollbar-thin scrollbar-thumb-amber-200 dark:scrollbar-thumb-amber-800 scrollbar-track-transparent">
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          <pre>
{EXPECTED_SCHEMA_TEXT}
                          </pre>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleCopySchema} 
                            className="mt-4 border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
                          >
                            <Copy className="mr-2 h-4 w-4" /> Copy Schema
                          </Button>
                        </div>
                      </CardContent>
                    )}
                    </Card>

                    <Button disabled={isSaving} onClick={handleBulkCreateQuestions}>
                      {isActionRunning('bulk-create-questions') ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {isActionRunning('bulk-create-questions')
                        ? 'Creating questions...'
                        : 'Create questions from upload'}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="question-check">
                <Card>
                  <CardHeader>
                    <CardTitle>Question Check</CardTitle>
                    <CardDescription>Inspect Question Display and Track LaTeX Rendering Errors</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Selection controls */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="courseSelect">Select course</Label>
                          <select
                            id="courseSelect"
                            className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                            value={selectedCourseId}
                            onChange={(event) => {
                              setSelectedCourseId(event.target.value);
                              setSelectedQuizId('');
                              setSelectedQuestionId('');
                            }}
                          >
                            <option value="">Select a course</option>
                            {visibleSortedCourses.map((course) => (
                              <option key={course.id} value={course.id}>
                                {course.title} ({course.id}) {course.isArchived ? '[archived]' : ''}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Showing {visibleSortedCourses.length} of {sortedCourses.length} courses.
                          </p>
                          {hasMoreCourses ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-2"
                              onClick={() => setVisibleCourseCount((previous) => previous + DASHBOARD_SELECT_PAGE_SIZE)}
                            >
                              Load more courses
                            </Button>
                          ) : null}
                        </div>

                        <div>
                          <Label>Select quiz</Label>
                          <select
                            className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                            value={selectedQuizId}
                            onChange={(event) => {
                              setSelectedQuizId(event.target.value);
                              setSelectedQuestionId('');
                              setSelectedCourseId('');
                            }}
                          >
                            <option value="">Select a quiz</option>
                            {groupedQuizzes.map((group) => (
                              <optgroup key={`${group.title}-${group.topic}`} label={`${group.title} (${group.topic})`}>
                                {group.variations.map(quiz => (
                                  <option key={quiz.id} value={quiz.id}>
                                    {QUIZ_DIFFICULTY_LABELS[quiz.difficulty] || quiz.difficulty} - {quiz.id} {quiz.isArchived ? '[archived]' : ''}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Showing {visibleSortedQuizzes.length} of {sortedQuizzes.length} quizzes.
                          </p>
                          {hasMoreQuizzes ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-2"
                              onClick={() => setVisibleQuizCount((previous) => previous + DASHBOARD_SELECT_PAGE_SIZE)}
                            >
                              Load more quizzes
                            </Button>
                          ) : null}
                        </div>

                        <div>
                          <Label>Select question</Label>
                          <select
                            className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                            value={selectedQuestionId}
                            onChange={(event) => {
                              setSelectedQuestionId(event.target.value);
                              setSelectedCourseId('');
                              setSelectedQuizId('');
                            }}
                          >
                            <option value="">Select a question</option>
                            {visibleSortedQuestions.map((question) => (
                              <option key={question.id} value={question.id}>
                                {formatQuestionLabel(question)}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Showing {visibleSortedQuestions.length} of {sortedQuestions.length} questions.
                          </p>
                          {hasMoreQuestions ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-2"
                              onClick={() => setVisibleQuestionCount((previous) => previous + DASHBOARD_SELECT_PAGE_SIZE)}
                            >
                              Load more questions
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      {/* Questions Display */}
                      <div className="mt-8">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold">
                            Questions ({displayQuestions.length})
                          </h3>
                          {displayQuestions.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {selectedCourseId && 'Course: ' + (courses.find(c => c.id === selectedCourseId)?.title || '')}
                              {selectedQuizId &&  'Quiz: ' + (quizzes.find(q => q.id === selectedQuizId)?.title || '')}
                              {selectedQuestionId && 'Single Question'}
                            </Badge>
                          )}
                        </div>

                        {displayQuestions.length === 0 ? (
                          <div className="text-center py-12 border-2 border-dashed border-slate-300 rounded-lg dark:border-slate-700">
                            <p className="text-slate-500 dark:text-slate-400">
                              Select a course, quiz, or question to view questions
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type='button'
                                variant='default'
                                size='sm'
                                onClick={() => {
                                  if (!editDisplayedQuestions) {
                                    const newEditing = {};
                                    displayQuestions.forEach(q => {
                                      newEditing[q.id] = {
                                        type: q.type,
                                        question_text: q.question_text,
                                        explanation: q.explanation || '',
                                        metadataJson: JSON.stringify(q.metadata || {}, null, 2),
                                        difficulty: q.difficulty,
                                        topic: q.topic,
                                        skillCategory: q.skillCategory,
                                        isArchived: q.isArchived,
                                      };
                                    });
                                    setEditingQuestions(newEditing);
                                  }
                                  setEditDisplayedQuestions(prev => !prev);
                                }}
                              >
                                {editDisplayedQuestions ? 'View Mode' : 'Edit Mode'}
                              </Button>

                              {editDisplayedQuestions && Object.keys(editingQuestions).length > 0 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800"
                                  onClick={handleSaveAllQuestionChanges}
                                  disabled={isSaving}
                                >
                                  {isSaving ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <Plus className="h-4 w-4 mr-2" />
                                  )}
                                  Save All Changes
                                </Button>
                              )}
                            </div>
                            <div className="space-y-4 mb-2 max-h-[600px] overflow-y-auto pr-2 md:grid md:grid-cols-2">
                              {displayQuestions.map((question, index) => (
                                <>
                                  {editDisplayedQuestions ? (
                                    <div key={question.id} className="border md:p-4 md:mx-2 rounded-lg border-gray-400 space-y-4">
                                      <p className="text-xs font-medium text-slate-600">Editing Question {index + 1}</p>
                                      
                                      {/* Question text */}
                                      <div>
                                        <Label>Question text</Label>
                                        <textarea
                                          className="mt-1 min-h-[100px] w-full rounded-md border border-slate-300/10 bg-slate-100 px-3 py-2 text-sm text-black dark:text-slate-300 dark:bg-slate-950"
                                          value={editingQuestions[question.id]?.question_text || ''}
                                          onChange={(e) => setEditingQuestions(prev => ({
                                            ...prev,
                                            [question.id]: { ...prev[question.id], question_text: e.target.value }
                                          }))}
                                        />
                                      </div>

                                      {/* Explanation */}
                                      <div>
                                        <Label>Explanation</Label>
                                        <textarea
                                          className="mt-1 min-h-[80px] w-full rounded-md border border-slate-300/10 bg-slate-100 px-3 py-2 text-sm text-black dark:text-slate-300 dark:bg-slate-950"
                                          value={editingQuestions[question.id]?.explanation || ''}
                                          onChange={(e) => setEditingQuestions(prev => ({
                                            ...prev,
                                            [question.id]: { ...prev[question.id], explanation: e.target.value }
                                          }))}
                                        />
                                      </div>

                                      {/* Metadata JSON */}
                                      <div>
                                        <Label>Metadata JSON</Label>
                                        <textarea
                                          className="mt-1 min-h-[180px] w-full rounded-md border border-slate-300/10 bg-slate-100 px-3 py-2 font-mono text-xs text-black dark:text-slate-300 dark:bg-slate-950"
                                          value={editingQuestions[question.id]?.metadataJson || ''}
                                          onChange={(e) => setEditingQuestions(prev => ({
                                            ...prev,
                                            [question.id]: { ...prev[question.id], metadataJson: e.target.value }
                                          }))}
                                        />
                                      </div>

                                      {/* Update button for this question */}
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={async () => {
                                          const data = editingQuestions[question.id];
                                          try {
                                            const metadata = JSON.parse(data.metadataJson);
                                            await updateAdminQuestion(question.id, {
                                              type: data.type,
                                              question_text: data.question_text,
                                              explanation: data.explanation,
                                              metadata,
                                              difficulty: data.difficulty,
                                              topic: data.topic,
                                              skillCategory: data.skillCategory,
                                              isArchived: data.isArchived,
                                            });
                                            toast({ title: 'Question updated' });
                                            // Optionally refresh the displayQuestions
                                            const updated = displayQuestions.map(q =>
                                              q.id === question.id ? { ...q, ...data, metadata } : q
                                            );
                                            setDisplayQuestions(updated);
                                          } catch (err) {
                                            toast({ title: 'Invalid JSON', variant: 'destructive' });
                                          }
                                        }}
                                      >
                                        Save this question
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="space-y-3 p-3">
                                      <p className="text-xs font-medium text-slate-600">Question {index + 1}:</p>
                                      <QuestionCard question={flattenQuestion(question)} selectedAnswer="" onAnswerChange={() => {}} showResult={true} />
                                    </div>
                                  )}
                                </>
                              ))}
                            </div>
                            <div>
                              <Button
                                type="button"
                                variant="default"
                                size="sm"
                                onClick={() => scanForLatexErrors(displayQuestions)}
                                disabled={isSaving || latexScanProgress > 0 && latexScanProgress < 100}
                              >
                                {latexScanProgress > 0 && latexScanProgress < 100 ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Scanning...
                                  </>
                                ) : (
                                  'Scan for LaTeX Errors'
                                )}
                              </Button>

                              {latexErrorQuestions.some(q => q.errors.some(e => e.type === 'safe_fix_available')) && (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="ml-2 bg-green-50 text-green-700 hover:bg-green-100 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800"
                                  onClick={handleFixAllLatex}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Fix All Safe Issues
                                </Button>
                              )}
                            </div>
                            {/* Progress bar */}
                            {latexScanProgress > 0 && (
                              <div className="mt-4 space-y-2">
                                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                                  <div
                                    className="h-full bg-indigo-500 transition-all duration-300 dark:bg-indigo-400"
                                    style={{ width: `${latexScanProgress}%` }}
                                  />
                                </div>
                                <p className="text-sm text-slate-700 dark:text-slate-300">{latexScanStatus}</p>
                              </div>
                            )}

                            {/* Logs */}
                            {latexScanLogs.length > 0 && (
                              <div className="mt-4 rounded-md border border-slate-300 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                                <Label>Scan log</Label>
                                <div className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-slate-600 dark:text-slate-400">
                                  {latexScanLogs.map((entry, idx) => (
                                    <p key={idx}>{entry}</p>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Error questions list */}
                            {latexErrorQuestions.length > 0 && (
                              <div className="mt-6">
                                <h4 className="mb-2 text-sm font-semibold text-red-600 dark:text-red-400">
                                  Questions with LaTeX errors ({latexErrorQuestions.length})
                                </h4>
                                <div className="max-h-80 space-y-3 overflow-y-auto rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/20">
                                  {latexErrorQuestions.map((item) => (
                                    <Card key={item.questionId} className="border-l-4 border-l-red-500">
                                      <CardHeader className="py-2">
                                        <CardTitle className="text-xs font-medium">
                                          {item.questionId}
                                        </CardTitle>
                                        <CardDescription className="text-xs">
                                          {truncateText(item.questionText, 100)}
                                        </CardDescription>
                                      </CardHeader>
                                      <CardContent className="py-2">
                                        <ul className="list-disc space-y-1 pl-4 text-xs text-red-700 dark:text-red-300">
                                          {item.errors.map((err, idx) => (
                                            <li key={idx} className="flex flex-col gap-1">
                                              <div>
                                                <span className="font-mono">[{err.field}]</span> {err.message || err.latex}
                                              </div>
                                              {err.type === "safe_fix_available" && (
                                                <div className="flex items-center gap-2 mt-1">
                                                   <Badge variant="outline" className="bg-slate-200 text-slate-700 text-[10px] py-0">
                                                      Fix: {truncateText(err.fixed, 40)}
                                                   </Badge>
                                                   <Button 
                                                      size="sm" 
                                                      variant="link" 
                                                      className="h-auto p-0 text-[10px] text-indigo-600 font-bold"
                                                      onClick={() => handleApplySafeFix(item.questionId, err.field, err.fixed)}
                                                   >
                                                      Apply Safe Fix
                                                   </Button>
                                                </div>
                                              )}
                                            </li>
                                          ))}
                                        </ul>
                                      </CardContent>
                                    </Card>
                                  ))}
                                  <Button
                                    type='button'
                                    variant='default'
                                    size='sm'
                                    onClick={() => setDisplayQuestions(latexErrorQuestions.map((item) => displayQuestions.find((q) => q.id === item.questionId)))}
                                  >
                                    Show questions with Errors
                                  </Button>
                                </div>
                              </div>
                            )}                            
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="delete-manager">
                <Card>
                  <CardHeader>
                    <CardTitle>Delete Manager</CardTitle>
                    <CardDescription>
                      Permanently delete content and all its linked data. This is a TRUE hard delete system.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                      <div className="w-full md:w-48">
                        <Label>Content Type</Label>
                        <select
                          className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                          value={deleteManagerType}
                          onChange={(e) => {
                            setDeleteManagerType(e.target.value);
                            setDeleteManagerSearch('');
                            setSelectedDeleteIds(new Set());
                          }}
                        >
                          <option value="course">Courses</option>
                          <option value="quiz">Quizzes</option>
                          <option value="question">Questions</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <Label>Search by Title or ID</Label>
                        <div className="relative mt-1">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            className="pl-9"
                            placeholder={`Search ${deleteManagerType}s...`}
                            value={deleteManagerSearch}
                            onChange={(e) => setDeleteManagerSearch(e.target.value)}
                          />
                        </div>
                      </div>
                      {selectedDeleteIds.size > 0 && (
                        <div className="flex items-center gap-2 animate-in slide-in-from-right-4">
                           <Button 
                            variant="destructive" 
                            size="sm"
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => {
                              const items = filteredDeleteItems.filter(i => selectedDeleteIds.has(i.id));
                              handleOpenDeleteConfirm(items, deleteManagerType);
                            }}
                           >
                             <Trash2 className="h-4 w-4 mr-2" />
                             Delete Selected ({selectedDeleteIds.size})
                           </Button>
                           <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setSelectedDeleteIds(new Set())}
                           >
                             Clear
                           </Button>
                        </div>
                      )}
                    </div>

                    <div className="rounded-md border border-slate-200 dark:border-slate-800">
                      <div className="max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                        {filteredDeleteItems.length === 0 ? (
                          <div className="p-8 text-center text-slate-500">
                            No {deleteManagerType}s found matching your search.
                          </div>
                        ) : (
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-10">
                              <tr>
                                <th className="px-4 py-2 text-left w-10">
                                  <input 
                                    type="checkbox" 
                                    className="rounded border-slate-300"
                                    checked={filteredDeleteItems.length > 0 && filteredDeleteItems.every(i => selectedDeleteIds.has(i.id))}
                                    onChange={() => handleSelectAll(filteredDeleteItems)}
                                  />
                                </th>
                                <th className="px-4 py-2 text-left font-medium">Title / ID</th>
                                <th className="px-4 py-2 text-left font-medium">Type</th>
                                <th className="px-4 py-2 text-right font-medium">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {filteredDeleteItems.map((item) => (
                                <tr key={item.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-900/50 ${selectedDeleteIds.has(item.id) ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''}`}>
                                  <td className="px-4 py-3">
                                    <input 
                                      type="checkbox" 
                                      className="rounded border-slate-300"
                                      checked={selectedDeleteIds.has(item.id)}
                                      onChange={() => handleToggleSelection(item.id)}
                                    />
                                  </td>
                                  <td className="px-4 py-3 cursor-pointer" onClick={() => handleToggleSelection(item.id)}>
                                    <div className="font-medium text-slate-900 dark:text-slate-100">
                                      {item.title || truncateText(item.question_text, 80) || 'Untitled'} {item.difficulty ? `- ${QUIZ_DIFFICULTY_LABELS[item.difficulty]}` : ''}
                                    </div>
                                    <div className="text-xs text-slate-500 font-mono">{item.id}</div>
                                  </td>
                                  <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-400">
                                    {deleteManagerType}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenDeleteConfirm(item, deleteManagerType);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
            </DataStatusOverlay>
          )}

          {isConfirmDeleteOpen && (
            <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 md:gap-8 p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <Card className="w-full max-w-md shadow-2xl animate-in zoom-in duration-300">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-red-100 dark:bg-red-950/50 rounded-full">
                      <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                    </div>
                    <CardTitle className="text-xl">Confirm Hard Delete</CardTitle>
                  </div>
                  <CardDescription className="text-slate-900 dark:text-slate-100 font-medium">
                    You are about to permanently delete this {deleteManagerType}:
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {itemToDelete ? (
                    <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800">
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {itemToDelete.title || truncateText(itemToDelete.question_text, 100) || 'Untitled'} {itemToDelete.difficulty ? `- ${QUIZ_DIFFICULTY_LABELS[itemToDelete.difficulty]}` : ''}
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-1">{itemToDelete.id}</div>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800">
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {multipleItemsToDelete.length} {deleteManagerType}s selected
                      </div>
                      <div className="text-xs text-slate-500 mt-1 max-h-24 overflow-y-auto">
                        {multipleItemsToDelete.slice(0, 5).map(item => (
                          <div key={item.id} className="truncate">
                            • {item.title || truncateText(item.question_text, 40) || item.id}
                          </div>
                        ))}
                        {multipleItemsToDelete.length > 5 && (
                          <div className="text-indigo-600 font-medium">...and {multipleItemsToDelete.length - 5} more</div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-md border border-amber-200 dark:border-amber-900/50 text-sm text-amber-900 dark:text-amber-200">
                    <div className="font-bold flex items-center gap-2 mb-1 underline">
                       Impact Summary:
                    </div>
                    {deleteImpact?.summary || 'Calculating cascading impact...'}
                  </div>

                  <p className="text-xs text-red-600 dark:text-red-400 font-bold italic border-l-2 border-red-500 pl-2">
                    CRITICAL: This action is irreversible. All linked attempts, answers, and references will be permanently purged.
                  </p>

                  <div className="flex gap-3 justify-end mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setIsConfirmDeleteOpen(false)}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-800"
                      onClick={handleConfirmDelete}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Permanently Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
              {isSaving ? (
                <Card className="mb-6 w-3/4 md:w-1/3 border-red-300 bg-blue-50 dark:border-red-800 dark:bg-red-950/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-red-900 dark:text-red-200">Deleting Data</CardTitle>
                    <CardDescription className="text-red-800 dark:text-red-300">
                      {savingAction.label || 'Processing update...'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-red-100 dark:bg-red-900">
                      <div
                        className="h-full bg-red-600 transition-all duration-200 dark:bg-red-400"
                        style={{ width: `${clampedSavingProgress}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-red-700 dark:text-red-300">
                      {Math.round(clampedSavingProgress)}%
                    </p>
                  </CardContent>
                </Card>
              ) : null}              
            </div>
          )}

          {(isSaving && !isConfirmDeleteOpen) ? (
            <Card className="mt-4 md:mt-6 border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-blue-900 dark:text-blue-200">Action in progress</CardTitle>
                <CardDescription className="text-blue-800 dark:text-blue-300">
                  {savingAction.label || 'Processing update...'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900">
                  <div
                    className="h-full bg-blue-600 transition-all duration-200 dark:bg-blue-400"
                    style={{ width: `${clampedSavingProgress}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">
                  {Math.round(clampedSavingProgress)}%
                </p>
              </CardContent>
            </Card>
          ) : null}

        </div>
      </div>
    </>
  );
};

export default DevContentDashboard;
