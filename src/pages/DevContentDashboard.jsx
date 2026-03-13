import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Navigate } from 'react-router-dom';
import { Archive, ArchiveRestore, Loader2, Plus, Trash2, Upload, ChevronDown, Copy } from 'lucide-react';
import Navbar from '@/components/layout/Navbar.jsx';
import SettingsModal from '@/components/layout/SettingsModal.jsx';
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
  removeDuplicateAdminContent,
  removeQuestionFromQuiz,
  updateAdminCourse,
  updateAdminQuestion,
  updateAdminQuiz,
} from '@/api/api.js';
import { measureAsync } from '@/utils/performance.js';
import { useQueryClient } from '@tanstack/react-query';
import { getUserFriendlyErrorMessage } from '@/utils/errorHandling.js';
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

Your task is to produce a valid JSON object that includes a title, a thoughtful estimate of the time required to complete the quiz (in minutes), and the array of questions. Follow this two‑step process internally:

Design the quiz questions – Carefully create the question set according to all requirements below (coverage, types, LaTeX, difficulty, skill category, explanations, etc.). Ensure the questions collectively address every focus topic listed in the description.

Estimate the time – After the questions are designed, think about the time a typical learner would need to answer them. Provide an estimate on the lower end (i.e., a reasonably quick but attentive pace). Base this on the number of questions, their types (MCQ, numeric, short answer), and their difficulty/complexity. For example, simple recall MCQs might take 30 seconds each, while a multi‑step calculation could take 2 minutes. Use your judgment; do not simply apply a formula. (A fallback guideline of 1 minute per 2 questions is only a server‑side default – your reasoned estimate is preferred.)

Finally, output only the JSON object with this structure:

{
  "title": "string (concise title derived from the description; use the 'Topic:' line if present, otherwise create a short descriptive title)",
  "estimatedTime": integer,  // your reasoned estimate in whole minutes (ceil to nearest minute)
  "questions": [
    {
      "type": "mcq" | "short_answer" | "numeric",
      "question_text": "The question text",
      "metadata": {},  // See format specifications below
      "difficulty": 1-3,
      "topic": "concise topic identifier (max 3 words)",
      "skillCategory": 1 | 2 | 3,
      "explanation": "Brief explanation of the correct answer"
    }
  ]
}
METADATA FORMATS
For MCQ:

{
  "options": [
    { "id": "A", "text": "option text" },
    { "id": "B", "text": "option text" },
    { "id": "C", "text": "option text" },
    { "id": "D", "text": "option text" }
  ],
  "correct_answer": "A"  // The ID of the correct option
}
For Short Answer:

{
  "accepted_answers": ["answer1", "alternate phrasing", "another acceptable answer"],
  "case_sensitive": false,
  "ignore_whitespace": true
}
For Numeric:

{
  "numeric_answer": 123.45,  // The correct numeric value
  "tolerance": 0.01  // Acceptable margin of error
}
LATEX SUPPORT – CRITICAL: ESCAPE BACKSLASHES
The platform fully supports LaTeX math rendering. Use $...$ for inline math and $$...$$ for display math wherever appropriate. This is especially important for questions involving chemical formulas, equations, mathematical expressions, or any scientific notation.

⚠️ IMPORTANT JSON REQUIREMENT: In JSON, the backslash (\) is an escape character. To include a literal backslash in a string (as needed for LaTeX commands), you must write two backslashes (\\) for every single backslash that should appear in the final LaTeX.

For example:

\Delta must be written as \\Delta

\int → \\int

\sum → \\sum

\rightarrow → \\rightarrow

\frac{1}{2} → \\frac{1}{2}

\ln → \\ln

\log → \\log

Failure to double the backslashes will result in an "invalid escape character" error and the JSON will be rejected. Always verify that every LaTeX command in your JSON strings uses double backslashes.

QUESTION REQUIREMENTS
COVERAGE: The question set must collectively address ALL focus topics listed in the quiz description. Distribute questions across topics as you see fit based on relevance and the natural need for assessment.

QUESTION TYPES:

PRIMARY: Multiple choice questions (MCQ) and numeric questions

