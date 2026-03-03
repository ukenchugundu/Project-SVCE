import StudentLayout from "@/components/StudentLayout";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BookOpen, Download, ExternalLink, FileText, FolderOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const officePreviewExtensions = new Set(["doc", "docx", "ppt", "pptx", "xls", "xlsx"]);
const colors = [
  "from-primary to-primary/60",
  "from-accent to-accent/60",
  "from-gold to-gold/60",
  "from-destructive to-destructive/60",
  "from-primary to-accent/60",
];

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

const getFileExtension = (fileUrl: string): string => {
  if (!fileUrl.trim()) {
    return "";
  }
  try {
    const pathname = new URL(fileUrl).pathname;
    const lastSegment = pathname.split("/").filter(Boolean).pop() ?? "";
    const dotIndex = lastSegment.lastIndexOf(".");
    if (dotIndex === -1) {
      return "";
    }
    return lastSegment.slice(dotIndex + 1).toLowerCase();
  } catch {
    const sanitized = fileUrl.split("?")[0].split("#")[0];
    const lastSegment = sanitized.split("/").filter(Boolean).pop() ?? "";
    const dotIndex = lastSegment.lastIndexOf(".");
    if (dotIndex === -1) {
      return "";
    }
    return lastSegment.slice(dotIndex + 1).toLowerCase();
  }
};

const getFileName = (note: NoteItem): string => {
  const fileUrl = note.file_url.trim();
  if (fileUrl) {
    try {
      const pathname = new URL(fileUrl).pathname;
      const fromPath = pathname.split("/").filter(Boolean).pop();
      if (fromPath && fromPath.trim()) {
        return decodeURIComponent(fromPath);
      }
    } catch {
      const sanitized = fileUrl.split("?")[0].split("#")[0];
      const fromPath = sanitized.split("/").filter(Boolean).pop();
      if (fromPath && fromPath.trim()) {
        return decodeURIComponent(fromPath);
      }
    }
  }

  const cleanTitle = note.title.trim().replace(/\s+/g, "-").toLowerCase();
  return `${cleanTitle || "note"}.txt`;
};

const getFileTypeLabel = (fileUrl: string): string => {
  const extension = getFileExtension(fileUrl);
  return extension ? extension.toUpperCase() : "TEXT";
};

const getPreviewUrl = (fileUrl: string): string => {
  const extension = getFileExtension(fileUrl);
  if (officePreviewExtensions.has(extension)) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
  }
  return fileUrl;
};

const StudentNotes = () => {
  const [selectedNote, setSelectedNote] = useState<NoteItem | null>(null);

  const { data, isLoading, isError, error } = useQuery<NoteItem[], Error>({
    queryKey: ["notes"],
    queryFn: ({ signal }) => fetchNotes(signal),
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: 1,
  });

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        subject: string;
        cls: string;
        notes: NoteItem[];
        latest: string;
      }
    >();

    for (const note of data ?? []) {
      const key = `${note.subject}__${note.cls}`;
      const existing = map.get(key);
      if (existing) {
        existing.notes.push(note);
        if (new Date(note.created_at).getTime() > new Date(existing.latest).getTime()) {
          existing.latest = note.created_at;
        }
        continue;
      }

      map.set(key, {
        key,
        subject: note.subject,
        cls: note.cls,
        notes: [note],
        latest: note.created_at,
      });
    }

    return Array.from(map.values())
      .map((group) => ({
        ...group,
        notes: group.notes
          .slice()
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime() ||
              b.note_id - a.note_id
          ),
      }))
      .sort((a, b) => new Date(b.latest).getTime() - new Date(a.latest).getTime());
  }, [data]);

  const selectedPreviewUrl =
    selectedNote && selectedNote.file_url ? getPreviewUrl(selectedNote.file_url) : "";

  return (
    <StudentLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Notes</h1>
        </div>

        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <RefreshCw className="w-3 h-3" /> Live sync every 3 seconds
        </div>

        {isLoading && <p>Loading notes...</p>}
        {isError && <p className="text-destructive text-sm">{error.message ?? "Failed to load notes."}</p>}
        {!isLoading && !isError && grouped.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No notes uploaded yet. Notes from faculty will appear here automatically.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {grouped.map((group, index) => (
            <motion.div
              key={group.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className="glass-card rounded-2xl p-6 card-hover group"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${
                    colors[index % colors.length]
                  } flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}
                >
                  <FolderOpen className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">
                  {group.notes.length} files
                </span>
              </div>
              <h3 className="font-heading font-bold text-foreground mb-1">{group.subject}</h3>
              <p className="text-xs text-muted-foreground">{group.cls}</p>
              <p className="text-xs text-muted-foreground mb-4">
                Latest: {formatDateTime(group.latest)}
              </p>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {group.notes.map((note) => (
                  <button
                    key={note.note_id}
                    type="button"
                    onClick={() => setSelectedNote(note)}
                    className="w-full rounded-lg bg-secondary/50 p-2.5 hover:bg-secondary text-left transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{note.title}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {getFileName(note)} ·{" "}
                            {note.file_url ? getFileTypeLabel(note.file_url) : "TEXT NOTE"}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {formatDateTime(note.created_at)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <p className="text-xs text-muted-foreground mt-4">
                Click a file to open it in document view.
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      <Dialog open={Boolean(selectedNote)} onOpenChange={(open) => !open && setSelectedNote(null)}>
        <DialogContent className="max-w-5xl w-[95vw] p-0 overflow-hidden">
          {selectedNote && (
            <div className="space-y-0">
              <DialogHeader className="px-6 pt-6 pb-3 border-b">
                <DialogTitle className="pr-8">{selectedNote.title}</DialogTitle>
                <DialogDescription>
                  {selectedNote.subject} · {selectedNote.cls} · Uploaded{" "}
                  {formatDateTime(selectedNote.created_at)}
                </DialogDescription>
              </DialogHeader>

              <div className="px-6 py-4 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  {selectedNote.file_url ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          window.open(selectedNote.file_url, "_blank", "noopener,noreferrer")
                        }
                      >
                        <ExternalLink className="w-4 h-4 mr-1.5" />
                        Open in New Tab
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <a
                          href={selectedNote.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                        >
                          <Download className="w-4 h-4 mr-1.5" />
                          Download
                        </a>
                      </Button>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      This note has no file URL. Showing text content below.
                    </p>
                  )}
                </div>

                {selectedNote.file_url && (
                  <div className="rounded-xl border h-[65vh] overflow-hidden bg-secondary/20">
                    <iframe
                      src={selectedPreviewUrl}
                      title={selectedNote.title}
                      className="w-full h-full"
                    />
                  </div>
                )}

                {selectedNote.content ? (
                  <div className="rounded-xl border p-4 bg-secondary/20">
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {selectedNote.content}
                    </p>
                  </div>
                ) : !selectedNote.file_url ? (
                  <p className="text-sm text-muted-foreground">No text summary available.</p>
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </StudentLayout>
  );
};

export default StudentNotes;
