import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
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
import AdminUsers from "./pages/admin/AdminUsers";
import AdminSettings from "./pages/admin/AdminSettings";
import NotFound from "./pages/NotFound";
import { PortalRole, readStoredAuth } from "./lib/authSession";

const roleHomeRoutes: Record<PortalRole, string> = {
  student: "/student",
  faculty: "/faculty",
  admin: "/admin",
};

const queryClient = new QueryClient();

const ProtectedRoute = ({
  allowedRole,
  children,
}: {
  allowedRole: PortalRole;
  children: JSX.Element;
}) => {
  const auth = readStoredAuth();
  if (!auth) {
    return <Navigate to="/auth" replace />;
  }

  if (auth.role !== allowedRole) {
    return <Navigate to={roleHomeRoutes[auth.role]} replace />;
  }

  return children;
};

const PublicOnlyRoute = ({ children }: { children: JSX.Element }) => {
  const location = useLocation();
  const isResetMode =
    location.pathname === "/auth" &&
    new URLSearchParams(location.search).get("mode") === "reset";
  if (isResetMode) {
    return children;
  }

  const auth = readStoredAuth();
  if (!auth) {
    return children;
  }

  return <Navigate to={roleHomeRoutes[auth.role]} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <PublicOnlyRoute>
                <PreLogin />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/auth"
            element={
              <PublicOnlyRoute>
                <Auth />
              </PublicOnlyRoute>
            }
          />

          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRole="student">
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/notes"
            element={
              <ProtectedRoute allowedRole="student">
                <StudentNotes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/assignments"
            element={
              <ProtectedRoute allowedRole="student">
                <StudentAssignments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/quizzes"
            element={
              <ProtectedRoute allowedRole="student">
                <StudentQuizzes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/quizzes/:quizId"
            element={
              <ProtectedRoute allowedRole="student">
                <StudentQuizAttempt />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/results"
            element={
              <ProtectedRoute allowedRole="student">
                <StudentResults />
              </ProtectedRoute>
            }
          />

          <Route
            path="/faculty"
            element={
              <ProtectedRoute allowedRole="faculty">
                <FacultyDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/roster"
            element={
              <ProtectedRoute allowedRole="faculty">
                <FacultyRoster />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/quizzes"
            element={
              <ProtectedRoute allowedRole="faculty">
                <FacultyQuizzes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/assignments"
            element={
              <ProtectedRoute allowedRole="faculty">
                <FacultyAssignments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/results"
            element={
              <ProtectedRoute allowedRole="faculty">
                <FacultyResults />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/notes"
            element={
              <ProtectedRoute allowedRole="faculty">
                <FacultyNotes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/attendance"
            element={
              <ProtectedRoute allowedRole="faculty">
                <FacultyAttendance />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminSettings />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
