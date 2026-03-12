import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase/client.js';
import { courseRepository } from '@/repositories/courseRepository.js';
import { quizRepository } from '@/repositories/quizRepository.js';
import { questionRepository } from '@/repositories/questionRepository.js';
import { MOCK_QUESTIONS, MOCK_QUIZZES } from '@/api/mock_api.js';

export const UPLOAD_MODES = {
  SAFE_APPEND: 'safe_append',
  FORCE_APPEND: 'force_append',
};

const QUESTION_DIFFICULTY_MAP = {
  easy: 1,
  medium: 2,
  hard: 3,
};

const QUIZ_DIFFICULTY_MAP = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

const SKILL_CATEGORY_MAP = {
  recall: 1,
  conceptual: 2,
  application: 3,
  memorization: 3,
};

const STARTER_QUESTIONS = {
  bio_cell_atp: {
    type: 'mcq',
    question_text: 'Which organelle is primarily responsible for ATP production in eukaryotic cells?',
    metadata: {
      options: [
        { id: 'A', text: 'Nucleus' },
        { id: 'B', text: 'Mitochondrion' },
        { id: 'C', text: 'Golgi apparatus' },
        { id: 'D', text: 'Lysosome' },
      ],
      correct_answer: 'B',
    },
    difficulty: 1,
    topic: 'Cell Biology',
    skillCategory: 1,
    explanation: 'Mitochondria are the main sites of aerobic respiration and ATP generation.',
    isArchived: false,
  },
  bio_dna_polymerase: {
    type: 'mcq',
    question_text: 'During DNA replication, which enzyme synthesizes new DNA strands?',
    metadata: {
      options: [
        { id: 'A', text: 'DNA ligase' },
        { id: 'B', text: 'Helicase' },
        { id: 'C', text: 'DNA polymerase' },
        { id: 'D', text: 'Topoisomerase' },
      ],
      correct_answer: 'C',
    },
    difficulty: 2,
    topic: 'Molecular Biology',
    skillCategory: 1,
    explanation: 'DNA polymerase adds nucleotides to the growing daughter strand.',
    isArchived: false,
  },
  bio_heterozygous: {
    type: 'mcq',
    question_text: 'What is the genotype of an organism that has two different alleles for a trait?',
    metadata: {
      options: [
        { id: 'A', text: 'Homozygous dominant' },
        { id: 'B', text: 'Heterozygous' },
        { id: 'C', text: 'Homozygous recessive' },
        { id: 'D', text: 'Hemizygous' },
      ],
      correct_answer: 'B',
    },
    difficulty: 1,
    topic: 'Genetics',
    skillCategory: 1,
    explanation: 'Heterozygous means the two alleles at a locus are different.',
    isArchived: false,
  },
  biochem_lysine_charge: {
    type: 'mcq',
    question_text: 'Which amino acid side chain is positively charged at physiological pH?',
    metadata: {
      options: [
        { id: 'A', text: 'Lysine' },
        { id: 'B', text: 'Valine' },
        { id: 'C', text: 'Serine' },
        { id: 'D', text: 'Phenylalanine' },
      ],
      correct_answer: 'A',
    },
    difficulty: 2,
    topic: 'Proteins',
    skillCategory: 1,
    explanation: 'Lysine is a basic amino acid and is usually protonated at physiological pH.',
    isArchived: false,
  },
  biochem_glycolysis_atp: {
    type: 'mcq',
    question_text: 'What is the net ATP yield from glycolysis per molecule of glucose?',
    metadata: {
      options: [
        { id: 'A', text: '1 ATP' },
        { id: 'B', text: '2 ATP' },
        { id: 'C', text: '4 ATP' },
        { id: 'D', text: '6 ATP' },
      ],
      correct_answer: 'B',
    },
    difficulty: 2,
    topic: 'Metabolism',
    skillCategory: 2,
    explanation: 'Glycolysis produces 4 ATP and consumes 2 ATP, giving a net gain of 2 ATP.',
    isArchived: false,
  },
  biochem_nad: {
    type: 'mcq',
    question_text: 'Which coenzyme is the primary electron carrier in many oxidation-reduction reactions?',
    metadata: {
      options: [
        { id: 'A', text: 'Coenzyme A' },
        { id: 'B', text: 'NAD+' },
        { id: 'C', text: 'Biotin' },
        { id: 'D', text: 'Thiamine pyrophosphate' },
      ],
      correct_answer: 'B',
    },
    difficulty: 2,
    topic: 'Bioenergetics',
    skillCategory: 1,
    explanation: 'NAD+ accepts electrons to form NADH in many catabolic pathways.',
    isArchived: false,
  },
};

