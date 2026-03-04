import StudentLayout from "@/components/StudentLayout";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Brain, ChevronLeft, ChevronRight, Clock, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type QuestionType = "mcq" | "fill_blank" | "true_false";

interface AttemptOption {
  option_id: number;
  option_text: string;
}

interface AttemptQuestion {
  question_id: number;
  question_text: string;
  question_type: QuestionType;
  options: AttemptOption[];
}

interface AttemptQuiz {
  quiz_id: number;
  cls: string;
  title: string;
  duration: string;
  status: string;
  questions: AttemptQuestion[];
}

interface AttemptSession {
  attempt_id: number;
  quiz_id: number;
  student_id: string;
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
  status: "InProgress" | "Submitted";
  score: number | null;
  faculty_score: number | null;
  reviewed_at: string | null;
  total_questions: number;
  remaining_seconds: number;
  answers: Record<string, string>;
  quiz: AttemptQuiz;
}

interface SaveAnswersResponse {
  attempt_id: number;
  saved_count: number;
  saved_at: string;
  remaining_seconds: number;
  answers: Record<string, string>;
}

interface ApiErrorResponse {
  error?: string;
  attempt?: AttemptSession;
}

class AttemptLockedError extends Error {
  attempt?: AttemptSession;

  constructor(message: string, attempt?: AttemptSession) {
    super(message);
    this.name = "AttemptLockedError";
    this.attempt = attempt;
  }
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

const readApiErrorBody = async (response: Response): Promise<ApiErrorResponse> => {
  try {
    return (await response.json()) as ApiErrorResponse;
  } catch {
    return {};
  }
};

const startQuizAttempt = async (
  quizId: string,
  studentId: string,
  signal?: AbortSignal
): Promise<AttemptSession> => {
  const request = withTimeoutSignal(6000);
  const onAbort = () => request.abort();
  if (signal) {
    signal.addEventListener("abort", onAbort);
  }

  try {
    const response = await fetch(`${API_BASE}/api/quizzes/${quizId}/attempts/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
      signal: request.signal,
    });

    if (!response.ok) {
      const body = await readApiErrorBody(response);
      throw new Error(body.error ?? "Failed to start quiz attempt.");
    }

    return (await response.json()) as AttemptSession;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Cannot connect to quiz server. Please check backend and try again.");
    }
    if (error instanceof TypeError) {
      throw new Error("Cannot connect to quiz server. Please check backend and try again.");
    }
    throw error;
  } finally {
    if (signal) {
      signal.removeEventListener("abort", onAbort);
    }
    request.clear();
  }
};

const saveAttemptAnswer = async (
  quizId: string,
  attemptId: number,
  studentId: string,
  answer: { questionId: number; answerText: string }
): Promise<SaveAnswersResponse> => {
  const request = withTimeoutSignal(6000);
  try {
    const response = await fetch(`${API_BASE}/api/quizzes/${quizId}/attempts/${attemptId}/answers`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        answers: [answer],
      }),
      signal: request.signal,
    });

    if (response.status === 409) {
      const body = await readApiErrorBody(response);
      throw new AttemptLockedError(body.error ?? "Quiz attempt is locked.", body.attempt);
    }

    if (!response.ok) {
      const body = await readApiErrorBody(response);
      throw new Error(body.error ?? "Failed to save answer.");
    }

    return (await response.json()) as SaveAnswersResponse;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Saving answer timed out. Retrying on next answer.");
    }
    if (error instanceof TypeError) {
      throw new Error("Cannot reach server to save answer.");
    }
    throw error;
  } finally {
    request.clear();
  }
};

const submitAttempt = async (
  quizId: string,
  attemptId: number,
  studentId: string
): Promise<AttemptSession> => {
  const request = withTimeoutSignal(8000);
  try {
    const response = await fetch(`${API_BASE}/api/quizzes/${quizId}/attempts/${attemptId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
      signal: request.signal,
    });

    if (!response.ok) {
      const body = await readApiErrorBody(response);
      throw new Error(body.error ?? "Failed to submit quiz.");
    }

    return (await response.json()) as AttemptSession;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Submit timed out. Please retry.");
    }
    if (error instanceof TypeError) {
      throw new Error("Cannot reach server to submit quiz.");
    }
    throw error;
  } finally {
    request.clear();
  }
};