SECONDARY: Short answer questions (use sparingly, only when the expected answer is robust and limited to 1‑2 words/phrases)

AVOID: Long answer questions (do not include any)

The quiz may consist entirely of MCQ and numeric questions if suitable short answer questions cannot be generated.

TOPIC FIELD: Create a concise identifier (1‑3 words maximum) that semantically maps to one of the focus topics. For example, if the focus topic is "Definition and four functions of metabolism", appropriate topic fields could be: "Metabolism definition", "Functions of metabolism", or simply "Metabolism functions". The identifier does not need to use exact words from the focus topic but must clearly relate to it.

DIFFICULTY (1‑3): Assign relative difficulty based on:

Level 1: Basic recall, definitional questions, straightforward calculations

Level 2: Conceptual understanding, multi‑step reasoning, application of principles

Level 3: Complex synthesis, analysis, integration of multiple concepts, challenging problem‑solving

SKILL CATEGORY:

1 (Recall): Direct fact recall, definitions, identifying terms

2 (Conceptual): Understanding relationships, explaining processes, comparing/contrasting

3 (Application): Applying knowledge to new situations, problem‑solving, experimental design

EXPLANATION: Provide a brief, clear explanation of why the answer is correct. For incorrect MCQ options, you may optionally include brief explanations of why they are wrong, but the primary explanation should focus on the correct answer.

ORDER: Questions should be arranged in random order by topic. If possible, order generally by increasing difficulty, but this is not strictly required.

COUNT: Generate exactly [estimated_questions] questions as specified in the quiz description.

VALIDATION CHECKLIST (for your internal use)
JSON is valid and properly formatted (no trailing commas, all strings properly quoted)

All backslashes in LaTeX are doubled (e.g., \\Delta, \\int, \\sum, \\rightarrow, \\frac)

Correct number of questions generated

All focus topics are covered at least once

No long answer questions included

Short answer questions used minimally

All MCQ options are plausible (not obviously incorrect)

Numeric answers include appropriate tolerance

Difficulty ratings are consistent across questions

Skill categories align with question nature

Topic fields semantically map to focus topics

Explanations are helpful and accurate

LaTeX is used where appropriate

Title is descriptive and derived from the description

