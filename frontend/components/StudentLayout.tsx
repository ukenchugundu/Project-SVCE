import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, BookOpen, FileText, Brain, BarChart3,
  User, LogOut, GraduationCap, Menu, X, ChevronRight
} from "lucide-react";

const sidebarItems = [
  { label: "My Insights", icon: LayoutDashboard, path: "/student" },
  { label: "Notes", icon: BookOpen, path: "/student/notes" },
  { label: "Assignments", icon: FileText, path: "/student/assignments" },
  { label: "Quizzes", icon: Brain, path: "/student/quizzes" },
  { label: "Results", icon: BarChart3, path: "/student/results" },
];

const StudentLayout = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 bg-sidebar border-r border-sidebar-border transition-all duration-500 ease-out flex flex-col ${sidebarOpen ? "w-64" : "w-[72px]"}`}>
        <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-heading font-bold text-sidebar-foreground text-sm">
              EduHub
            </motion.span>
          )}
        </div>

        <nav className="flex-1 py-4 space-y-1 px-3">
          {sidebarItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all duration-300 ${
                  active
                    ? "gradient-primary text-white shadow-lg shadow-primary/20 font-medium"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
                {sidebarOpen && active && <ChevronRight className="w-4 h-4 ml-auto" />}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-sidebar-border">
          <button onClick={() => navigate("/auth")} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-sidebar-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-all duration-300">
            <LogOut className="w-5 h-5 shrink-0" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <div className={`flex-1 transition-all duration-500 ${sidebarOpen ? "ml-64" : "ml-[72px]"}`}>
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 py-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2.5 rounded-xl hover:bg-secondary transition-colors">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="relative">
            <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-secondary transition-colors">
              <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-foreground hidden md:inline">Student</span>
            </button>

            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-full mt-2 w-72 glass-card rounded-2xl p-6 shadow-2xl border border-border z-50"
                >
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-3">
                      <User className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="font-heading font-bold text-foreground">John Doe</h3>
                    <p className="text-sm text-muted-foreground">21BCE7001</p>
                  </div>
                  <div className="text-sm space-y-2 text-muted-foreground">
                    <p><strong className="text-foreground">Branch:</strong> CSE</p>
                    <p><strong className="text-foreground">Year:</strong> IV</p>
                    <p><strong className="text-foreground">Section:</strong> A</p>
                    <p><strong className="text-foreground">Email:</strong> john@svce.edu.in</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        <main className="p-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default StudentLayout;
