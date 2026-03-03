import { Request, Response } from "express";
import { Pool, PoolClient } from "pg";
import pool from "../utils/db";

interface NormalizedAssignmentPayload {
  cls: string;
  subject: string;
  title: string;
  description: string;
  dueDateIso: string;
  maxScore: number;
}

interface InMemoryAssignment {
  assignment_id: number;
  cls: string;
  subject: string;
  title: string;
  description: string;
  due_date: string;
  max_score: number;
  created_at: string;
}

interface InMemorySubmission {
  submission_id: number;
  assignment_id: number;
  student_id: string;
  submission_text: string;
  submitted_at: string;
  faculty_score: number | null;
  reviewed_at: string | null;
}

const inMemoryAssignments: InMemoryAssignment[] = [];
const inMemorySubmissions: InMemorySubmission[] = [];
let inMemoryAssignmentId = 1;
let inMemorySubmissionId = 1;

const sampleAssignment: NormalizedAssignmentPayload = {
  cls: "CSE - Section A",
  subject: "Data Structures",
  title: "Assignment 1 - Binary Trees",
  description:
    "Implement preorder, inorder, and postorder traversal for a binary tree and upload complexity analysis.",
  dueDateIso: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  maxScore: 20,
};

const dbConnectionErrorCodes = new Set([
  "28P01",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "ECONNRESET",
  "ETIMEDOUT",
  "3D000",
]);

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

const parsePositiveId = (value: unknown): number => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    return 0;
  }
  return id;
};

const parseAssignmentIdParam = (req: Request, res: Response): number | null => {
  const assignmentId = parsePositiveId(req.params.assignmentId ?? req.params.id);
  if (!assignmentId) {
    res.status(400).json({ error: "Invalid assignment id" });
    return null;
  }
  return assignmentId;
};

const parseSubmissionIdParam = (req: Request, res: Response): number | null => {
  const submissionId = parsePositiveId(req.params.submissionId);
  if (!submissionId) {
    res.status(400).json({ error: "Invalid submission id" });
    return null;
  }
  return submissionId;
};

const toIsoString = (value: unknown): string => {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
};

const normalizeAssignmentPayload = (body: unknown): {
  error?: string;
  payload?: NormalizedAssignmentPayload;
} => {
  const rawBody =
    body && typeof body === "object"
      ? (body as {
          cls?: unknown;
          subject?: unknown;
          title?: unknown;
          description?: unknown;
          dueDate?: unknown;
          maxScore?: unknown;
        })
      : {};

  if (
    typeof rawBody.cls !== "string" ||
    !rawBody.cls.trim() ||
    typeof rawBody.subject !== "string" ||
    !rawBody.subject.trim() ||
    typeof rawBody.title !== "string" ||
    !rawBody.title.trim() ||
    typeof rawBody.dueDate !== "string" ||
    !rawBody.dueDate.trim()
  ) {
    return { error: "cls, subject, title and dueDate are required" };
  }

  const dueDate = new Date(rawBody.dueDate);
  if (Number.isNaN(dueDate.getTime())) {
    return { error: "dueDate must be a valid date string" };
  }

  const maxScoreCandidate =
    rawBody.maxScore === undefined || rawBody.maxScore === null
      ? 100
      : Number(rawBody.maxScore);
  if (!Number.isFinite(maxScoreCandidate) || maxScoreCandidate <= 0) {
    return { error: "maxScore must be a positive number" };
  }

  const description =
    typeof rawBody.description === "string" ? rawBody.description.trim() : "";

  return {
    payload: {
      cls: rawBody.cls.trim(),
      subject: rawBody.subject.trim(),
      title: rawBody.title.trim(),
      description,
      dueDateIso: dueDate.toISOString(),
      maxScore: Number(maxScoreCandidate.toFixed(2)),
    },
  };
};

