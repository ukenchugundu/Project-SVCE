import StudentLayout from "@/components/StudentLayout";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CheckCircle2, Clock3, FileText } from "lucide-react";

interface ApiErrorResponse {
  error?: string;
}

interface QuizResultItem {
  attempt_id: number;
  quiz_title: string;
  cls: string;
  submitted_at: string | null;
  total_questions: number;
  faculty_score: number | null;
  reviewed_at: string | null;
}

interface AssignmentResultItem {
  submission_id: number;
  assignment_title?: string;
  cls?: string;
  submitted_at: string;
  max_score?: number;
  faculty_score: number | null;
  reviewed_at: string | null;
}

interface PublishedResult {
  id: string;
  type: "Quiz" | "Assignment";
  title: string;
  cls: string;
  submittedAt: string | null;
  publishedAt: string | null;
  score: number;
  maxScore: number;
}

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const STUDENT_ID_STORAGE_KEY = "eduhub_student_id";

const withTimeoutSignal = (timeoutMs = 6000): {
  signal: AbortSignal;
  clear: () => void;
  abort: () => void;
} => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
    abort: () => controller.abort(),
  };
};

const getOrCreateStudentId = (): string => {
  const fallback = `student-${Math.random().toString(36).slice(2, 10)}`;
  try {
    const existing = localStorage.getItem(STUDENT_ID_STORAGE_KEY);
    if (existing && existing.trim()) {
      return existing;
    }

    localStorage.setItem(STUDENT_ID_STORAGE_KEY, fallback);
    return fallback;
  } catch {
    return fallback;
  }
};

const readApiErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const body = (await response.json()) as ApiErrorResponse;
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
};

const fetchJson = async <T,>(url: string, signal?: AbortSignal): Promise<T> => {
  const request = withTimeoutSignal(6000);
  const onAbort = () => request.abort();
  if (signal) {
    signal.addEventListener("abort", onAbort);
  }

  try {
    const response = await fetch(url, { signal: request.signal });
    if (!response.ok) {
      const message = await readApiErrorMessage(response, "Failed to load results.");
      throw new Error(message);
    }
    return (await response.json()) as T;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Cannot reach backend API for results.");
    }
    if (error instanceof TypeError) {
      throw new Error("Cannot reach backend API for results.");
    }
    throw error;
  } finally {
    if (signal) {
      signal.removeEventListener("abort", onAbort);
    }
    request.clear();
  }
};

const fetchPublishedResults = async (
  studentId: string,
  signal?: AbortSignal
): Promise<PublishedResult[]> => {
  const [quizRows, assignmentRows] = await Promise.all([
    fetchJson<QuizResultItem[]>(
      `${API_BASE}/api/student/results?studentId=${encodeURIComponent(studentId)}`,
      signal
    ),
    fetchJson<AssignmentResultItem[]>(
      `${API_BASE}/api/student/assignments/results?studentId=${encodeURIComponent(studentId)}`,
      signal
    ),
  ]);

  const quizResults: PublishedResult[] = quizRows
    .filter((row) => row.faculty_score !== null)
    .map((row) => ({
      id: `quiz-${row.attempt_id}`,
      type: "Quiz",
      title: row.quiz_title,
      cls: row.cls,
      submittedAt: row.submitted_at,
      publishedAt: row.reviewed_at,
      score: Number(row.faculty_score ?? 0),
      maxScore: Number(row.total_questions ?? 0),
    }));

  const assignmentResults: PublishedResult[] = assignmentRows
    .filter((row) => row.faculty_score !== null)
    .map((row) => ({
      id: `assignment-${row.submission_id}`,
      type: "Assignment",
      title: row.assignment_title ?? "Assignment",
      cls: row.cls ?? "",
      submittedAt: row.submitted_at,
      publishedAt: row.reviewed_at,
      score: Number(row.faculty_score ?? 0),
      maxScore: Number(row.max_score ?? 100),
    }));

  return [...quizResults, ...assignmentResults].sort((a, b) => {
    const aTime = new Date(a.publishedAt ?? a.submittedAt ?? 0).getTime();
    const bTime = new Date(b.publishedAt ?? b.submittedAt ?? 0).getTime();
    return bTime - aTime;
  });
};

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString();
};

const StudentResults = () => {
  const [studentId] = useState<string>(() => getOrCreateStudentId());

  const { data, isLoading, isError, error } = useQuery<PublishedResult[], Error>({
    queryKey: ["student-published-results", studentId],
    queryFn: ({ signal }) => fetchPublishedResults(studentId, signal),
    refetchInterval: 6000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: 1,
  });

  const rows = useMemo(() => data ?? [], [data]);
  const average = useMemo(() => {
    const validRows = rows.filter((row) => row.maxScore > 0);
    if (!validRows.length) {
      return null;
    }
    const totalPercent = validRows.reduce(
      (sum, row) => sum + (row.score / row.maxScore) * 100,
      0
    );
    return (totalPercent / validRows.length).toFixed(1);
  }, [rows]);

  return (
    <StudentLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Results</h1>
        </div>

        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs text-muted-foreground">Published by Faculty</p>
          <p className="text-2xl font-heading font-bold text-foreground mt-1">{rows.length}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {average ? `Average: ${average}%` : "Average will appear after score publication."}
          </p>
        </div>

        {isLoading && <p>Loading published scores...</p>}
        {isError && (
          <p className="text-destructive text-sm">{error.message ?? "Failed to load results."}</p>
        )}
        {!isLoading && !isError && rows.length === 0 && (
          <div className="glass-card rounded-2xl p-5">
            <p className="text-sm text-muted-foreground">
              No scores published yet. Faculty scores for quizzes and assignments will appear here.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="glass-card rounded-2xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{row.title}</p>
                  <p className="text-xs text-muted-foreground">{row.cls}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full ${
                        row.type === "Quiz"
                          ? "bg-primary/10 text-primary"
                          : "bg-accent/10 text-accent"
                      }`}
                    >
                      {row.type}
                    </span>
                  </p>
                </div>
                <p className="text-primary font-bold text-lg">
                  {row.score} / {row.maxScore}
                </p>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock3 className="w-3.5 h-3.5" /> Submitted: {formatDateTime(row.submittedAt)}
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent" /> Published:{" "}
                  {formatDateTime(row.publishedAt)}
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> {row.id}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </StudentLayout>
  );
};

export default StudentResults;
