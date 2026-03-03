import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, ExternalLink, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
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

interface NoteItem {
  note_id: number;
  cls: string;
  subject: string;
  title: string;
  content: string;
  file_url: string;
  created_at: string;
  updated_at: string;
}

interface NoteUploadResponse {
  fileUrl: string;
  fileName: string;
  mimeType: string;
  size: number;
}

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

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

const fetchNotes = async (signal?: AbortSignal): Promise<NoteItem[]> => {
  const request = withTimeoutSignal(6000);
  const onAbort = () => request.abort();
  if (signal) {
    signal.addEventListener("abort", onAbort);
  }

  try {
    const response = await fetch(`${API_BASE}/api/notes`, {
      signal: request.signal,
    });
    if (!response.ok) {
      const message = await readApiErrorMessage(response, "Failed to load notes.");
      throw new Error(message);
    }
    return (await response.json()) as NoteItem[];
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Cannot reach backend API for notes.");
    }
    if (error instanceof TypeError) {
      throw new Error("Cannot reach backend API for notes.");
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

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.replace(/^data:[^;]+;base64,/, ""));
    };
    reader.onerror = () => reject(new Error("Failed to read selected file."));
    reader.readAsDataURL(file);
  });

const FacultyNotes = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    cls: "",
    subject: "",
    title: "",
    content: "",
    fileUrl: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [editForm, setEditForm] = useState({
    cls: "",
    subject: "",
    title: "",
    content: "",
    fileUrl: "",
  });
  const [editSelectedFile, setEditSelectedFile] = useState<File | null>(null);
  const [editFileInputKey, setEditFileInputKey] = useState(0);

  const notesQuery = useQuery<NoteItem[], Error>({
    queryKey: ["notes"],
    queryFn: ({ signal }) => fetchNotes(signal),
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      let resolvedFileUrl = form.fileUrl.trim();
      if (selectedFile) {
        const fileBase64 = await fileToBase64(selectedFile);
        const uploadResponse = await fetch(`${API_BASE}/api/notes/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: selectedFile.name,
            mimeType: selectedFile.type || "application/octet-stream",
            fileBase64,
          }),
        });
        if (!uploadResponse.ok) {
          const message = await readApiErrorMessage(
            uploadResponse,
            "Failed to upload note file."
          );
          throw new Error(message);
        }

        const uploadBody = (await uploadResponse.json()) as NoteUploadResponse;
        if (!uploadBody.fileUrl?.trim()) {
          throw new Error("File upload completed but no file URL was returned.");
        }
        resolvedFileUrl = uploadBody.fileUrl.trim();
      }

      const response = await fetch(`${API_BASE}/api/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cls: form.cls,
          subject: form.subject,
          title: form.title,
          content: form.content,
          fileUrl: resolvedFileUrl,
        }),
      });
      if (!response.ok) {
        const message = await readApiErrorMessage(response, "Failed to create note.");
        throw new Error(message);
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success("Note uploaded successfully.");
      setForm({ cls: "", subject: "", title: "", content: "", fileUrl: "" });
      setSelectedFile(null);
      setFileInputKey((prev) => prev + 1);
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to upload note.";
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (noteId: number) => {
      const response = await fetch(`${API_BASE}/api/notes/${noteId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const message = await readApiErrorMessage(response, "Failed to delete note.");
        throw new Error(message);
      }
    },
    onSuccess: () => {
      toast.success("Note deleted.");
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to delete note.";
      toast.error(message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingNote) return;
      
      let resolvedFileUrl = editForm.fileUrl.trim();
      if (editSelectedFile) {
        const fileBase64 = await fileToBase64(editSelectedFile);
        const uploadResponse = await fetch(`${API_BASE}/api/notes/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: editSelectedFile.name,
            mimeType: editSelectedFile.type || "application/octet-stream",
            fileBase64,
          }),
        });
        if (!uploadResponse.ok) {
          const message = await readApiErrorMessage(
            uploadResponse,
            "Failed to upload note file."
          );
          throw new Error(message);
        }

        const uploadBody = (await uploadResponse.json()) as NoteUploadResponse;
        if (!uploadBody.fileUrl?.trim()) {
          throw new Error("File upload completed but no file URL was returned.");
        }
        resolvedFileUrl = uploadBody.fileUrl.trim();
      }

      const response = await fetch(`${API_BASE}/api/notes/${editingNote.note_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cls: editForm.cls,
          subject: editForm.subject,
          title: editForm.title,
          content: editForm.content,
          fileUrl: resolvedFileUrl,
        }),
      });
      if (!response.ok) {
        const message = await readApiErrorMessage(response, "Failed to update note.");
        throw new Error(message);
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success("Note updated successfully.");
      setEditDialogOpen(false);
      setEditingNote(null);
      setEditForm({ cls: "", subject: "", title: "", content: "", fileUrl: "" });
      setEditSelectedFile(null);
      setEditFileInputKey((prev) => prev + 1);
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to update note.";
      toast.error(message);
    },
  });

  const notes = useMemo(
    () =>
      (notesQuery.data ?? [])
        .slice()
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime() ||
            b.note_id - a.note_id
        ),
    [notesQuery.data]
  );

  const handleCreateNote = () => {
    if (!form.cls.trim() || !form.subject.trim() || !form.title.trim()) {
      toast.error("Class, subject and title are required.");
      return;
    }

    if (!form.content.trim() && !form.fileUrl.trim() && !selectedFile) {
      toast.error("Provide note content, file URL, or upload a document.");
      return;
    }

    if (form.fileUrl.trim()) {
      try {
        new URL(form.fileUrl.trim());
      } catch {
        toast.error("File URL must be a valid URL.");
        return;
      }
    }

    if (selectedFile && selectedFile.size > MAX_UPLOAD_BYTES) {
      toast.error("File is too large. Maximum allowed size is 20 MB.");
      return;
    }

    createMutation.mutate();
  };

  const handleEditClick = (note: NoteItem) => {
    setEditingNote(note);
    setEditForm({
      cls: note.cls,
      subject: note.subject,
      title: note.title,
      content: note.content,
      fileUrl: note.file_url,
    });
    setEditSelectedFile(null);
    setEditFileInputKey((prev) => prev + 1);
    setEditDialogOpen(true);
  };

  const handleEditSave = () => {
    if (!editForm.cls.trim() || !editForm.subject.trim() || !editForm.title.trim()) {
      toast.error("Class, subject and title are required.");
      return;
    }

    if (!editForm.content.trim() && !editForm.fileUrl.trim() && !editSelectedFile) {
      toast.error("Provide note content, file URL, or upload a document.");
      return;
    }

    if (editForm.fileUrl.trim()) {
      try {
        new URL(editForm.fileUrl.trim());
      } catch {
        toast.error("File URL must be a valid URL.");
        return;
      }
    }

    if (editSelectedFile && editSelectedFile.size > MAX_UPLOAD_BYTES) {
      toast.error("File is too large. Maximum allowed size is 20 MB.");
      return;
    }

    updateMutation.mutate();
  };

  return (
    <FacultyLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Notes Management</h1>
        </div>

        <div className="glass-card rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Plus className="w-4 h-4" /> Upload Note
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
              placeholder="File URL (optional)"
              value={form.fileUrl}
              onChange={(event) => setForm((prev) => ({ ...prev, fileUrl: event.target.value }))}
            />
            <Input
              key={fileInputKey}
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setSelectedFile(file);
              }}
            />
          </div>
          {selectedFile && (
            <p className="text-xs text-muted-foreground">
              Selected file: {selectedFile.name}
            </p>
          )}
          <Textarea
            placeholder="Note summary/content (optional if file URL provided)"
            value={form.content}
            onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
            rows={4}
          />
          <div className="flex justify-end">
            <Button onClick={handleCreateNote} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Uploading..." : "Upload Note"}
            </Button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <RefreshCw className="w-3 h-3" /> Live sync every 3 seconds
        </div>

        {notesQuery.isLoading && <p>Loading notes...</p>}
        {notesQuery.isError && (
          <p className="text-destructive text-sm">
            {notesQuery.error.message ?? "Failed to load notes."}
          </p>
        )}
        {!notesQuery.isLoading && !notesQuery.isError && notes.length === 0 && (
          <p className="text-sm text-muted-foreground">No notes yet. Upload your first note.</p>
        )}

        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.note_id}
              className="glass-card rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
            >
              <div className="flex-1">
                <p className="text-xs font-semibold text-accent">
                  {note.subject} · {note.cls}
                </p>
                <h3 className="font-medium text-foreground">{note.title}</h3>
                {note.content && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{note.content}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Uploaded: {formatDateTime(note.created_at)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {note.file_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(note.file_url, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEditClick(note)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(note.note_id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Edit Note Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Note</DialogTitle>
              <DialogDescription>
                Update the note details below.
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
                placeholder="File URL (optional)"
                value={editForm.fileUrl}
                onChange={(event) => setEditForm((prev) => ({ ...prev, fileUrl: event.target.value }))}
              />
              <Input
                key={editFileInputKey}
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setEditSelectedFile(file);
                }}
              />
            </div>
            {editSelectedFile && (
              <p className="text-xs text-muted-foreground">
                Selected file: {editSelectedFile.name}
              </p>
            )}
            <Textarea
              placeholder="Note summary/content (optional if file URL provided)"
              value={editForm.content}
              onChange={(event) => setEditForm((prev) => ({ ...prev, content: event.target.value }))}
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
      </div>
    </FacultyLayout>
  );
};

export default FacultyNotes;
