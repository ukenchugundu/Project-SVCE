import { Router } from 'express';
import {
  createQuiz,
  deleteQuiz,
  getFacultyResults,
  getQuizAttempt,
  getQuizById,
  getQuizzes,
  getStudentResults,
  saveQuizAttemptAnswers,
  startQuizAttempt,
  submitQuizAttempt,
  uploadFacultyResultScore,
  updateQuiz,
  updateQuizStatus,
} from '../controllers/quizController';
import {
  createAssignment,
  deleteAssignment,
  getAssignments,
  getFacultyAssignmentSubmissions,
  getStudentAssignmentResults,
  getStudentAssignmentSubmissions,
  submitAssignment,
  updateAssignment,
  uploadAssignmentScore,
} from '../controllers/assignmentController';
import {
  createNote,
  deleteNote,
  getNotes,
  updateNote,
  uploadNoteFile,
} from '../controllers/notesController';
import {
  createMemberByAdmin,
  deleteAdminMember,
  getAdminDashboardData,
  getAdminMembers,
  loginUser,
  requestPasswordReset,
  registerUser,
  resendLoginOtp,
  resetPassword,
  updateAdminMember,
  verifyLoginOtp,
} from '../controllers/authController';

const router = Router();

router.get('/quizzes', getQuizzes);
router.get('/quizzes/:id', getQuizById);
router.post('/quizzes', createQuiz);
router.put('/quizzes/:id', updateQuiz);
router.patch('/quizzes/:id/status', updateQuizStatus);
router.delete('/quizzes/:id', deleteQuiz);
router.post('/quizzes/:id/attempts/start', startQuizAttempt);
router.get('/quizzes/:id/attempts/:attemptId', getQuizAttempt);
router.put('/quizzes/:id/attempts/:attemptId/answers', saveQuizAttemptAnswers);
router.post('/quizzes/:id/attempts/:attemptId/submit', submitQuizAttempt);
router.get('/faculty/results', getFacultyResults);
router.patch('/faculty/results/:attemptId/score', uploadFacultyResultScore);
router.get('/student/results', getStudentResults);
router.get('/assignments', getAssignments);
router.post('/assignments', createAssignment);
router.put('/assignments/:assignmentId', updateAssignment);
router.delete('/assignments/:assignmentId', deleteAssignment);
router.post('/assignments/:assignmentId/submissions', submitAssignment);
router.get('/student/assignments/submissions', getStudentAssignmentSubmissions);
router.get('/student/assignments/results', getStudentAssignmentResults);
router.get('/faculty/assignments/submissions', getFacultyAssignmentSubmissions);
router.patch('/faculty/assignments/submissions/:submissionId/score', uploadAssignmentScore);
router.get('/notes', getNotes);
router.post('/notes/upload', uploadNoteFile);
router.post('/notes', createNote);
router.put('/notes/:noteId', updateNote);
router.delete('/notes/:noteId', deleteNote);
router.post('/auth/register', registerUser);
router.post('/auth/login', loginUser);
router.post('/auth/login/verify-otp', verifyLoginOtp);
router.post('/auth/login/resend-otp', resendLoginOtp);
router.post('/auth/forgot-password', requestPasswordReset);
router.post('/auth/reset-password', resetPassword);
router.post('/auth/admin/create-member', createMemberByAdmin);
router.get('/auth/admin/dashboard', getAdminDashboardData);
router.get('/auth/admin/members', getAdminMembers);
router.put('/auth/admin/members/:memberId', updateAdminMember);
router.delete('/auth/admin/members/:memberId', deleteAdminMember);

export default router;
