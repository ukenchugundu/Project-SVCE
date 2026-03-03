import { Request, Response } from "express";
import { Pool, PoolClient } from "pg";
import path from "path";
import pool from "../utils/db";
import {
  isSupabaseStorageConfigured,
  uploadBufferToSupabaseStorage,
} from "../utils/supabaseStorage";

interface NormalizedNotePayload {
  cls: string;
  subject: string;
  title: string;
  content: string;
  fileUrl: string;
}

interface InMemoryNote {
  note_id: number;
  cls: string;
  subject: string;
  title: string;
  content: string;
  file_url: string;
  created_at: string;
  updated_at: string;
}

interface NormalizedNoteFileUploadPayload {
  fileName: string;
  mimeType: string;
  fileBase64: string;
}

const inMemoryNotes: InMemoryNote[] = [];
let inMemoryNoteId = 1;
const MAX_NOTE_UPLOAD_BYTES = 20 * 1024 * 1024;
const allowedUploadExtensions = new Set([
  "pdf",
  "txt",
  "md",
  "csv",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
  "jpg",
  "jpeg",
  "png",
  "webp",
]);

const sampleNote: NormalizedNotePayload = {
  cls: "CSE - Section A",
  subject: "Data Structures",
  title: "Trees - Quick Revision Notes",
  content:
    "Covers binary tree traversals, BST insertion/deletion, and time complexity summary for common operations.",
  fileUrl:
    "https://www.cs.cornell.edu/courses/cs3110/2014sp/lectures/21/binary-trees.html",
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

const parsePositiveId = (value: unknown): number => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    return 0;
  }
  return id;
};

const parseNoteIdParam = (req: Request, res: Response): number | null => {
  const noteId = parsePositiveId(req.params.noteId ?? req.params.id);
  if (!noteId) {
    res.status(400).json({ error: "Invalid note id" });
    return null;
  }
  return noteId;
};

const toIsoString = (value: unknown): string => {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
};

const mapNoteRow = (row: Record<string, unknown>): Record<string, unknown> => ({
  note_id: Number(row.note_id),
  cls: String(row.cls ?? ""),
  subject: String(row.subject ?? ""),
  title: String(row.title ?? ""),
  content: String(row.content ?? ""),
  file_url: String(row.file_url ?? ""),
  created_at: row.created_at ? toIsoString(row.created_at) : null,
  updated_at: row.updated_at ? toIsoString(row.updated_at) : null,
});

const normalizeNotePayload = (body: unknown): {
  error?: string;
  payload?: NormalizedNotePayload;
} => {
  const rawBody =
    body && typeof body === "object"
      ? (body as {
          cls?: unknown;
          subject?: unknown;
          title?: unknown;
          content?: unknown;
          fileUrl?: unknown;
          file_url?: unknown;
        })
      : {};

  const cls = typeof rawBody.cls === "string" ? rawBody.cls.trim() : "";
  const subject = typeof rawBody.subject === "string" ? rawBody.subject.trim() : "";
  const title = typeof rawBody.title === "string" ? rawBody.title.trim() : "";
  const content = typeof rawBody.content === "string" ? rawBody.content.trim() : "";
  const fileUrlRaw =
    typeof rawBody.fileUrl === "string"
      ? rawBody.fileUrl
      : typeof rawBody.file_url === "string"
        ? rawBody.file_url
        : "";
  const fileUrl = fileUrlRaw.trim();

  if (!cls || !subject || !title) {
    return { error: "cls, subject and title are required" };
  }

  if (!content && !fileUrl) {
    return { error: "Provide at least content or fileUrl" };
  }

  if (fileUrl && !fileUrl.startsWith("/")) {
    try {
      new URL(fileUrl);
    } catch {
      return { error: "fileUrl must be a valid URL" };
    }
  }

  return {
    payload: {
      cls,
      subject,
      title,
      content,
      fileUrl,
    },
  };
};

const normalizeNoteUploadPayload = (body: unknown): {
  error?: string;
  payload?: NormalizedNoteFileUploadPayload;
} => {
  const rawBody =
    body && typeof body === "object"
      ? (body as {
          fileName?: unknown;
          mimeType?: unknown;
          fileBase64?: unknown;
          base64?: unknown;
        })
      : {};

  const fileName = typeof rawBody.fileName === "string" ? rawBody.fileName.trim() : "";
  const mimeType = typeof rawBody.mimeType === "string" ? rawBody.mimeType.trim() : "";
  const base64Raw =
    typeof rawBody.fileBase64 === "string"
      ? rawBody.fileBase64
      : typeof rawBody.base64 === "string"
        ? rawBody.base64
        : "";
  const fileBase64 = base64Raw
    .replace(/^data:[^;]+;base64,/, "")
    .replace(/\s+/g, "")
    .trim();

  if (!fileName) {
    return { error: "fileName is required" };
  }

  if (!fileBase64) {
    return { error: "fileBase64 is required" };
  }

  return {
    payload: {
      fileName,
      mimeType,
      fileBase64,
    },
  };
};

