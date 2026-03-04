import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  GraduationCap,
} from "lucide-react";
import FacultyLayout from "@/components/FacultyLayout";
import { Button } from "@/components/ui/button";

interface ApiErrorResponse {
  error?: string;
}

interface FacultyQuizResult {
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

interface FacultyAssignmentSubmission {
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

interface StudentPerformanceSummary {
  studentId: string;
  quizzesAttempted: number;
  quizzesReviewed: number;
  quizAveragePercent: number | null;
  assignmentsSubmitted: number;
  assignmentsReviewed: number;
  assignmentAveragePercent: number | null;
  lastSubmissionAt: string | null;
}

interface ClassPerformanceSummary {
  className: string;
  studentCount: number;
  quizAttempts: number;
  assignmentSubmissions: number;
  pendingReviewCount: number;
  averagePercent: number | null;
  students: StudentPerformanceSummary[];
}

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

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

const normalizeClassName = (value: string | null | undefined): string => {
  const next = String(value ?? "").trim();
  return next || "Unassigned";
};

const parseScorePercent = (score: number | null, maxScore: number | null): number | null => {
  if (score === null || score === undefined || maxScore === null || maxScore === undefined) {
    return null;
  }
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) {
    return null;
  }
  return (score / maxScore) * 100;
};

const formatPercent = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }
  return `${value.toFixed(1)}%`;
};

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString();
};

const examKeywordRegex = /(exam|mid|final|semester|term|unit\s*test|internal)/i;

const readApiErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const body = (await response.json()) as ApiErrorResponse;
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
};

const fetchFacultyQuizResults = async (signal?: AbortSignal): Promise<FacultyQuizResult[]> => {
  const request = withTimeoutSignal(6000);
  const onAbort = () => request.abort();
  if (signal) {
    signal.addEventListener("abort", onAbort);
  }

  try {
    const response = await fetch(`${API_BASE}/api/faculty/results`, {
      signal: request.signal,
    });
    if (!response.ok) {
      const message = await readApiErrorMessage(response, "Failed to load quiz performance data.");
      throw new Error(message);
    }
    return (await response.json()) as FacultyQuizResult[];
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Cannot reach backend API for quiz performance data.");
    }
    if (error instanceof TypeError) {
      throw new Error("Cannot reach backend API for quiz performance data.");
    }
    throw error;
  } finally {
    if (signal) {
      signal.removeEventListener("abort", onAbort);
    }
    request.clear();
  }
};

const fetchFacultyAssignmentSubmissions = async (
  signal?: AbortSignal
): Promise<FacultyAssignmentSubmission[]> => {
  const request = withTimeoutSignal(6000);
  const onAbort = () => request.abort();
  if (signal) {
    signal.addEventListener("abort", onAbort);
  }

  try {
    const response = await fetch(`${API_BASE}/api/faculty/assignments/submissions`, {
      signal: request.signal,
    });
    if (!response.ok) {
      const message = await readApiErrorMessage(
        response,
        "Failed to load assignment performance data."
      );
      throw new Error(message);
    }
    return (await response.json()) as FacultyAssignmentSubmission[];
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Cannot reach backend API for assignment performance data.");
    }
    if (error instanceof TypeError) {
      throw new Error("Cannot reach backend API for assignment performance data.");
    }
    throw error;
  } finally {
    if (signal) {
      signal.removeEventListener("abort", onAbort);
    }
    request.clear();
  }
};