const STARTER_QUIZZES = {
  bio_foundations: {
    title: 'Foundations of Biological Sciences',
    shortDescription: '',
    longDescription: 'Starter quiz covering key concepts in biology and genetics.',
    topic: 'Biological Sciences',
    difficulty: 1,
    estimatedTime: 12,
    isTimePerQuestion: false,
    questionRefs: ['bio_cell_atp', 'bio_dna_polymerase', 'bio_heterozygous'],
    isArchived: false,
  },
  biochem_essentials: {
    title: 'Biochemistry Essentials',
    shortDescription: '',
    longDescription: 'Starter quiz on core biochemical principles and pathways.',
    topic: 'Biochemistry',
    difficulty: 2,
    estimatedTime: 12,
    isTimePerQuestion: false,
    questionRefs: ['biochem_lysine_charge', 'biochem_glycolysis_atp', 'biochem_nad'],
    isArchived: false,
  },
};

const STARTER_COURSES = {
  'Computer Science': {
    courseCode: 'CSC',
    topic: 'Computer Science',
    shortDescription: '',
    longDescription:
      'Core computer science topics including data structures, databases, and software design principles.',
    quizRefs: ['cs_data_structures', 'math_algorithm_analysis', 'cs_database_design', 'cs_oop'],
    isArchived: false,
  },
  Mathematics: {
    courseCode: 'MTH',
    topic: 'Mathematics',
    shortDescription: '',
    longDescription:
      'Mathematical reasoning and analysis through computational complexity and algorithmic thinking.',
    quizRefs: ['math_algorithm_analysis'],
    isArchived: false,
  },
  'Biological Sciences': {
    courseCode: 'BIO',
    topic: 'Biological Sciences',
    shortDescription: '',
    longDescription:
      'Foundations in molecular biology, genetics, and physiology for life science learners.',
    quizRefs: ['bio_foundations'],
    isArchived: false,
  },
  Biochemistry: {
    courseCode: 'BCH',
    topic: 'Biochemistry',
    shortDescription: '',
    longDescription:
      'Introductory biochemical concepts spanning biomolecules, metabolism, and enzyme function.',
    quizRefs: ['biochem_essentials'],
    isArchived: false,
  },
};

const MOCK_QUIZ_KEY_MAP = {
  cs_data_structures: 'quiz-1',
  math_algorithm_analysis: 'quiz-2',
  cs_database_design: 'quiz-3',
  cs_oop: 'quiz-4',
};

const normalizeMockQuestion = (question) => ({
  type: 'mcq',
  question_text: String(question?.text || '').trim(),
  metadata: {
    options: Array.isArray(question?.options)
      ? question.options.map((option) => ({
          id: String(option?.id || '').trim().toUpperCase(),
          text: String(option?.text || '').trim(),
        }))
      : [],
    correct_answer: String(question?.correctAnswer || '').trim().toUpperCase(),
  },
  difficulty: QUESTION_DIFFICULTY_MAP[String(question?.difficulty || '').toLowerCase()] || 2,
  topic: String(question?.topic || 'General').trim(),
  skillCategory: SKILL_CATEGORY_MAP[String(question?.skillCategory || '').toLowerCase()] || 2,
  explanation: String(question?.explanation || '').trim(),
  isArchived: false,
});

const normalizeMockQuiz = (quiz, questionRefs) => ({
  title: String(quiz?.title || '').trim(),
  shortDescription: String(quiz?.shortDescription || '').trim(),
  longDescription: String(
    quiz?.longDescription || quiz?.description || ''
  ).trim(),
  topic: String(quiz?.topic || 'General').trim(),
  difficulty: QUIZ_DIFFICULTY_MAP[String(quiz?.difficulty || '').toLowerCase()] || 2,
  estimatedTime: Number(quiz?.estimatedTime) > 0 ? Number(quiz.estimatedTime) : 15,
  isTimePerQuestion: false,
  questionRefs,
  isArchived: false,
});

const buildNormalizedSeedCatalog = () => {
  const questions = { ...STARTER_QUESTIONS };
  const quizzes = { ...STARTER_QUIZZES };
  const courses = { ...STARTER_COURSES };

  Object.entries(MOCK_QUIZ_KEY_MAP).forEach(([quizKey, mockQuizId]) => {
    const mockQuiz = MOCK_QUIZZES.find((entry) => entry.id === mockQuizId);
    if (!mockQuiz) return;

    const questionRefs = [];
    const mockQuestions = Array.isArray(MOCK_QUESTIONS[mockQuizId]) ? MOCK_QUESTIONS[mockQuizId] : [];

    mockQuestions.forEach((mockQuestion, index) => {
      const questionKey = `${quizKey}_q_${index + 1}`;
      questions[questionKey] = normalizeMockQuestion(mockQuestion);
      questionRefs.push(questionKey);
    });

    quizzes[quizKey] = normalizeMockQuiz(mockQuiz, questionRefs);
  });

  return { questions, quizzes, courses };
};

const findExistingQuestionIdByText = async (questionText) => {
  const q = query(collection(db, 'questions'), where('question_text', '==', questionText));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return snapshot.docs[0].id;
};

const findExistingQuizByTitle = async (title) => {
  const q = query(collection(db, 'quizzes'), where('title', '==', title));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const first = snapshot.docs[0];
  return { id: first.id, ...first.data() };
};

