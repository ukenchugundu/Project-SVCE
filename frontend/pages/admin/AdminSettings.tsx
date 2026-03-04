import AdminLayout from "@/components/AdminLayout";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BellRing,
  Lock,
  Mail,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { refreshWebsiteData } from "@/lib/appRefresh";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const SETTINGS_STORAGE_KEY = "eduhub_admin_settings_v1";

interface AdminDashboardData {
  metrics: {
    quizzesCount: number;
    assignmentsCount: number;
    notesCount: number;
    pendingQuizReviews: number;
    pendingAssignmentReviews: number;
  };
}

interface AdminAppSettings {
  enforceOtpLogin: boolean;
  allowPasswordResetEmail: boolean;
  autoCloseQuizAttempts: boolean;
  requireFacultyScorePublish: boolean;
  notifyOnNewSubmission: boolean;
  maintenanceMode: boolean;
  supportEmail: string;
  defaultQuizDurationMins: number;
}

interface ApiErrorBody {
  error?: string;
}

const defaultSettings: AdminAppSettings = {
  enforceOtpLogin: true,
  allowPasswordResetEmail: true,
  autoCloseQuizAttempts: true,
  requireFacultyScorePublish: true,
  notifyOnNewSubmission: true,
  maintenanceMode: false,
  supportEmail: "support@eduhub.local",
  defaultQuizDurationMins: 30,
};

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

const fetchDashboardData = async (signal?: AbortSignal): Promise<AdminDashboardData> =>
  fetchJson<AdminDashboardData>(
    `${API_BASE}/api/auth/admin/dashboard`,
    { signal },
    "Failed to load system snapshot."
  );

const readStoredSettings = (): AdminAppSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return defaultSettings;
    }
    const parsed = JSON.parse(raw) as Partial<AdminAppSettings>;
    return {
      enforceOtpLogin: Boolean(parsed.enforceOtpLogin ?? defaultSettings.enforceOtpLogin),
      allowPasswordResetEmail: Boolean(
        parsed.allowPasswordResetEmail ?? defaultSettings.allowPasswordResetEmail
      ),
      autoCloseQuizAttempts: Boolean(
        parsed.autoCloseQuizAttempts ?? defaultSettings.autoCloseQuizAttempts
      ),
      requireFacultyScorePublish: Boolean(
        parsed.requireFacultyScorePublish ?? defaultSettings.requireFacultyScorePublish
      ),
      notifyOnNewSubmission: Boolean(
        parsed.notifyOnNewSubmission ?? defaultSettings.notifyOnNewSubmission
      ),
      maintenanceMode: Boolean(parsed.maintenanceMode ?? defaultSettings.maintenanceMode),
      supportEmail: String(parsed.supportEmail ?? defaultSettings.supportEmail).trim(),
      defaultQuizDurationMins: Number(
        parsed.defaultQuizDurationMins ?? defaultSettings.defaultQuizDurationMins
      ),
    };
  } catch {
    return defaultSettings;
  }
};