const formatRemainingTime = (seconds: number): string => {
  const safe = Math.max(0, seconds);
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

const normalizeAnswers = (rawAnswers: Record<string, string>): Record<number, string> => {
  const normalized: Record<number, string> = {};
  for (const [questionKey, selectedOption] of Object.entries(rawAnswers ?? {})) {
    const questionId = Number(questionKey);
    if (Number.isInteger(questionId) && questionId > 0 && typeof selectedOption === "string") {
      normalized[questionId] = selectedOption;
    }
  }
  return normalized;
};

const normalizeQuestionType = (value: string): QuestionType => {
  const normalized = value.trim().toLowerCase();
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
  return "mcq";
};

const formatQuestionTypeLabel = (value: QuestionType): string => {
  if (value === "fill_blank") {
    return "Fill in the Blank";
  }
  if (value === "true_false") {
    return "True / False";
  }
  return "Multiple Choice";
};

const StudentQuizAttempt = () => {
  const navigate = useNavigate();
  const { quizId = "" } = useParams<{ quizId: string }>();
  const [studentId] = useState<string>(() => getOrCreateStudentId());
  const [attemptSession, setAttemptSession] = useState<AttemptSession | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<string>("");
  const autoSubmitTriggeredRef = useRef(false);

  const applyAttemptSession = (session: AttemptSession) => {
    const normalizedSession: AttemptSession = {
      ...session,
      quiz: {
        ...session.quiz,
        questions: (session.quiz?.questions ?? []).map((question) => ({
          ...question,
          question_type: normalizeQuestionType(String(question.question_type ?? "mcq")),
          options: Array.isArray(question.options) ? question.options : [],
        })),
      },
    };
    setAttemptSession(normalizedSession);
    setAnswers(normalizeAnswers(session.answers));
    setRemainingSeconds(session.remaining_seconds ?? 0);
    if (session.status === "InProgress") {
      autoSubmitTriggeredRef.current = false;
    }
  };

  const {
    data: startedAttempt,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<AttemptSession, Error>({
    queryKey: ["quiz-attempt", quizId, studentId],
    queryFn: ({ signal }) => startQuizAttempt(quizId, studentId, signal),
    enabled: Boolean(quizId),
    retry: 1,
    staleTime: 0,
  });

  useEffect(() => {
    if (!startedAttempt) {
      return;
    }
    applyAttemptSession(startedAttempt);
  }, [startedAttempt]);

  const saveMutation = useMutation({
    mutationFn: (payload: { questionId: number; answerText: string }) => {
      if (!attemptSession) {
        throw new Error("Attempt not initialized.");
      }
      return saveAttemptAnswer(
        String(attemptSession.quiz_id),
        attemptSession.attempt_id,
        studentId,
        payload
      );
    },
    onSuccess: (result) => {
      setLastSavedAt(new Date(result.saved_at).toLocaleTimeString());
      setRemainingSeconds(result.remaining_seconds);
    },
    onError: (err) => {
      if (err instanceof AttemptLockedError && err.attempt) {
        applyAttemptSession(err.attempt);
        toast.error(err.message);
        return;
      }

      const message = err instanceof Error ? err.message : "Failed to save answer.";
      toast.error(message);
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!attemptSession) {
        throw new Error("Attempt not initialized.");
      }
      return submitAttempt(
        String(attemptSession.quiz_id),
        attemptSession.attempt_id,
        studentId
      );
    },
    onSuccess: (result) => {
      applyAttemptSession(result);
      toast.success("Quiz submitted successfully.");
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Failed to submit quiz.";
      toast.error(message);
    },
  });

  const isInProgress = attemptSession?.status === "InProgress";
  const quiz = attemptSession?.quiz;
  const totalQuestions = quiz?.questions.length ?? 0;
  const question = quiz?.questions[currentIndex];
  const publishedScore = attemptSession?.faculty_score;

  const answeredCount = useMemo(
    () => Object.values(answers).filter((value) => value.trim().length > 0).length,
    [answers]
  );

  useEffect(() => {
    if (!isInProgress) {
      return;
    }

    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isInProgress]);

  useEffect(() => {
    if (!isInProgress || remainingSeconds > 0 || autoSubmitTriggeredRef.current) {
      return;
    }

    autoSubmitTriggeredRef.current = true;
    submitMutation.mutate();
  }, [isInProgress, remainingSeconds, submitMutation]);

  useEffect(() => {
    if (!isInProgress) {
      return;
    }

    const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", beforeUnloadHandler);
    return () => window.removeEventListener("beforeunload", beforeUnloadHandler);
  }, [isInProgress]);

  useEffect(() => {
    if (!isInProgress) {
      return;
    }

    const visibilityHandler = () => {
      if (document.visibilityState === "hidden") {
        setTabSwitchCount((count) => count + 1);
      }
    };

    document.addEventListener("visibilitychange", visibilityHandler);
    return () => document.removeEventListener("visibilitychange", visibilityHandler);
  }, [isInProgress]);

  const handleAnswerSave = (questionId: number, answerText: string) => {
    if (!isInProgress || !attemptSession) {
      return;
    }

    if (!answerText.trim()) {
      return;
    }

    setAnswers((previous) => ({ ...previous, [questionId]: answerText }));
    saveMutation.mutate({
      questionId,
      answerText,
    });
  };

  const handleTextAnswerChange = (questionId: number, value: string) => {
    setAnswers((previous) => {
      if (!value.trim()) {
        const updated = { ...previous };
        delete updated[questionId];
        return updated;
      }
      return { ...previous, [questionId]: value };
    });
  };

  const handleSubmitQuiz = () => {
    if (!isInProgress) {
      return;
    }
    submitMutation.mutate();
  };

  return (
    <StudentLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground">
                {quiz?.title ?? "Quiz Attempt"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {quiz?.cls ?? ""} {quiz?.duration ? `· ${quiz.duration}` : ""}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/student/quizzes")}>
            Back to Quizzes
          </Button>
        </div>

        {isLoading && <p>Starting quiz session...</p>}
        {isError && (
          <div className="glass-card rounded-2xl p-4 space-y-3">
            <p className="text-destructive text-sm">
              {error.message ?? "Failed to start quiz attempt."}
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !isError && attemptSession && (
          <>
            {isInProgress ? (
              <div className="glass-card rounded-2xl p-4 flex flex-wrap items-center gap-4 text-sm">
                <span
                  className={`flex items-center gap-1 font-semibold ${
                    remainingSeconds <= 60 ? "text-destructive" : "text-foreground"
                  }`}
                >
                  <Clock className="w-4 h-4" /> Time Left: {formatRemainingTime(remainingSeconds)}
                </span>
                <span>
                  Question {Math.min(currentIndex + 1, totalQuestions)} of {totalQuestions}
                </span>
                <span>
                  Answered: {answeredCount}/{totalQuestions}
                </span>
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" /> Tab switches: {tabSwitchCount}
                </span>
                <span className="flex items-center gap-1">
                  <Save className="w-4 h-4" />
                  {saveMutation.isPending
                    ? "Saving..."
                    : lastSavedAt
                      ? `Saved at ${lastSavedAt}`
                      : "Waiting for first save"}
                </span>
              </div>
            ) : (
              <div className="glass-card rounded-2xl p-4 bg-primary/5 border-primary/20 text-sm">
                <p className="font-medium text-foreground">Quiz submitted successfully.</p>
                <p className="text-muted-foreground mt-1">
                  Attempt review is available below.
                </p>
                <p className="mt-2 text-foreground font-semibold">
                  {publishedScore !== null && publishedScore !== undefined
                    ? `Published Score: ${publishedScore} / ${attemptSession.total_questions}`
                    : "Score will appear after faculty publishes the result."}
                </p>
              </div>
            )}

            {totalQuestions === 0 && (
              <p className="text-sm text-muted-foreground">This quiz has no questions yet.</p>
            )}

            {isInProgress && totalQuestions > 0 && question && (
              <div className="glass-card rounded-2xl p-6 space-y-5">
                <h2 className="font-medium text-foreground">
                  {currentIndex + 1}. {question.question_text}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {formatQuestionTypeLabel(question.question_type)}
                </p>

                {question.question_type === "fill_blank" ? (
                  <div className="space-y-3">
                    <Input
                      placeholder="Type your answer"
                      value={answers[question.question_id] ?? ""}
                      onChange={(event) =>
                        handleTextAnswerChange(question.question_id, event.target.value)
                      }
                      onBlur={() => {
                        const textAnswer = (answers[question.question_id] ?? "").trim();
                        if (textAnswer) {
                          handleAnswerSave(question.question_id, textAnswer);
                        }
                      }}
                    />
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        onClick={() =>
                          handleAnswerSave(
                            question.question_id,
                            (answers[question.question_id] ?? "").trim()
                          )
                        }
                        disabled={!answers[question.question_id]?.trim() || saveMutation.isPending}
                      >
                        Save Answer
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {question.options.map((option) => {
                      const selected = answers[question.question_id] === option.option_text;
                      return (
                        <button
                          key={option.option_id}
                          type="button"
                          onClick={() => handleAnswerSave(question.question_id, option.option_text)}
                          className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                            selected
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/50"
                          }`}
                          disabled={!isInProgress}
                        >
                          {option.option_text}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentIndex((index) => Math.max(index - 1, 0))}
                      disabled={currentIndex === 0}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setCurrentIndex((index) => Math.min(index + 1, totalQuestions - 1))
                      }
                      disabled={currentIndex === totalQuestions - 1}
                    >
                      Next <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                  <Button onClick={handleSubmitQuiz} disabled={!isInProgress || submitMutation.isPending}>
                    {submitMutation.isPending ? "Submitting..." : isInProgress ? "Submit Quiz" : "Submitted"}
                  </Button>
                </div>
              </div>
            )}

            {!isInProgress && (
              <div className="glass-card rounded-2xl p-5 space-y-4">
                <p className="text-sm font-medium text-foreground">Attempted Questions</p>
                <div className="space-y-3">
                  {quiz?.questions.map((quizQuestion, index) => (
                    <div key={quizQuestion.question_id} className="rounded-xl border p-4 space-y-2">
                      <p className="text-sm text-foreground font-medium">
                        {index + 1}. {quizQuestion.question_text}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatQuestionTypeLabel(quizQuestion.question_type)}
                      </p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">Your answer: </span>
                        <span className="font-medium text-foreground">
                          {answers[quizQuestion.question_id]?.trim() || "Not answered"}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </StudentLayout>
  );
};

export default StudentQuizAttempt;
