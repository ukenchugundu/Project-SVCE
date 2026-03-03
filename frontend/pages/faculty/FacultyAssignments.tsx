import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Pencil, Trash2, Upload, UserCircle2, Clock3 } from "lucide-react";
import { toast } from "sonner";
import FacultyLayout from "@/components/FacultyLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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

interface AssignmentSubmission {
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

const fetchFacultySubmissions = async (signal?: AbortSignal): Promise<AssignmentSubmission[]> => {
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
      const message = await readApiErrorMessage(response, "Failed to load submissions.");
      throw new Error(message);
    }
    return (await response.json()) as AssignmentSubmission[];
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

const toLocalDateTimeInput = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

const FacultyAssignments = () => {
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [editForm, setEditForm] = useState({
    cls: "",
    subject: "",
    title: "",
    description: "",
    dueDate: "",
    maxScore: "",
  });

  const [form, setForm] = useState({
    cls: "",
    subject: "",
    title: "",
    description: "",
    dueDate: toLocalDateTimeInput(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    maxScore: "100",
  });
  const [scoreDrafts, setScoreDrafts] = useState<Record<number, string>>({});

  const assignmentsQuery = useQuery<Assignment[], Error>({
    queryKey: ["assignments"],
    queryFn: ({ signal }) => fetchAssignments(signal),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: 1,
  });

  const submissionsQuery = useQuery<AssignmentSubmission[], Error>({
    queryKey: ["faculty-assignment-submissions"],
    queryFn: ({ signal }) => fetchFacultySubmissions(signal),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: 1,
  });

  useEffect(() => {
    if (!submissionsQuery.data) {
      return;
    }
    setScoreDrafts((previous) => {
      const next = { ...previous };
      for (const row of submissionsQuery.data) {
        if (next[row.submission_id] === undefined) {
          next[row.submission_id] =
            row.faculty_score !== null ? String(row.faculty_score) : "";
        }
      }
      return next;
    });
  }, [submissionsQuery.data]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_BASE}/api/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cls: form.cls,
          subject: form.subject,
          title: form.title,
          description: form.description,
          dueDate: new Date(form.dueDate).toISOString(),
          maxScore: Number(form.maxScore),
        }),
      });
      if (!response.ok) {
        const message = await readApiErrorMessage(response, "Failed to create assignment.");
        throw new Error(message);
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success("Assignment created.");
      setForm({
        cls: "",
        subject: "",
        title: "",
        description: "",
        dueDate: toLocalDateTimeInput(new Date(Date.now() + 24 * 60 * 60 * 1000)),
        maxScore: "100",
      });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to create assignment.";
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (assignmentId: number) => {
      const response = await fetch(`${API_BASE}/api/assignments/${assignmentId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const message = await readApiErrorMessage(response, "Failed to delete assignment.");
        throw new Error(message);
      }
    },
    onSuccess: () => {
      toast.success("Assignment deleted.");
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["faculty-assignment-submissions"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to delete assignment.";
      toast.error(message);
    },
  });

  const scoreMutation = useMutation({
    mutationFn: async (params: { submissionId: number; score: number }) => {
      const response = await fetch(
        `${API_BASE}/api/faculty/assignments/submissions/${params.submissionId}/score`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ score: params.score }),
        }
      );
      if (!response.ok) {
        const message = await readApiErrorMessage(response, "Failed to upload score.");
        throw new Error(message);
      }
      return response.json();
    },
    onSuccess: (updatedSubmission: AssignmentSubmission) => {
      toast.success("Score uploaded for student.");
      setScoreDrafts((previous) => ({
        ...previous,
        [updatedSubmission.submission_id]:
          updatedSubmission.faculty_score !== null
            ? String(updatedSubmission.faculty_score)
            : "",
      }));
      queryClient.setQueryData<AssignmentSubmission[]>(
        ["faculty-assignment-submissions"],
        (existing) =>
          existing?.map((row) =>
            row.submission_id === updatedSubmission.submission_id
              ? { ...row, ...updatedSubmission }
              : row
          ) ?? existing
      );
      queryClient.invalidateQueries({ queryKey: ["faculty-assignment-submissions"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to upload score.";
      toast.error(message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingAssignment) return;
      const response = await fetch(`${API_BASE}/api/assignments/${editingAssignment.assignment_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cls: editForm.cls,
          subject: editForm.subject,
          title: editForm.title,
          description: editForm.description,
          dueDate: new Date(editForm.dueDate).toISOString(),
          maxScore: Number(editForm.maxScore),
        }),
      });
      if (!response.ok) {
        const message = await readApiErrorMessage(response, "Failed to update assignment.");
        throw new Error(message);
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success("Assignment updated.");
      setEditDialogOpen(false);
      setEditingAssignment(null);
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to update assignment.";
      toast.error(message);
    },
  });

  const handleEditClick = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setEditForm({
      cls: assignment.cls,
      subject: assignment.subject,
      title: assignment.title,
      description: assignment.description,
      dueDate: toLocalDateTimeInput(new Date(assignment.due_date)),
      maxScore: String(assignment.max_score),
    });
    setEditDialogOpen(true);
  };

  const handleEditSave = () => {
    if (!editForm.cls.trim() || !editForm.subject.trim() || !editForm.title.trim() || !editForm.dueDate.trim()) {
      toast.error("Class, subject, title and due date are required.");
      return;
    }

    const maxScore = Number(editForm.maxScore);
    if (!Number.isFinite(maxScore) || maxScore <= 0) {
      toast.error("Max score must be a positive number.");
      return;
    }

    const dueDate = new Date(editForm.dueDate);
    if (Number.isNaN(dueDate.getTime())) {
      toast.error("Due date is invalid.");
      return;
    }

    updateMutation.mutate();
  };

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
  const submissions = useMemo(
    () =>
      (submissionsQuery.data ?? [])
        .slice()
        .sort(
          (a, b) =>
            new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime() ||
            b.submission_id - a.submission_id
        ),
    [submissionsQuery.data]
  );

  const handleCreate = () => {
    if (!form.cls.trim() || !form.subject.trim() || !form.title.trim() || !form.dueDate.trim()) {
      toast.error("Class, subject, title and due date are required.");
      return;
    }

    const maxScore = Number(form.maxScore);
    if (!Number.isFinite(maxScore) || maxScore <= 0) {
      toast.error("Max score must be a positive number.");
      return;
    }

    const dueDate = new Date(form.dueDate);
    if (Number.isNaN(dueDate.getTime())) {
      toast.error("Due date is invalid.");
      return;
    }

    createMutation.mutate();
  };

  const handleScoreUpload = (submission: AssignmentSubmission) => {
    const draft = scoreDrafts[submission.submission_id] ?? "";
    const score = Number(draft);
    if (!Number.isFinite(score)) {
      toast.error("Enter a valid score.");
      return;
    }
    if (score < 0) {
      toast.error("Score cannot be negative.");
      return;
    }

    const maxScore = submission.max_score ?? 100;
    if (score > maxScore) {
      toast.error(`Score cannot exceed ${maxScore}.`);
      return;
    }

    scoreMutation.mutate({ submissionId: submission.submission_id, score });
  };

  return (
    <FacultyLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Assignments</h1>
        </div>

        <div className="glass-card rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Plus className="w-4 h-4" /> Create Assignment
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              placeholder="Class (e.g., III CSE-A)"
              value={form.cls}
              onChange={(event) => setForm((prev) => ({ ...prev, cls: event.target.value }))}
            />
            <Input
              placeholder="Subject"
              value={form.subject}
              onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
            />
            <Input
              placeholder="Title"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            />
            <Input
              type="datetime-local"
              value={form.dueDate}
              onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))}
            />
            <Input
              type="number"
              min={1}
              step="0.01"
              placeholder="Max score"
              value={form.maxScore}
              onChange={(event) => setForm((prev) => ({ ...prev, maxScore: event.target.value }))}
            />
          </div>
          <Textarea
            placeholder="Assignment description"
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            rows={4}
          />
          <div className="flex justify-end">
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Assignment"}
            </Button>
          </div>
        </div>

        {assignmentsQuery.isLoading && <p>Loading assignments...</p>}
        {assignmentsQuery.isError && (
          <p className="text-destructive text-sm">
            {assignmentsQuery.error.message ?? "Failed to load assignments."}
          </p>
        )}

        <div className="space-y-3">
          {assignments.map((assignment) => (
            <div
              key={assignment.assignment_id}
              className="glass-card rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"
            >
              <div>
                <p className="text-xs font-semibold text-accent">
                  {assignment.subject} · {assignment.cls}
                </p>
                <h3 className="font-medium text-foreground">{assignment.title}</h3>
                {assignment.description && (
                  <p className="text-xs text-muted-foreground mt-1">{assignment.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Due: {formatDateTime(assignment.due_date)} · Max: {assignment.max_score} ·
                  Submissions: {assignment.submission_count}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEditClick(assignment)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(assignment.assignment_id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Edit Assignment Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Assignment</DialogTitle>
              <DialogDescription>
                Update the assignment details below.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder="Class (e.g., III CSE-A)"
                value={editForm.cls}
                onChange={(event) => setEditForm((prev) => ({ ...prev, cls: event.target.value }))}
              />
              <Input
                placeholder="Subject"
                value={editForm.subject}
                onChange={(event) => setEditForm((prev) => ({ ...prev, subject: event.target.value }))}
              />
              <Input
                placeholder="Title"
                value={editForm.title}
                onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
              />
              <Input
                type="datetime-local"
                value={editForm.dueDate}
                onChange={(event) => setEditForm((prev) => ({ ...prev, dueDate: event.target.value }))}
              />
              <Input
                type="number"
                min={1}
                step="0.01"
                placeholder="Max score"
                value={editForm.maxScore}
                onChange={(event) => setEditForm((prev) => ({ ...prev, maxScore: event.target.value }))}
              />
            </div>
            <Textarea
              placeholder="Assignment description"
              value={editForm.description}
              onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="glass-card rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Student Submissions</h2>
          {submissionsQuery.isLoading && <p>Loading submissions...</p>}
          {submissionsQuery.isError && (
            <p className="text-destructive text-sm">
              {submissionsQuery.error.message ?? "Failed to load submissions."}
            </p>
          )}
          {!submissionsQuery.isLoading && !submissionsQuery.isError && submissions.length === 0 && (
            <p className="text-sm text-muted-foreground">No assignment submissions yet.</p>
          )}
          <div className="space-y-3">
            {submissions.map((submission) => (
              <div
                key={submission.submission_id}
                className="rounded-xl border border-border/60 p-4 flex flex-col lg:flex-row lg:items-center gap-4"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {submission.assignment_title ?? "Assignment"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {submission.subject ?? ""} {submission.cls ? `· ${submission.cls}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <UserCircle2 className="w-3.5 h-3.5" /> {submission.student_id}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock3 className="w-3.5 h-3.5" /> Submitted: {formatDateTime(submission.submitted_at)}
                  </p>
                  <p className="text-xs text-foreground mt-2 line-clamp-2">
                    {submission.submission_text}
                  </p>
                  {submission.faculty_score !== null ? (
                    <p className="text-xs text-accent mt-2 font-semibold">
                      Published Score: {submission.faculty_score} / {submission.max_score ?? 100}
                    </p>
                  ) : (
                    <p className="text-xs text-destructive mt-2 font-semibold">
                      Pending faculty score
                    </p>
                  )}
                  {submission.reviewed_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Reviewed: {formatDateTime(submission.reviewed_at)}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={submission.max_score ?? undefined}
                    step="0.01"
                    className="w-28"
                    placeholder="Score"
                    value={scoreDrafts[submission.submission_id] ?? ""}
                    onChange={(event) =>
                      setScoreDrafts((prev) => ({
                        ...prev,
                        [submission.submission_id]: event.target.value,
                      }))
                    }
                  />
                  <Button
                    onClick={() => handleScoreUpload(submission)}
                    disabled={scoreMutation.isPending}
                  >
                    <Upload className="w-4 h-4 mr-2" /> Upload
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </FacultyLayout>
  );
};

export default FacultyAssignments;