const normalizeSubmissionPayload = (body: unknown): {
  error?: string;
  payload?: { submissionText: string };
} => {
  const rawBody =
    body && typeof body === "object" ? (body as { submissionText?: unknown }) : {};

  if (typeof rawBody.submissionText !== "string" || !rawBody.submissionText.trim()) {
    return { error: "submissionText is required" };
  }

  return { payload: { submissionText: rawBody.submissionText.trim() } };
};

const normalizeScorePayload = (body: unknown): {
  error?: string;
  payload?: { score: number };
} => {
  const rawBody = body && typeof body === "object" ? (body as { score?: unknown }) : {};
  const rawScore = rawBody.score;
  const score =
    typeof rawScore === "number"
      ? rawScore
      : typeof rawScore === "string" && rawScore.trim()
        ? Number(rawScore)
        : NaN;

  if (!Number.isFinite(score)) {
    return { error: "score is required and must be a valid number" };
  }

  if (score < 0) {
    return { error: "score cannot be negative" };
  }

  return { payload: { score: Number(score.toFixed(2)) } };
};

const ensureAssignmentTables = async (db: Pool | PoolClient): Promise<void> => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS assignments (
      assignment_id SERIAL PRIMARY KEY,
      cls VARCHAR(255) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      due_date TIMESTAMPTZ NOT NULL,
      max_score NUMERIC NOT NULL DEFAULT 100,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS assignment_submissions (
      submission_id SERIAL PRIMARY KEY,
      assignment_id INT REFERENCES assignments(assignment_id) ON DELETE CASCADE,
      student_id VARCHAR(120) NOT NULL,
      submission_text TEXT NOT NULL,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      faculty_score NUMERIC,
      reviewed_at TIMESTAMPTZ,
      UNIQUE (assignment_id, student_id)
    )
  `);

  await db.query(
    "CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment ON assignment_submissions (assignment_id)"
  );
  await db.query(
    "CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student ON assignment_submissions (student_id)"
  );
};

const mapAssignmentRow = (row: Record<string, unknown>): Record<string, unknown> => ({
  assignment_id: Number(row.assignment_id),
  cls: String(row.cls ?? ""),
  subject: String(row.subject ?? ""),
  title: String(row.title ?? ""),
  description: String(row.description ?? ""),
  due_date: toIsoString(row.due_date),
  max_score: Number(row.max_score ?? 100),
  created_at: row.created_at ? toIsoString(row.created_at) : null,
  submission_count: Number(row.submission_count ?? 0),
});

const mapSubmissionRow = (row: Record<string, unknown>): Record<string, unknown> => ({
  submission_id: Number(row.submission_id),
  assignment_id: Number(row.assignment_id),
  student_id: String(row.student_id ?? ""),
  submission_text: String(row.submission_text ?? ""),
  submitted_at: toIsoString(row.submitted_at),
  faculty_score:
    row.faculty_score === null || row.faculty_score === undefined
      ? null
      : Number(row.faculty_score),
  reviewed_at: row.reviewed_at ? toIsoString(row.reviewed_at) : null,
  assignment_title: row.assignment_title ? String(row.assignment_title) : undefined,
  subject: row.subject ? String(row.subject) : undefined,
  cls: row.cls ? String(row.cls) : undefined,
  max_score:
    row.max_score === null || row.max_score === undefined
      ? undefined
      : Number(row.max_score),
});

const ensureSampleAssignmentInMemory = (): void => {
  if (inMemoryAssignments.length > 0) {
    return;
  }

  inMemoryAssignments.push({
    assignment_id: inMemoryAssignmentId++,
    cls: sampleAssignment.cls,
    subject: sampleAssignment.subject,
    title: sampleAssignment.title,
    description: sampleAssignment.description,
    due_date: sampleAssignment.dueDateIso,
    max_score: sampleAssignment.maxScore,
    created_at: new Date().toISOString(),
  });
};

const createSampleAssignmentInDb = async (db: Pool | PoolClient): Promise<void> => {
  const existingResult = await db.query("SELECT assignment_id FROM assignments LIMIT 1");
  if ((existingResult.rowCount ?? 0) > 0) {
    return;
  }

  await db.query(
    `
      INSERT INTO assignments (cls, subject, title, description, due_date, max_score)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      sampleAssignment.cls,
      sampleAssignment.subject,
      sampleAssignment.title,
      sampleAssignment.description,
      sampleAssignment.dueDateIso,
      sampleAssignment.maxScore,
    ]
  );
};

