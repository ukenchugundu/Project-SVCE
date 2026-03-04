import { Request, Response } from "express";
import { Pool, PoolClient } from "pg";
import pool from "../utils/db";

type QuizStatus = "Draft" | "Published" | "Completed";
type QuestionType = "mcq" | "fill_blank" | "true_false";

interface QuizQuestionInput {
  question: string;
  type?: QuestionType;
  options?: string[];
  correctAnswer: string;
}

interface NormalizedQuizQuestion {
  question: string;
  type: QuestionType;
  options: string[];
  correctAnswer: string;
}

interface NormalizedQuizPayload {
  cls: string;
  title: string;
  duration: string;
  questions: NormalizedQuizQuestion[];
}

interface InMemoryOption {
  option_id: number;
  option_text: string;
  is_correct: boolean;
}

interface InMemoryQuestion {
  question_id: number;
  question_text: string;
  question_type: QuestionType;
  correct_answer_text: string;
  options: InMemoryOption[];
}

interface InMemoryQuiz {
  quiz_id: number;
  cls: string;
  title: string;
  duration: string;
  status: QuizStatus;
  questions: InMemoryQuestion[];
}

const inMemoryQuizzes: InMemoryQuiz[] = [];
let inMemoryQuizId = 1;
let inMemoryQuestionId = 1;
let inMemoryOptionId = 1;

const sampleQuizPayload: NormalizedQuizPayload = {
  cls: "CSE - Section A",
  title: "Sample Aptitude Quiz",
  duration: "20 mins",
  questions: [
    {
      question: "What is the time complexity of binary search in a sorted array?",
      type: "mcq",
      options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
      correctAnswer: "O(log n)",
    },
    {
      question: "Which SQL command is used to retrieve data from a table?",
      type: "mcq",
      options: ["GET", "SELECT", "FETCH", "PULL"],
      correctAnswer: "SELECT",
    },
    {
      question: "HTTP status 200 means _____",
      type: "fill_blank",
      options: [],
      correctAnswer: "OK",
    },
    {
      question: "React is primarily used for front-end development.",
      type: "true_false",
      options: ["True", "False"],
      correctAnswer: "True",
    },
  ],
};

const defaultTrueFalseOptions = ["True", "False"];

const normalizeQuestionType = (value: unknown): QuestionType | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "mcq") {
    return "mcq";
  }

  if (normalized === "fill_blank" || normalized === "fillblank" || normalized === "fill") {
    return "fill_blank";
  }

  if (
    normalized === "true_false" ||
    normalized === "truefalse" ||
    normalized === "boolean" ||
    normalized === "tf"
  ) {
    return "true_false";
  }

  return null;
};

const normalizeTrueFalseAnswer = (value: string): string | null => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return "True";
  }
  if (normalized === "false") {
    return "False";
  }
  return null;
};

const normalizeFreeTextForComparison = (value: string): string =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

const dbConnectionErrorCodes = new Set([
  "28P01",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "ECONNRESET",
  "ETIMEDOUT",
  "3D000",
]);

const normalizeStatusValue = (value: string): QuizStatus | null => {
  switch (value.trim().toLowerCase()) {
    case "draft":
      return "Draft";
    case "published":
      return "Published";
    case "completed":
      return "Completed";
    default:
      return null;
  }
};

const isDatabaseConnectionError = (error: unknown): boolean => {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  if (dbConnectionErrorCodes.has(code)) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("password authentication failed") ||
    message.includes("client password must be a string") ||
    message.includes("connection terminated unexpectedly") ||
    message.includes("timeout expired") ||
    message.includes("connect econnrefused") ||
    (message.includes("database") && message.includes("does not exist"))
  );
};

const columnExists = async (
  db: Pool | PoolClient,
  tableName: string,
  columnName: string
): Promise<boolean> => {
  const result = await db.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
      ) AS exists
    `,
    [tableName, columnName]
  );

  return Boolean(result.rows[0]?.exists);
};

const resolveQuizIdColumn = async (db: Pool | PoolClient): Promise<"quiz_id" | "id"> => {
  if (await columnExists(db, "quizzes", "quiz_id")) {
    return "quiz_id";
  }

  if (await columnExists(db, "quizzes", "id")) {
    return "id";
  }

  throw new Error("quizzes table is missing both quiz_id and id columns");
};

const ensureQuizQuestionTables = async (
  db: Pool | PoolClient,
  quizIdColumn: "quiz_id" | "id"
): Promise<void> => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS questions (
      question_id SERIAL PRIMARY KEY,
      quiz_id INT REFERENCES quizzes(${quizIdColumn}) ON DELETE CASCADE,
      question_text TEXT NOT NULL,
      question_type VARCHAR(30) NOT NULL DEFAULT 'mcq',
      correct_answer_text TEXT NOT NULL DEFAULT ''
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS options (
      option_id SERIAL PRIMARY KEY,
      question_id INT REFERENCES questions(question_id) ON DELETE CASCADE,
      option_text TEXT NOT NULL,
      is_correct BOOLEAN NOT NULL DEFAULT FALSE
    )
  `);

  await db.query("ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_type VARCHAR(30)");
  await db.query(
    "ALTER TABLE questions ALTER COLUMN question_type SET DEFAULT 'mcq'"
  );
  await db.query(
    "UPDATE questions SET question_type = 'mcq' WHERE question_type IS NULL OR question_type = ''"
  );
  await db.query("ALTER TABLE questions ALTER COLUMN question_type SET NOT NULL");

  await db.query("ALTER TABLE questions ADD COLUMN IF NOT EXISTS correct_answer_text TEXT");
  await db.query(
    "UPDATE questions SET correct_answer_text = '' WHERE correct_answer_text IS NULL"
  );
  await db.query(
    "ALTER TABLE questions ALTER COLUMN correct_answer_text SET DEFAULT ''"
  );
  await db.query("ALTER TABLE questions ALTER COLUMN correct_answer_text SET NOT NULL");
};

const parseQuizIdParam = (req: Request, res: Response): number | null => {
  const quizId = Number(req.params.id);
  if (!Number.isInteger(quizId) || quizId <= 0) {
    res.status(400).json({ error: "Invalid quiz id" });
    return null;
  }
  return quizId;
};

const isValidQuestion = (question: unknown): question is QuizQuestionInput => {
  if (!question || typeof question !== "object") {
    return false;
  }

  const payload = question as Partial<QuizQuestionInput>;
  const hasQuestionText =
    typeof payload.question === "string" && payload.question.trim().length > 0;
  const hasCorrectAnswer =
    typeof payload.correctAnswer === "string" && payload.correctAnswer.trim().length > 0;

  if (!hasQuestionText || !hasCorrectAnswer) {
    return false;
  }

  const questionType = normalizeQuestionType(payload.type ?? "mcq") ?? "mcq";
  if (questionType === "fill_blank") {
    return true;
  }

  if (questionType === "true_false") {
    return normalizeTrueFalseAnswer(payload.correctAnswer ?? "") !== null;
  }

  const hasOptions =
    Array.isArray(payload.options) &&
    payload.options.length > 1 &&
    payload.options.every((option) => typeof option === "string" && option.trim().length > 0);
  return hasOptions;
};

