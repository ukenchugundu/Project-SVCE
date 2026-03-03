import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { Request, Response } from "express";
import { Pool, PoolClient } from "pg";
import pool from "../utils/db";

type UserRole = "student" | "faculty" | "admin";

interface AuthUserRecord {
  auth_user_id: number;
  email: string;
  role: UserRole;
  full_name: string;
  roll_number: string | null;
  password_hash: string;
}

interface PublicUser {
  id: number;
  email: string;
  role: UserRole;
  fullName: string;
  rollNumber: string;
  studentId: string;
}

interface AuthUserSummaryRow {
  auth_user_id: number;
  email: string;
  role: UserRole;
  full_name: string;
  roll_number: string | null;
  created_at: string | Date;
}

const allowedRoles = new Set<UserRole>(["student", "faculty", "admin"]);
const dbConnectionErrorCodes = new Set([
  "28P01",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "ECONNRESET",
  "ETIMEDOUT",
  "3D000",
]);

const inMemoryUsers: AuthUserRecord[] = [];
let inMemoryUserId = 1;

const toRole = (value: unknown): UserRole | null => {
  const role = String(value ?? "").trim().toLowerCase();
  return allowedRoles.has(role as UserRole) ? (role as UserRole) : null;
};

const normalizeEmail = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 320);

const normalizeName = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .slice(0, 255);

const normalizeRollNumber = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .slice(0, 120);

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

const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

const verifyPassword = (password: string, storedHash: string): boolean => {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) {
    return false;
  }
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
};

const toPublicUser = (row: AuthUserRecord): PublicUser => {
  const roll = row.roll_number ?? "";
  return {
    id: Number(row.auth_user_id),
    email: String(row.email),
    role: row.role,
    fullName: String(row.full_name ?? ""),
    rollNumber: roll,
    studentId: roll || row.email,
  };
};

const ensureAuthUsersTable = async (db: Pool | PoolClient): Promise<void> => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      auth_user_id SERIAL PRIMARY KEY,
      email VARCHAR(320) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL,
      full_name VARCHAR(255) NOT NULL DEFAULT '',
      roll_number VARCHAR(120),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query("CREATE INDEX IF NOT EXISTS idx_auth_users_role ON auth_users (role)");
};

const seedDefaultAccounts = async (db: Pool | PoolClient): Promise<void> => {
  const existing = await db.query("SELECT auth_user_id FROM auth_users LIMIT 1");
  if ((existing.rowCount ?? 0) > 0) {
    return;
  }

  await db.query(
    `
      INSERT INTO auth_users (email, password_hash, role, full_name, roll_number)
      VALUES
        ($1, $2, 'admin', 'Admin User', NULL),
        ($3, $4, 'faculty', 'Faculty User', NULL)
    `,
    [
      "admin@eduhub.local",
      hashPassword("Admin@123"),
      "faculty@eduhub.local",
      hashPassword("Faculty@123"),
    ]
  );
};

const ensureInMemorySeedUsers = (): void => {
  if (inMemoryUsers.length > 0) {
    return;
  }
  inMemoryUsers.push(
    {
      auth_user_id: inMemoryUserId++,
      email: "admin@eduhub.local",
      role: "admin",
      full_name: "Admin User",
      roll_number: null,
      password_hash: hashPassword("Admin@123"),
    },
    {
      auth_user_id: inMemoryUserId++,
      email: "faculty@eduhub.local",
      role: "faculty",
      full_name: "Faculty User",
      roll_number: null,
      password_hash: hashPassword("Faculty@123"),
    }
  );
};

const createUserInDb = async (
  db: Pool | PoolClient,
  {
    email,
    password,
    role,
    fullName,
    rollNumber,
  }: {
    email: string;
    password: string;
    role: UserRole;
    fullName: string;
    rollNumber: string;
  }
): Promise<{ user?: PublicUser; error?: string }> => {
  const exists = await db.query("SELECT auth_user_id FROM auth_users WHERE email = $1", [email]);
  if ((exists.rowCount ?? 0) > 0) {
    return { error: "Account already exists for this email." };
  }

  const inserted = await db.query<AuthUserRecord>(
    `
      INSERT INTO auth_users (email, password_hash, role, full_name, roll_number)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING auth_user_id, email, role, full_name, roll_number, password_hash
    `,
    [email, hashPassword(password), role, fullName, rollNumber || null]
  );
  return { user: toPublicUser(inserted.rows[0]) };
};

const createUserInMemory = ({
  email,
  password,
  role,
  fullName,
  rollNumber,
}: {
  email: string;
  password: string;
  role: UserRole;
  fullName: string;
  rollNumber: string;
}): { user?: PublicUser; error?: string } => {
  ensureInMemorySeedUsers();
  if (inMemoryUsers.some((user) => user.email === email)) {
    return { error: "Account already exists for this email." };
  }
  const user: AuthUserRecord = {
    auth_user_id: inMemoryUserId++,
    email,
    role,
    full_name: fullName,
    roll_number: rollNumber || null,
    password_hash: hashPassword(password),
  };
  inMemoryUsers.push(user);
  return { user: toPublicUser(user) };
};