const findAssignmentInMemory = (assignmentId: number): InMemoryAssignment | null =>
  inMemoryAssignments.find((item) => item.assignment_id === assignmentId) ?? null;

export const getAssignments = async (req: Request, res: Response) => {
  try {
    await ensureAssignmentTables(pool);
    await createSampleAssignmentInDb(pool);

    const result = await pool.query(
      `
        SELECT
          a.*,
          COUNT(s.submission_id)::INT AS submission_count
        FROM assignments a
        LEFT JOIN assignment_submissions s
          ON s.assignment_id = a.assignment_id
        GROUP BY a.assignment_id
        ORDER BY a.due_date ASC, a.assignment_id DESC
      `
    );

    return res.json(result.rows.map((row) => mapAssignmentRow(row)));
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      ensureSampleAssignmentInMemory();
      const rows = inMemoryAssignments
        .map((assignment) => ({
          ...assignment,
          submission_count: inMemorySubmissions.filter(
            (submission) => submission.assignment_id === assignment.assignment_id
          ).length,
        }))
        .sort(
          (a, b) =>
            new Date(a.due_date).getTime() - new Date(b.due_date).getTime() ||
            b.assignment_id - a.assignment_id
        );
      return res.json(rows);
    }

    console.error("Error fetching assignments:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createAssignment = async (req: Request, res: Response) => {
  const normalized = normalizeAssignmentPayload(req.body);
  if (normalized.error || !normalized.payload) {
    return res.status(400).json({ error: normalized.error ?? "Invalid payload" });
  }

  const payload = normalized.payload;

  try {
    await ensureAssignmentTables(pool);
    const result = await pool.query(
      `
        INSERT INTO assignments (cls, subject, title, description, due_date, max_score)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        payload.cls,
        payload.subject,
        payload.title,
        payload.description,
        payload.dueDateIso,
        payload.maxScore,
      ]
    );

    return res.status(201).json(mapAssignmentRow(result.rows[0]));
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      const assignment: InMemoryAssignment = {
        assignment_id: inMemoryAssignmentId++,
        cls: payload.cls,
        subject: payload.subject,
        title: payload.title,
        description: payload.description,
        due_date: payload.dueDateIso,
        max_score: payload.maxScore,
        created_at: new Date().toISOString(),
      };
      inMemoryAssignments.push(assignment);
      return res.status(201).json({ ...assignment, submission_count: 0 });
    }

    console.error("Error creating assignment:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateAssignment = async (req: Request, res: Response) => {
  const assignmentId = parseAssignmentIdParam(req, res);
  if (!assignmentId) {
    return;
  }

  const normalized = normalizeAssignmentPayload(req.body);
  if (normalized.error || !normalized.payload) {
    return res.status(400).json({ error: normalized.error ?? "Invalid payload" });
  }

  const payload = normalized.payload;

  try {
    await ensureAssignmentTables(pool);
    const result = await pool.query(
      `
        UPDATE assignments
        SET cls = $1,
            subject = $2,
            title = $3,
            description = $4,
            due_date = $5,
            max_score = $6
        WHERE assignment_id = $7
        RETURNING *
      `,
      [
        payload.cls,
        payload.subject,
        payload.title,
        payload.description,
        payload.dueDateIso,
        payload.maxScore,
        assignmentId,
      ]
    );

    if (!(result.rowCount ?? 0)) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    const submissionCountResult = await pool.query(
      "SELECT COUNT(*)::INT AS count FROM assignment_submissions WHERE assignment_id = $1",
      [assignmentId]
    );

    return res.json({
      ...mapAssignmentRow(result.rows[0]),
      submission_count: Number(submissionCountResult.rows[0]?.count ?? 0),
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      const assignment = findAssignmentInMemory(assignmentId);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      assignment.cls = payload.cls;
      assignment.subject = payload.subject;
      assignment.title = payload.title;
      assignment.description = payload.description;
      assignment.due_date = payload.dueDateIso;
      assignment.max_score = payload.maxScore;

      return res.json({
        ...assignment,
        submission_count: inMemorySubmissions.filter(
          (submission) => submission.assignment_id === assignmentId
        ).length,
      });
    }

    console.error("Error updating assignment:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteAssignment = async (req: Request, res: Response) => {
  const assignmentId = parseAssignmentIdParam(req, res);
  if (!assignmentId) {
    return;
  }

  try {
    await ensureAssignmentTables(pool);
    const result = await pool.query("DELETE FROM assignments WHERE assignment_id = $1", [
      assignmentId,
    ]);

    if (!(result.rowCount ?? 0)) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    return res.sendStatus(204);
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      const index = inMemoryAssignments.findIndex(
        (assignment) => assignment.assignment_id === assignmentId
      );
      if (index === -1) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      inMemoryAssignments.splice(index, 1);
      for (let i = inMemorySubmissions.length - 1; i >= 0; i -= 1) {
        if (inMemorySubmissions[i].assignment_id === assignmentId) {
          inMemorySubmissions.splice(i, 1);
        }
      }
      return res.sendStatus(204);
    }

    console.error("Error deleting assignment:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const submitAssignment = async (req: Request, res: Response) => {
  const assignmentId = parseAssignmentIdParam(req, res);
  if (!assignmentId) {
    return;
  }

  const normalized = normalizeSubmissionPayload(req.body);
  if (normalized.error || !normalized.payload) {
    return res.status(400).json({ error: normalized.error ?? "Invalid payload" });
  }

  const studentId = resolveStudentId(req);
  const { submissionText } = normalized.payload;

  try {
    await ensureAssignmentTables(pool);

    const assignmentResult = await pool.query(
      "SELECT assignment_id, max_score, title AS assignment_title, subject, cls FROM assignments WHERE assignment_id = $1",
      [assignmentId]
    );
    const assignment = assignmentResult.rows[0] as Record<string, unknown> | undefined;
    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    const submissionResult = await pool.query(
      `
        INSERT INTO assignment_submissions (
          assignment_id,
          student_id,
          submission_text,
          submitted_at,
          faculty_score,
          reviewed_at
        )
        VALUES ($1, $2, $3, NOW(), NULL, NULL)
        ON CONFLICT (assignment_id, student_id)
        DO UPDATE SET
          submission_text = EXCLUDED.submission_text,
          submitted_at = NOW(),
          faculty_score = NULL,
          reviewed_at = NULL
        RETURNING *
      `,
      [assignmentId, studentId, submissionText]
    );

    return res.status(201).json({
      ...mapSubmissionRow({
        ...submissionResult.rows[0],
        ...assignment,
      }),
      message: "Assignment submitted successfully",
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      const assignment = findAssignmentInMemory(assignmentId);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      const existing = inMemorySubmissions.find(
        (submission) =>
          submission.assignment_id === assignmentId && submission.student_id === studentId
      );
      const nowIso = new Date().toISOString();

      if (existing) {
        existing.submission_text = submissionText;
        existing.submitted_at = nowIso;
        existing.faculty_score = null;
        existing.reviewed_at = null;

        return res.status(201).json({
          ...existing,
          assignment_title: assignment.title,
          subject: assignment.subject,
          cls: assignment.cls,
          max_score: assignment.max_score,
          message: "Assignment submitted successfully",
        });
      }

      const submission: InMemorySubmission = {
        submission_id: inMemorySubmissionId++,
        assignment_id: assignmentId,
        student_id: studentId,
        submission_text: submissionText,
        submitted_at: nowIso,
        faculty_score: null,
        reviewed_at: null,
      };
      inMemorySubmissions.push(submission);
      return res.status(201).json({
        ...submission,
        assignment_title: assignment.title,
        subject: assignment.subject,
        cls: assignment.cls,
        max_score: assignment.max_score,
        message: "Assignment submitted successfully",
      });
    }

    console.error("Error submitting assignment:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getStudentAssignmentSubmissions = async (req: Request, res: Response) => {
  const studentId = resolveStudentId(req);

  try {
    await ensureAssignmentTables(pool);

    const result = await pool.query(
      `
        SELECT
          s.*,
          a.title AS assignment_title,
          a.subject,
          a.cls,
          a.max_score,
          a.due_date
        FROM assignment_submissions s
        INNER JOIN assignments a
          ON a.assignment_id = s.assignment_id
        WHERE s.student_id = $1
        ORDER BY s.submitted_at DESC, s.submission_id DESC
      `,
      [studentId]
    );

    return res.json(result.rows.map((row) => mapSubmissionRow(row)));
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      const rows = inMemorySubmissions
        .filter((submission) => submission.student_id === studentId)
        .map((submission) => {
          const assignment = findAssignmentInMemory(submission.assignment_id);
          return {
            ...submission,
            assignment_title: assignment?.title ?? "",
            subject: assignment?.subject ?? "",
            cls: assignment?.cls ?? "",
            max_score: assignment?.max_score ?? 100,
            due_date: assignment?.due_date ?? null,
          };
        })
        .sort(
          (a, b) =>
            new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime() ||
            b.submission_id - a.submission_id
        );
      return res.json(rows);
    }

    console.error("Error fetching student assignment submissions:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const parseOptionalAssignmentIdQuery = (
  req: Request,
  res: Response
): number | null | undefined => {
  const raw = req.query.assignmentId;
  if (raw === undefined) {
    return undefined;
  }
  if (typeof raw !== "string") {
    res.status(400).json({ error: "assignmentId query must be a single value" });
    return null;
  }
  const assignmentId = parsePositiveId(raw);
  if (!assignmentId) {
    res.status(400).json({ error: "Invalid assignmentId query value" });
    return null;
  }
  return assignmentId;
};

export const getFacultyAssignmentSubmissions = async (req: Request, res: Response) => {
  const optionalAssignmentId = parseOptionalAssignmentIdQuery(req, res);
  if (optionalAssignmentId === null) {
    return;
  }

  try {
    await ensureAssignmentTables(pool);

    const params: Array<string | number> = [];
    let whereClause = "";
    if (optionalAssignmentId !== undefined) {
      params.push(optionalAssignmentId);
      whereClause = `WHERE s.assignment_id = $${params.length}`;
    }

    const result = await pool.query(
      `
        SELECT
          s.*,
          a.title AS assignment_title,
          a.subject,
          a.cls,
          a.max_score,
          a.due_date
        FROM assignment_submissions s
        INNER JOIN assignments a
          ON a.assignment_id = s.assignment_id
        ${whereClause}
        ORDER BY s.submitted_at DESC, s.submission_id DESC
      `,
      params
    );

    return res.json(result.rows.map((row) => mapSubmissionRow(row)));
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      const rows = inMemorySubmissions
        .filter((submission) =>
          optionalAssignmentId === undefined
            ? true
            : submission.assignment_id === optionalAssignmentId
        )
        .map((submission) => {
          const assignment = findAssignmentInMemory(submission.assignment_id);
          return {
            ...submission,
            assignment_title: assignment?.title ?? "",
            subject: assignment?.subject ?? "",
            cls: assignment?.cls ?? "",
            max_score: assignment?.max_score ?? 100,
            due_date: assignment?.due_date ?? null,
          };
        })
        .sort(
          (a, b) =>
            new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime() ||
            b.submission_id - a.submission_id
        );
      return res.json(rows);
    }

    console.error("Error fetching faculty assignment submissions:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const uploadAssignmentScore = async (req: Request, res: Response) => {
  const submissionId = parseSubmissionIdParam(req, res);
  if (!submissionId) {
    return;
  }

  const normalized = normalizeScorePayload(req.body);
  if (normalized.error || !normalized.payload) {
    return res.status(400).json({ error: normalized.error ?? "Invalid payload" });
  }

  const { score } = normalized.payload;

  try {
    await ensureAssignmentTables(pool);

    const rowResult = await pool.query(
      `
        SELECT
          s.*,
          a.title AS assignment_title,
          a.subject,
          a.cls,
          a.max_score,
          a.due_date
        FROM assignment_submissions s
        INNER JOIN assignments a
          ON a.assignment_id = s.assignment_id
        WHERE s.submission_id = $1
      `,
      [submissionId]
    );

    const row = rowResult.rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      return res.status(404).json({ error: "Assignment submission not found" });
    }

    const maxScore = Number(row.max_score ?? 100);
    if (score > maxScore) {
      return res.status(400).json({ error: `score cannot exceed max score (${maxScore})` });
    }

    const updateResult = await pool.query(
      `
        UPDATE assignment_submissions
        SET faculty_score = $1,
            reviewed_at = NOW()
        WHERE submission_id = $2
        RETURNING *
      `,
      [score, submissionId]
    );

    return res.json(
      mapSubmissionRow({
        ...updateResult.rows[0],
        assignment_title: row.assignment_title,
        subject: row.subject,
        cls: row.cls,
        max_score: row.max_score,
        due_date: row.due_date,
      })
    );
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      const submission = inMemorySubmissions.find((item) => item.submission_id === submissionId);
      if (!submission) {
        return res.status(404).json({ error: "Assignment submission not found" });
      }

      const assignment = findAssignmentInMemory(submission.assignment_id);
      const maxScore = assignment?.max_score ?? 100;
      if (score > maxScore) {
        return res.status(400).json({ error: `score cannot exceed max score (${maxScore})` });
      }

      submission.faculty_score = score;
      submission.reviewed_at = new Date().toISOString();
      return res.json({
        ...submission,
        assignment_title: assignment?.title ?? "",
        subject: assignment?.subject ?? "",
        cls: assignment?.cls ?? "",
        max_score: maxScore,
        due_date: assignment?.due_date ?? null,
      });
    }

    console.error("Error uploading assignment score:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getStudentAssignmentResults = async (req: Request, res: Response) => {
  const studentId = resolveStudentId(req);

  try {
    await ensureAssignmentTables(pool);

    const result = await pool.query(
      `
        SELECT
          s.*,
          a.title AS assignment_title,
          a.subject,
          a.cls,
          a.max_score,
          a.due_date
        FROM assignment_submissions s
        INNER JOIN assignments a
          ON a.assignment_id = s.assignment_id
        WHERE s.student_id = $1
          AND s.faculty_score IS NOT NULL
        ORDER BY s.reviewed_at DESC NULLS LAST, s.submitted_at DESC
      `,
      [studentId]
    );

    return res.json(result.rows.map((row) => mapSubmissionRow(row)));
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      const rows = inMemorySubmissions
        .filter((submission) => submission.student_id === studentId)
        .filter((submission) => submission.faculty_score !== null)
        .map((submission) => {
          const assignment = findAssignmentInMemory(submission.assignment_id);
          return {
            ...submission,
            assignment_title: assignment?.title ?? "",
            subject: assignment?.subject ?? "",
            cls: assignment?.cls ?? "",
            max_score: assignment?.max_score ?? 100,
            due_date: assignment?.due_date ?? null,
          };
        })
        .sort((a, b) => {
          const aTime = new Date(a.reviewed_at ?? a.submitted_at).getTime();
          const bTime = new Date(b.reviewed_at ?? b.submitted_at).getTime();
          return bTime - aTime;
        });
      return res.json(rows);
    }

    console.error("Error fetching student assignment results:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
