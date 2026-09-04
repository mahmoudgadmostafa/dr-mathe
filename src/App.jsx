import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./lib/ProtectedRoute";
import Layout from "./components/Layout";
import { useAuth } from "./context/AuthContext";

// ── Lazy-loaded pages (code-split by route) ─────────────────────────────────
const Landing              = lazy(() => import("./pages/Landing"));
const Login                = lazy(() => import("./pages/Login"));
const Register             = lazy(() => import("./pages/Register"));
const TeacherRegister      = lazy(() => import("./pages/TeacherRegister"));
const TeacherAddStudent    = lazy(() => import("./pages/TeacherAddStudent"));
const TeacherStudents      = lazy(() => import("./pages/TeacherStudents"));
const TeacherGroups        = lazy(() => import("./pages/TeacherGroups"));
const TeacherLiveSessions  = lazy(() => import("./pages/TeacherLiveSessions"));
const TeacherLibrary       = lazy(() => import("./pages/TeacherLibrary"));
const TeacherQuizzes       = lazy(() => import("./pages/TeacherQuizzes"));
const TeacherProfileSettings = lazy(() => import("./pages/TeacherProfileSettings"));
const TeacherReports       = lazy(() => import("./pages/TeacherReports"));
const TeacherFinances      = lazy(() => import("./pages/TeacherFinances"));
const Dashboard            = lazy(() => import("./pages/Dashboard"));
const TeacherNotifications = lazy(() => import("./pages/TeacherNotifications"));
const SupportTickets       = lazy(() => import("./pages/SupportTickets"));

// ── Mini fallback shown during lazy chunk load ───────────────────────────────
function PageLoader() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <img
        src="/logo-circle.png"
        alt="Loading"
        className="logo-loading-sway"
        style={{ width: "70px", height: "70px", objectFit: "cover" }}
      />
      <p style={{ color: "var(--color-primary)", fontFamily: "var(--font-body)", fontSize: "1rem" }}>
        جاري التحميل...
      </p>
    </div>
  );
}

// Teacher: full dedicated page. Student: redirect to dashboard tab
function NotificationsRoute() {
  const { isTeacher } = useAuth();
  return isTeacher
    ? <TeacherNotifications />
    : <Navigate to="/dashboard?tab=notifications" replace />;
}

function SupportRoute() {
  const { isTeacher } = useAuth();
  return isTeacher
    ? <SupportTickets />
    : <Navigate to="/dashboard?tab=support" replace />;
}

// إذا كان المعلم أو الطالب مسجلاً دخوله، يوجَّه تلقائياً لصفحته الرئيسية (لوحة التحكم) بدلاً من صفحات الهبوط أو تسجيل الدخول
function PublicOnlyRoute({ children }) {
  const { currentUser, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"                element={<PublicOnlyRoute><Layout><Landing /></Layout></PublicOnlyRoute>} />
            <Route path="/login"           element={<PublicOnlyRoute><Layout><Login /></Layout></PublicOnlyRoute>} />
            <Route path="/register"        element={<PublicOnlyRoute><Layout><Register /></Layout></PublicOnlyRoute>} />
            <Route path="/register-teacher" element={<PublicOnlyRoute><Layout><TeacherRegister /></Layout></PublicOnlyRoute>} />
            <Route path="/students"        element={<Layout><ProtectedRoute><TeacherStudents /></ProtectedRoute></Layout>} />
            <Route path="/students/add"    element={<Layout><ProtectedRoute><TeacherAddStudent /></ProtectedRoute></Layout>} />
            <Route path="/groups"          element={<Layout><ProtectedRoute><TeacherGroups /></ProtectedRoute></Layout>} />
            <Route path="/live-sessions"   element={<Layout><ProtectedRoute><TeacherLiveSessions /></ProtectedRoute></Layout>} />
            <Route path="/library"         element={<Layout><ProtectedRoute><TeacherLibrary /></ProtectedRoute></Layout>} />
            <Route path="/quizzes"         element={<Layout><ProtectedRoute><TeacherQuizzes /></ProtectedRoute></Layout>} />
            <Route path="/profile"         element={<Layout><ProtectedRoute><TeacherProfileSettings /></ProtectedRoute></Layout>} />
            <Route path="/reports"         element={<Layout><ProtectedRoute><TeacherReports /></ProtectedRoute></Layout>} />
            <Route path="/finances"        element={<Layout><ProtectedRoute><TeacherFinances /></ProtectedRoute></Layout>} />
            <Route path="/notifications"   element={<Layout><ProtectedRoute><NotificationsRoute /></ProtectedRoute></Layout>} />
            <Route path="/support-tickets" element={<Layout><ProtectedRoute><SupportRoute /></ProtectedRoute></Layout>} />
            <Route path="/dashboard"       element={<Layout><ProtectedRoute><Dashboard /></ProtectedRoute></Layout>} />
            <Route path="*"                element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </HashRouter>
  );
}
