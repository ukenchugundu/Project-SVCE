import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import PreLogin from "./pages/PreLogin";
import Auth from "./pages/Auth";
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentNotes from "./pages/student/StudentNotes";
import StudentAssignments from "./pages/student/StudentAssignments";
import StudentQuizzes from "./pages/student/StudentQuizzes";
import StudentQuizAttempt from "./pages/student/StudentQuizAttempt";
import StudentResults from "./pages/student/StudentResults";
import FacultyDashboard from "./pages/faculty/FacultyDashboard";
import FacultyRoster from "./pages/faculty/FacultyRoster";
import FacultyQuizzes from "./pages/faculty/FacultyQuizzes";
import FacultyAssignments from "./pages/faculty/FacultyAssignments";
import FacultyResults from "./pages/faculty/FacultyResults";
import FacultyNotes from "./pages/faculty/FacultyNotes";
import FacultyAttendance from "./pages/faculty/FacultyAttendance";
import AdminDashboard from "./pages/admin/AdminDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PreLogin />} />
          <Route path="/auth" element={<Auth />} />

          {/* Student Routes */}
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/student/notes" element={<StudentNotes />} />
          <Route path="/student/assignments" element={<StudentAssignments />} />
          <Route path="/student/quizzes" element={<StudentQuizzes />} />
          <Route path="/student/quizzes/:quizId" element={<StudentQuizAttempt />} />
          <Route path="/student/results" element={<StudentResults />} />

          {/* Faculty Routes */}
          <Route path="/faculty" element={<FacultyDashboard />} />
          <Route path="/faculty/roster" element={<FacultyRoster />} />
          <Route path="/faculty/quizzes" element={<FacultyQuizzes />} />
          <Route path="/faculty/assignments" element={<FacultyAssignments />} />
          <Route path="/faculty/results" element={<FacultyResults />} />
          <Route path="/faculty/notes" element={<FacultyNotes />} />
          <Route path="/faculty/attendance" element={<FacultyAttendance />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminDashboard />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);
import { useEffect, useState } from "react";

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [dark]);

  return (
    <button
      onClick={() => setDark(!dark)}
      className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700"
    >
      {dark ? "Light Mode" : "Dark Mode"}
    </button>
  );
}
export default App;
