import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, ShieldCheck, BookOpenCheck, UserCog, Eye, EyeOff, ArrowLeft, Sparkles } from "lucide-react";

type Role = "student" | "faculty" | "admin";

const roleConfig = {
  student: { label: "Student", icon: GraduationCap, gradient: "from-primary to-primary/70", redirect: "/student" },
  faculty: { label: "Faculty", icon: BookOpenCheck, gradient: "from-accent to-accent/70", redirect: "/faculty" },
  admin: { label: "Admin", icon: UserCog, gradient: "from-gold to-gold/70", redirect: "/admin" },
};

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const STUDENT_ID_STORAGE_KEY = "eduhub_student_id";

interface AuthApiUser {
  id: number;
  email: string;
  role: Role;
  fullName: string;
  rollNumber: string;
  studentId: string;
}

interface AuthApiResponse {
  user: AuthApiUser;
  error?: string;
}

const postJson = async <T,>(path: string, payload: Record<string, unknown>): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message =
      (typeof data.error === "string" && data.error) ||
      "Request failed. Please try again.";
    throw new Error(message);
  }

  return data as T;
};

const Auth = () => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupRoll, setSignupRoll] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) {
      return;
    }

    setAuthError("");
    setAuthMessage("");
    setIsSubmitting(true);
    try {
      const auth = await postJson<AuthApiResponse>("/api/auth/login", {
        role: selectedRole,
        email: loginEmail.trim(),
        password: loginPassword,
      });

      if (!auth.user) {
        throw new Error("Invalid login response from server.");
      }

      localStorage.setItem(
        "eduhub_auth",
        JSON.stringify({
          userId: auth.user.id,
          email: auth.user.email,
          fullName: auth.user.fullName,
          role: auth.user.role,
        })
      );
      if (auth.user.role === "student") {
        localStorage.setItem(STUDENT_ID_STORAGE_KEY, auth.user.studentId || auth.user.email);
      }
      navigate(roleConfig[selectedRole].redirect);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthMessage("");
    setAuthMessage(
      "Forgot password flow is not enabled yet. Please contact admin to reset your account."
    );
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthMessage("");
    setIsSubmitting(true);
    try {
      const auth = await postJson<AuthApiResponse>("/api/auth/register", {
        role: "student",
        email: signupEmail.trim(),
        password: signupPassword,
        fullName: signupName.trim(),
        rollNumber: signupRoll.trim(),
      });

      if (!auth.user) {
        throw new Error("Invalid registration response from server.");
      }

      localStorage.setItem(
        "eduhub_auth",
        JSON.stringify({
          userId: auth.user.id,
          email: auth.user.email,
          fullName: auth.user.fullName,
          role: auth.user.role,
        })
      );
      localStorage.setItem(STUDENT_ID_STORAGE_KEY, auth.user.studentId || auth.user.email);
      navigate("/student");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Account creation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetView = () => {
    setIsCreatingAccount(false);
    setIsForgotPassword(false);
    setAuthError("");
    setAuthMessage("");
  };

  const inputClass = "w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-300";

  return (
    <div className="min-h-screen gradient-dark relative flex items-center justify-center px-4 py-8 overflow-hidden">
      {/* Background orbs */}
      <div className="floating-orb w-[500px] h-[500px] bg-primary -top-40 -right-40" />
      <div className="floating-orb w-[400px] h-[400px] bg-accent -bottom-20 -left-20" style={{ animationDelay: "4s" }} />
      <div className="floating-orb w-[300px] h-[300px] bg-gold top-1/2 left-1/2" style={{ animationDelay: "2s" }} />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
            className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30"
          >
            <GraduationCap className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="font-heading text-3xl font-bold text-white">EduHub</h1>
          <p className="text-white/40 text-sm mt-1">A Learning Platform</p>
        </div>

        <AnimatePresence mode="wait">
          {/* Role selection */}
          {!selectedRole && (
            <motion.div key="roles" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-3">
              <p className="text-center text-white/60 mb-6 font-medium text-sm">Select your role to continue</p>
              {(Object.keys(roleConfig) as Role[]).map((role, i) => {
                const config = roleConfig[role];
                return (
                  <motion.button
                    key={role}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    onClick={() => { setSelectedRole(role); resetView(); }}
                    className="w-full glass-dark rounded-2xl p-5 flex items-center gap-4 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 text-left group"
                  >
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                      <config.icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-heading font-semibold text-white text-lg">{config.label}</p>
                      <p className="text-xs text-white/40">Login as {config.label.toLowerCase()}</p>
                    </div>
                    <Sparkles className="w-4 h-4 text-white/20 group-hover:text-primary transition-colors" />
                  </motion.button>
                );
              })}
              <button onClick={() => navigate("/")} className="w-full text-center text-white/30 text-sm mt-6 hover:text-primary transition-colors flex items-center justify-center gap-1.5">
                <ArrowLeft className="w-4 h-4" /> Back to Home
              </button>
            </motion.div>
          )}

          {/* Login Form */}
          {selectedRole && !isCreatingAccount && !isForgotPassword && (
            <motion.div key="login" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="glass-dark rounded-2xl p-8"
            >
              <div className="flex items-center gap-3 mb-8">
                <button onClick={() => setSelectedRole(null)} className="text-white/40 hover:text-primary transition-colors">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="font-heading text-xl font-bold text-white">{roleConfig[selectedRole].label} Login</h2>
                <ShieldCheck className="w-5 h-5 text-primary ml-auto" />
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                {authError ? <p className="text-sm text-destructive">{authError}</p> : null}
                {authMessage ? <p className="text-sm text-emerald-400">{authMessage}</p> : null}
                <div>
                  <label className="text-sm text-white/50 mb-2 block font-medium">Email</label>
                  <input
                    type="email"
                    placeholder="Enter your email"
                    className={inputClass}
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-white/50 mb-2 block font-medium">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter password"
                      className={`${inputClass} pr-12`}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-primary transition-colors">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-xl gradient-primary text-white font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Signing in..." : "Login"}
                </button>
                <div className="flex items-center justify-between text-sm">
                  <button type="button" onClick={() => setIsForgotPassword(true)} className="text-primary hover:underline">Forgot Password?</button>
                  {selectedRole === "student" && (
                    <button type="button" onClick={() => setIsCreatingAccount(true)} className="text-white/40 hover:text-primary transition-colors">Create Account</button>
                  )}
                </div>
              </form>
            </motion.div>
          )}

          {/* Forgot Password */}
          {selectedRole && isForgotPassword && (
            <motion.div key="forgot" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="glass-dark rounded-2xl p-8"
            >
              <div className="flex items-center gap-3 mb-8">
                <button onClick={() => setIsForgotPassword(false)} className="text-white/40 hover:text-primary transition-colors"><ArrowLeft className="w-5 h-5" /></button>
                <h2 className="font-heading text-xl font-bold text-white">Reset Password</h2>
              </div>
              <form className="space-y-5" onSubmit={handleForgotPassword}>
                {authError ? <p className="text-sm text-destructive">{authError}</p> : null}
                {authMessage ? <p className="text-sm text-emerald-400">{authMessage}</p> : null}
                <div>
                  <label className="text-sm text-white/50 mb-2 block font-medium">Email</label>
                  <input
                    type="email"
                    placeholder="Enter your registered email"
                    className={inputClass}
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-xl gradient-primary text-white font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
            </motion.div>
          )}

          {/* Create Account */}
          {selectedRole === "student" && isCreatingAccount && (
            <motion.div key="create" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="glass-dark rounded-2xl p-8"
            >
              <div className="flex items-center gap-3 mb-8">
                <button onClick={() => setIsCreatingAccount(false)} className="text-white/40 hover:text-primary transition-colors"><ArrowLeft className="w-5 h-5" /></button>
                <h2 className="font-heading text-xl font-bold text-white">Create Account</h2>
              </div>
              <form className="space-y-4" onSubmit={handleCreateAccount}>
                {authError ? <p className="text-sm text-destructive">{authError}</p> : null}
                {authMessage ? <p className="text-sm text-emerald-400">{authMessage}</p> : null}
                <div>
                  <label className="text-sm text-white/50 mb-2 block font-medium">Full Name</label>
                  <input
                    type="text"
                    placeholder="Enter full name"
                    className={inputClass}
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-white/50 mb-2 block font-medium">Roll Number</label>
                  <input
                    type="text"
                    placeholder="Enter roll number"
                    className={inputClass}
                    value={signupRoll}
                    onChange={(e) => setSignupRoll(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-white/50 mb-2 block font-medium">Email</label>
                  <input
                    type="email"
                    placeholder="Enter email"
                    className={inputClass}
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-white/50 mb-2 block font-medium">Password</label>
                  <input
                    type="password"
                    placeholder="Create password"
                    className={inputClass}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-xl gradient-primary text-white font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Creating..." : "Create Account"}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default Auth;