const countOrZero = async (
  db: Pool | PoolClient,
  query: string,
  params: unknown[] = []
): Promise<number> => {
  try {
    const result = await db.query<{ value: number | string }>(query, params);
    return Number(result.rows[0]?.value ?? 0);
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";
    if (code === "42P01" || code === "42703") {
      return 0;
    }
    throw error;
  }
};

export const registerUser = async (req: Request, res: Response) => {
  const role = toRole(req.body?.role);
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password ?? "");
  const fullName = normalizeName(req.body?.fullName);
  const rollNumber = normalizeRollNumber(req.body?.rollNumber);

  if (role !== "student") {
    return res.status(400).json({ error: "Only student self-registration is allowed." });
  }
  if (!email || !password || password.length < 6 || !fullName) {
    return res.status(400).json({
      error: "email, password (min 6 chars) and fullName are required.",
    });
  }

  try {
    await ensureAuthUsersTable(pool);
    await seedDefaultAccounts(pool);
    const created = await createUserInDb(pool, {
      email,
      password,
      role,
      fullName,
      rollNumber,
    });
    if (created.error) {
      return res.status(409).json({ error: created.error });
    }
    return res.status(201).json({ user: created.user });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      const created = createUserInMemory({
        email,
        password,
        role,
        fullName,
        rollNumber,
      });
      if (created.error) {
        return res.status(409).json({ error: created.error });
      }
      return res.status(201).json({ user: created.user });
    }

    console.error("Error registering user:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createMemberByAdmin = async (req: Request, res: Response) => {
  const role = toRole(req.body?.role);
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password ?? "");
  const fullName = normalizeName(req.body?.fullName);
  const rollNumber = normalizeRollNumber(req.body?.rollNumber);

  if (role !== "student" && role !== "faculty") {
    return res.status(400).json({ error: "role must be either student or faculty." });
  }
  if (!email || !password || password.length < 6 || !fullName) {
    return res.status(400).json({
      error: "email, password (min 6 chars) and fullName are required.",
    });
  }
  if (role === "student" && !rollNumber) {
    return res.status(400).json({ error: "rollNumber is required for student accounts." });
  }

  try {
    await ensureAuthUsersTable(pool);
    await seedDefaultAccounts(pool);
    const created = await createUserInDb(pool, {
      email,
      password,
      role,
      fullName,
      rollNumber,
    });
    if (created.error) {
      return res.status(409).json({ error: created.error });
    }
    return res.status(201).json({ user: created.user });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      const created = createUserInMemory({
        email,
        password,
        role,
        fullName,
        rollNumber,
      });
      if (created.error) {
        return res.status(409).json({ error: created.error });
      }
      return res.status(201).json({ user: created.user });
    }

    console.error("Error creating member by admin:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getAdminDashboardData = async (req: Request, res: Response) => {
  try {
    await ensureAuthUsersTable(pool);
    await seedDefaultAccounts(pool);

    const roleCounts = await pool.query<{ role: UserRole; total: number | string }>(
      `
        SELECT role, COUNT(*) AS total
        FROM auth_users
        GROUP BY role
      `
    );

    const countMap: Record<UserRole, number> = {
      student: 0,
      faculty: 0,
      admin: 0,
    };
    roleCounts.rows.forEach((row) => {
      countMap[row.role] = Number(row.total ?? 0);
    });

    const recentMembersResult = await pool.query<AuthUserSummaryRow>(
      `
        SELECT auth_user_id, email, role, full_name, roll_number, created_at
        FROM auth_users
        ORDER BY created_at DESC
        LIMIT 10
      `
    );

    const recentFacultyResult = await pool.query<AuthUserSummaryRow>(
      `
        SELECT auth_user_id, email, role, full_name, roll_number, created_at
        FROM auth_users
        WHERE role = 'faculty'
        ORDER BY created_at DESC
        LIMIT 5
      `
    );

    const recentStudentsResult = await pool.query<AuthUserSummaryRow>(
      `
        SELECT auth_user_id, email, role, full_name, roll_number, created_at
        FROM auth_users
        WHERE role = 'student'
        ORDER BY created_at DESC
        LIMIT 5
      `
    );

    const quizzesCount = await countOrZero(pool, "SELECT COUNT(*) AS value FROM quizzes");
    const assignmentsCount = await countOrZero(pool, "SELECT COUNT(*) AS value FROM assignments");
    const notesCount = await countOrZero(pool, "SELECT COUNT(*) AS value FROM notes");
    const pendingQuizReviews = await countOrZero(
      pool,
      "SELECT COUNT(*) AS value FROM quiz_attempts WHERE status = 'Submitted' AND faculty_score IS NULL"
    );
    const pendingAssignmentReviews = await countOrZero(
      pool,
      "SELECT COUNT(*) AS value FROM assignment_submissions WHERE faculty_score IS NULL"
    );
    const recentStudentRegistrations = await countOrZero(
      pool,
      "SELECT COUNT(*) AS value FROM auth_users WHERE role = 'student' AND created_at >= NOW() - INTERVAL '7 days'"
    );
    const studentQuizParticipants = await countOrZero(
      pool,
      "SELECT COUNT(DISTINCT student_id) AS value FROM quiz_attempts"
    );
    const studentAssignmentSubmitters = await countOrZero(
      pool,
      "SELECT COUNT(DISTINCT student_id) AS value FROM assignment_submissions"
    );

    return res.json({
      metrics: {
        totalMembers: countMap.student + countMap.faculty + countMap.admin,
        totalStudents: countMap.student,
        totalFaculty: countMap.faculty,
        totalAdmins: countMap.admin,
        quizzesCount,
        assignmentsCount,
        notesCount,
        pendingQuizReviews,
        pendingAssignmentReviews,
      },
      facultyOverview: {
        total: countMap.faculty,
        pendingQuizReviews,
        pendingAssignmentReviews,
        recentlyAdded: recentFacultyResult.rows.map((row) => ({
          id: Number(row.auth_user_id),
          email: row.email,
          role: row.role,
          fullName: row.full_name,
          rollNumber: row.roll_number ?? "",
          createdAt: new Date(row.created_at).toISOString(),
        })),
      },
      studentOverview: {
        total: countMap.student,
        recentRegistrations7d: recentStudentRegistrations,
        quizParticipants: studentQuizParticipants,
        assignmentSubmitters: studentAssignmentSubmitters,
        recentlyAdded: recentStudentsResult.rows.map((row) => ({
          id: Number(row.auth_user_id),
          email: row.email,
          role: row.role,
          fullName: row.full_name,
          rollNumber: row.roll_number ?? "",
          createdAt: new Date(row.created_at).toISOString(),
        })),
      },
      recentMembers: recentMembersResult.rows.map((row) => ({
        id: Number(row.auth_user_id),
        email: row.email,
        role: row.role,
        fullName: row.full_name,
        rollNumber: row.roll_number ?? "",
        createdAt: new Date(row.created_at).toISOString(),
      })),
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      ensureInMemorySeedUsers();
      const members = inMemoryUsers
        .slice()
        .reverse()
        .slice(0, 10)
        .map((row) => ({
          id: Number(row.auth_user_id),
          email: row.email,
          role: row.role,
          fullName: row.full_name,
          rollNumber: row.roll_number ?? "",
          createdAt: new Date().toISOString(),
        }));
      const students = inMemoryUsers.filter((u) => u.role === "student").length;
      const faculty = inMemoryUsers.filter((u) => u.role === "faculty").length;
      const admins = inMemoryUsers.filter((u) => u.role === "admin").length;
      const recentFaculty = members.filter((m) => m.role === "faculty").slice(0, 5);
      const recentStudents = members.filter((m) => m.role === "student").slice(0, 5);
      return res.json({
        metrics: {
          totalMembers: inMemoryUsers.length,
          totalStudents: students,
          totalFaculty: faculty,
          totalAdmins: admins,
          quizzesCount: 0,
          assignmentsCount: 0,
          notesCount: 0,
          pendingQuizReviews: 0,
          pendingAssignmentReviews: 0,
        },
        facultyOverview: {
          total: faculty,
          pendingQuizReviews: 0,
          pendingAssignmentReviews: 0,
          recentlyAdded: recentFaculty,
        },
        studentOverview: {
          total: students,
          recentRegistrations7d: recentStudents.length,
          quizParticipants: 0,
          assignmentSubmitters: 0,
          recentlyAdded: recentStudents,
        },
        recentMembers: members,
      });
    }

    console.error("Error fetching admin dashboard data:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  const role = toRole(req.body?.role);
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password ?? "");

  if (!role || !email || !password) {
    return res.status(400).json({ error: "role, email and password are required." });
  }

  try {
    await ensureAuthUsersTable(pool);
    await seedDefaultAccounts(pool);
    const result = await pool.query<AuthUserRecord>(
      `
        SELECT auth_user_id, email, role, full_name, roll_number, password_hash
        FROM auth_users
        WHERE email = $1
        LIMIT 1
      `,
      [email]
    );

    if (!(result.rowCount ?? 0)) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const user = result.rows[0];
    if (user.role !== role || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    return res.json({ user: toPublicUser(user) });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      ensureInMemorySeedUsers();
      const user = inMemoryUsers.find((item) => item.email === email);
      if (!user || user.role !== role || !verifyPassword(password, user.password_hash)) {
        return res.status(401).json({ error: "Invalid credentials." });
      }
      return res.json({ user: toPublicUser(user) });
    }

    console.error("Error logging in user:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