estimatedTime is a reasoned estimate (not a mechanical calculation) and is a whole number of minutes`;

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
const DEDUPE_IDLE_MESSAGE = 'Ready to scan for strict semantic duplicates.';
const DASHBOARD_SELECT_PAGE_SIZE = 150;

const DevContentDashboard = () => {
  const { isDevFeaturesEnabled } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeduping, setIsDeduping] = useState(false);
  const [schema, setSchema] = useState(false);
  const [courses, setCourses] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [selectedQuestionId, setSelectedQuestionId] = useState('');
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
    } catch (error) {
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
      setSavingAction((previous) => ({ ...previous, progress: 96 }));
      await loadAllContent(false);
      await queryClient.invalidateQueries();
      setSavingAction((previous) => ({ ...previous, progress: 100 }));
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
        await updateAdminQuiz(selectedQuizId, {
          title: quizForm.title,
          shortDescription: quizForm.shortDescription,
          longDescription: quizForm.longDescription,
          topic: quizForm.topic,
          difficulty: Number(quizForm.difficulty),
          estimatedTime: Number(quizForm.estimatedTime),
          isTimePerQuestion: Boolean(quizForm.isTimePerQuestion),
          questionIds: Array.isArray(selectedQuiz?.questionIds) ? selectedQuiz.questionIds : [],
          isArchived: Boolean(quizForm.isArchived),
        });
        await syncQuizCourseAssociations(selectedQuizId, quizLinkedCourseIds);
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

  const handleCopyGeneratedPrompt = async () => {
    const generatedPrompt = QUIZ_GENERATION_PROMPT_TEMPLATE.replace(
      '[INSERT QUIZ DESCRIPTION HERE]',
      promptInput || '[INSERT QUIZ DESCRIPTION HERE]'
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

    if (mappedQuestions.length !== sourceQuestionIds.length) {
      toast({
        title: 'Some linked questions are unavailable',
        description: 'Only available questions were generated in the JSON editor.',
        variant: 'destructive',
      });
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

        const selectedQuizForBulk = quizzes.find((entry) => entry.id === bulkForm.selectedQuizId);
        if (!selectedQuizForBulk) {
          throw new Error('Selected quiz was not found');
        }

        const existingQuestionIds = Array.isArray(selectedQuizForBulk.questionIds)
          ? selectedQuizForBulk.questionIds
          : [];

        if (existingQuestionIds.length !== uploadedQuestions.length) {
          throw new Error(
            `Question count mismatch: selected quiz has ${existingQuestionIds.length} linked questions but upload has ${uploadedQuestions.length}.`
          );
        }

        for (let index = 0; index < existingQuestionIds.length; index += 1) {
          const questionId = existingQuestionIds[index];
          const payload = uploadedQuestions[index];
          await updateAdminQuestion(questionId, {
            ...payload,
            isArchived: Boolean(payload?.isArchived),
          });
        }

        await updateAdminQuiz(selectedQuizForBulk.id, {
          title: bulkForm.title,
          shortDescription: bulkForm.shortDescription,
          longDescription: bulkForm.longDescription,
          topic: bulkForm.topic,
          difficulty: Number(bulkForm.difficulty),
          estimatedTime: Number(bulkForm.estimatedTime),
          isTimePerQuestion: Boolean(bulkForm.isTimePerQuestion),
          questionIds: existingQuestionIds,
          isArchived: Boolean(selectedQuizForBulk.isArchived),
        });
        await syncQuizCourseAssociations(selectedQuizForBulk.id, bulkLinkedCourseIds);
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
                throw error;
              }
            }
            throw error;
          }
        };

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

  return (
    <>
      <Helmet>
        <title>Dev Content Dashboard - QuizMaster</title>
      </Helmet>

      <div className="min-h-screen">
        <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />
        <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

        <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Dev Content Dashboard</h1>
            <p className="text-slate-600 dark:text-slate-400">
              Edit courses, quizzes, and questions. Manage associations and run bulk upload/edit workflows.
            </p>
          </div>

          <Card className="mb-6 border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-amber-900 dark:text-amber-200">Developer mode only</CardTitle>
              <CardDescription className="text-amber-800 dark:text-amber-300">
                Includes archived records and performs direct content updates.
              </CardDescription>
            </CardHeader>
          </Card>

          {isSaving ? (
            <Card className="mb-6 border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
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

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto dark:border-indigo-400"></div>
              <p className="mt-4 text-slate-600 dark:text-slate-400">Loading content...</p>
            </div>
          ) : (
            <Tabs defaultValue="courses">
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="courses">Courses</TabsTrigger>
                <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
                <TabsTrigger value="questions">Questions</TabsTrigger>
                <TabsTrigger value="bulk-quiz">Bulk Edit Quiz</TabsTrigger>
                <TabsTrigger value="bulk-questions">Bulk Upload Questions</TabsTrigger>
                <TabsTrigger value="dedupe">Bulk Remove Duplicates</TabsTrigger>
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
                          {visibleSortedQuizzes.map((quiz) => (
                            <option key={quiz.id} value={quiz.id}>
                              {quiz.title} ({quiz.id}) {quiz.isArchived ? '[archived]' : ''}
                            </option>
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
                          {visibleSortedQuizzes.map((quiz) => (
                            <option key={quiz.id} value={quiz.id}>
                              {quiz.title} ({quiz.id}) {quiz.isArchived ? '[archived]' : ''}
                            </option>
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
                                      <Button type="button" onClick={handleCopyGeneratedPrompt} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600">
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
                        <Button type="button" variant="ghost" size="sm" onClick={() => handlePasteJson(setBulkForm)} className="h-6 px-2 text-xs">
                          <Copy className="h-3 w-3 mr-1" /> Paste from clipboard
                        </Button>
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
                        <Button type="button" variant="ghost" size="sm" onClick={() => handlePasteJson(setBulkQuestionForm)} className="h-6 px-2 text-xs">
                          <Copy className="h-3 w-3 mr-1" /> Paste from clipboard
                        </Button>
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
            </Tabs>
          )}
        </div>
      </div>
    </>
  );
};

export default DevContentDashboard;
