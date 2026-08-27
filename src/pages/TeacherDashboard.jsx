import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { getSubscriptionInfo } from "../components/StudentCard";
import TeacherAIRoomsModal from "../components/TeacherAIRoomsModal";

export default function TeacherDashboard() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const [showAIRoomsModal, setShowAIRoomsModal] = useState(false);
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeSubscribers: 0,
    pendingSubscribers: 0,
    expiringSoonCount: 0,
    loading: true,
  });

  const [recentStudents, setRecentStudents] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "student"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const studentDocs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const totalStudents = studentDocs.length;
        let activeSubscribers = 0;
        let expiringSoonCount = 0;

        studentDocs.forEach((s) => {
          const info = getSubscriptionInfo(s);
          if (info.status === "active" || info.status === "expiring_soon") {
            activeSubscribers++;
          }
          if (info.status === "expiring_soon") {
            expiringSoonCount++;
          }
        });

        const pendingSubscribers = totalStudents - activeSubscribers;

        setStats({
          totalStudents,
          activeSubscribers,
          pendingSubscribers,
          expiringSoonCount,
          loading: false,
        });

        // Get 5 most recent registered students
        const sorted = [...studentDocs].sort((a, b) => {
          const tA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
          const tB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
          return tB - tA;
        });
        setRecentStudents(sorted.slice(0, 5));
      },
      (err) => {
        console.error("Failed to load live student stats:", err);
        setStats((prev) => ({ ...prev, loading: false }));
      }
    );

    return () => unsubscribe();
  }, []);

  const navItems = [
    { href: "/notifications", icon: "🔔", label: "مركز الإشعارات والتنبيهات الموجهة" },
    { href: "/support-tickets", icon: "🧑‍💻", label: "كروت الدعم والرد على الطلاب" },
    { href: "/profile", icon: "⚙️", label: "تعديل بيانات المعلم والرقم السري" },
    { href: "/reports", icon: "📊", label: "تقارير الطلاب" },
    { href: "/quizzes", icon: "📝", label: "الاختبارات والتطبيقات الذكية والنتائج" },
    { href: "/library", icon: "📚", label: "المكتبة والشروحات (فيديو/PDF/إنفوجرافيك)" },
    { href: "/live-sessions", icon: "📡", label: "الحصص المباشرة والافتراضية" },
    { href: "/groups", icon: "🏫", label: "تنظيم المراحل والمجموعات" },
    { href: "/students", icon: "👥", label: "إدارة الطلاب والاشتراكات" },
    { href: "/students/add", icon: "➕", label: "إضافة طالب جديد" },
  ];

  const activePercent =
    stats.totalStudents > 0
      ? Math.round((stats.activeSubscribers / stats.totalStudents) * 100)
      : 0;

  return (
    <div className="dashboard-modern fade-in">
      {/* Welcome Banner */}
      <div className="dashboard-banner glass">
        <div className="dashboard-banner-content">
          <img src="/logo-circle.png" alt="logo" className="dashboard-avatar" />
          <div>
            <h1 className="font-heading dashboard-welcome">
              أهلاً، <span className="text-gradient">{userProfile?.fullName || "المعلم"}</span> 👋
            </h1>
            <p className="dashboard-role">مدير المنصة والمعلم | منصة الدكتور فى الرياضيات</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setShowAIRoomsModal(true)}
            className="button button-sm"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #0284c7)",
              color: "#ffffff",
              fontWeight: 800,
              borderRadius: "12px",
              padding: "0.5rem 1rem",
              boxShadow: "0 4px 15px rgba(124, 58, 237, 0.35)",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              display: "flex",
              alignItems: "center",
              gap: "0.45rem",
            }}
          >
            <span>🤖</span>
            <span>غرف الذكاء الاصطناعي (AI)</span>
          </button>

          <Link to="/students/add" className="button button-sm button-primary" style={{ borderRadius: "12px", padding: "0.5rem 1rem", fontWeight: 800 }}>
            + إضافة طالب جديد
          </Link>
        </div>
      </div>

      {/* Live Real-time Statistics */}
      <h2 className="font-heading dashboard-section-title">📊 الإحصائيات الفعلية للمنصة</h2>
      <div className="stats-grid">
        {/* Total Registered Students */}
        <div className="stat-card glass highlight-card">
          <div className="stat-icon">👥</div>
          <div className="stat-info">
            <span className="stat-value">{stats.loading ? "..." : stats.totalStudents}</span>
            <span className="stat-label">إجمالي الطلاب المسجلين</span>
          </div>
        </div>

        {/* Active Subscribed Students */}
        <div className="stat-card glass success-card">
          <div className="stat-icon">⭐</div>
          <div className="stat-info">
            <span className="stat-value">{stats.loading ? "..." : stats.activeSubscribers}</span>
            <span className="stat-label">
              طلاب مشتركين بالفعل ({activePercent}% مفعلين)
            </span>
          </div>
        </div>

        {/* Pending Subscriptions */}
        <div className="stat-card glass warning-card">
          <div className="stat-icon">⏳</div>
          <div className="stat-info">
            <span className="stat-value">{stats.loading ? "..." : stats.pendingSubscribers}</span>
            <span className="stat-label">في انتظار تفعيل الاشتراك</span>
          </div>
        </div>

        {/* Action Link Card */}
        <div 
          className="stat-card glass action-card" 
          onClick={() => navigate("/students")} 
          style={{ cursor: "pointer" }}
        >
          <div className="stat-icon">⚡</div>
          <div className="stat-info">
            <span className="stat-value" style={{ fontSize: "1.1rem", color: "var(--color-primary)" }}>إدارة المفعلين</span>
            <span className="stat-label">تفعيل / إلغاء تفعيل الاشتراكات ←</span>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <h2 className="font-heading dashboard-section-title">⚡ التحكم والوصول السريع</h2>
      <div className="nav-cards-grid">
        {navItems.map((item) => (
          <Link key={item.href} to={item.href} className="nav-card glass">
            <span className="nav-card-icon">{item.icon}</span>
            <span className="nav-card-label">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Recent Registered Students List */}
      <div className="recent-students-section glass" style={{ marginTop: "2.5rem", padding: "1.5rem", borderRadius: "var(--radius-lg)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 className="font-heading" style={{ margin: 0, fontSize: "1.3rem" }}>📋 أحدث الطلاب المسجلين بالمنصة</h3>
          <Link to="/students" className="link" style={{ fontSize: "0.9rem" }}>
            عرض جميع الطلاب ({stats.totalStudents}) ←
          </Link>
        </div>

        {stats.loading ? (
          <p className="muted">جاري تحميل البيانات الحية...</p>
        ) : recentStudents.length === 0 ? (
          <p className="muted">لا يوجد طلاب مسجلون حالياً في المنصة.</p>
        ) : (
          <div className="recent-table-wrapper" style={{ overflowX: "auto" }}>
            <table className="recent-students-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid rgba(14, 165, 233, 0.2)", paddingBottom: "0.5rem" }}>
                  <th style={{ padding: "0.75rem", color: "var(--color-muted)" }}>الطالب</th>
                  <th style={{ padding: "0.75rem", color: "var(--color-muted)" }}>الصف الدراسي</th>
                  <th style={{ padding: "0.75rem", color: "var(--color-muted)" }}>البريد الإلكتروني</th>
                  <th style={{ padding: "0.75rem", color: "var(--color-muted)" }}>حالة الاشتراك</th>
                </tr>
              </thead>
              <tbody>
                {recentStudents.map((s) => {
                  const subInfo = getSubscriptionInfo(s);
                  return (
                    <tr key={s.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
                      <td style={{ padding: "0.75rem", fontWeight: "600" }}>{s.fullName}</td>
                      <td style={{ padding: "0.75rem" }}>{s.grade || "غير محدد"}</td>
                      <td style={{ padding: "0.75rem", color: "var(--color-muted)" }}>{s.email}</td>
                      <td style={{ padding: "0.75rem" }}>
                        <span className={`subscription-badge ${subInfo.badgeClass}`}>
                          {subInfo.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Teacher AI Rooms Management Modal */}
      <TeacherAIRoomsModal
        isOpen={showAIRoomsModal}
        onClose={() => setShowAIRoomsModal(false)}
      />
    </div>
  );
}
