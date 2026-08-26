// src/pages/Dashboard.jsx
// نقطة دخول واحدة بعد تسجيل الدخول، بتوجه المستخدم حسب دوره
import { useAuth } from "../context/AuthContext";
import TeacherDashboard from "./TeacherDashboard";
import StudentDashboard from "./StudentDashboard";
import GradeSelectionModal from "../components/GradeSelectionModal";

export default function Dashboard() {
  const { isTeacher, isStudent, userProfile, currentUser, completeGoogleStudentProfile } = useAuth();

  if (isTeacher) return <TeacherDashboard />;
  if (isStudent) {
    if (!userProfile?.grade) {
      return (
        <GradeSelectionModal
          user={currentUser}
          onConfirm={async (grade) => {
            await completeGoogleStudentProfile(currentUser, grade);
          }}
        />
      );
    }
    return <StudentDashboard />;
  }

  return (
    <div className="page">
      <p>الحساب ده لسه مالوش دور محدد ({userProfile ? "تحقق من مستند users" : "لا يوجد ملف مستخدم"}).</p>
    </div>
  );
}