const normalizeQuizPayload = (body: unknown): {
  error?: string;
  payload?: NormalizedQuizPayload;
} => {
  const rawBody =
    body && typeof body === "object"
      ? (body as {
          cls?: unknown;
          title?: unknown;
          duration?: unknown;
          questions?: unknown;
        })
      : {};

  const { cls, title, duration, questions: rawQuestions } = rawBody;
  if (
    typeof cls !== "string" ||
    !cls.trim() ||
    typeof title !== "string" ||
    !title.trim() ||
    typeof duration !== "string" ||
    !duration.trim() ||
    !Array.isArray(rawQuestions) ||
    rawQuestions.length === 0
  ) {
    return {
      error: "cls, title, duration and at least one question are required",
    };
  }

  if (!rawQuestions.every(isValidQuestion)) {
    return {
      error:
        "Each question must include text and correct answer. MCQ requires options. True/False must use true or false.",
    };
  }

  const questions: NormalizedQuizQuestion[] = rawQuestions.map((rawQuestion) => {
    const questionType = normalizeQuestionType(rawQuestion.type ?? "mcq") ?? "mcq";
    if (questionType === "fill_blank") {
      return {
        question: rawQuestion.question.trim(),
        type: questionType,
        options: [],
        correctAnswer: rawQuestion.correctAnswer.trim(),
      };
    }

    if (questionType === "true_false") {
      return {
        question: rawQuestion.question.trim(),
        type: questionType,
        options: [...defaultTrueFalseOptions],
        correctAnswer: normalizeTrueFalseAnswer(rawQuestion.correctAnswer)!,
      };
    }

    return {
      question: rawQuestion.question.trim(),
      type: questionType,
      options: (rawQuestion.options ?? []).map((option) => option.trim()),
      correctAnswer: rawQuestion.correctAnswer.trim(),
    };
  });

  const hasInvalidMcqQuestion = questions.some((question) => {
    if (question.type !== "mcq") {
      return false;
    }
    if (question.options.length < 2) {
      return true;
    }
    return !question.options.includes(question.correctAnswer);
  });
  if (hasInvalidMcqQuestion) {
    return { error: "MCQ correct answer must match one of the options" };
  }

  return {
    payload: {
      cls: cls.trim(),
      title: title.trim(),
      duration: duration.trim(),
      questions,
    },
  };
};

const normalizeStatusPayload = (body: unknown): {
  error?: string;
  payload?: { status: QuizStatus };
} => {
  const rawBody = body && typeof body === "object" ? (body as { status?: unknown }) : {};
  if (typeof rawBody.status !== "string" || !rawBody.status.trim()) {
    return { error: "status is required" };
  }

  const status = normalizeStatusValue(rawBody.status);
  if (!status) {
    return { error: "status must be one of: Draft, Published, Completed" };
  }

  return { payload: { status } };
};

const buildInMemoryQuestions = (questions: NormalizedQuizQuestion[]): InMemoryQuestion[] =>
  questions.map((question) => ({
    question_id: inMemoryQuestionId++,
    question_text: question.question,
    question_type: question.type,
    correct_answer_text: question.correctAnswer,
    options: question.options.map((option) => ({
      option_id: inMemoryOptionId++,
      option_text: option,
      is_correct: option === question.correctAnswer,
    })),
  }));

const createInMemoryQuiz = (
  payload: NormalizedQuizPayload,
  status: QuizStatus = "Draft"
): InMemoryQuiz => {
  const quiz: InMemoryQuiz = {
    quiz_id: inMemoryQuizId++,
    cls: payload.cls,
    title: payload.title,
    duration: payload.duration,
    status,
    questions: buildInMemoryQuestions(payload.questions),
  };

  inMemoryQuizzes.push(quiz);
  return quiz;
};

const ensureSampleQuizInMemory = (): void => {
  if (inMemoryQuizzes.length > 0) {
    return;
  }

  createInMemoryQuiz(sampleQuizPayload, "Published");
};

const loadQuizWithRelations = async (
  db: Pool | PoolClient,
  idColumn: "quiz_id" | "id",
  quizId: number
): Promise<Record<string, unknown> | null> => {
  const quizResult = await db.query(`SELECT * FROM quizzes WHERE ${idColumn} = $1`, [quizId]);
  const quiz = quizResult.rows[0];
  if (!quiz) {
    return null;
  }

  const normalizedQuizId = quiz.quiz_id ?? quiz.id;
  quiz.quiz_id = normalizedQuizId;

  const questionsResult = await db.query(
    "SELECT * FROM questions WHERE quiz_id = $1 ORDER BY question_id ASC",
    [normalizedQuizId]
  );
  const questions = questionsResult.rows;

  for (const question of questions) {
    const optionsResult = await db.query(
      "SELECT * FROM options WHERE question_id = $1 ORDER BY option_id ASC",
      [question.question_id]
    );
    question.options = optionsResult.rows;
  }

  quiz.questions = questions;
  return quiz;
};

const loadAllQuizzesWithRelations = async (
  db: Pool | PoolClient,
  idColumn: "quiz_id" | "id"
): Promise<Record<string, unknown>[]> => {
  const quizzesResult = await db.query(`SELECT * FROM quizzes ORDER BY ${idColumn} DESC`);
  const quizzes = quizzesResult.rows;

  for (const quiz of quizzes) {
    const normalizedQuizId = quiz.quiz_id ?? quiz.id;
    quiz.quiz_id = normalizedQuizId;

    const questionsResult = await db.query(
      "SELECT * FROM questions WHERE quiz_id = $1 ORDER BY question_id ASC",
      [normalizedQuizId]
    );
    const questions = questionsResult.rows;

    for (const question of questions) {
      const optionsResult = await db.query(
        "SELECT * FROM options WHERE question_id = $1 ORDER BY option_id ASC",
        [question.question_id]
      );
      question.options = optionsResult.rows;
    }

    quiz.questions = questions;
  }

  return quizzes;
};

const insertQuizQuestions = async (
  db: Pool | PoolClient,
  quizId: number,
  questions: NormalizedQuizQuestion[]
): Promise<void> => {
  for (const question of questions) {
    const questionResult = await db.query(
      `
        INSERT INTO questions (quiz_id, question_text, question_type, correct_answer_text)
        VALUES ($1, $2, $3, $4)
        RETURNING question_id
      `,
      [quizId, question.question, question.type, question.correctAnswer]
    );

    const questionId = questionResult.rows[0]?.question_id;
    for (const option of question.options) {
      await db.query(
        "INSERT INTO options (question_id, option_text, is_correct) VALUES ($1, $2, $3)",
        [questionId, option, option === question.correctAnswer]
      );
    }
  }
};

const createSampleQuizInDatabase = async (
  db: Pool | PoolClient,
  quizIdColumn: "quiz_id" | "id"
): Promise<Record<string, unknown> | null> => {
  const hasQuestionsColumn = await columnExists(db, "quizzes", "questions");

  const quizResult = hasQuestionsColumn
    ? await db.query(
        "INSERT INTO quizzes (cls, title, questions, duration, status) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [
          sampleQuizPayload.cls,
          sampleQuizPayload.title,
          sampleQuizPayload.questions.length,
          sampleQuizPayload.duration,
          "Published",
        ]
      )
    : await db.query(
        "INSERT INTO quizzes (cls, title, duration, status) VALUES ($1, $2, $3, $4) RETURNING *",
        [
          sampleQuizPayload.cls,
          sampleQuizPayload.title,
          sampleQuizPayload.duration,
          "Published",
        ]
      );

  const createdQuiz = quizResult.rows[0];
  const quizId = Number(createdQuiz?.quiz_id ?? createdQuiz?.id);
  if (!Number.isInteger(quizId) || quizId <= 0) {
    return null;
  }

  await insertQuizQuestions(db, quizId, sampleQuizPayload.questions);
  return loadQuizWithRelations(db, quizIdColumn, quizId);
};

