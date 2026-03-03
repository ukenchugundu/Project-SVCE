import { useState } from "react";
import FacultyLayout from "@/components/FacultyLayout";
import { motion } from "framer-motion";
import { Brain, Clock, Users, Trash, RefreshCw, Pencil } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import CreateQuizDialog from "@/components/CreateQuizDialog";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface ApiErrorResponse {
  error?: string;
}

interface QuizQuestion {
  question_id: number;
  question_text: string;
  options?: QuizOption[];
}

interface QuizOption {
  option_id: number;
  option_text: string;
  is_correct?: boolean;
}

type QuizStatus = "Draft" | "Published" | "Completed";

interface Quiz {
  quiz_id: number;
  cls: string;
  title: string;
  questions?: QuizQuestion[];
  duration: string;
  status: QuizStatus | string;
}

// use same-origin /api by default, override via VITE_API_URL when needed
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

const normalizeStatus = (status: string): QuizStatus =>
  status.toLowerCase() === "published"
    ? "Published"
    : status.toLowerCase() === "completed"
      ? "Completed"
      : "Draft";

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

const FacultyQuizzes = () => {
  const queryClient = useQueryClient();
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState<number | null>(null);

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

  const deleteMutation = useMutation({
    mutationFn: async (quizId: number) => {
      const request = withTimeoutSignal(5000);
      try {
        const response = await fetch(`${API_BASE}/api/quizzes/${quizId}`, {
          method: "DELETE",
          signal: request.signal,
        });
        if (!response.ok) {
          const message = await readApiErrorMessage(response, "Failed to delete quiz");
          throw new Error(message);
        }
      } catch (deleteError: unknown) {
        if (deleteError instanceof DOMException && deleteError.name === "AbortError") {
          throw new Error(`Cannot reach backend API (${QUIZZES_API_URL}).`);
        }
        if (deleteError instanceof TypeError) {
          throw new Error(`Cannot reach backend API (${QUIZZES_API_URL}).`);
        }
        throw deleteError;
      } finally {
        request.clear();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
    },
    onError: (err) => {
      console.error("Delete quiz failed", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to delete quiz";
      toast.error(errorMessage);
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (params: { quizId: number; status: QuizStatus }) => {
      const request = withTimeoutSignal(5000);
      try {
        const response = await fetch(`${API_BASE}/api/quizzes/${params.quizId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: params.status }),
          signal: request.signal,
        });
        if (!response.ok) {
          const message = await readApiErrorMessage(response, "Failed to update quiz status");
          throw new Error(message);
        }
      } catch (statusError: unknown) {
        if (statusError instanceof DOMException && statusError.name === "AbortError") {
          throw new Error(`Cannot reach backend API (${QUIZZES_API_URL}).`);
        }
        if (statusError instanceof TypeError) {
          throw new Error(`Cannot reach backend API (${QUIZZES_API_URL}).`);
        }
        throw statusError;
      } finally {
        request.clear();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
    },
    onError: (err) => {
      const errorMessage = err instanceof Error ? err.message : "Failed to update quiz status";
      toast.error(errorMessage);
    },
  });

  const handleDelete = (quizId: number) => {
    setQuizToDelete(quizId);
    setIsAlertOpen(true);
  };

  const confirmDelete = () => {
    if (quizToDelete) {
      deleteMutation.mutate(quizToDelete);
      setQuizToDelete(null);
      setIsAlertOpen(false);
    }
  };

  const handleToggleStatus = (quizId: number, currentStatus: string) => {
    const normalizedStatus = normalizeStatus(currentStatus);
    const nextStatus: QuizStatus = normalizedStatus === "Published" ? "Draft" : "Published";
    statusMutation.mutate({ quizId, status: nextStatus });
  };

  const quizList = (quizzes ?? []).slice().sort((a, b) => b.quiz_id - a.quiz_id);
  const fetchErrorMessage = isError
    ? error.message ?? "Error fetching quizzes."
    : "";

  return (
    <FacultyLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Quizzes</h1>
          </div>
          <CreateQuizDialog />
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <RefreshCw className="w-3 h-3" /> Live sync every 3 seconds
        </div>

        {isLoading && <p>Loading quizzes...</p>}
        {isError && <p className="text-destructive text-sm">{fetchErrorMessage}</p>}
        {!isLoading && !isError && quizList.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No quizzes yet. Create your first quiz to see it here in real time.
          </p>
        )}

        <div className="space-y-3">
          {quizList.map((q) => {
            const questionCount = Array.isArray(q.questions) ? q.questions.length : 0;
            return (
              <motion.div
                key={q.quiz_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card rounded-2xl p-5 flex items-center justify-between card-hover"
              >
                <div>
                  <span className="text-xs font-semibold text-accent">{q.cls}</span>
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
                <div className="flex items-center gap-2">
                  <CreateQuizDialog
                    mode="edit"
                    quiz={q}
                    trigger={
                      <Button variant="outline" size="sm">
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                    }
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleStatus(q.quiz_id, q.status)}
                    disabled={statusMutation.isPending}
                  >
                    {normalizeStatus(q.status) === "Published" ? "Unpublish" : "Publish"}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(q.quiz_id)}>
                    <Trash className="w-4 h-4 text-destructive" />
                  </Button>
                  <span
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold ${
                      q.status === "Published"
                        ? "bg-accent/10 text-accent"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {q.status}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the quiz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FacultyLayout>
  );
};

export default FacultyQuizzes;
