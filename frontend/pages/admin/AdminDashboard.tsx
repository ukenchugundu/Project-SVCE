import AdminLayout from "@/components/AdminLayout";
import { motion } from "framer-motion";
import {
  Activity,
  BookOpen,
  GraduationCap,
  RefreshCw,
  Shield,
  Users,
  Zap,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { refreshWebsiteData } from "@/lib/appRefresh";

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

interface ApiErrorBody {
  error?: string;
}

const fetchDashboardData = async (signal?: AbortSignal): Promise<AdminDashboardData> => {
  const response = await fetch(`${API_BASE}/api/auth/admin/dashboard`, { signal });
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody & AdminDashboardData;
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
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState("");

  const {
    data: dashboardData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<AdminDashboardData, Error>({
    queryKey: ["admin-dashboard-data"],
    queryFn: ({ signal }) => fetchDashboardData(signal),
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: 1,
  });

  const handleRefreshWebsite = async () => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    try {
      await refreshWebsiteData(queryClient);
      await refetch();
      setLastSyncedAt(new Date().toLocaleTimeString());
    } finally {
      setIsRefreshing(false);
    }
  };

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefreshWebsite}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-border/70 px-3 py-2 text-sm text-foreground hover:bg-secondary/50 disabled:opacity-70"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {lastSyncedAt
            ? `Last synced at ${lastSyncedAt}.`
            : "Refresh pulls latest updates across the website."}
        </p>

        {isError ? (
          <div className="glass-card rounded-2xl p-4">
            <p className="text-sm text-destructive">
              {error?.message ?? "Failed to load dashboard data."}
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className="glass-card rounded-2xl p-5 card-hover"
            >
              <div
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center mb-3`}
              >
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-3xl font-heading font-bold text-foreground">
                {isLoading ? "..." : stat.value}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                <span className="font-semibold text-foreground">
                  {dashboard.facultyOverview.pendingQuizReviews}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pending Assignment Reviews</span>
                <span className="font-semibold text-foreground">
                  {dashboard.facultyOverview.pendingAssignmentReviews}
                </span>
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
                <span className="font-semibold text-foreground">
                  {dashboard.studentOverview.recentRegistrations7d}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Quiz Participants</span>
                <span className="font-semibold text-foreground">{dashboard.studentOverview.quizParticipants}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Assignment Submitters</span>
                <span className="font-semibold text-foreground">
                  {dashboard.studentOverview.assignmentSubmitters}
                </span>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h2 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-accent" /> Platform Activity
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Quizzes</span>
                <span className="font-semibold text-foreground">{dashboard.metrics.quizzesCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Assignments</span>
                <span className="font-semibold text-foreground">{dashboard.metrics.assignmentsCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Notes</span>
                <span className="font-semibold text-foreground">{dashboard.metrics.notesCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pending Quiz Review</span>
                <span className="font-semibold text-foreground">{dashboard.metrics.pendingQuizReviews}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pending Assignment Review</span>
                <span className="font-semibold text-foreground">
                  {dashboard.metrics.pendingAssignmentReviews}
                </span>
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
              <GraduationCap className="w-5 h-5 text-primary" /> Recent Student Members
            </h2>
            <div className="space-y-3">
              {dashboard.studentOverview.recentlyAdded.length === 0 ? (
                <p className="text-sm text-muted-foreground">No student accounts yet.</p>
              ) : (
                dashboard.studentOverview.recentlyAdded.map((member) => (
                  <div key={member.id} className="rounded-xl bg-secondary/40 p-3">
                    <p className="text-sm font-medium text-foreground">{member.fullName || member.email}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">Roll No: {member.rollNumber || "-"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Added: {formatDateTime(member.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