export const getQuizzes = async (req: Request, res: Response) => {
  try {
    const quizIdColumn = await resolveQuizIdColumn(pool);
    await ensureQuizQuestionTables(pool, quizIdColumn);
    let quizzes = await loadAllQuizzesWithRelations(pool, quizIdColumn);
    if (quizzes.length === 0) {
      await createSampleQuizInDatabase(pool, quizIdColumn);
      quizzes = await loadAllQuizzesWithRelations(pool, quizIdColumn);
    }
    res.json(quizzes);
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      console.warn("Database unavailable while fetching quizzes. Returning in-memory quizzes.");
      ensureSampleQuizInMemory();
      return res.json(inMemoryQuizzes);
    }

    console.error("Error fetching quizzes:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getQuizById = async (req: Request, res: Response) => {
  const quizId = parseQuizIdParam(req, res);
  if (!quizId) {
    return;
  }

  try {
    const quizIdColumn = await resolveQuizIdColumn(pool);
    await ensureQuizQuestionTables(pool, quizIdColumn);
    const quiz = await loadQuizWithRelations(pool, quizIdColumn, quizId);
    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    res.json(quiz);
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      const quiz = inMemoryQuizzes.find((item) => item.quiz_id === quizId);
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found" });
      }
      return res.json(quiz);
    }

    console.error("Error fetching quiz:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createQuiz = async (req: Request, res: Response) => {
  const normalized = normalizeQuizPayload(req.body);
  if (normalized.error || !normalized.payload) {
    return res.status(400).json({ error: normalized.error ?? "Invalid payload" });
  }

  const payload = normalized.payload;
  let client: PoolClient | null = null;
  let transactionStarted = false;

  try {
    client = await pool.connect();
    const quizIdColumn = await resolveQuizIdColumn(client);
    await ensureQuizQuestionTables(client, quizIdColumn);

    await client.query("BEGIN");
    transactionStarted = true;

    const hasQuestionsColumn = await columnExists(client, "quizzes", "questions");
    const status: QuizStatus = "Draft";

    const quizResult = hasQuestionsColumn
      ? await client.query(
          "INSERT INTO quizzes (cls, title, questions, duration, status) VALUES ($1, $2, $3, $4, $5) RETURNING *",
          [payload.cls, payload.title, payload.questions.length, payload.duration, status]
        )
      : await client.query(
          "INSERT INTO quizzes (cls, title, duration, status) VALUES ($1, $2, $3, $4) RETURNING *",
          [payload.cls, payload.title, payload.duration, status]
        );

    const createdQuiz = quizResult.rows[0];
    const quizId = createdQuiz.quiz_id ?? createdQuiz.id;
    await insertQuizQuestions(client, quizId, payload.questions);

    await client.query("COMMIT");
    const quiz = await loadQuizWithRelations(client, quizIdColumn, quizId);
    res.status(201).json(quiz ?? { ...createdQuiz, quiz_id: quizId, questions: [] });
  } catch (error: unknown) {
    if (client && transactionStarted) {
      await client.query("ROLLBACK");
    }

    if (isDatabaseConnectionError(error)) {
      const quiz = createInMemoryQuiz(payload, "Draft");
      console.warn("Database unavailable while creating quiz. Saved quiz in in-memory store.");
      return res.status(201).json(quiz);
    }

    console.error("Error creating quiz:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  } finally {
    client?.release();
  }
};

export const updateQuiz = async (req: Request, res: Response) => {
  const quizId = parseQuizIdParam(req, res);
  if (!quizId) {
    return;
  }

  const normalized = normalizeQuizPayload(req.body);
  if (normalized.error || !normalized.payload) {
    return res.status(400).json({ error: normalized.error ?? "Invalid payload" });
  }

  const payload = normalized.payload;
  let client: PoolClient | null = null;
  let transactionStarted = false;

  try {
    client = await pool.connect();
    const quizIdColumn = await resolveQuizIdColumn(client);
    await ensureQuizQuestionTables(client, quizIdColumn);

    await client.query("BEGIN");
    transactionStarted = true;

    const hasQuestionsColumn = await columnExists(client, "quizzes", "questions");
    const updateResult = hasQuestionsColumn
      ? await client.query(
          `UPDATE quizzes SET cls = $1, title = $2, duration = $3, questions = $4 WHERE ${quizIdColumn} = $5 RETURNING *`,
          [payload.cls, payload.title, payload.duration, payload.questions.length, quizId]
        )
      : await client.query(
          `UPDATE quizzes SET cls = $1, title = $2, duration = $3 WHERE ${quizIdColumn} = $4 RETURNING *`,
          [payload.cls, payload.title, payload.duration, quizId]
        );

    if (!updateResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Quiz not found" });
    }

    await client.query("DELETE FROM questions WHERE quiz_id = $1", [quizId]);
    await insertQuizQuestions(client, quizId, payload.questions);

    await client.query("COMMIT");
    const quiz = await loadQuizWithRelations(client, quizIdColumn, quizId);
    res.json(quiz);
  } catch (error) {
    if (client && transactionStarted) {
      await client.query("ROLLBACK");
    }

    if (isDatabaseConnectionError(error)) {
      const quiz = inMemoryQuizzes.find((item) => item.quiz_id === quizId);
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found" });
      }

      quiz.cls = payload.cls;
      quiz.title = payload.title;
      quiz.duration = payload.duration;
      quiz.questions = buildInMemoryQuestions(payload.questions);
      return res.json(quiz);
    }

    console.error("Error updating quiz:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client?.release();
  }
};

export const updateQuizStatus = async (req: Request, res: Response) => {
  const quizId = parseQuizIdParam(req, res);
  if (!quizId) {
    return;
  }

  const normalized = normalizeStatusPayload(req.body);
  if (normalized.error || !normalized.payload) {
    return res.status(400).json({ error: normalized.error ?? "Invalid payload" });
  }

  const { status } = normalized.payload;

  try {
    const quizIdColumn = await resolveQuizIdColumn(pool);
    const result = await pool.query(
      `UPDATE quizzes SET status = $1 WHERE ${quizIdColumn} = $2 RETURNING *`,
      [status, quizId]
    );
    if (!result.rowCount) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    const quiz = await loadQuizWithRelations(pool, quizIdColumn, quizId);
    res.json(quiz);
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      const quiz = inMemoryQuizzes.find((item) => item.quiz_id === quizId);
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found" });
      }

      quiz.status = status;
      return res.json(quiz);
    }

    console.error("Error updating quiz status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteQuiz = async (req: Request, res: Response) => {
  const quizId = parseQuizIdParam(req, res);
  if (!quizId) {
    return;
  }

  try {
    const idColumn = await resolveQuizIdColumn(pool);
    const result = await pool.query(`DELETE FROM quizzes WHERE ${idColumn} = $1`, [quizId]);
    if (!result.rowCount) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    res.sendStatus(204);
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      const quizIndex = inMemoryQuizzes.findIndex((quiz) => quiz.quiz_id === quizId);
      if (quizIndex === -1) {
        return res.status(404).json({ error: "Quiz not found" });
      }

      inMemoryQuizzes.splice(quizIndex, 1);
      return res.sendStatus(204);
    }

    console.error("Error deleting quiz:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

type AttemptStatus = "InProgress" | "Submitted";

interface QuizAttemptAnswerInput {
  questionId: number;
  answerText: string;
}

interface InMemoryQuizAttempt {
  attempt_id: number;
  quiz_id: number;
  student_id: string;
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
  status: AttemptStatus;
  score: number | null;
  total_questions: number;
  faculty_score: number | null;
  reviewed_at: string | null;
  question_order: number[];
  answers: Record<number, string>;
}

interface DbAttemptRow {
  attempt_id: number;
  quiz_id: number;
  student_id: string;
  started_at: Date | string;
  expires_at: Date | string;
  submitted_at: Date | string | null;
  status: string;
  score: number | null;
  total_questions: number;
  faculty_score: number | null;
  reviewed_at: Date | string | null;
  question_order: unknown;
}

const inMemoryQuizAttempts: InMemoryQuizAttempt[] = [];
let inMemoryAttemptId = 1;

const parseAttemptIdParam = (req: Request, res: Response): number | null => {
  const attemptId = Number(req.params.attemptId);
  if (!Number.isInteger(attemptId) || attemptId <= 0) {
    res.status(400).json({ error: "Invalid attempt id" });
    return null;
  }
  return attemptId;
};

const sanitizeStudentId = (value: string): string => value.trim().slice(0, 120);

const resolveStudentId = (req: Request): string => {
  const bodyValue =
    req.body && typeof req.body === "object" && "studentId" in req.body
      ? (req.body as { studentId?: unknown }).studentId
      : undefined;
  if (typeof bodyValue === "string" && bodyValue.trim()) {
    return sanitizeStudentId(bodyValue);
  }

  const queryValue = req.query.studentId;
  if (typeof queryValue === "string" && queryValue.trim()) {
    return sanitizeStudentId(queryValue);
  }

  const headerValue = req.header("x-student-id");
  if (typeof headerValue === "string" && headerValue.trim()) {
    return sanitizeStudentId(headerValue);
  }

  return "student-demo";
};

const toIsoString = (value: unknown): string => {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
};

const remainingSecondsFromIso = (expiresAtIso: string): number =>
  Math.max(0, Math.floor((new Date(expiresAtIso).getTime() - Date.now()) / 1000));

const parseDurationToSeconds = (duration: string): number => {
  const fallback = 30 * 60;
  const normalized = duration.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  const clockMatch = normalized.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (clockMatch) {
    const first = Number(clockMatch[1]);
    const second = Number(clockMatch[2]);
    const third = clockMatch[3] ? Number(clockMatch[3]) : 0;
    if (clockMatch[3]) {
      return Math.max(60, Math.min(first * 3600 + second * 60 + third, 6 * 3600));
    }
    return Math.max(60, Math.min(first * 60 + second, 6 * 3600));
  }

  const unitMatch = normalized.match(
    /(\d+)\s*(hours?|hrs?|hr|h|minutes?|mins?|min|m|seconds?|secs?|sec|s)?/
  );
  if (!unitMatch) {
    return fallback;
  }

  const rawValue = Number(unitMatch[1]);
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return fallback;
  }

  const unit = unitMatch[2] ?? "min";
  let seconds = rawValue * 60;
  if (unit.startsWith("h")) {
    seconds = rawValue * 3600;
  } else if (unit.startsWith("s")) {
    seconds = rawValue;
  }

  return Math.max(60, Math.min(seconds, 6 * 3600));
};

const ensureQuizAttemptTables = async (
  db: Pool | PoolClient,
  quizIdColumn: "quiz_id" | "id"
): Promise<void> => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      attempt_id SERIAL PRIMARY KEY,
      quiz_id INT REFERENCES quizzes(${quizIdColumn}) ON DELETE CASCADE,
      student_id VARCHAR(120) NOT NULL,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      submitted_at TIMESTAMPTZ,
      status VARCHAR(20) NOT NULL DEFAULT 'InProgress',
      score INT,
      total_questions INT NOT NULL DEFAULT 0
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS quiz_attempt_answers (
      answer_id SERIAL PRIMARY KEY,
      attempt_id INT REFERENCES quiz_attempts(attempt_id) ON DELETE CASCADE,
      question_id INT REFERENCES questions(question_id) ON DELETE CASCADE,
      selected_option_text TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (attempt_id, question_id)
    )
  `);

  await db.query(
    "CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_student ON quiz_attempts (quiz_id, student_id)"
  );

  await db.query("ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS faculty_score NUMERIC");
  await db.query("ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ");
  await db.query("ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS question_order JSONB");
};

const normalizeAttemptAnswersPayload = (body: unknown): {
  error?: string;
  payload?: QuizAttemptAnswerInput[];
} => {
  const rawBody =
    body && typeof body === "object"
      ? (body as {
          answers?: unknown;
          questionId?: unknown;
          answerText?: unknown;
          selectedOptionText?: unknown;
        })
      : {};

  const answerCandidates = Array.isArray(rawBody.answers)
    ? rawBody.answers
    : rawBody.questionId !== undefined
      ? [
          {
            questionId: rawBody.questionId,
            answerText: rawBody.answerText,
            selectedOptionText: rawBody.selectedOptionText,
          },
        ]
      : [];

  if (!answerCandidates.length) {
    return {
      error:
        "answers is required. Use [{ questionId, answerText }] or questionId + answerText",
    };
  }

  const normalizedAnswers: QuizAttemptAnswerInput[] = [];
  for (const candidate of answerCandidates) {
    if (!candidate || typeof candidate !== "object") {
      return { error: "Each answer must be an object with questionId and answerText" };
    }

    const answer = candidate as {
      questionId?: unknown;
      answerText?: unknown;
      selectedOptionText?: unknown;
    };
    const questionId = Number(answer.questionId);
    if (!Number.isInteger(questionId) || questionId <= 0) {
      return { error: "questionId must be a positive integer" };
    }

    const answerTextCandidate =
      typeof answer.answerText === "string" && answer.answerText.trim()
        ? answer.answerText
        : typeof answer.selectedOptionText === "string"
          ? answer.selectedOptionText
          : null;

    if (typeof answerTextCandidate !== "string" || !answerTextCandidate.trim()) {
      return { error: "answerText is required" };
    }

    normalizedAnswers.push({
      questionId,
      answerText: answerTextCandidate.trim(),
    });
  }

  return { payload: normalizedAnswers };
};

const normalizeFacultyScorePayload = (body: unknown): {
  error?: string;
  payload?: { score: number };
} => {
  const rawBody = body && typeof body === "object" ? (body as { score?: unknown }) : {};
  const rawScore = rawBody.score;
  const numericScore =
    typeof rawScore === "number"
      ? rawScore
      : typeof rawScore === "string" && rawScore.trim()
        ? Number(rawScore)
        : NaN;

  if (!Number.isFinite(numericScore)) {
    return { error: "score is required and must be a valid number" };
  }

  if (numericScore < 0) {
    return { error: "score cannot be negative" };
  }

  return { payload: { score: Number(numericScore.toFixed(2)) } };
};

interface QuizQuestionMeta {
  type: QuestionType;
  options: Set<string>;
  correctAnswer: string;
}

const extractQuestionMetaLookup = (
  quiz: Record<string, unknown>
): Map<number, QuizQuestionMeta> => {
  const questionLookup = new Map<number, QuizQuestionMeta>();
  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];

  for (const questionValue of questions) {
    if (!questionValue || typeof questionValue !== "object") {
      continue;
    }
    const question = questionValue as {
      question_id?: unknown;
      question_type?: unknown;
      correct_answer_text?: unknown;
      options?: unknown;
    };
    const questionId = Number(question.question_id);
    if (!Number.isInteger(questionId) || questionId <= 0) {
      continue;
    }

    const questionType = normalizeQuestionType(question.question_type) ?? "mcq";
    const correctAnswer =
      typeof question.correct_answer_text === "string" ? question.correct_answer_text.trim() : "";

    const optionValues = Array.isArray(question.options) ? question.options : [];
    const options = new Set<string>();
    for (const optionValue of optionValues) {
      if (!optionValue || typeof optionValue !== "object") {
        continue;
      }
      const option = optionValue as { option_text?: unknown };
      if (typeof option.option_text === "string" && option.option_text.trim()) {
        options.add(option.option_text.trim());
      }
    }

    questionLookup.set(questionId, {
      type: questionType,
      options,
      correctAnswer,
    });
  }

  return questionLookup;
};

const normalizeAnswerForQuestionType = (type: QuestionType, answer: string): string => {
  if (type === "fill_blank") {
    return normalizeFreeTextForComparison(answer);
  }
  if (type === "true_false") {
    return normalizeTrueFalseAnswer(answer) ?? answer.trim();
  }
  return answer.trim();
};

const sanitizeQuizForStudent = (quiz: Record<string, unknown>): Record<string, unknown> => {
  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  const sanitizedQuestions = questions.map((questionValue) => {
    const question = questionValue as {
      question_id?: unknown;
      question_text?: unknown;
      question_type?: unknown;
      options?: unknown;
    };
    const options = Array.isArray(question.options) ? question.options : [];
    return {
      question_id: Number(question.question_id),
      question_text: String(question.question_text ?? ""),
      question_type: normalizeQuestionType(question.question_type) ?? "mcq",
      options: options
        .map((optionValue) => {
          const option = optionValue as {
            option_id?: unknown;
            option_text?: unknown;
          };
          return {
            option_id: Number(option.option_id),
            option_text: String(option.option_text ?? ""),
          };
        })
        .filter(
          (option) =>
            Number.isInteger(option.option_id) && option.option_id > 0 && option.option_text
        ),
    };
  });

  return {
    quiz_id: Number(quiz.quiz_id ?? quiz.id),
    cls: String(quiz.cls ?? ""),
    title: String(quiz.title ?? ""),
    duration: String(quiz.duration ?? ""),
    status: String(quiz.status ?? ""),
    questions: sanitizedQuestions.filter(
      (question) => Number.isInteger(question.question_id) && question.question_id > 0
    ),
  };
};

const countQuizQuestions = (quiz: Record<string, unknown>): number =>
  Array.isArray(quiz.questions) ? quiz.questions.length : 0;

const shuffleNumbers = (values: number[]): number[] => {
  const shuffled = [...values];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
  }
  return shuffled;
};

const parseQuestionOrder = (value: unknown): number[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => Number(item))
          .filter((item) => Number.isInteger(item) && item > 0);
      }
    } catch {
      return [];
    }
  }

  return [];
};

const applyQuestionOrderToQuiz = (
  quiz: Record<string, unknown>,
  questionOrder: number[]
): Record<string, unknown> => {
  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  if (!questionOrder.length || !questions.length) {
    return quiz;
  }

  const questionsById = new Map<number, Record<string, unknown>>();
  for (const questionValue of questions) {
    if (!questionValue || typeof questionValue !== "object") {
      continue;
    }
    const question = questionValue as { question_id?: unknown };
    const questionId = Number(question.question_id);
    if (Number.isInteger(questionId) && questionId > 0) {
      questionsById.set(questionId, questionValue as Record<string, unknown>);
    }
  }

  const orderedQuestions: Record<string, unknown>[] = [];
  const seen = new Set<number>();
  for (const questionId of questionOrder) {
    const question = questionsById.get(questionId);
    if (question && !seen.has(questionId)) {
      orderedQuestions.push(question);
      seen.add(questionId);
    }
  }

  for (const questionValue of questions) {
    const question = questionValue as { question_id?: unknown };
    const questionId = Number(question.question_id);
    if (Number.isInteger(questionId) && questionId > 0 && !seen.has(questionId)) {
      orderedQuestions.push(questionValue as Record<string, unknown>);
      seen.add(questionId);
    }
  }

  return {
    ...quiz,
    questions: orderedQuestions,
  };
};

const extractQuestionIds = (quiz: Record<string, unknown>): number[] => {
  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  return questions
    .map((questionValue) =>
      Number(
        (questionValue as {
          question_id?: unknown;
        }).question_id
      )
    )
    .filter((questionId) => Number.isInteger(questionId) && questionId > 0);
};

const loadDbAttemptAnswers = async (
  db: Pool | PoolClient,
  attemptId: number
): Promise<Record<number, string>> => {
  const result = await db.query(
    "SELECT question_id, selected_option_text FROM quiz_attempt_answers WHERE attempt_id = $1",
    [attemptId]
  );

  const answers: Record<number, string> = {};
  for (const row of result.rows) {
    const questionId = Number((row as { question_id?: unknown }).question_id);
    const selectedOptionText = (row as { selected_option_text?: unknown }).selected_option_text;
    if (Number.isInteger(questionId) && questionId > 0 && typeof selectedOptionText === "string") {
      answers[questionId] = selectedOptionText;
    }
  }

  return answers;
};

const loadLatestDbAttempt = async (
  db: Pool | PoolClient,
  quizId: number,
  studentId: string
): Promise<DbAttemptRow | null> => {
  const result = await db.query(
    `
      SELECT *
      FROM quiz_attempts
      WHERE quiz_id = $1 AND student_id = $2
      ORDER BY started_at DESC
      LIMIT 1
    `,
    [quizId, studentId]
  );

  return (result.rows[0] as DbAttemptRow | undefined) ?? null;
};

const loadDbAttemptById = async (
  db: Pool | PoolClient,
  quizId: number,
  attemptId: number
): Promise<DbAttemptRow | null> => {
  const result = await db.query(
    "SELECT * FROM quiz_attempts WHERE quiz_id = $1 AND attempt_id = $2",
    [quizId, attemptId]
  );

  return (result.rows[0] as DbAttemptRow | undefined) ?? null;
};

const calculateDbScore = async (
  db: Pool | PoolClient,
  quizId: number,
  answers: Record<number, string>
): Promise<{ score: number; totalQuestions: number }> => {
  const result = await db.query(
    `
      SELECT q.question_id, q.question_type, q.correct_answer_text
      FROM questions q
      WHERE q.quiz_id = $1
      ORDER BY q.question_id ASC
    `,
    [quizId]
  );

  let score = 0;
  for (const row of result.rows) {
    const questionId = Number((row as { question_id?: unknown }).question_id);
    const questionType = normalizeQuestionType((row as { question_type?: unknown }).question_type) ?? "mcq";
    const correctAnswer = String((row as { correct_answer_text?: unknown }).correct_answer_text ?? "");
    const selectedAnswer = answers[questionId];
    if (!Number.isInteger(questionId) || questionId <= 0 || typeof selectedAnswer !== "string") {
      continue;
    }

    const normalizedExpected = normalizeAnswerForQuestionType(questionType, correctAnswer);
    const normalizedSelected = normalizeAnswerForQuestionType(questionType, selectedAnswer);
    if (normalizedExpected && normalizedExpected === normalizedSelected) {
      score += 1;
    }
  }

  return { score, totalQuestions: result.rowCount ?? 0 };
};

const buildDbAttemptResponse = (
  quiz: Record<string, unknown>,
  attempt: DbAttemptRow,
  answers: Record<number, string>
): Record<string, unknown> => {
  const expiresAtIso = toIsoString(attempt.expires_at);
  const orderedQuiz = applyQuestionOrderToQuiz(quiz, parseQuestionOrder(attempt.question_order));
  return {
    attempt_id: attempt.attempt_id,
    quiz_id: attempt.quiz_id,
    student_id: attempt.student_id,
    started_at: toIsoString(attempt.started_at),
    expires_at: expiresAtIso,
    submitted_at: attempt.submitted_at ? toIsoString(attempt.submitted_at) : null,
    status: attempt.submitted_at ? "Submitted" : "InProgress",
    score: attempt.score,
    faculty_score: attempt.faculty_score,
    reviewed_at: attempt.reviewed_at ? toIsoString(attempt.reviewed_at) : null,
    total_questions: Number(attempt.total_questions ?? countQuizQuestions(quiz)),
    remaining_seconds: attempt.submitted_at ? 0 : remainingSecondsFromIso(expiresAtIso),
    answers,
    quiz: sanitizeQuizForStudent(orderedQuiz),
  };
};

const finalizeDbAttempt = async (
  db: Pool | PoolClient,
  quizIdColumn: "quiz_id" | "id",
  quizId: number,
  attempt: DbAttemptRow
): Promise<Record<string, unknown> | null> => {
  const answers = await loadDbAttemptAnswers(db, attempt.attempt_id);
  let finalAttempt = attempt;

  if (!attempt.submitted_at) {
    const { score, totalQuestions } = await calculateDbScore(db, quizId, answers);
    const updateResult = await db.query(
      `
        UPDATE quiz_attempts
        SET submitted_at = NOW(),
            status = 'Submitted',
            score = $1,
            total_questions = $2
        WHERE attempt_id = $3
        RETURNING *
      `,
      [score, totalQuestions, attempt.attempt_id]
    );
    finalAttempt = (updateResult.rows[0] as DbAttemptRow | undefined) ?? attempt;
  }

  const quiz = await loadQuizWithRelations(db, quizIdColumn, quizId);
  if (!quiz) {
    return null;
  }

  return buildDbAttemptResponse(quiz, finalAttempt, answers);
};

const validateAttemptAnswersAgainstQuiz = (
  quiz: Record<string, unknown>,
  answers: QuizAttemptAnswerInput[]
): string | null => {
  const questionLookup = extractQuestionMetaLookup(quiz);
  for (const answer of answers) {
    const questionMeta = questionLookup.get(answer.questionId);
    if (!questionMeta) {
      return `Question ${answer.questionId} does not belong to this quiz`;
    }

    if (questionMeta.type === "fill_blank") {
      if (!answer.answerText.trim()) {
        return `Answer is required for question ${answer.questionId}`;
      }
      continue;
    }

    if (!questionMeta.options.has(answer.answerText)) {
      return `Invalid option selected for question ${answer.questionId}`;
    }
  }

  return null;
};

const findLatestInMemoryAttempt = (
  quizId: number,
  studentId: string
): InMemoryQuizAttempt | null => {
  const attempts = inMemoryQuizAttempts
    .filter((attempt) => attempt.quiz_id === quizId && attempt.student_id === studentId)
    .sort((a, b) => b.attempt_id - a.attempt_id);
  return attempts[0] ?? null;
};

const calculateInMemoryScore = (
  quiz: InMemoryQuiz,
  answers: Record<number, string>
): { score: number; totalQuestions: number } => {
  let score = 0;
  for (const question of quiz.questions) {
    const selected = answers[question.question_id];
    const correct = question.correct_answer_text;
    if (!selected) {
      continue;
    }

    const normalizedExpected = normalizeAnswerForQuestionType(question.question_type, correct);
    const normalizedSelected = normalizeAnswerForQuestionType(question.question_type, selected);
    if (normalizedExpected && normalizedExpected === normalizedSelected) {
      score += 1;
    }
  }
  return { score, totalQuestions: quiz.questions.length };
};

const finalizeInMemoryAttempt = (
  quiz: InMemoryQuiz,
  attempt: InMemoryQuizAttempt
): InMemoryQuizAttempt => {
  if (attempt.submitted_at) {
    return attempt;
  }

  const { score, totalQuestions } = calculateInMemoryScore(quiz, attempt.answers);
  attempt.status = "Submitted";
  attempt.submitted_at = new Date().toISOString();
  attempt.score = score;
  attempt.total_questions = totalQuestions;
  return attempt;
};

const buildInMemoryAttemptResponse = (
  quiz: InMemoryQuiz,
  attempt: InMemoryQuizAttempt
): Record<string, unknown> => {
  const remaining = attempt.submitted_at ? 0 : remainingSecondsFromIso(attempt.expires_at);
  const questionOrder = Array.isArray(attempt.question_order) ? attempt.question_order : [];
  const orderedQuestions = applyQuestionOrderToQuiz(
    {
      ...quiz,
      questions: quiz.questions,
    } as Record<string, unknown>,
    questionOrder
  );
  return {
    attempt_id: attempt.attempt_id,
    quiz_id: attempt.quiz_id,
    student_id: attempt.student_id,
    started_at: attempt.started_at,
    expires_at: attempt.expires_at,
    submitted_at: attempt.submitted_at,
    status: attempt.submitted_at ? "Submitted" : "InProgress",
    score: attempt.score,
    faculty_score: attempt.faculty_score,
    reviewed_at: attempt.reviewed_at,
    total_questions: attempt.total_questions,
    remaining_seconds: remaining,
    answers: attempt.answers,
    quiz: sanitizeQuizForStudent(orderedQuestions),
  };
};

export const startQuizAttempt = async (req: Request, res: Response) => {
  const quizId = parseQuizIdParam(req, res);
  if (!quizId) {
    return;
  }

  const studentId = resolveStudentId(req);

  try {
    const quizIdColumn = await resolveQuizIdColumn(pool);
    await ensureQuizQuestionTables(pool, quizIdColumn);
    await ensureQuizAttemptTables(pool, quizIdColumn);

    const quiz = await loadQuizWithRelations(pool, quizIdColumn, quizId);
    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    const latestAttempt = await loadLatestDbAttempt(pool, quizId, studentId);
    if (latestAttempt) {
      let attemptForResponse = latestAttempt;
      const storedOrder = parseQuestionOrder(latestAttempt.question_order);
      if (!storedOrder.length) {
        const shuffledOrder = shuffleNumbers(extractQuestionIds(quiz));
        const updateAttemptResult = await pool.query(
          `
            UPDATE quiz_attempts
            SET question_order = $1
            WHERE attempt_id = $2
            RETURNING *
          `,
          [JSON.stringify(shuffledOrder), latestAttempt.attempt_id]
        );
        attemptForResponse =
          (updateAttemptResult.rows[0] as DbAttemptRow | undefined) ?? latestAttempt;
      }

      if (
        !attemptForResponse.submitted_at &&
        remainingSecondsFromIso(toIsoString(attemptForResponse.expires_at)) <= 0
      ) {
        const finalizedAttempt = await finalizeDbAttempt(
          pool,
          quizIdColumn,
          quizId,
          attemptForResponse
        );
        if (!finalizedAttempt) {
          return res.status(404).json({ error: "Quiz not found" });
        }
        return res.json(finalizedAttempt);
      }

      const existingAnswers = await loadDbAttemptAnswers(pool, attemptForResponse.attempt_id);
      return res.json(buildDbAttemptResponse(quiz, attemptForResponse, existingAnswers));
    }

    const quizStatus = String((quiz as { status?: unknown }).status ?? "").toLowerCase();
    if (quizStatus === "completed") {
      return res.status(400).json({ error: "Quiz is closed." });
    }

    const durationSeconds = parseDurationToSeconds(String((quiz as { duration?: unknown }).duration ?? ""));
    const expiresAt = new Date(Date.now() + durationSeconds * 1000);
    const totalQuestions = countQuizQuestions(quiz);
    const questionOrder = shuffleNumbers(extractQuestionIds(quiz));
    const createResult = await pool.query(
      `
        INSERT INTO quiz_attempts (quiz_id, student_id, expires_at, status, total_questions, question_order)
        VALUES ($1, $2, $3, 'InProgress', $4, $5)
        RETURNING *
      `,
      [quizId, studentId, expiresAt.toISOString(), totalQuestions, JSON.stringify(questionOrder)]
    );

    const attempt = createResult.rows[0] as DbAttemptRow;
    return res.status(201).json(buildDbAttemptResponse(quiz, attempt, {}));
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      const quiz = inMemoryQuizzes.find((item) => item.quiz_id === quizId);
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found" });
      }

      const latestAttempt = findLatestInMemoryAttempt(quizId, studentId);
      if (latestAttempt) {
        if (!Array.isArray(latestAttempt.question_order) || !latestAttempt.question_order.length) {
          latestAttempt.question_order = shuffleNumbers(
            quiz.questions.map((question) => question.question_id)
          );
        }
        if (!latestAttempt.submitted_at && remainingSecondsFromIso(latestAttempt.expires_at) <= 0) {
          finalizeInMemoryAttempt(quiz, latestAttempt);
        }
        return res.json(buildInMemoryAttemptResponse(quiz, latestAttempt));
      }

      if (quiz.status === "Completed") {
        return res.status(400).json({ error: "Quiz is closed." });
      }

      const durationSeconds = parseDurationToSeconds(quiz.duration);
      const now = new Date();
      const questionOrder = shuffleNumbers(quiz.questions.map((question) => question.question_id));
      const attempt: InMemoryQuizAttempt = {
        attempt_id: inMemoryAttemptId++,
        quiz_id: quiz.quiz_id,
        student_id: studentId,
        started_at: now.toISOString(),
        expires_at: new Date(now.getTime() + durationSeconds * 1000).toISOString(),
        submitted_at: null,
        status: "InProgress",
        score: null,
        total_questions: quiz.questions.length,
        faculty_score: null,
        reviewed_at: null,
        question_order: questionOrder,
        answers: {},
      };
      inMemoryQuizAttempts.push(attempt);
      return res.status(201).json(buildInMemoryAttemptResponse(quiz, attempt));
    }

    console.error("Error starting quiz attempt:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getQuizAttempt = async (req: Request, res: Response) => {
  const quizId = parseQuizIdParam(req, res);
  if (!quizId) {
    return;
  }

  const attemptId = parseAttemptIdParam(req, res);
  if (!attemptId) {
    return;
  }

  const studentId = resolveStudentId(req);

  try {
    const quizIdColumn = await resolveQuizIdColumn(pool);
    await ensureQuizQuestionTables(pool, quizIdColumn);
    await ensureQuizAttemptTables(pool, quizIdColumn);

    const quiz = await loadQuizWithRelations(pool, quizIdColumn, quizId);
    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    const attempt = await loadDbAttemptById(pool, quizId, attemptId);
    if (!attempt) {
      return res.status(404).json({ error: "Quiz attempt not found" });
    }

    if (attempt.student_id !== studentId) {
      return res.status(403).json({ error: "Forbidden: attempt belongs to another student" });
    }

    if (!attempt.submitted_at && remainingSecondsFromIso(toIsoString(attempt.expires_at)) <= 0) {
      const finalized = await finalizeDbAttempt(pool, quizIdColumn, quizId, attempt);
      if (!finalized) {
        return res.status(404).json({ error: "Quiz not found" });
      }
      return res.json(finalized);
    }

    const answers = await loadDbAttemptAnswers(pool, attemptId);
    return res.json(buildDbAttemptResponse(quiz, attempt, answers));
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      const quiz = inMemoryQuizzes.find((item) => item.quiz_id === quizId);
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found" });
      }

      const attempt = inMemoryQuizAttempts.find(
        (item) => item.quiz_id === quizId && item.attempt_id === attemptId
      );
      if (!attempt) {
        return res.status(404).json({ error: "Quiz attempt not found" });
      }

      if (attempt.student_id !== studentId) {
        return res.status(403).json({ error: "Forbidden: attempt belongs to another student" });
      }

      if (!attempt.submitted_at && remainingSecondsFromIso(attempt.expires_at) <= 0) {
        finalizeInMemoryAttempt(quiz, attempt);
      }

      return res.json(buildInMemoryAttemptResponse(quiz, attempt));
    }

    console.error("Error fetching quiz attempt:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const saveQuizAttemptAnswers = async (req: Request, res: Response) => {
  const quizId = parseQuizIdParam(req, res);
  if (!quizId) {
    return;
  }

  const attemptId = parseAttemptIdParam(req, res);
  if (!attemptId) {
    return;
  }

  const studentId = resolveStudentId(req);
  const normalizedAnswers = normalizeAttemptAnswersPayload(req.body);
  if (normalizedAnswers.error || !normalizedAnswers.payload) {
    return res.status(400).json({ error: normalizedAnswers.error ?? "Invalid answer payload" });
  }

  const answersToSave = normalizedAnswers.payload;

  try {
    const quizIdColumn = await resolveQuizIdColumn(pool);
    await ensureQuizQuestionTables(pool, quizIdColumn);
    await ensureQuizAttemptTables(pool, quizIdColumn);

    const quiz = await loadQuizWithRelations(pool, quizIdColumn, quizId);
    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    const attempt = await loadDbAttemptById(pool, quizId, attemptId);
    if (!attempt) {
      return res.status(404).json({ error: "Quiz attempt not found" });
    }

    if (attempt.student_id !== studentId) {
      return res.status(403).json({ error: "Forbidden: attempt belongs to another student" });
    }

    if (attempt.submitted_at) {
      const submittedAttempt = await finalizeDbAttempt(pool, quizIdColumn, quizId, attempt);
      return res.status(409).json({
        error: "Quiz already submitted",
        attempt: submittedAttempt,
      });
    }

    if (remainingSecondsFromIso(toIsoString(attempt.expires_at)) <= 0) {
      const finalizedAttempt = await finalizeDbAttempt(pool, quizIdColumn, quizId, attempt);
      return res.status(409).json({
        error: "Quiz time is over. Attempt auto-submitted.",
        attempt: finalizedAttempt,
      });
    }

    const validationError = validateAttemptAnswersAgainstQuiz(quiz, answersToSave);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    for (const answer of answersToSave) {
      await pool.query(
        `
          INSERT INTO quiz_attempt_answers (attempt_id, question_id, selected_option_text)
          VALUES ($1, $2, $3)
          ON CONFLICT (attempt_id, question_id)
          DO UPDATE SET
            selected_option_text = EXCLUDED.selected_option_text,
            updated_at = NOW()
        `,
        [attemptId, answer.questionId, answer.answerText]
      );
    }

    const latestAnswers = await loadDbAttemptAnswers(pool, attemptId);
    return res.json({
      attempt_id: attemptId,
      saved_count: answersToSave.length,
      saved_at: new Date().toISOString(),
      remaining_seconds: remainingSecondsFromIso(toIsoString(attempt.expires_at)),
      answers: latestAnswers,
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      const quiz = inMemoryQuizzes.find((item) => item.quiz_id === quizId);
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found" });
      }

      const attempt = inMemoryQuizAttempts.find(
        (item) => item.quiz_id === quizId && item.attempt_id === attemptId
      );
      if (!attempt) {
        return res.status(404).json({ error: "Quiz attempt not found" });
      }

      if (attempt.student_id !== studentId) {
        return res.status(403).json({ error: "Forbidden: attempt belongs to another student" });
      }

      if (attempt.submitted_at) {
        return res.status(409).json({
          error: "Quiz already submitted",
          attempt: buildInMemoryAttemptResponse(quiz, attempt),
        });
      }

      if (remainingSecondsFromIso(attempt.expires_at) <= 0) {
        finalizeInMemoryAttempt(quiz, attempt);
        return res.status(409).json({
          error: "Quiz time is over. Attempt auto-submitted.",
          attempt: buildInMemoryAttemptResponse(quiz, attempt),
        });
      }

      const validationError = validateAttemptAnswersAgainstQuiz(
        sanitizeQuizForStudent({
          ...quiz,
          questions: quiz.questions,
        } as Record<string, unknown>),
        answersToSave
      );
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      for (const answer of answersToSave) {
        attempt.answers[answer.questionId] = answer.answerText;
      }

      return res.json({
        attempt_id: attemptId,
        saved_count: answersToSave.length,
        saved_at: new Date().toISOString(),
        remaining_seconds: remainingSecondsFromIso(attempt.expires_at),
        answers: attempt.answers,
      });
    }

    console.error("Error saving quiz attempt answers:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const submitQuizAttempt = async (req: Request, res: Response) => {
  const quizId = parseQuizIdParam(req, res);
  if (!quizId) {
    return;
  }

  const attemptId = parseAttemptIdParam(req, res);
  if (!attemptId) {
    return;
  }

  const studentId = resolveStudentId(req);

  try {
    const quizIdColumn = await resolveQuizIdColumn(pool);
    await ensureQuizQuestionTables(pool, quizIdColumn);
    await ensureQuizAttemptTables(pool, quizIdColumn);

    const attempt = await loadDbAttemptById(pool, quizId, attemptId);
    if (!attempt) {
      return res.status(404).json({ error: "Quiz attempt not found" });
    }

    if (attempt.student_id !== studentId) {
      return res.status(403).json({ error: "Forbidden: attempt belongs to another student" });
    }

    const finalizedAttempt = await finalizeDbAttempt(pool, quizIdColumn, quizId, attempt);
    if (!finalizedAttempt) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    return res.json(finalizedAttempt);
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      const quiz = inMemoryQuizzes.find((item) => item.quiz_id === quizId);
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found" });
      }

      const attempt = inMemoryQuizAttempts.find(
        (item) => item.quiz_id === quizId && item.attempt_id === attemptId
      );
      if (!attempt) {
        return res.status(404).json({ error: "Quiz attempt not found" });
      }

      if (attempt.student_id !== studentId) {
        return res.status(403).json({ error: "Forbidden: attempt belongs to another student" });
      }

      finalizeInMemoryAttempt(quiz, attempt);
      return res.json(buildInMemoryAttemptResponse(quiz, attempt));
    }

    console.error("Error submitting quiz attempt:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

interface ResultRow {
  attempt_id: number;
  quiz_id: number;
  quiz_title: string;
  cls: string;
  student_id: string;
  submitted_at: string | null;
  auto_score: number | null;
  total_questions: number;
  faculty_score: number | null;
  reviewed_at: string | null;
}

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const mapDbResultRow = (row: Record<string, unknown>): ResultRow => ({
  attempt_id: Number(row.attempt_id),
  quiz_id: Number(row.quiz_id),
  quiz_title: String(row.quiz_title ?? ""),
  cls: String(row.cls ?? ""),
  student_id: String(row.student_id ?? ""),
  submitted_at: row.submitted_at ? toIsoString(row.submitted_at) : null,
  auto_score: toNullableNumber(row.auto_score),
  total_questions: Number(row.total_questions ?? 0),
  faculty_score: toNullableNumber(row.faculty_score),
  reviewed_at: row.reviewed_at ? toIsoString(row.reviewed_at) : null,
});

const parseOptionalQuizIdFromQuery = (req: Request, res: Response): number | null | undefined => {
  const quizIdValue = req.query.quizId;
  if (quizIdValue === undefined) {
    return undefined;
  }

  if (typeof quizIdValue !== "string") {
    res.status(400).json({ error: "quizId query must be a single value" });
    return null;
  }

  const quizId = Number(quizIdValue);
  if (!Number.isInteger(quizId) || quizId <= 0) {
    res.status(400).json({ error: "Invalid quizId query value" });
    return null;
  }

  return quizId;
};

export const getFacultyResults = async (req: Request, res: Response) => {
  const parsedQuizId = parseOptionalQuizIdFromQuery(req, res);
  if (parsedQuizId === null) {
    return;
  }

  try {
    const quizIdColumn = await resolveQuizIdColumn(pool);
    await ensureQuizQuestionTables(pool, quizIdColumn);
    await ensureQuizAttemptTables(pool, quizIdColumn);

    const queryParams: Array<string | number> = [];
    let whereClause = "WHERE qa.submitted_at IS NOT NULL";
    if (parsedQuizId !== undefined) {
      queryParams.push(parsedQuizId);
      whereClause += ` AND qa.quiz_id = $${queryParams.length}`;
    }

    const result = await pool.query(
      `
        SELECT
          qa.attempt_id,
          qa.quiz_id,
          qa.student_id,
          qa.submitted_at,
          qa.score AS auto_score,
          qa.total_questions,
          qa.faculty_score,
          qa.reviewed_at,
          q.title AS quiz_title,
          q.cls
        FROM quiz_attempts qa
        INNER JOIN quizzes q
          ON qa.quiz_id = q.${quizIdColumn}
        ${whereClause}
        ORDER BY qa.submitted_at DESC NULLS LAST, qa.attempt_id DESC
      `,
      queryParams
    );

    return res.json(result.rows.map((row) => mapDbResultRow(row)));
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      const rows: ResultRow[] = inMemoryQuizAttempts
        .filter((attempt) => attempt.submitted_at)
        .filter((attempt) => (parsedQuizId === undefined ? true : attempt.quiz_id === parsedQuizId))
        .map((attempt) => {
          const quiz = inMemoryQuizzes.find((item) => item.quiz_id === attempt.quiz_id);
          return {
            attempt_id: attempt.attempt_id,
            quiz_id: attempt.quiz_id,
            quiz_title: quiz?.title ?? "Untitled Quiz",
            cls: quiz?.cls ?? "",
            student_id: attempt.student_id,
            submitted_at: attempt.submitted_at,
            auto_score: attempt.score,
            total_questions: attempt.total_questions,
            faculty_score: attempt.faculty_score,
            reviewed_at: attempt.reviewed_at,
          };
        })
        .sort((a, b) => {
          const aTime = new Date(a.submitted_at ?? 0).getTime();
          const bTime = new Date(b.submitted_at ?? 0).getTime();
          return bTime - aTime;
        });

      return res.json(rows);
    }

    console.error("Error fetching faculty results:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const uploadFacultyResultScore = async (req: Request, res: Response) => {
  const attemptId = parseAttemptIdParam(req, res);
  if (!attemptId) {
    return;
  }

  const normalized = normalizeFacultyScorePayload(req.body);
  if (normalized.error || !normalized.payload) {
    return res.status(400).json({ error: normalized.error ?? "Invalid payload" });
  }

  const { score } = normalized.payload;

  try {
    const quizIdColumn = await resolveQuizIdColumn(pool);
    await ensureQuizQuestionTables(pool, quizIdColumn);
    await ensureQuizAttemptTables(pool, quizIdColumn);

    const attemptResult = await pool.query(
      "SELECT * FROM quiz_attempts WHERE attempt_id = $1",
      [attemptId]
    );
    const attempt = attemptResult.rows[0] as DbAttemptRow | undefined;
    if (!attempt) {
      return res.status(404).json({ error: "Quiz attempt not found" });
    }

    if (!attempt.submitted_at) {
      return res.status(400).json({ error: "Cannot score an in-progress attempt" });
    }

    const totalQuestions = Number(attempt.total_questions ?? 0);
    if (totalQuestions > 0 && score > totalQuestions) {
      return res.status(400).json({
        error: `score cannot exceed total questions (${totalQuestions})`,
      });
    }

    const updateResult = await pool.query(
      `
        UPDATE quiz_attempts
        SET faculty_score = $1,
            reviewed_at = NOW()
        WHERE attempt_id = $2
        RETURNING *
      `,
      [score, attemptId]
    );
    const updatedAttempt = updateResult.rows[0] as DbAttemptRow;

    const quizResult = await pool.query(
      `SELECT title AS quiz_title, cls FROM quizzes WHERE ${quizIdColumn} = $1`,
      [updatedAttempt.quiz_id]
    );
    const quizRow = (quizResult.rows[0] ?? {}) as { quiz_title?: unknown; cls?: unknown };

    return res.json({
      attempt_id: updatedAttempt.attempt_id,
      quiz_id: updatedAttempt.quiz_id,
      quiz_title: String(quizRow.quiz_title ?? ""),
      cls: String(quizRow.cls ?? ""),
      student_id: updatedAttempt.student_id,
      submitted_at: updatedAttempt.submitted_at ? toIsoString(updatedAttempt.submitted_at) : null,
      auto_score: updatedAttempt.score,
      total_questions: Number(updatedAttempt.total_questions ?? 0),
      faculty_score: toNullableNumber(updatedAttempt.faculty_score),
      reviewed_at: updatedAttempt.reviewed_at ? toIsoString(updatedAttempt.reviewed_at) : null,
    } as ResultRow);
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      const attempt = inMemoryQuizAttempts.find((item) => item.attempt_id === attemptId);
      if (!attempt) {
        return res.status(404).json({ error: "Quiz attempt not found" });
      }

      if (!attempt.submitted_at) {
        return res.status(400).json({ error: "Cannot score an in-progress attempt" });
      }

      if (attempt.total_questions > 0 && score > attempt.total_questions) {
        return res.status(400).json({
          error: `score cannot exceed total questions (${attempt.total_questions})`,
        });
      }

      attempt.faculty_score = score;
      attempt.reviewed_at = new Date().toISOString();

      const quiz = inMemoryQuizzes.find((item) => item.quiz_id === attempt.quiz_id);
      return res.json({
        attempt_id: attempt.attempt_id,
        quiz_id: attempt.quiz_id,
        quiz_title: quiz?.title ?? "Untitled Quiz",
        cls: quiz?.cls ?? "",
        student_id: attempt.student_id,
        submitted_at: attempt.submitted_at,
        auto_score: attempt.score,
        total_questions: attempt.total_questions,
        faculty_score: attempt.faculty_score,
        reviewed_at: attempt.reviewed_at,
      } as ResultRow);
    }

    console.error("Error uploading faculty score:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getStudentResults = async (req: Request, res: Response) => {
  const studentId = resolveStudentId(req);

  try {
    const quizIdColumn = await resolveQuizIdColumn(pool);
    await ensureQuizQuestionTables(pool, quizIdColumn);
    await ensureQuizAttemptTables(pool, quizIdColumn);

    const result = await pool.query(
      `
        SELECT
          qa.attempt_id,
          qa.quiz_id,
          qa.student_id,
          qa.submitted_at,
          qa.score AS auto_score,
          qa.total_questions,
          qa.faculty_score,
          qa.reviewed_at,
          q.title AS quiz_title,
          q.cls
        FROM quiz_attempts qa
        INNER JOIN quizzes q
          ON qa.quiz_id = q.${quizIdColumn}
        WHERE qa.student_id = $1
          AND qa.submitted_at IS NOT NULL
        ORDER BY qa.submitted_at DESC NULLS LAST, qa.attempt_id DESC
      `,
      [studentId]
    );

    return res.json(result.rows.map((row) => mapDbResultRow(row)));
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      const rows: ResultRow[] = inMemoryQuizAttempts
        .filter((attempt) => attempt.student_id === studentId)
        .filter((attempt) => attempt.submitted_at)
        .map((attempt) => {
          const quiz = inMemoryQuizzes.find((item) => item.quiz_id === attempt.quiz_id);
          return {
            attempt_id: attempt.attempt_id,
            quiz_id: attempt.quiz_id,
            quiz_title: quiz?.title ?? "Untitled Quiz",
            cls: quiz?.cls ?? "",
            student_id: attempt.student_id,
            submitted_at: attempt.submitted_at,
            auto_score: attempt.score,
            total_questions: attempt.total_questions,
            faculty_score: attempt.faculty_score,
            reviewed_at: attempt.reviewed_at,
          };
        })
        .sort((a, b) => {
          const aTime = new Date(a.submitted_at ?? 0).getTime();
          const bTime = new Date(b.submitted_at ?? 0).getTime();
          return bTime - aTime;
        });

      return res.json(rows);
    }

    console.error("Error fetching student results:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
