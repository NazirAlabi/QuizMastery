
import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Navigate } from 'react-router-dom';
import { Archive, ArchiveRestore, Plus, Trash2, Upload } from 'lucide-react';
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

const COURSE_DEFAULTS = {
  title: '',
  description: '',
  topic: '',
  courseCode: '',
  quizIds: '',
  isArchived: false,
};

const QUIZ_DEFAULTS = {
  title: '',
  description: '',
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

const BULK_UPLOAD_TEMPLATE = '{\n  "questions": []\n}';

const BULK_DEFAULTS = {
  selectedQuizId: '',
  title: '',
  description: '',
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeduping, setIsDeduping] = useState(false);
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
  const [dedupeProgress, setDedupeProgress] = useState(0);
  const [dedupeStatus, setDedupeStatus] = useState(DEDUPE_IDLE_MESSAGE);
  const [dedupeLogs, setDedupeLogs] = useState([DEDUPE_IDLE_MESSAGE]);
  const [visibleCourseCount, setVisibleCourseCount] = useState(DASHBOARD_SELECT_PAGE_SIZE);
  const [visibleQuizCount, setVisibleQuizCount] = useState(DASHBOARD_SELECT_PAGE_SIZE);
  const [visibleQuestionCount, setVisibleQuestionCount] = useState(DASHBOARD_SELECT_PAGE_SIZE);

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

  const loadAllContent = async () => {
    setIsLoading(true);
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
        description: error.message || 'Could not fetch dashboard data.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
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
      description: selectedCourse.description || '',
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
      description: selectedQuiz.description || '',
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

  if (!isDevFeaturesEnabled) {
    return <Navigate to="/quizzes" replace />;
  }

  const withSaving = async (callback, successTitle) => {
    setIsSaving(true);
    try {
      await callback();
      await loadAllContent();
      toast({ title: successTitle });
    } catch (error) {
      toast({
        title: 'Action failed',
        description: error.message || 'Please check your input and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateCourse = async () => {
    await withSaving(async () => {
      await createAdminCourse({
        title: courseForm.title,
        description: courseForm.description,
        topic: courseForm.topic,
        courseCode: courseForm.courseCode || undefined,
        quizIds: parseCsvIds(courseForm.quizIds),
        isArchived: Boolean(courseForm.isArchived),
      });
      setSelectedCourseId('');
      setCourseForm(COURSE_DEFAULTS);
    }, 'Course created');
  };

  const handleUpdateCourse = async () => {
    if (!selectedCourseId) return;
    await withSaving(async () => {
      await updateAdminCourse(selectedCourseId, {
        title: courseForm.title,
        description: courseForm.description,
        topic: courseForm.topic,
        courseCode: courseForm.courseCode || undefined,
        quizIds: parseCsvIds(courseForm.quizIds),
        isArchived: Boolean(courseForm.isArchived),
      });
    }, 'Course updated');
  };

  const handleToggleArchiveCourse = async () => {
    if (!selectedCourseId || !selectedCourse) return;
    await withSaving(async () => {
      await archiveAdminCourse(selectedCourseId, !selectedCourse.isArchived);
    }, selectedCourse.isArchived ? 'Course restored' : 'Course archived');
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

  const handleRemoveCourseFromBulkQuiz = (courseIdToRemove) => {
    const nextCourseIds = bulkLinkedCourseIds.filter((courseId) => courseId !== courseIdToRemove);
    setBulkLinkedCourseIds(nextCourseIds);
    setBulkForm((previous) => ({ ...previous, courseIds: nextCourseIds.join(', ') }));
  };

  const handleCreateQuiz = async () => {
    await withSaving(async () => {
      const createdQuiz = await createAdminQuiz({
        quiz: {
          title: quizForm.title,
          description: quizForm.description,
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
    }, 'Quiz created');
  };
  const handleUpdateQuiz = async () => {
    if (!selectedQuizId) return;
    await withSaving(async () => {
      await updateAdminQuiz(selectedQuizId, {
        title: quizForm.title,
        description: quizForm.description,
        topic: quizForm.topic,
        difficulty: Number(quizForm.difficulty),
        estimatedTime: Number(quizForm.estimatedTime),
        isTimePerQuestion: Boolean(quizForm.isTimePerQuestion),
        questionIds: Array.isArray(selectedQuiz?.questionIds) ? selectedQuiz.questionIds : [],
        isArchived: Boolean(quizForm.isArchived),
      });
      await syncQuizCourseAssociations(selectedQuizId, quizLinkedCourseIds);
    }, 'Quiz updated');
  };

  const handleToggleArchiveQuiz = async () => {
    if (!selectedQuizId || !selectedQuiz) return;
    await withSaving(async () => {
      await archiveAdminQuiz(selectedQuizId, !selectedQuiz.isArchived);
    }, selectedQuiz.isArchived ? 'Quiz restored' : 'Quiz archived');
  };

  const handleAddQuestionToQuiz = async () => {
    if (!selectedQuizId || !questionToAddId) return;
    await withSaving(async () => {
      await addQuestionsToQuiz(selectedQuizId, [questionToAddId]);
      setQuestionToAddId('');
    }, 'Question added to quiz');
  };

  const handleRemoveQuestionFromQuiz = async (questionId) => {
    if (!selectedQuizId) return;
    await withSaving(async () => {
      await removeQuestionFromQuiz(selectedQuizId, questionId);
    }, 'Question removed from quiz');
  };

  const handleCreateQuestion = async () => {
    await withSaving(async () => {
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
    }, 'Question created');
  };

  const handleUpdateQuestion = async () => {
    if (!selectedQuestionId) return;
    await withSaving(async () => {
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
    }, 'Question updated');
  };

  const handleToggleArchiveQuestion = async () => {
    if (!selectedQuestionId || !selectedQuestion) return;
    await withSaving(async () => {
      await archiveAdminQuestion(selectedQuestionId, !selectedQuestion.isArchived);
    }, selectedQuestion.isArchived ? 'Question restored' : 'Question archived');
  };

  const handleBulkQuizUploadFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setBulkForm((previous) => ({ ...previous, uploadText: content }));
    event.target.value = '';
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
      description: quiz.description || '',
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
    await withSaving(async () => {
      const uploadPayload = JSON.parse(bulkForm.uploadText);
      const uploadedQuestions = normalizeQuestionUploadPayload(uploadPayload);

      if (!bulkForm.selectedQuizId) {
        const createdQuizResult = await createQuizFromQuestionUpload({
          quizPayload: {
            title: bulkForm.title,
            description: bulkForm.description,
            topic: bulkForm.topic,
            difficulty: Number(bulkForm.difficulty),
            estimatedTime: Number(bulkForm.estimatedTime),
            isTimePerQuestion: Boolean(bulkForm.isTimePerQuestion),
            questionIds: [],
            isArchived: false,
          },
          uploadPayload,
          courseId: '',
        });
        await syncQuizCourseAssociations(createdQuizResult.quiz.id, bulkLinkedCourseIds);
        setBulkForm(BULK_DEFAULTS);
        setBulkLinkedCourseIds([]);
        setBulkCourseToAddId('');
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
        description: bulkForm.description,
        topic: bulkForm.topic,
        difficulty: Number(bulkForm.difficulty),
        estimatedTime: Number(bulkForm.estimatedTime),
        isTimePerQuestion: Boolean(bulkForm.isTimePerQuestion),
        questionIds: existingQuestionIds,
        isArchived: Boolean(selectedQuizForBulk.isArchived),
      });
      await syncQuizCourseAssociations(selectedQuizForBulk.id, bulkLinkedCourseIds);
    }, bulkForm.selectedQuizId ? 'Bulk quiz edits applied' : 'Bulk quiz created');
  };

  const handleBulkCreateQuestions = async () => {
    await withSaving(async () => {
      const uploadPayload = JSON.parse(bulkQuestionForm.uploadText);
      const uploadedQuestions = normalizeQuestionUploadPayload(uploadPayload);

      for (const questionPayload of uploadedQuestions) {
        await createAdminQuestion({
          ...questionPayload,
          isArchived: Boolean(questionPayload?.isArchived),
        });
      }

      setBulkQuestionForm(BULK_QUESTION_DEFAULTS);
    }, 'Questions created from upload');
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
                      <Label>Description</Label>
                      <textarea
                        className="mt-1 min-h-[100px] w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                        value={courseForm.description}
                        onChange={(event) => setCourseForm((v) => ({ ...v, description: event.target.value }))}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button disabled={isSaving} onClick={handleCreateCourse}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create course
                      </Button>
                      <Button variant="outline" disabled={isSaving || !selectedCourseId} onClick={handleUpdateCourse}>
                        Save changes
                      </Button>
                      <Button
                        variant="outline"
                        disabled={isSaving || !selectedCourseId}
                        onClick={handleToggleArchiveCourse}
                      >
                        {selectedCourse?.isArchived ? (
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
                      <Label>Description</Label>
                      <textarea
                        className="mt-1 min-h-[100px] w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                        value={quizForm.description}
                        onChange={(event) => setQuizForm((v) => ({ ...v, description: event.target.value }))}
                      />
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
                              <button type="button" onClick={() => handleRemoveQuestionFromQuiz(questionId)}>
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
                            Add question
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      <Button disabled={isSaving} onClick={handleCreateQuiz}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create quiz
                      </Button>
                      <Button variant="outline" disabled={isSaving || !selectedQuizId} onClick={handleUpdateQuiz}>
                        Save changes
                      </Button>
                      <Button
                        variant="outline"
                        disabled={isSaving || !selectedQuizId}
                        onClick={handleToggleArchiveQuiz}
                      >
                        {selectedQuiz?.isArchived ? (
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
                      <Label>Metadata JSON</Label>
                      <textarea
                        className="mt-1 min-h-[180px] w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 font-mono text-xs dark:border-slate-800 dark:bg-slate-950"
                        value={questionForm.metadataJson}
                        onChange={(event) => setQuestionForm((v) => ({ ...v, metadataJson: event.target.value }))}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button disabled={isSaving} onClick={handleCreateQuestion}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create question
                      </Button>
                      <Button variant="outline" disabled={isSaving || !selectedQuestionId} onClick={handleUpdateQuestion}>
                        Save changes
                      </Button>
                      <Button
                        variant="outline"
                        disabled={isSaving || !selectedQuestionId}
                        onClick={handleToggleArchiveQuestion}
                      >
                        {selectedQuestion?.isArchived ? (
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
                      <div className="md:col-span-2">
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
                      </div>
                      <div>
                        <Label>Quiz title</Label>
                        <Input value={bulkForm.title} onChange={(event) => setBulkForm((v) => ({ ...v, title: event.target.value }))} />
                      </div>
                      <div>
                        <Label>Topic</Label>
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
                      </div>
                      <div>
                        <Label>Estimated time (minutes)</Label>
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
                      <div className="md:col-span-2">
                        <Label>Course IDs (display-only)</Label>
                        <Input value={bulkForm.courseIds} readOnly className="cursor-not-allowed opacity-80" />
                      </div>
                    </div>

                    <div>
                      <Label>Description</Label>
                      <textarea
                        className="mt-1 min-h-[90px] w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                        value={bulkForm.description}
                        onChange={(event) => setBulkForm((v) => ({ ...v, description: event.target.value }))}
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
                      <Label>Questions JSON</Label>
                      <textarea
                        className="mt-1 min-h-[220px] w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 font-mono text-xs dark:border-slate-800 dark:bg-slate-950"
                        value={bulkForm.uploadText}
                        onChange={(event) => setBulkForm((v) => ({ ...v, uploadText: event.target.value }))}
                      />
                    </div>

                    <Button disabled={isSaving} onClick={handleBulkUpsertQuiz}>
                      <Upload className="h-4 w-4 mr-2" />
                      {bulkForm.selectedQuizId ? 'Apply bulk edits to selected quiz' : 'Create quiz from upload'}
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
                      <Label>Questions JSON</Label>
                      <textarea
                        className="mt-1 min-h-[220px] w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 font-mono text-xs dark:border-slate-800 dark:bg-slate-950"
                        value={bulkQuestionForm.uploadText}
                        onChange={(event) => setBulkQuestionForm((v) => ({ ...v, uploadText: event.target.value }))}
                      />
                    </div>

                    <Button disabled={isSaving} onClick={handleBulkCreateQuestions}>
                      <Upload className="h-4 w-4 mr-2" />
                      Create questions from upload
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