const calculateAverage = (values: Array<number | null | undefined>): number | null => {
  const valid = values.filter((value): value is number =>
    typeof value === "number" && Number.isFinite(value)
  );
  if (!valid.length) {
    return null;
  }
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

const FacultyRoster = () => {
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const quizQuery = useQuery<FacultyQuizResult[], Error>({
    queryKey: ["faculty-performance-quiz"],
    queryFn: ({ signal }) => fetchFacultyQuizResults(signal),
    refetchInterval: 7000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: 1,
  });

  const assignmentQuery = useQuery<FacultyAssignmentSubmission[], Error>({
    queryKey: ["faculty-performance-assignments"],
    queryFn: ({ signal }) => fetchFacultyAssignmentSubmissions(signal),
    refetchInterval: 7000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: 1,
  });

  const isLoading = quizQuery.isLoading || assignmentQuery.isLoading;
  const isError = quizQuery.isError || assignmentQuery.isError;
  const errorMessage = quizQuery.error?.message || assignmentQuery.error?.message;

  const quizRows = useMemo(() => quizQuery.data ?? [], [quizQuery.data]);
  const assignmentRows = useMemo(() => assignmentQuery.data ?? [], [assignmentQuery.data]);

  const classSummaries = useMemo<ClassPerformanceSummary[]>(() => {
    type StudentMapValue = {
      studentId: string;
      quizRows: FacultyQuizResult[];
      assignmentRows: FacultyAssignmentSubmission[];
    };

    const classMap = new Map<string, Map<string, StudentMapValue>>();

    for (const quiz of quizRows) {
      const className = normalizeClassName(quiz.cls);
      const studentId = quiz.student_id.trim() || "unknown-student";
      const studentsMap = classMap.get(className) ?? new Map<string, StudentMapValue>();
      const student = studentsMap.get(studentId) ?? {
        studentId,
        quizRows: [],
        assignmentRows: [],
      };
      student.quizRows.push(quiz);
      studentsMap.set(studentId, student);
      classMap.set(className, studentsMap);
    }

    for (const assignment of assignmentRows) {
      const className = normalizeClassName(assignment.cls);
      const studentId = assignment.student_id.trim() || "unknown-student";
      const studentsMap = classMap.get(className) ?? new Map<string, StudentMapValue>();
      const student = studentsMap.get(studentId) ?? {
        studentId,
        quizRows: [],
        assignmentRows: [],
      };
      student.assignmentRows.push(assignment);
      studentsMap.set(studentId, student);
      classMap.set(className, studentsMap);
    }

    const summary: ClassPerformanceSummary[] = Array.from(classMap.entries()).map(
      ([className, studentsMap]) => {
        const students = Array.from(studentsMap.values()).map<StudentPerformanceSummary>(
          (student) => {
            const quizPercents = student.quizRows.map((quiz) =>
              parseScorePercent(quiz.faculty_score, quiz.total_questions)
            );
            const assignmentPercents = student.assignmentRows.map((assignment) =>
              parseScorePercent(assignment.faculty_score, assignment.max_score ?? 100)
            );

            const lastQuizTime = student.quizRows
              .map((quiz) => (quiz.submitted_at ? new Date(quiz.submitted_at).getTime() : 0))
              .reduce((max, current) => (current > max ? current : max), 0);
            const lastAssignmentTime = student.assignmentRows
              .map((assignment) => new Date(assignment.submitted_at).getTime())
              .reduce((max, current) => (current > max ? current : max), 0);
            const lastSubmissionTime = Math.max(lastQuizTime, lastAssignmentTime);

            return {
              studentId: student.studentId,
              quizzesAttempted: student.quizRows.length,
              quizzesReviewed: student.quizRows.filter((quiz) => quiz.faculty_score !== null).length,
              quizAveragePercent: calculateAverage(quizPercents),
              assignmentsSubmitted: student.assignmentRows.length,
              assignmentsReviewed: student.assignmentRows.filter(
                (assignment) => assignment.faculty_score !== null
              ).length,
              assignmentAveragePercent: calculateAverage(assignmentPercents),
              lastSubmissionAt:
                lastSubmissionTime > 0 ? new Date(lastSubmissionTime).toISOString() : null,
            };
          }
        );

        const pendingReviewCount =
          students.reduce(
            (sum, student) =>
              sum +
              (student.quizzesAttempted - student.quizzesReviewed) +
              (student.assignmentsSubmitted - student.assignmentsReviewed),
            0
          ) || 0;

        const averagePercent = calculateAverage(
          students.map((student) =>
            calculateAverage([student.quizAveragePercent, student.assignmentAveragePercent])
          )
        );

        return {
          className,
          studentCount: students.length,
          quizAttempts: students.reduce((sum, student) => sum + student.quizzesAttempted, 0),
          assignmentSubmissions: students.reduce(
            (sum, student) => sum + student.assignmentsSubmitted,
            0
          ),
          pendingReviewCount,
          averagePercent,
          students: students.sort((a, b) => a.studentId.localeCompare(b.studentId)),
        };
      }
    );

    return summary.sort((a, b) => a.className.localeCompare(b.className));
  }, [quizRows, assignmentRows]);

  const activeClassSummary = useMemo(
    () => classSummaries.find((entry) => entry.className === selectedClass) ?? null,
    [classSummaries, selectedClass]
  );

  const selectedStudentSummary = useMemo(() => {
    if (!activeClassSummary || !selectedStudentId) {
      return null;
    }
    return activeClassSummary.students.find((student) => student.studentId === selectedStudentId) ?? null;
  }, [activeClassSummary, selectedStudentId]);

  const studentQuizRows = useMemo(() => {
    if (!activeClassSummary || !selectedStudentId) {
      return [];
    }
    return quizRows
      .filter((quiz) => normalizeClassName(quiz.cls) === activeClassSummary.className)
      .filter((quiz) => quiz.student_id === selectedStudentId)
      .sort((a, b) => {
        const aTime = new Date(a.submitted_at ?? 0).getTime();
        const bTime = new Date(b.submitted_at ?? 0).getTime();
        return bTime - aTime;
      });
  }, [activeClassSummary, selectedStudentId, quizRows]);

  const studentAssignmentRows = useMemo(() => {
    if (!activeClassSummary || !selectedStudentId) {
      return [];
    }
    return assignmentRows
      .filter((assignment) => normalizeClassName(assignment.cls) === activeClassSummary.className)
      .filter((assignment) => assignment.student_id === selectedStudentId)
      .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
  }, [activeClassSummary, selectedStudentId, assignmentRows]);

  const examRows = useMemo(
    () => studentQuizRows.filter((quiz) => examKeywordRegex.test(quiz.quiz_title)),
    [studentQuizRows]
  );

  return (
    <FacultyLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Class Performance Monitor</h1>
            <p className="text-sm text-muted-foreground">
              Select a class, review student-wise performance, then drill into full student reports.
            </p>
          </div>
        </div>

        {isLoading ? <p>Loading performance analytics...</p> : null}
        {isError ? <p className="text-sm text-destructive">{errorMessage ?? "Failed to load performance."}</p> : null}

        {!isLoading && !isError && classSummaries.length === 0 ? (
          <div className="glass-card rounded-2xl p-5 text-sm text-muted-foreground">
            No class-level performance data yet. Once students submit quizzes/assignments, this dashboard will populate.
          </div>
        ) : null}

        {!isLoading && !isError && classSummaries.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {classSummaries.map((entry) => {
                const isActive = selectedClass === entry.className;
                return (
                  <button
                    key={entry.className}
                    type="button"
                    onClick={() => {
                      setSelectedClass(entry.className);
                      setSelectedStudentId(null);
                    }}
                    className={`glass-card rounded-2xl p-5 text-left border transition-all duration-300 ${
                      isActive
                        ? "border-accent ring-1 ring-accent/50 shadow-lg shadow-accent/20"
                        : "border-border hover:border-accent/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="font-heading font-semibold text-foreground text-lg">{entry.className}</h2>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">
                        {entry.studentCount} students
                      </span>
                    </div>
                    <div className="mt-4 space-y-1.5 text-sm">
                      <p className="text-muted-foreground">Quiz Attempts: <span className="text-foreground font-medium">{entry.quizAttempts}</span></p>
                      <p className="text-muted-foreground">Assignment Submissions: <span className="text-foreground font-medium">{entry.assignmentSubmissions}</span></p>
                      <p className="text-muted-foreground">Pending Reviews: <span className="text-destructive font-medium">{entry.pendingReviewCount}</span></p>
                      <p className="text-muted-foreground">Average Performance: <span className="text-accent font-semibold">{formatPercent(entry.averagePercent)}</span></p>
                    </div>
                  </button>
                );
              })}
            </div>

            {activeClassSummary ? (
              <div className="space-y-4">
                <div className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="font-heading text-xl font-bold text-foreground">
                      {activeClassSummary.className} - Student Performance
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Click a student to open complete performance and submission reports.
                    </p>
                  </div>
                  {selectedStudentId ? (
                    <Button
                      variant="outline"
                      onClick={() => setSelectedStudentId(null)}
                      className="rounded-xl"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" /> Back to Class List
                    </Button>
                  ) : null}
                </div>

                {!selectedStudentId ? (
                  <div className="glass-card rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="gradient-accent text-white">
                            <th className="text-left p-4 font-medium">Student ID</th>
                            <th className="text-center p-4 font-medium">Quiz Avg</th>
                            <th className="text-center p-4 font-medium">Assignment Avg</th>
                            <th className="text-center p-4 font-medium">Reviewed</th>
                            <th className="text-center p-4 font-medium">Pending</th>
                            <th className="text-center p-4 font-medium">Last Submission</th>
                            <th className="text-center p-4 font-medium">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeClassSummary.students.map((student) => {
                            const pending =
                              student.quizzesAttempted - student.quizzesReviewed +
                              (student.assignmentsSubmitted - student.assignmentsReviewed);

                            return (
                              <tr
                                key={student.studentId}
                                className="border-t border-border hover:bg-secondary/40 transition-colors"
                              >
                                <td className="p-4 font-medium text-foreground">{student.studentId}</td>
                                <td className="p-4 text-center">{formatPercent(student.quizAveragePercent)}</td>
                                <td className="p-4 text-center">{formatPercent(student.assignmentAveragePercent)}</td>
                                <td className="p-4 text-center text-accent font-medium">
                                  {student.quizzesReviewed + student.assignmentsReviewed}
                                </td>
                                <td className="p-4 text-center text-destructive font-medium">{pending}</td>
                                <td className="p-4 text-center text-muted-foreground text-xs">
                                  {formatDateTime(student.lastSubmissionAt)}
                                </td>
                                <td className="p-4 text-center">
                                  <Button
                                    size="sm"
                                    onClick={() => setSelectedStudentId(student.studentId)}
                                  >
                                    View Full Report
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : selectedStudentSummary ? (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                      <div className="glass-card rounded-2xl p-4">
                        <p className="text-xs text-muted-foreground">Student</p>
                        <p className="text-lg font-heading font-bold text-foreground mt-1">
                          {selectedStudentSummary.studentId}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{activeClassSummary.className}</p>
                      </div>
                      <div className="glass-card rounded-2xl p-4">
                        <p className="text-xs text-muted-foreground">Overall Avg</p>
                        <p className="text-2xl font-heading font-bold text-accent mt-1">
                          {formatPercent(
                            calculateAverage([
                              selectedStudentSummary.quizAveragePercent,
                              selectedStudentSummary.assignmentAveragePercent,
                            ])
                          )}
                        </p>
                      </div>
                      <div className="glass-card rounded-2xl p-4">
                        <p className="text-xs text-muted-foreground">Quiz Reviews</p>
                        <p className="text-2xl font-heading font-bold text-foreground mt-1">
                          {selectedStudentSummary.quizzesReviewed}/{selectedStudentSummary.quizzesAttempted}
                        </p>
                      </div>
                      <div className="glass-card rounded-2xl p-4">
                        <p className="text-xs text-muted-foreground">Assignment Reviews</p>
                        <p className="text-2xl font-heading font-bold text-foreground mt-1">
                          {selectedStudentSummary.assignmentsReviewed}/{selectedStudentSummary.assignmentsSubmitted}
                        </p>
                      </div>
                    </div>

                    <div className="glass-card rounded-2xl p-5">
                      <h3 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-accent" /> Quiz Performance
                      </h3>
                      {studentQuizRows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No quiz attempts available for this student.</p>
                      ) : (
                        <div className="space-y-2">
                          {studentQuizRows.map((quiz) => (
                            <div key={quiz.attempt_id} className="p-3 rounded-xl bg-secondary/50 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-medium text-foreground">{quiz.quiz_title}</p>
                                <p className="font-semibold text-primary">
                                  {quiz.faculty_score ?? "-"} / {quiz.total_questions}
                                </p>
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-4">
                                <span className="flex items-center gap-1"><Clock3 className="w-3.5 h-3.5" /> Submitted: {formatDateTime(quiz.submitted_at)}</span>
                                <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-accent" /> Reviewed: {formatDateTime(quiz.reviewed_at)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="glass-card rounded-2xl p-5">
                      <h3 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-accent" /> Assignment Performance
                      </h3>
                      {studentAssignmentRows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No assignment submissions available for this student.</p>
                      ) : (
                        <div className="space-y-2">
                          {studentAssignmentRows.map((assignment) => (
                            <div key={assignment.submission_id} className="p-3 rounded-xl bg-secondary/50 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-medium text-foreground">
                                  {assignment.assignment_title ?? "Assignment"}
                                </p>
                                <p className="font-semibold text-primary">
                                  {assignment.faculty_score ?? "-"} / {assignment.max_score ?? 100}
                                </p>
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-4">
                                <span className="flex items-center gap-1"><Clock3 className="w-3.5 h-3.5" /> Submitted: {formatDateTime(assignment.submitted_at)}</span>
                                <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-accent" /> Reviewed: {formatDateTime(assignment.reviewed_at)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      <div className="glass-card rounded-2xl p-5">
                        <h3 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-accent" /> Exam Results
                        </h3>
                        {examRows.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No exam-tagged quiz records found. Exam reports will appear when quiz titles include terms like Exam/Mid/Final.
                          </p>
                        ) : (
                          <div className="space-y-2 text-sm">
                            {examRows.map((exam) => (
                              <div key={exam.attempt_id} className="p-3 rounded-xl bg-secondary/50">
                                <p className="font-medium text-foreground">{exam.quiz_title}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Score: {exam.faculty_score ?? "-"}/{exam.total_questions} | Reviewed: {formatDateTime(exam.reviewed_at)}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="glass-card rounded-2xl p-5">
                        <h3 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
                          <ClipboardList className="w-4 h-4 text-accent" /> Submission Report
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div className="p-3 rounded-xl bg-secondary/50 flex items-center justify-between">
                            <span className="text-muted-foreground">Total Quiz Attempts</span>
                            <span className="font-semibold text-foreground">{studentQuizRows.length}</span>
                          </div>
                          <div className="p-3 rounded-xl bg-secondary/50 flex items-center justify-between">
                            <span className="text-muted-foreground">Total Assignments Submitted</span>
                            <span className="font-semibold text-foreground">{studentAssignmentRows.length}</span>
                          </div>
                          <div className="p-3 rounded-xl bg-secondary/50 flex items-center justify-between">
                            <span className="text-muted-foreground">Pending Faculty Review</span>
                            <span className="font-semibold text-destructive">
                              {
                                studentQuizRows.filter((quiz) => quiz.faculty_score === null).length +
                                studentAssignmentRows.filter((assignment) => assignment.faculty_score === null).length
                              }
                            </span>
                          </div>
                          <div className="p-3 rounded-xl bg-secondary/50 flex items-center justify-between">
                            <span className="text-muted-foreground">Latest Submission</span>
                            <span className="font-semibold text-foreground text-xs">
                              {formatDateTime(selectedStudentSummary.lastSubmissionAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="glass-card rounded-2xl p-5 text-sm text-muted-foreground">
                    Selected student not found in this class.
                  </div>
                )}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </FacultyLayout>
  );
};

export default FacultyRoster;
