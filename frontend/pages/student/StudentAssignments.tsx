import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle, Clock, FileText } from "lucide-react";
import StudentLayout from "@/components/StudentLayout";
import SubmitAssignmentDialog from "@/components/SubmitAssignmentDialog";

interface ApiErrorResponse {
  error?: string;
}

interface Assignment {
  assignment_id: number;
  cls: string;
  subject: string;
  title: string;
  description: string;
  due_date: string;
  max_score: number;
  submission_count: number;
}

interface StudentAssignmentSubmission {
  submission_id: number;
  assignment_id: number;
  student_id: string;
  submission_text: string;
  submitted_at: string;
  faculty_score: number | null;
  reviewed_at: string | null;
  assignment_title?: string;
  subject?: string;
  cls?: string;
  max_score?: number;
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

const fetchAssignments = async (signal?: AbortSignal): Promise<Assignment[]> => {
  const request = withTimeoutSignal(6000);
  const onAbort = () => request.abort();
  if (signal) {
    signal.addEventListener("abort", onAbort);
  }

  try {
    const response = await fetch(`${API_BASE}/api/assignments`, { signal: request.signal });
    if (!response.ok) {
      const message = await readApiErrorMessage(response, "Failed to load assignments.");
      throw new Error(message);
    }
    return (await response.json()) as Assignment[];
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Cannot reach backend API for assignments.");
    }
    if (error instanceof TypeError) {
      throw new Error("Cannot reach backend API for assignments.");
    }
    throw error;
  } finally {
    if (signal) {
      signal.removeEventListener("abort", onAbort);
    }
    request.clear();
  }
};

const fetchStudentSubmissions = async (
  studentId: string,
  signal?: AbortSignal
): Promise<StudentAssignmentSubmission[]> => {
  const request = withTimeoutSignal(6000);
  const onAbort = () => request.abort();
  if (signal) {
    signal.addEventListener("abort", onAbort);
  }

  try {
    const response = await fetch(
      `${API_BASE}/api/student/assignments/submissions?studentId=${encodeURIComponent(studentId)}`,
      { signal: request.signal }
    );
    if (!response.ok) {
      const message = await readApiErrorMessage(response, "Failed to load submissions.");
      throw new Error(message);
    }
    return (await response.json()) as StudentAssignmentSubmission[];
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Cannot reach backend API for assignment submissions.");
    }
    if (error instanceof TypeError) {
      throw new Error("Cannot reach backend API for assignment submissions.");
    }
    throw error;
  } finally {
    if (signal) {
      signal.removeEventListener("abort", onAbort);
    }
    request.clear();
  }
};

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const StudentAssignments = () => {
  const queryClient = useQueryClient();
  const [studentId] = useState<string>(() => getOrCreateStudentId());

  const assignmentsQuery = useQuery<Assignment[], Error>({
    queryKey: ["assignments"],
    queryFn: ({ signal }) => fetchAssignments(signal),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: 1,
  });

  const submissionsQuery = useQuery<StudentAssignmentSubmission[], Error>({
    queryKey: ["student-assignment-submissions", studentId],
    queryFn: ({ signal }) => fetchStudentSubmissions(studentId, signal),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: 1,
  });

  const assignments = useMemo(
    () =>
      (assignmentsQuery.data ?? [])
        .slice()
        .sort(
          (a, b) =>
            new Date(a.due_date).getTime() - new Date(b.due_date).getTime() ||
            b.assignment_id - a.assignment_id
        ),
    [assignmentsQuery.data]
  );

  const submissionByAssignmentId = useMemo(() => {
    const map = new Map<number, StudentAssignmentSubmission>();
    for (const submission of submissionsQuery.data ?? []) {
      map.set(submission.assignment_id, submission);
    }
    return map;
  }, [submissionsQuery.data]);

  const isLoading = assignmentsQuery.isLoading || submissionsQuery.isLoading;
  const errorMessage = assignmentsQuery.error?.message ?? submissionsQuery.error?.message ?? "";

  return (
    <StudentLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Assignments</h1>
        </div>

        {isLoading && <p>Loading assignments...</p>}
        {(assignmentsQuery.isError || submissionsQuery.isError) && (
          <p className="text-destructive text-sm">{errorMessage || "Failed to load assignments."}</p>
        )}
        {!isLoading && !assignmentsQuery.isError && assignments.length === 0 && (
          <p className="text-sm text-muted-foreground">No assignments available right now.</p>
        )}

        <div className="space-y-3">
          {assignments.map((assignment, index) => {
            const submission = submissionByAssignmentId.get(assignment.assignment_id);
            return (
              <motion.div
                key={assignment.assignment_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08 }}
                className="glass-card rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 card-hover"
              >
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-primary">
                    {assignment.subject} · {assignment.cls}
                  </span>
                  <h3 className="font-medium text-foreground">{assignment.title}</h3>
                  {assignment.description && (
                    <p className="text-xs text-muted-foreground">{assignment.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> Due: {formatDateTime(assignment.due_date)}
                  </p>
                </div>

                <div className="flex flex-col items-start lg:items-end gap-2">
                  {!submission && (
                    <SubmitAssignmentDialog
                      assignmentId={assignment.assignment_id}
                      assignmentTitle={assignment.title}
                      studentId={studentId}
                      triggerLabel="Submit"
                      onSubmitted={() => {
                        queryClient.invalidateQueries({
                          queryKey: ["student-assignment-submissions", studentId],
                        });
                        queryClient.invalidateQueries({ queryKey: ["assignments"] });
                      }}
                    />
                  )}

                  {submission && submission.faculty_score === null && (
                    <>
                      <span className="flex items-center gap-1.5 text-sm text-accent font-medium">
                        <CheckCircle className="w-4 h-4" /> Submitted · Awaiting faculty score
                      </span>
                      <SubmitAssignmentDialog
                        assignmentId={assignment.assignment_id}
                        assignmentTitle={assignment.title}
                        studentId={studentId}
                        triggerLabel="Resubmit"
                        initialText={submission.submission_text}
                        onSubmitted={() => {
                          queryClient.invalidateQueries({
                            queryKey: ["student-assignment-submissions", studentId],
                          });
                          queryClient.invalidateQueries({ queryKey: ["assignments"] });
                        }}
                      />
                    </>
                  )}

                  {submission && submission.faculty_score !== null && (
                    <span className="px-4 py-2 rounded-xl gradient-accent text-white text-sm font-bold">
                      Score: {submission.faculty_score} / {assignment.max_score}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </StudentLayout>
  );
};

export default StudentAssignments;