const sanitizeUploadedFileName = (originalName: string): {
  safeBaseName: string;
  extension: string;
} => {
  const normalizedOriginal = originalName.replace(/[/\\]+/g, " ").trim() || "note-file";
  const parsed = path.parse(normalizedOriginal);
  const extension = parsed.ext.replace(".", "").toLowerCase();
  const baseNameSource = parsed.name || "note-file";
  const safeBaseName = baseNameSource
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 80);

  return {
    safeBaseName: safeBaseName || "note-file",
    extension,
  };
};

const buildUploadedFileUrl = (req: Request, storedFileName: string): string => {
  const safeFileName = encodeURIComponent(storedFileName);
  const pathName = `/uploads/notes/${safeFileName}`;
  const host = req.get("host");
  if (!host) {
    return pathName;
  }

  const protocol = req.protocol || "http";
  return `${protocol}://${host}${pathName}`;
};

const ensureNotesTable = async (db: Pool | PoolClient): Promise<void> => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS notes (
      note_id SERIAL PRIMARY KEY,
      cls VARCHAR(255) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      file_url TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query("CREATE INDEX IF NOT EXISTS idx_notes_subject ON notes (subject)");
  await db.query("CREATE INDEX IF NOT EXISTS idx_notes_cls ON notes (cls)");
};

