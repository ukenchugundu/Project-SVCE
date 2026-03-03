import AdminLayout from "@/components/AdminLayout";
import { motion } from "framer-motion";
import { Users, GraduationCap, BookOpen, Activity, Shield, Settings, Zap } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

type MemberRole = "student" | "faculty" | "admin";

interface DashboardMember {
  id: number;
  email: string;
  role: MemberRole;
  fullName: string;
  rollNumber: string;
  createdAt: string;
}

interface AdminDashboardData {
  metrics: {
    totalMembers: number;
    totalStudents: number;
    totalFaculty: number;
    totalAdmins: number;
    quizzesCount: number;
    assignmentsCount: number;
    notesCount: number;
    pendingQuizReviews: number;
    pendingAssignmentReviews: number;
  };
  facultyOverview: {
    total: number;
    pendingQuizReviews: number;
    pendingAssignmentReviews: number;
    recentlyAdded: DashboardMember[];
  };
  studentOverview: {
    total: number;
    recentRegistrations7d: number;
    quizParticipants: number;
    assignmentSubmitters: number;
    recentlyAdded: DashboardMember[];
  };
  recentMembers: DashboardMember[];
}

const fetchDashboardData = async (signal?: AbortSignal): Promise<AdminDashboardData> => {
  const response = await fetch(`${API_BASE}/api/auth/admin/dashboard`, { signal });
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(body.error || "Failed to load admin dashboard data.");
  }
  return body as AdminDashboardData;
};

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString();
};