const AdminSettings = () => {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<AdminAppSettings>(() => readStoredSettings());
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState("");

  const { data, isLoading, isError, error, refetch } = useQuery<AdminDashboardData, Error>({
    queryKey: ["admin-settings-snapshot"],
    queryFn: ({ signal }) => fetchDashboardData(signal),
    refetchInterval: 12000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: 1,
  });

  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const systemStats = useMemo(
    () =>
      data?.metrics ?? {
        quizzesCount: 0,
        assignmentsCount: 0,
        notesCount: 0,
        pendingQuizReviews: 0,
        pendingAssignmentReviews: 0,
      },
    [data]
  );

  const updateSetting = <K extends keyof AdminAppSettings>(key: K, value: AdminAppSettings[K]) => {
    setSaveMessage("");
    setSaveError("");
    setSettings((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const handleSaveSettings = () => {
    setSaveError("");
    if (!settings.supportEmail.trim() || !settings.supportEmail.includes("@")) {
      setSaveMessage("");
      setSaveError("Support email must be a valid email address.");
      return;
    }
    if (settings.defaultQuizDurationMins < 5 || settings.defaultQuizDurationMins > 240) {
      setSaveMessage("");
      setSaveError("Default quiz duration must be between 5 and 240 minutes.");
      return;
    }
    setSaveMessage("Settings saved for this admin session.");
  };

  const handleResetDefaults = () => {
    setSettings(defaultSettings);
    setSaveError("");
    setSaveMessage("Settings reset to defaults.");
  };

  const handleRefreshWebsite = async () => {
    if (isRefreshing) {
      return;
    }

    setSaveMessage("");
    setSaveError("");
    setIsRefreshing(true);
    try {
      await refreshWebsiteData(queryClient);
      await refetch();
      setLastSyncedAt(new Date().toLocaleTimeString());
    } catch (refreshError) {
      setSaveError(
        refreshError instanceof Error ? refreshError.message : "Failed to refresh website data."
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const checkboxClass =
    "h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary/40";

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center">
              <Settings2 className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Admin Settings</h1>
          </div>
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
        <p className="text-xs text-muted-foreground">
          {lastSyncedAt
            ? `Last synced at ${lastSyncedAt}.`
            : "Refresh pulls latest updates across the website."}
        </p>

        {isError ? (
          <p className="text-sm text-destructive">{error?.message ?? "Failed to load settings snapshot."}</p>
        ) : null}
        {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
        {saveMessage ? <p className="text-sm text-accent">{saveMessage}</p> : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-card rounded-2xl p-6">
            <h2 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-gold" /> Security & Access
            </h2>
            <div className="space-y-3 text-sm">
              <label className="flex items-start gap-3">
                <input
                  className={checkboxClass}
                  type="checkbox"
                  checked={settings.enforceOtpLogin}
                  onChange={(event) => updateSetting("enforceOtpLogin", event.target.checked)}
                />
                <span>
                  <span className="font-medium text-foreground">Enforce OTP login</span>
                  <span className="block text-muted-foreground">Require OTP step for all roles.</span>
                </span>
              </label>
              <label className="flex items-start gap-3">
                <input
                  className={checkboxClass}
                  type="checkbox"
                  checked={settings.allowPasswordResetEmail}
                  onChange={(event) => updateSetting("allowPasswordResetEmail", event.target.checked)}
                />
                <span>
                  <span className="font-medium text-foreground">Allow password-reset email</span>
                  <span className="block text-muted-foreground">Keep reset-link flow active.</span>
                </span>
              </label>
              <label className="flex items-start gap-3">
                <input
                  className={checkboxClass}
                  type="checkbox"
                  checked={settings.maintenanceMode}
                  onChange={(event) => updateSetting("maintenanceMode", event.target.checked)}
                />
                <span>
                  <span className="font-medium text-foreground">Maintenance mode</span>
                  <span className="block text-muted-foreground">Mark platform for maintenance window.</span>
                </span>
              </label>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h2 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" /> Academic Workflow
            </h2>
            <div className="space-y-3 text-sm">
              <label className="flex items-start gap-3">
                <input
                  className={checkboxClass}
                  type="checkbox"
                  checked={settings.autoCloseQuizAttempts}
                  onChange={(event) => updateSetting("autoCloseQuizAttempts", event.target.checked)}
                />
                <span>
                  <span className="font-medium text-foreground">Auto-close quiz attempts</span>
                  <span className="block text-muted-foreground">Close attempts after submit/time-over.</span>
                </span>
              </label>
              <label className="flex items-start gap-3">
                <input
                  className={checkboxClass}
                  type="checkbox"
                  checked={settings.requireFacultyScorePublish}
                  onChange={(event) =>
                    updateSetting("requireFacultyScorePublish", event.target.checked)
                  }
                />
                <span>
                  <span className="font-medium text-foreground">Manual faculty score publish</span>
                  <span className="block text-muted-foreground">Publish student-visible scores after review.</span>
                </span>
              </label>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Default Quiz Duration (minutes)</label>
                <input
                  type="number"
                  min={5}
                  max={240}
                  value={settings.defaultQuizDurationMins}
                  onChange={(event) =>
                    updateSetting("defaultQuizDurationMins", Number(event.target.value || 0))
                  }
                  className="w-full rounded-xl border border-border/70 bg-background/60 px-3 py-2 text-sm text-foreground"
                />
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h2 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-accent" /> Communication
            </h2>
            <div className="space-y-3 text-sm">
              <label className="flex items-start gap-3">
                <input
                  className={checkboxClass}
                  type="checkbox"
                  checked={settings.notifyOnNewSubmission}
                  onChange={(event) => updateSetting("notifyOnNewSubmission", event.target.checked)}
                />
                <span>
                  <span className="font-medium text-foreground">Notify on submissions</span>
                  <span className="block text-muted-foreground">Alert faculty for new attempts/submissions.</span>
                </span>
              </label>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Support Email</label>
                <input
                  type="email"
                  value={settings.supportEmail}
                  onChange={(event) => updateSetting("supportEmail", event.target.value)}
                  className="w-full rounded-xl border border-border/70 bg-background/60 px-3 py-2 text-sm text-foreground"
                  placeholder="support@eduhub.local"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h2 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-gold" /> Live System Snapshot
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
            <div className="rounded-xl bg-secondary/40 p-3">
              <p className="text-xs text-muted-foreground">Quizzes</p>
              <p className="text-xl font-bold text-foreground">{isLoading ? "..." : systemStats.quizzesCount}</p>
            </div>
            <div className="rounded-xl bg-secondary/40 p-3">
              <p className="text-xs text-muted-foreground">Assignments</p>
              <p className="text-xl font-bold text-foreground">{isLoading ? "..." : systemStats.assignmentsCount}</p>
            </div>
            <div className="rounded-xl bg-secondary/40 p-3">
              <p className="text-xs text-muted-foreground">Notes</p>
              <p className="text-xl font-bold text-foreground">{isLoading ? "..." : systemStats.notesCount}</p>
            </div>
            <div className="rounded-xl bg-secondary/40 p-3">
              <p className="text-xs text-muted-foreground">Pending Quiz Reviews</p>
              <p className="text-xl font-bold text-foreground">
                {isLoading ? "..." : systemStats.pendingQuizReviews}
              </p>
            </div>
            <div className="rounded-xl bg-secondary/40 p-3">
              <p className="text-xs text-muted-foreground">Pending Assignment Reviews</p>
              <p className="text-xl font-bold text-foreground">
                {isLoading ? "..." : systemStats.pendingAssignmentReviews}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSaveSettings}
            className="inline-flex items-center gap-2 rounded-xl gradient-gold text-white px-4 py-2 text-sm font-medium"
          >
            <Save className="w-4 h-4" /> Save Settings
          </button>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-2 rounded-xl bg-secondary text-foreground px-4 py-2 text-sm font-medium hover:bg-secondary/70"
          >
            <BellRing className="w-4 h-4" /> Reset Defaults
          </button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