const findExistingCourseByTitle = async (title) => {
  const q = query(collection(db, 'courses'), where('title', '==', title));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const first = snapshot.docs[0];
  return { id: first.id, ...first.data() };
};

const ensureQuestion = async (questionPayload, mode) => {
  if (mode === UPLOAD_MODES.SAFE_APPEND) {
    const existingId = await findExistingQuestionIdByText(questionPayload.question_text);
    if (existingId) return existingId;
  }

  const created = await questionRepository.createQuestion(questionPayload);
  return created.id;
};

const ensureQuiz = async (quizPayload, mode) => {
  if (mode === UPLOAD_MODES.SAFE_APPEND) {
    const existingQuiz = await findExistingQuizByTitle(quizPayload.title);
    if (existingQuiz) {
      const mergedQuestionIds = Array.from(
        new Set([...(existingQuiz.questionIds || []), ...(quizPayload.questionIds || [])])
      );
      return quizRepository.updateQuiz(existingQuiz.id, {
        ...existingQuiz,
        ...quizPayload,
        questionIds: mergedQuestionIds,
      });
    }
  }

  return quizRepository.createQuiz(quizPayload);
};

const ensureCourse = async (coursePayload, mode) => {
  if (mode === UPLOAD_MODES.SAFE_APPEND) {
    const existingCourse = await findExistingCourseByTitle(coursePayload.title);
    if (existingCourse) {
      const mergedQuizIds = Array.from(
        new Set([...(existingCourse.quizIds || []), ...(coursePayload.quizIds || [])])
      );
      return courseRepository.updateCourse(existingCourse.id, {
        ...existingCourse,
        ...coursePayload,
        quizIds: mergedQuizIds,
      });
    }
  }

  return courseRepository.createCourse(coursePayload);
};

export const uploadStarterCourses = async ({
  mode = UPLOAD_MODES.SAFE_APPEND,
  courseTitles = ['Biochemistry', 'Biological Sciences', 'Mathematics', 'Computer Science'],
} = {}) => {
  if (!Object.values(UPLOAD_MODES).includes(mode)) {
    throw new Error(`Unsupported upload mode "${mode}"`);
  }

  const catalog = buildNormalizedSeedCatalog();
  const questionIdByRef = new Map();
  const quizIdByRef = new Map();
  const uploaded = [];

  for (const courseTitle of courseTitles) {
    const courseConfig = catalog.courses[courseTitle];
    if (!courseConfig) {
      uploaded.push({ courseTitle, skipped: true, reason: 'Missing course seed configuration' });
      continue;
    }

    for (const quizRef of courseConfig.quizRefs || []) {
      if (quizIdByRef.has(quizRef)) continue;

      const quizConfig = catalog.quizzes[quizRef];
      if (!quizConfig) {
        throw new Error(`Quiz seed "${quizRef}" is missing for course "${courseTitle}"`);
      }

      const questionIds = [];
      for (const questionRef of quizConfig.questionRefs || []) {
        if (!questionIdByRef.has(questionRef)) {
          const questionConfig = catalog.questions[questionRef];
          if (!questionConfig) {
            throw new Error(`Question seed "${questionRef}" is missing for quiz "${quizRef}"`);
          }

          const questionId = await ensureQuestion(questionConfig, mode);
          questionIdByRef.set(questionRef, questionId);
        }

        questionIds.push(questionIdByRef.get(questionRef));
      }

      const quiz = await ensureQuiz(
        {
          title: quizConfig.title,
          shortDescription: quizConfig.shortDescription,
          longDescription: quizConfig.longDescription,
          topic: quizConfig.topic,
          difficulty: Number(quizConfig.difficulty) || 2,
          estimatedTime: Number(quizConfig.estimatedTime) || 10,
          isTimePerQuestion: Boolean(quizConfig.isTimePerQuestion),
          questionIds,
          isArchived: Boolean(quizConfig.isArchived),
        },
        mode
      );

      quizIdByRef.set(quizRef, quiz.id);
    }

    const quizIds = (courseConfig.quizRefs || [])
      .map((quizRef) => quizIdByRef.get(quizRef))
      .filter(Boolean);

    const course = await ensureCourse(
      {
        title: courseTitle,
        shortDescription: courseConfig.shortDescription,
        longDescription: courseConfig.longDescription,
        topic: courseConfig.topic,
        courseCode: courseConfig.courseCode,
        quizIds,
        isArchived: Boolean(courseConfig.isArchived),
      },
      mode
    );

    uploaded.push({
      courseTitle,
      courseId: course.id,
      quizCount: quizIds.length,
      questionCount: quizIds.reduce((count, quizId) => {
        const quizRef = Array.from(quizIdByRef.entries()).find((entry) => entry[1] === quizId)?.[0];
        const quizConfig = quizRef ? catalog.quizzes[quizRef] : null;
        return count + (quizConfig?.questionRefs?.length || 0);
      }, 0),
    });
  }

  return {
    mode,
    uploaded,
  };
};