const AdminDashboard = () => {
  const [facultyName, setFacultyName] = useState("");
  const [facultyEmail, setFacultyEmail] = useState("");
  const [facultyPassword, setFacultyPassword] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentRoll, setStudentRoll] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [facultyMessage, setFacultyMessage] = useState("");
  const [studentMessage, setStudentMessage] = useState("");
  const [facultyError, setFacultyError] = useState("");
  const [studentError, setStudentError] = useState("");
  const [isFacultySubmitting, setIsFacultySubmitting] = useState(false);
  const [isStudentSubmitting, setIsStudentSubmitting] = useState(false);

  const {
    data: dashboardData,
    isLoading: isDashboardLoading,
    isError: isDashboardError,
    error: dashboardError,
    refetch: refetchDashboard,
  } = useQuery<AdminDashboardData, Error>({
    queryKey: ["admin-dashboard-data"],
    queryFn: ({ signal }) => fetchDashboardData(signal),
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: 1,
  });

  const dashboard: AdminDashboardData = dashboardData ?? {
    metrics: {
      totalMembers: 0,
      totalStudents: 0,
      totalFaculty: 0,
      totalAdmins: 0,
      quizzesCount: 0,
      assignmentsCount: 0,
      notesCount: 0,
      pendingQuizReviews: 0,
      pendingAssignmentReviews: 0,
    },
    facultyOverview: {
      total: 0,
      pendingQuizReviews: 0,
      pendingAssignmentReviews: 0,
      recentlyAdded: [],
    },
    studentOverview: {
      total: 0,
      recentRegistrations7d: 0,
      quizParticipants: 0,
      assignmentSubmitters: 0,
      recentlyAdded: [],
    },
    recentMembers: [],
  };

  const createMember = async (payload: {
    role: "faculty" | "student";
    fullName: string;
    email: string;
    password: string;
    rollNumber?: string;
  }) => {
    const response = await fetch(`${API_BASE}/api/auth/admin/create-member`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      throw new Error(data.error || "Failed to create member.");
    }
  };

  const handleCreateFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    setFacultyError("");
    setFacultyMessage("");
    setIsFacultySubmitting(true);
    try {
      await createMember({
        role: "faculty",
        fullName: facultyName.trim(),
        email: facultyEmail.trim(),
        password: facultyPassword,
      });
      setFacultyMessage("Faculty account created successfully.");
      setFacultyName("");
      setFacultyEmail("");
      setFacultyPassword("");
      refetchDashboard();
    } catch (error) {
      setFacultyError(error instanceof Error ? error.message : "Failed to create faculty.");
    } finally {
      setIsFacultySubmitting(false);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentError("");
    setStudentMessage("");
    setIsStudentSubmitting(true);
    try {
      await createMember({
        role: "student",
        fullName: studentName.trim(),
        rollNumber: studentRoll.trim(),
        email: studentEmail.trim(),
        password: studentPassword,
      });
      setStudentMessage("Student account created successfully.");
      setStudentName("");
      setStudentRoll("");
      setStudentEmail("");
      setStudentPassword("");
      refetchDashboard();
    } catch (error) {
      setStudentError(error instanceof Error ? error.message : "Failed to create student.");
    } finally {
      setIsStudentSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-border/70 bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";

  const statCards = [
    {
      label: "Total Students",
      value: dashboard.metrics.totalStudents,
      icon: GraduationCap,
      gradient: "from-primary to-primary/60",
    },
    {
      label: "Total Faculty",
      value: dashboard.metrics.totalFaculty,
      icon: Users,
      gradient: "from-accent to-accent/60",
    },
    {
      label: "Admins",
      value: dashboard.metrics.totalAdmins,
      icon: Shield,
      gradient: "from-gold to-gold/60",
    },
    {
      label: "Members Total",
      value: dashboard.metrics.totalMembers,
      icon: Activity,
      gradient: "from-destructive to-destructive/60",
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Admin Dashboard</h1>
        </div>

        {isDashboardError ? (
          <div className="glass-card rounded-2xl p-4">
            <p className="text-sm text-destructive">
              {dashboardError?.message ?? "Failed to load dashboard data."}
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-card rounded-2xl p-5 card-hover">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center mb-3`}>
                <s.icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-3xl font-heading font-bold text-foreground">
                {isDashboardLoading ? "..." : s.value}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card rounded-2xl p-6">
            <h2 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-gold" /> Faculty Overview
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Faculty Accounts</span>
                <span className="font-semibold text-foreground">{dashboard.facultyOverview.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pending Quiz Reviews</span>
                <span className="font-semibold text-foreground">{dashboard.facultyOverview.pendingQuizReviews}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pending Assignment Reviews</span>
                <span className="font-semibold text-foreground">{dashboard.facultyOverview.pendingAssignmentReviews}</span>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h2 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" /> Student Overview
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Student Accounts</span>
                <span className="font-semibold text-foreground">{dashboard.studentOverview.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">New Registrations (7 days)</span>
                <span className="font-semibold text-foreground">{dashboard.studentOverview.recentRegistrations7d}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Quiz Participants</span>
                <span className="font-semibold text-foreground">{dashboard.studentOverview.quizParticipants}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Assignment Submitters</span>
                <span className="font-semibold text-foreground">{dashboard.studentOverview.assignmentSubmitters}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card rounded-2xl p-6">
            <h2 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-accent" /> Recent Faculty Members
            </h2>
            <div className="space-y-3">
              {dashboard.facultyOverview.recentlyAdded.length === 0 ? (
                <p className="text-sm text-muted-foreground">No faculty accounts yet.</p>
              ) : (
                dashboard.facultyOverview.recentlyAdded.map((member) => (
                  <div key={member.id} className="rounded-xl bg-secondary/40 p-3">
                    <p className="text-sm font-medium text-foreground">{member.fullName || member.email}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Added: {formatDateTime(member.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h2 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" /> Recent Student Members
            </h2>
            <div className="space-y-3">
              {dashboard.studentOverview.recentlyAdded.length === 0 ? (
                <p className="text-sm text-muted-foreground">No student accounts yet.</p>
              ) : (
                dashboard.studentOverview.recentlyAdded.map((member) => (
                  <div key={member.id} className="rounded-xl bg-secondary/40 p-3">
                    <p className="text-sm font-medium text-foreground">{member.fullName || member.email}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Roll: {member.rollNumber || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Added: {formatDateTime(member.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card rounded-2xl p-6">
            <h2 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-gold" /> Add Faculty
            </h2>
            <form onSubmit={handleCreateFaculty} className="space-y-3">
              {facultyError ? <p className="text-sm text-destructive">{facultyError}</p> : null}
              {facultyMessage ? <p className="text-sm text-accent">{facultyMessage}</p> : null}
              <input
                type="text"
                placeholder="Faculty full name"
                className={inputClass}
                value={facultyName}
                onChange={(e) => setFacultyName(e.target.value)}
                required
              />
              <input
                type="email"
                placeholder="Faculty email"
                className={inputClass}
                value={facultyEmail}
                onChange={(e) => setFacultyEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Temporary password (min 6)"
                className={inputClass}
                value={facultyPassword}
                onChange={(e) => setFacultyPassword(e.target.value)}
                minLength={6}
                required
              />
              <button
                type="submit"
                disabled={isFacultySubmitting}
                className="w-full rounded-xl gradient-gold text-white py-2.5 text-sm font-medium disabled:opacity-70"
              >
                {isFacultySubmitting ? "Creating..." : "Create Faculty"}
              </button>
            </form>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h2 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-gold" /> Add Student
            </h2>
            <form onSubmit={handleCreateStudent} className="space-y-3">
              {studentError ? <p className="text-sm text-destructive">{studentError}</p> : null}
              {studentMessage ? <p className="text-sm text-accent">{studentMessage}</p> : null}
              <input
                type="text"
                placeholder="Student full name"
                className={inputClass}
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Roll number"
                className={inputClass}
                value={studentRoll}
                onChange={(e) => setStudentRoll(e.target.value)}
                required
              />
              <input
                type="email"
                placeholder="Student email"
                className={inputClass}
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Temporary password (min 6)"
                className={inputClass}
                value={studentPassword}
                onChange={(e) => setStudentPassword(e.target.value)}
                minLength={6}
                required
              />
              <button
                type="submit"
                disabled={isStudentSubmitting}
                className="w-full rounded-xl gradient-primary text-white py-2.5 text-sm font-medium disabled:opacity-70"
              >
                {isStudentSubmitting ? "Creating..." : "Create Student"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
