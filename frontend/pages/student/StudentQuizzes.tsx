import StudentLayout from "@/components/StudentLayout";
import { motion } from "framer-motion";
import { Brain, Clock, Video, Mic, Shield, Users, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

interface ApiErrorResponse {
  error?: string;
}

interface QuizQuestion {
  question_id: number;
  question_text: string;
}

interface Quiz {
  quiz_id: number;
  cls: string;
  title: string;
  duration: string;
  status: string;
  questions?: QuizQuestion[];
}

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const QUIZZES_API_URL = `${API_BASE}/api/quizzes`;

const withTimeoutSignal = (timeoutMs = 5000): {
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

const readApiErrorMessage = async (
  response: Response,
  fallback: string
): Promise<string> => {
  try {
    const body = (await response.json()) as ApiErrorResponse;
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
};

const fetchQuizzes = async (signal?: AbortSignal): Promise<Quiz[]> => {
  const request = withTimeoutSignal(5000);
  const onAbort = () => request.abort();
  if (signal) {
    signal.addEventListener("abort", onAbort);
  }

  try {
    const response = await fetch(QUIZZES_API_URL, { signal: request.signal });
    if (!response.ok) {
      const message = await readApiErrorMessage(response, "Error fetching quizzes.");
      throw new Error(message);
    }
    return (await response.json()) as Quiz[];
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Cannot reach backend API (${QUIZZES_API_URL}).`);
    }
    if (error instanceof TypeError) {
      throw new Error(`Cannot reach backend API (${QUIZZES_API_URL}).`);
    }
    throw error;
  } finally {
    if (signal) {
      signal.removeEventListener("abort", onAbort);
    }
    request.clear();
  }
};

const getStatusPill = (status: string, onStart: () => void) => {
  const normalizedStatus = status.toLowerCase();
  switch (normalizedStatus) {
    case "published":
    case "live":
      return (
        <button
          onClick={onStart}
          className="px-5 py-2.5 rounded-xl gradient-primary text-white text-sm font-medium animate-pulse shadow-lg shadow-primary/30"
        >
          Start Quiz
        </button>
      );
    case "completed":
      return (
        <span className="px-4 py-2 rounded-xl gradient-accent text-white text-sm font-bold">
          Completed
        </span>
      );
    default:
      return (
        <button
          onClick={onStart}
          className="px-5 py-2.5 rounded-xl bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80"
        >
          Start Quiz
        </button>
      );
  }
};

const StudentQuizzes = () => {
  const navigate = useNavigate();
  const { data: quizzes, isLoading, isError, error } = useQuery<Quiz[], Error>({
    queryKey: ["quizzes"],
    queryFn: ({ signal }) => fetchQuizzes(signal),
    refetchInterval: (query) => (query.state.error ? false : 3000),
    refetchIntervalInBackground: true,
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 1,
    retryDelay: 800,
  });

  const quizList = (quizzes ?? []).slice().sort((a, b) => b.quiz_id - a.quiz_id);
  const fetchErrorMessage = isError
    ? error.message ?? "Error fetching quizzes."
    : "";

  return (
    <StudentLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Quizzes</h1>
        </div>

        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <RefreshCw className="w-3 h-3" /> Live sync every 3 seconds
        </div>

        <div className="glass-card rounded-2xl p-4 border-primary/20 flex items-center gap-3 bg-primary/5">
          <Shield className="w-5 h-5 text-primary shrink-0" />
          <p className="text-sm text-foreground">
            During quizzes, <strong>camera</strong> <Video className="inline w-4 h-4 text-primary" /> and{" "}
            <strong>microphone</strong> <Mic className="inline w-4 h-4 text-primary" /> are enabled. Tab switching is blocked.
          </p>
        </div>

        {isLoading && <p>Loading quizzes...</p>}
        {isError && <p className="text-destructive text-sm">{fetchErrorMessage}</p>}
        {!isLoading && !isError && quizList.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No quizzes available yet. New quizzes from faculty will appear here automatically.
          </p>
        )}

        <div className="space-y-3">
          {quizList.map((q, i) => {
            const questionCount = Array.isArray(q.questions) ? q.questions.length : 0;
            return (
              <motion.div
                key={q.quiz_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="glass-card rounded-2xl p-5 flex items-center justify-between card-hover"
              >
                <div>
                  <span className="text-xs font-semibold text-primary">{q.cls}</span>
                  <h3 className="font-medium text-foreground">{q.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {questionCount} questions
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {q.duration}
                    </span>
                  </p>
                </div>
                {getStatusPill(q.status, () => navigate(`/student/quizzes/${q.quiz_id}`))}
              </motion.div>
            );
          })}
        </div>
      </div>
    </StudentLayout>
  );
};

export default StudentQuizzes;
