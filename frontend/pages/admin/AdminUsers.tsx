import AdminLayout from "@/components/AdminLayout";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, RefreshCw, Search, Shield, Trash2, UserCog, Users } from "lucide-react";
import { refreshWebsiteData } from "@/lib/appRefresh";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

type ManagedRole = "student" | "faculty";
type MemberFilterRole = "all" | ManagedRole;

interface AdminMember {
  id: number;
  email: string;
  role: ManagedRole;
  fullName: string;
  rollNumber: string;
  createdAt: string;
  updatedAt: string;
}

interface AdminMembersData {
  members: AdminMember[];
  counts: {
    total: number;
    faculty: number;
    students: number;
  };
}

interface ApiErrorBody {
  error?: string;
}

const fetchJson = async <T,>(
  url: string,
  options?: RequestInit,
  fallbackError = "Request failed."
): Promise<T> => {
  const response = await fetch(url, options);
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody & T;
  if (!response.ok) {
    throw new Error(body.error || fallbackError);
  }
  return body as T;
};

const fetchAdminMembers = async (
  role: MemberFilterRole,
  search: string,
  signal?: AbortSignal
): Promise<AdminMembersData> => {
  const params = new URLSearchParams();
  params.set("role", role);
  if (search.trim()) {
    params.set("search", search.trim());
  }

  return fetchJson<AdminMembersData>(
    `${API_BASE}/api/auth/admin/members?${params.toString()}`,
    { signal },
    "Failed to load members."
  );
};

const createMemberByAdmin = async (payload: {
  role: ManagedRole;
  fullName: string;
  email: string;
  password: string;
  rollNumber: string;
}) =>
  fetchJson<{ user: unknown }>(
    `${API_BASE}/api/auth/admin/create-member`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Failed to create member."
  );