const createSampleNoteInDb = async (db: Pool | PoolClient): Promise<void> => {
  const result = await db.query("SELECT note_id FROM notes LIMIT 1");
  if ((result.rowCount ?? 0) > 0) {
    return;
  }

  await db.query(
    `
      INSERT INTO notes (cls, subject, title, content, file_url)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [
      sampleNote.cls,
      sampleNote.subject,
      sampleNote.title,
      sampleNote.content,
      sampleNote.fileUrl,
    ]
  );
};

const ensureSampleNoteInMemory = (): void => {
  if (inMemoryNotes.length > 0) {
    return;
  }

  const now = new Date().toISOString();
  inMemoryNotes.push({
    note_id: inMemoryNoteId++,
    cls: sampleNote.cls,
    subject: sampleNote.subject,
    title: sampleNote.title,
    content: sampleNote.content,
    file_url: sampleNote.fileUrl,
    created_at: now,
    updated_at: now,
  });
};

export const getNotes = async (req: Request, res: Response) => {
  const clsQuery = typeof req.query.cls === "string" ? req.query.cls.trim() : "";
  const subjectQuery =
    typeof req.query.subject === "string" ? req.query.subject.trim() : "";

  try {
    await ensureNotesTable(pool);
    await createSampleNoteInDb(pool);

    const whereParts: string[] = [];
    const values: string[] = [];

    if (clsQuery) {
      values.push(clsQuery);
      whereParts.push(`cls = $${values.length}`);
    }
    if (subjectQuery) {
      values.push(subjectQuery);
      whereParts.push(`subject = $${values.length}`);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const result = await pool.query(
      `
        SELECT *
        FROM notes
        ${whereClause}
        ORDER BY created_at DESC, note_id DESC
      `,
      values
    );

    return res.json(result.rows.map((row) => mapNoteRow(row)));
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      ensureSampleNoteInMemory();
      const rows = inMemoryNotes
        .filter((note) => (clsQuery ? note.cls === clsQuery : true))
        .filter((note) => (subjectQuery ? note.subject === subjectQuery : true))
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime() ||
            b.note_id - a.note_id
        );
      return res.json(rows);
    }

    console.error("Error fetching notes:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const uploadNoteFile = async (req: Request, res: Response) => {
  if (!isSupabaseStorageConfigured()) {
    return res.status(500).json({
      error:
        "Supabase Storage is not configured. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_STORAGE_BUCKET.",
    });
  }

  const normalized = normalizeNoteUploadPayload(req.body);
  if (normalized.error || !normalized.payload) {
    return res.status(400).json({ error: normalized.error ?? "Invalid payload" });
  }

  const payload = normalized.payload;
  const { safeBaseName, extension } = sanitizeUploadedFileName(payload.fileName);

  if (extension && !allowedUploadExtensions.has(extension)) {
    return res.status(400).json({
      error:
        "Unsupported file format. Allowed: pdf, doc/docx, ppt/pptx, xls/xlsx, txt, md, csv, jpg/jpeg/png/webp",
    });
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(payload.fileBase64, "base64");
  } catch {
    return res.status(400).json({ error: "Invalid base64 file data" });
  }

  if (!buffer.length) {
    return res.status(400).json({ error: "Uploaded file is empty" });
  }

  if (buffer.length > MAX_NOTE_UPLOAD_BYTES) {
    return res
      .status(400)
      .json({ error: `File is too large. Maximum allowed size is ${MAX_NOTE_UPLOAD_BYTES / (1024 * 1024)} MB` });
  }

  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const storedFileName = extension
    ? `${safeBaseName}-${uniqueSuffix}.${extension}`
    : `${safeBaseName}-${uniqueSuffix}`;

  try {
    const supabaseUpload = await uploadBufferToSupabaseStorage(
      buffer,
      storedFileName,
      payload.mimeType || "application/octet-stream"
    );

    if (!supabaseUpload) {
      return res
        .status(500)
        .json({ error: "Supabase Storage is not configured on the server." });
    }

    return res.status(201).json({
      fileUrl: supabaseUpload.fileUrl,
      fileName: payload.fileName,
      mimeType: payload.mimeType || "application/octet-stream",
      size: buffer.length,
      storage: "supabase",
    });
  } catch (error) {
    console.error("Error uploading note file to Supabase Storage:", error);
    return res.status(502).json({ error: "Failed to upload file to Supabase Storage" });
  }
};

export const createNote = async (req: Request, res: Response) => {
  const normalized = normalizeNotePayload(req.body);
  if (normalized.error || !normalized.payload) {
    return res.status(400).json({ error: normalized.error ?? "Invalid payload" });
  }

  const payload = normalized.payload;

  try {
    await ensureNotesTable(pool);
    const result = await pool.query(
      `
        INSERT INTO notes (cls, subject, title, content, file_url)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [payload.cls, payload.subject, payload.title, payload.content, payload.fileUrl]
    );

    return res.status(201).json(mapNoteRow(result.rows[0]));
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      const now = new Date().toISOString();
      const note: InMemoryNote = {
        note_id: inMemoryNoteId++,
        cls: payload.cls,
        subject: payload.subject,
        title: payload.title,
        content: payload.content,
        file_url: payload.fileUrl,
        created_at: now,
        updated_at: now,
      };
      inMemoryNotes.push(note);
      return res.status(201).json(note);
    }

    console.error("Error creating note:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateNote = async (req: Request, res: Response) => {
  const noteId = parseNoteIdParam(req, res);
  if (!noteId) {
    return;
  }

  const normalized = normalizeNotePayload(req.body);
  if (normalized.error || !normalized.payload) {
    return res.status(400).json({ error: normalized.error ?? "Invalid payload" });
  }

  const payload = normalized.payload;

  try {
    await ensureNotesTable(pool);
    const result = await pool.query(
      `
        UPDATE notes
        SET cls = $1,
            subject = $2,
            title = $3,
            content = $4,
            file_url = $5,
            updated_at = NOW()
        WHERE note_id = $6
        RETURNING *
      `,
      [
        payload.cls,
        payload.subject,
        payload.title,
        payload.content,
        payload.fileUrl,
        noteId,
      ]
    );

    if (!(result.rowCount ?? 0)) {
      return res.status(404).json({ error: "Note not found" });
    }

    return res.json(mapNoteRow(result.rows[0]));
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      const note = inMemoryNotes.find((item) => item.note_id === noteId);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }

      note.cls = payload.cls;
      note.subject = payload.subject;
      note.title = payload.title;
      note.content = payload.content;
      note.file_url = payload.fileUrl;
      note.updated_at = new Date().toISOString();
      return res.json(note);
    }

    console.error("Error updating note:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteNote = async (req: Request, res: Response) => {
  const noteId = parseNoteIdParam(req, res);
  if (!noteId) {
    return;
  }

  try {
    await ensureNotesTable(pool);
    const result = await pool.query("DELETE FROM notes WHERE note_id = $1", [noteId]);
    if (!(result.rowCount ?? 0)) {
      return res.status(404).json({ error: "Note not found" });
    }
    return res.sendStatus(204);
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      const index = inMemoryNotes.findIndex((item) => item.note_id === noteId);
      if (index === -1) {
        return res.status(404).json({ error: "Note not found" });
      }
      inMemoryNotes.splice(index, 1);
      return res.sendStatus(204);
    }

    console.error("Error deleting note:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
