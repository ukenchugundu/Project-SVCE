import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Brain, BookOpen, ClipboardCheck, BarChart3, FileText,
  LogOut, GraduationCap, Menu, X, User, ChevronRight
} from "lucide-react";
import { Toaster } from "./ui/sonner";

const sidebarItems = [
  { label: "Command Center", icon: LayoutDashboard, path: "/faculty" },
  { label: "Student Roster", icon: Users, path: "/faculty/roster" },
  { label: "Quizzes", icon: Brain, path: "/faculty/quizzes" },
  { label: "Assignments", icon: FileText, path: "/faculty/assignments" },
  { label: "Results", icon: BarChart3, path: "/faculty/results" },
  { label: "Notes", icon: BookOpen, path: "/faculty/notes" },
  { label: "Attendance", icon: ClipboardCheck, path: "/faculty/attendance" },
];

const FacultyLayout = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen flex bg-background">
      <aside className={`fixed inset-y-0 left-0 z-40 bg-sidebar border-r border-sidebar-border transition-all duration-500 flex flex-col ${sidebarOpen ? "w-64" : "w-[72px]"}`}>
        <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-xl gradient-accent flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && <span className="font-heading font-bold text-sidebar-foreground text-sm">EduHub</span>}
        </div>
        <nav className="flex-1 py-4 space-y-1 px-3">
          {sidebarItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button key={item.path} onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all duration-300 ${active ? "gradient-accent text-white shadow-lg shadow-accent/20 font-medium" : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50"}`}>
                <item.icon className="w-5 h-5 shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
                {sidebarOpen && active && <ChevronRight className="w-4 h-4 ml-auto" />}
              </button>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-sidebar-border">
          <button onClick={() => navigate("/auth")} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-sidebar-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-all duration-300">
            <LogOut className="w-5 h-5 shrink-0" />{sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <div className={`flex-1 transition-all duration-500 ${sidebarOpen ? "ml-64" : "ml-[72px]"}`}>
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 py-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2.5 rounded-xl hover:bg-secondary transition-colors">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl gradient-accent flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium text-foreground hidden md:inline">Faculty</span>
          </div>
        </header>
        <main className="p-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            {children}
          </motion.div>
        </main>
      </div>
      <Toaster />
    </div>
  );
};

export default FacultyLayout;