const updateMemberByAdmin = async (
  memberId: number,
  payload: {
    role: ManagedRole;
    fullName: string;
    email: string;
    rollNumber: string;
    password?: string;
  }
) =>
  fetchJson<{ member: AdminMember }>(
    `${API_BASE}/api/auth/admin/members/${memberId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Failed to update member."
  );

const deleteMemberByAdmin = async (memberId: number) =>
  fetchJson<{ deleted: AdminMember }>(
    `${API_BASE}/api/auth/admin/members/${memberId}`,
    { method: "DELETE" },
    "Failed to delete member."
  );

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString();
};

const AdminUsers = () => {
  const queryClient = useQueryClient();
  const [facultyName, setFacultyName] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [facultyEmail, setFacultyEmail] = useState("");
  const [facultyPassword, setFacultyPassword] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentRoll, setStudentRoll] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPassword, setStudentPassword] = useState("");

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isCreatingFaculty, setIsCreatingFaculty] = useState(false);
  const [isCreatingStudent, setIsCreatingStudent] = useState(false);

  const [memberFilterRole, setMemberFilterRole] = useState<MemberFilterRole>("all");
  const [memberSearch, setMemberSearch] = useState("");
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [processingMemberId, setProcessingMemberId] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState("");
  const [editForm, setEditForm] = useState({
    fullName: "",
    email: "",
    rollNumber: "",
    password: "",
  });

  const {
    data: membersData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<AdminMembersData, Error>({
    queryKey: ["admin-members-page", memberFilterRole, memberSearch.trim()],
    queryFn: ({ signal }) => fetchAdminMembers(memberFilterRole, memberSearch, signal),
    refetchInterval: 7000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: 1,
  });

  const memberRows = membersData?.members ?? [];
  const inputClass =
    "w-full rounded-xl border border-border/70 bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";

  const resetFeedback = () => {
    setMessage("");
    setErrorMessage("");
  };

  const handleSyncWebsite = async () => {
    if (isSyncing) {
      return;
    }

    resetFeedback();
    setIsSyncing(true);
    try {
      await refreshWebsiteData(queryClient);
      await refetch();
      setLastSyncedAt(new Date().toLocaleTimeString());
    } catch (syncError) {
      setErrorMessage(syncError instanceof Error ? syncError.message : "Failed to sync website data.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateFaculty = async (event: React.FormEvent) => {
    event.preventDefault();
    resetFeedback();
    setIsCreatingFaculty(true);
    try {
      await createMemberByAdmin({
        role: "faculty",
        fullName: facultyName.trim(),
        rollNumber: facultyId.trim(),
        email: facultyEmail.trim(),
        password: facultyPassword,
      });
      setMessage("Faculty account created successfully.");
      setFacultyName("");
      setFacultyId("");
      setFacultyEmail("");
      setFacultyPassword("");
      await refetch();
    } catch (createError) {
      setErrorMessage(createError instanceof Error ? createError.message : "Failed to create faculty.");
    } finally {
      setIsCreatingFaculty(false);
    }
  };

  const handleCreateStudent = async (event: React.FormEvent) => {
    event.preventDefault();
    resetFeedback();
    setIsCreatingStudent(true);
    try {
      await createMemberByAdmin({
        role: "student",
        fullName: studentName.trim(),
        rollNumber: studentRoll.trim(),
        email: studentEmail.trim(),
        password: studentPassword,
      });
      setMessage("Student account created successfully.");
      setStudentName("");
      setStudentRoll("");
      setStudentEmail("");
      setStudentPassword("");
      await refetch();
    } catch (createError) {
      setErrorMessage(createError instanceof Error ? createError.message : "Failed to create student.");
    } finally {
      setIsCreatingStudent(false);
    }
  };

  const startEdit = (member: AdminMember) => {
    resetFeedback();
    setEditingMemberId(member.id);
    setEditForm({
      fullName: member.fullName,
      email: member.email,
      rollNumber: member.rollNumber,
      password: "",
    });
  };

  const cancelEdit = () => {
    setEditingMemberId(null);
    setEditForm({ fullName: "", email: "", rollNumber: "", password: "" });
  };

  const saveEdit = async (event: React.FormEvent, member: AdminMember) => {
    event.preventDefault();
    resetFeedback();
    if (!editForm.rollNumber.trim()) {
      setErrorMessage(
        member.role === "faculty"
          ? "Faculty ID is required for faculty accounts."
          : "Roll number is required for student accounts."
      );
      return;
    }

    setProcessingMemberId(member.id);
    try {
      await updateMemberByAdmin(member.id, {
        role: member.role,
        fullName: editForm.fullName.trim(),
        email: editForm.email.trim(),
        rollNumber: editForm.rollNumber.trim(),
        password: editForm.password.trim() ? editForm.password : undefined,
      });
      setMessage("Member updated successfully.");
      setEditingMemberId(null);
      await refetch();
    } catch (updateError) {
      setErrorMessage(updateError instanceof Error ? updateError.message : "Failed to update member.");
    } finally {
      setProcessingMemberId(null);
    }
  };

  const handleDeleteMember = async (member: AdminMember) => {
    resetFeedback();
    const confirmed = window.confirm(
      `Delete ${member.role} account "${member.fullName || member.email}"?`
    );
    if (!confirmed) {
      return;
    }

    setProcessingMemberId(member.id);
    try {
      await deleteMemberByAdmin(member.id);
      setMessage("Member deleted successfully.");
      if (editingMemberId === member.id) {
        setEditingMemberId(null);
      }
      await refetch();
    } catch (deleteError) {
      setErrorMessage(deleteError instanceof Error ? deleteError.message : "Failed to delete member.");
    } finally {
      setProcessingMemberId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center">
              <UserCog className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Manage Users</h1>
          </div>
          <button
            type="button"
            onClick={handleSyncWebsite}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 rounded-xl border border-border/70 px-3 py-2 text-sm text-foreground hover:bg-secondary/50 disabled:opacity-70"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing..." : "Sync"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {lastSyncedAt ? `Last synced at ${lastSyncedAt}.` : "Sync fetches latest website updates."}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card rounded-2xl p-6">
            <h2 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-gold" /> Add Faculty
            </h2>
            <form onSubmit={handleCreateFaculty} className="space-y-3">
              <input
                type="text"
                placeholder="Faculty full name"
                className={inputClass}
                value={facultyName}
                onChange={(event) => setFacultyName(event.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Faculty ID"
                className={inputClass}
                value={facultyId}
                onChange={(event) => setFacultyId(event.target.value)}
                required
              />
              <input
                type="email"
                placeholder="Faculty email"
                className={inputClass}
                value={facultyEmail}
                onChange={(event) => setFacultyEmail(event.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Temporary password (min 6)"
                className={inputClass}
                value={facultyPassword}
                onChange={(event) => setFacultyPassword(event.target.value)}
                minLength={6}
                required
              />
              <button
                type="submit"
                disabled={isCreatingFaculty}
                className="w-full rounded-xl gradient-gold text-white py-2.5 text-sm font-medium disabled:opacity-70"
              >
                {isCreatingFaculty ? "Creating..." : "Create Faculty"}
              </button>
            </form>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h2 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" /> Add Student
            </h2>
            <form onSubmit={handleCreateStudent} className="space-y-3">
              <input
                type="text"
                placeholder="Student full name"
                className={inputClass}
                value={studentName}
                onChange={(event) => setStudentName(event.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Roll number"
                className={inputClass}
                value={studentRoll}
                onChange={(event) => setStudentRoll(event.target.value)}
                required
              />
              <input
                type="email"
                placeholder="Student email"
                className={inputClass}
                value={studentEmail}
                onChange={(event) => setStudentEmail(event.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Temporary password (min 6)"
                className={inputClass}
                value={studentPassword}
                onChange={(event) => setStudentPassword(event.target.value)}
                minLength={6}
                required
              />
              <button
                type="submit"
                disabled={isCreatingStudent}
                className="w-full rounded-xl gradient-primary text-white py-2.5 text-sm font-medium disabled:opacity-70"
              >
                {isCreatingStudent ? "Creating..." : "Create Student"}
              </button>
            </form>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "faculty", "student"] as MemberFilterRole[]).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setMemberFilterRole(role)}
                className={`rounded-xl px-3 py-1.5 text-sm font-medium ${
                  memberFilterRole === role
                    ? "bg-primary text-white"
                    : "bg-secondary text-foreground hover:bg-secondary/70"
                }`}
              >
                {role === "all" ? "All Members" : role === "faculty" ? "Faculty" : "Students"}
              </button>
            ))}
            <div className="relative ml-auto min-w-[220px] flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                value={memberSearch}
                onChange={(event) => setMemberSearch(event.target.value)}
                className="w-full rounded-xl border border-border/70 bg-background/60 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Search by name, email, roll no, or faculty ID"
              />
            </div>
          </div>

          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Total: {membersData?.counts.total ?? 0}</span>
            <span>Faculty: {membersData?.counts.faculty ?? 0}</span>
            <span>Students: {membersData?.counts.students ?? 0}</span>
          </div>

          {isError ? (
            <p className="text-sm text-destructive">{error?.message ?? "Failed to load members."}</p>
          ) : null}
          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          {message ? <p className="text-sm text-accent">{message}</p> : null}
          {isLoading ? <p className="text-sm text-muted-foreground">Loading members...</p> : null}

          {!isLoading && memberRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members found for this filter.</p>
          ) : null}

          <div className="space-y-3">
            {memberRows.map((member) => {
              const isEditing = editingMemberId === member.id;
              const isProcessing = processingMemberId === member.id;

              if (isEditing) {
                return (
                  <form
                    key={member.id}
                    onSubmit={(event) => saveEdit(event, member)}
                    className="rounded-xl border border-border/70 bg-secondary/30 p-4 space-y-3"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={editForm.fullName}
                        onChange={(event) =>
                          setEditForm((previous) => ({ ...previous, fullName: event.target.value }))
                        }
                        className={inputClass}
                        placeholder="Full name"
                        required
                      />
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(event) =>
                          setEditForm((previous) => ({ ...previous, email: event.target.value }))
                        }
                        className={inputClass}
                        placeholder="Email"
                        required
                      />
                      <input
                        type="text"
                        value={editForm.rollNumber}
                        onChange={(event) =>
                          setEditForm((previous) => ({
                            ...previous,
                            rollNumber: event.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder={member.role === "faculty" ? "Faculty ID" : "Roll number"}
                        required
                      />
                      <input
                        type="password"
                        value={editForm.password}
                        onChange={(event) =>
                          setEditForm((previous) => ({ ...previous, password: event.target.value }))
                        }
                        className={inputClass}
                        placeholder="New password (optional)"
                        minLength={6}
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded-xl px-3 py-2 text-sm bg-secondary text-foreground hover:bg-secondary/70"
                        disabled={isProcessing}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="rounded-xl px-3 py-2 text-sm gradient-primary text-white disabled:opacity-70"
                        disabled={isProcessing}
                      >
                        {isProcessing ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </form>
                );
              }

              return (
                <div key={member.id} className="rounded-xl border border-border/70 bg-secondary/30 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{member.fullName || member.email}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{member.email}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                            member.role === "faculty"
                              ? "bg-accent/15 text-accent"
                              : "bg-primary/15 text-primary"
                          }`}
                        >
                          {member.role === "faculty" ? "Faculty" : "Student"}
                        </span>
                        <span className="text-muted-foreground">
                          {member.role === "faculty" ? "Faculty ID" : "Roll No"}: {member.rollNumber || "-"}
                        </span>
                        <span className="text-muted-foreground">Created: {formatDateTime(member.createdAt)}</span>
                        <span className="text-muted-foreground">Updated: {formatDateTime(member.updatedAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(member)}
                        className="rounded-xl px-3 py-2 text-xs bg-secondary text-foreground hover:bg-secondary/70"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMember(member)}
                        className="rounded-xl px-3 py-2 text-xs bg-destructive/15 text-destructive hover:bg-destructive/25 inline-flex items-center gap-1"
                        disabled={isProcessing}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {isProcessing ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminUsers;
