import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ApiErrorResponse {
  error?: string;
}

interface SubmitAssignmentDialogProps {
  assignmentId: number;
  assignmentTitle: string;
  studentId: string;
  triggerLabel: string;
  initialText?: string;
  onSubmitted: () => void;
}

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

const readApiErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const body = (await response.json()) as ApiErrorResponse;
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
};

const SubmitAssignmentDialog = ({
  assignmentId,
  assignmentTitle,
  studentId,
  triggerLabel,
  initialText = "",
  onSubmitted,
}: SubmitAssignmentDialogProps) => {
  const [open, setOpen] = useState(false);
  const [submissionText, setSubmissionText] = useState(initialText);

  useEffect(() => {
    if (!open) {
      setSubmissionText(initialText);
    }
  }, [initialText, open]);

  const mutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await fetch(`${API_BASE}/api/assignments/${assignmentId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          submissionText: text,
        }),
      });

      if (!response.ok) {
        const message = await readApiErrorMessage(response, "Failed to submit assignment.");
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success("Assignment submitted.");
      setOpen(false);
      onSubmitted();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to submit assignment.";
      toast.error(message);
    },
  });

  const handleSubmit = () => {
    if (!submissionText.trim()) {
      toast.error("Submission text is required.");
      return;
    }

    mutation.mutate(submissionText.trim());
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit Assignment</DialogTitle>
          <DialogDescription>{assignmentTitle}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            value={submissionText}
            onChange={(event) => setSubmissionText(event.target.value)}
            placeholder="Paste your solution link or write your submission summary..."
            rows={8}
          />
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={mutation.isPending}>
              {mutation.isPending ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SubmitAssignmentDialog;
