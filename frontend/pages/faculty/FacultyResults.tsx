import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, CheckCircle2, Clock3, Upload, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import FacultyLayout from "@/components/FacultyLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ApiErrorResponse {
  error?: string;
}

interface FacultyResultItem {
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

const readApiErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const body = (await response.json()) as ApiErrorResponse;
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
};

const fetchFacultyResults = async (signal?: AbortSignal): Promise<FacultyResultItem[]> => {
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
      const message = await readApiErrorMessage(response, "Failed to fetch faculty results.");
      throw new Error(message);
    }
    return (await response.json()) as FacultyResultItem[];
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Cannot reach backend API for faculty results.");
    }
    if (error instanceof TypeError) {
      throw new Error("Cannot reach backend API for faculty results.");
    }
    throw error;
  } finally {
    if (signal) {
      signal.removeEventListener("abort", onAbort);
    }
    request.clear();
  }
};

const updateFacultyScore = async (params: {
  attemptId: number;
  score: number;
}): Promise<FacultyResultItem> => {
  const request = withTimeoutSignal(6000);
  try {
    const response = await fetch(`${API_BASE}/api/faculty/results/${params.attemptId}/score`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: params.score }),
      signal: request.signal,
    });
    if (!response.ok) {
      const message = await readApiErrorMessage(response, "Failed to upload score.");
      throw new Error(message);
    }
    return (await response.json()) as FacultyResultItem;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Score upload timed out. Please retry.");
    }
    if (error instanceof TypeError) {
      throw new Error("Cannot reach backend API to upload score.");
    }
    throw error;
  } finally {
    request.clear();
  }
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

const FacultyResults = () => {
  const queryClient = useQueryClient();
  const [scoreDrafts, setScoreDrafts] = useState<Record<number, string>>({});

  const { data, isLoading, isError, error } = useQuery<FacultyResultItem[], Error>({
    queryKey: ["faculty-results"],
    queryFn: ({ signal }) => fetchFacultyResults(signal),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: 1,
  });

  useEffect(() => {
    if (!data) {
      return;
    }

    setScoreDrafts((previous) => {
      const next = { ...previous };
      for (const row of data) {
        if (next[row.attempt_id] === undefined) {
          next[row.attempt_id] =
            row.faculty_score !== null
              ? String(row.faculty_score)
              : row.auto_score !== null
                ? String(row.auto_score)
                : "";
        }
      }
      return next;
    });
  }, [data]);

  const uploadMutation = useMutation({
    mutationFn: updateFacultyScore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faculty-results"] });
      toast.success("Score published for student.");
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Failed to upload score.";
      toast.error(message);
    },
  });

  const rows = useMemo(
    () => (data ?? []).slice().sort((a, b) => b.attempt_id - a.attempt_id),
    [data]
  );
  const pendingCount = rows.filter((row) => row.faculty_score === null).length;
  const publishedCount = rows.filter((row) => row.faculty_score !== null).length;

  const handleUpload = (row: FacultyResultItem) => {
    const draft = scoreDrafts[row.attempt_id] ?? "";
    const score = Number(draft);
    if (!Number.isFinite(score)) {
      toast.error("Enter a valid numeric score.");
      return;
    }
    if (score < 0) {
      toast.error("Score cannot be negative.");
      return;
    }
    if (row.total_questions > 0 && score > row.total_questions) {
      toast.error(`Score cannot exceed ${row.total_questions}.`);
      return;
    }

    uploadMutation.mutate({ attemptId: row.attempt_id, score });
  };

  return (
    <FacultyLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Quiz Results</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">Total Submitted Attempts</p>
            <p className="text-2xl font-heading font-bold text-foreground">{rows.length}</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">Pending Score Upload</p>
            <p className="text-2xl font-heading font-bold text-destructive">{pendingCount}</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">Published Scores</p>
            <p className="text-2xl font-heading font-bold text-accent">{publishedCount}</p>
          </div>
        </div>

        {isLoading && <p>Loading submitted quiz attempts...</p>}
        {isError && (
          <p className="text-destructive text-sm">{error.message ?? "Failed to load results."}</p>
        )}
        {!isLoading && !isError && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No submitted quiz attempts yet. Student submissions will appear here.
          </p>
        )}

        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.attempt_id}
              className="glass-card rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center gap-4"
            >
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium text-foreground">{row.quiz_title}</p>
                <p className="text-xs text-muted-foreground">{row.cls}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <UserCircle2 className="w-3.5 h-3.5" /> {row.student_id}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Clock3 className="w-3.5 h-3.5" /> Submitted: {formatDateTime(row.submitted_at)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Auto Score:{" "}
                  <span className="font-semibold text-foreground">
                    {row.auto_score ?? "-"} / {row.total_questions}
                  </span>
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="w-32">
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    max={row.total_questions || undefined}
                    value={scoreDrafts[row.attempt_id] ?? ""}
                    onChange={(event) =>
                      setScoreDrafts((prev) => ({
                        ...prev,
                        [row.attempt_id]: event.target.value,
                      }))
                    }
                    placeholder="Score"
                  />
                </div>
                <Button
                  onClick={() => handleUpload(row)}
                  disabled={uploadMutation.isPending}
                  className="min-w-32"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Score
                </Button>
              </div>

              <div className="text-xs">
                {row.faculty_score !== null ? (
                  <p className="text-accent font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Published: {row.faculty_score} / {row.total_questions}
                  </p>
                ) : (
                  <p className="text-destructive font-semibold">Pending faculty score</p>
                )}
                <p className="text-muted-foreground mt-1">
                  Updated: {formatDateTime(row.reviewed_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </FacultyLayout>
  );
};

export default FacultyResults;
