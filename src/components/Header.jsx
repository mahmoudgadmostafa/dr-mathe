// src/components/Header.jsx
import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";

export default function Header({ onToggleSidebar, sidebarOpen }) {
  const { currentUser, userProfile, logout, isTeacher, isStudent } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [notifCount, setNotifCount] = useState(0);
  const [supportCount, setSupportCount] = useState(0);

  // Student identification info
  const studentGrade = (userProfile?.grade || "").trim();
  const studentGroup = (userProfile?.group || "").trim();
  const studentUid = (currentUser?.uid || localStorage.getItem("math_app_user_uid") || userProfile?.uid || userProfile?.id || "").trim();
  const studentEmail = (userProfile?.email || "").trim().toLowerCase();
  const studentPhone = (userProfile?.phone || "").trim();

  // Clear badge when visiting the respective route or dashboard tab
  useEffect(() => {
    const isNotifActive = location.pathname === "/notifications" || (location.pathname === "/dashboard" && location.search.includes("tab=notifications"));
    if (isNotifActive) {
      localStorage.setItem("math_app_last_seen_notif", Date.now().toString());
      setNotifCount(0);
    }
    const isSupportActive = location.pathname === "/support-tickets" || (location.pathname === "/dashboard" && location.search.includes("tab=support"));
    if (isSupportActive) {
      if (isTeacher) {
        localStorage.setItem("math_app_teacher_last_seen_tickets", Date.now().toString());
      } else {
        localStorage.setItem("math_app_student_last_seen_replies", Date.now().toString());
      }
      setSupportCount(0);
    }
  }, [location.pathname, location.search, isTeacher]);

  // Listen to notifications count
  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(collection(db, "notifications"), (snap) => {
      const lastSeen = Number(localStorage.getItem("math_app_last_seen_notif") || 0);
      const list = snap.docs.map((d) => d.data());

      const unreadList = list.filter((n) => {
        const notifTime = n.createdAt?.toDate ? n.createdAt.toDate().getTime() : new Date(n.createdAt || 0).getTime();
        // Count notifications created after lastSeen
        if (notifTime <= lastSeen) return false;

        if (isTeacher) return true;

        if (!n.targetType || n.targetType === "all") return true;
        if (n.targetType === "student") {
          const val = (n.targetValue || "").trim();
          const notifEmail = (n.targetStudentEmail || "").trim().toLowerCase();
          const notifPhone = (n.targetStudentPhone || "").trim();
          return (val && (val === studentUid || val === studentEmail || val === studentPhone)) ||
            (notifEmail && notifEmail === studentEmail) ||
            (notifPhone && notifPhone === studentPhone);
        }
        if (n.targetType === "grade" && (n.targetValue || "").trim() === studentGrade) return true;
        if (n.targetType === "group" && (n.targetValue || "").trim() === studentGroup) return true;
        if (n.targetType === "stage") {
          const stageName = (n.targetValue || "").trim();
          if (stageName.includes("ابتدائ") && studentGrade.includes("الابتدائي")) return true;
          if (stageName.includes("إعداد") && studentGrade.includes("الإعدادي")) return true;
          if (stageName.includes("ثانو") && studentGrade.includes("الثانوي")) return true;
        }
        return false;
      });

      const isNotifActive = location.pathname === "/notifications" || (location.pathname === "/dashboard" && location.search.includes("tab=notifications"));
      if (!isNotifActive) {
        setNotifCount(unreadList.length);
      }
    });
    return () => unsub();
  }, [currentUser, isTeacher, studentGrade, studentGroup, studentUid, studentEmail, studentPhone, location.pathname, location.search]);

  // Listen to support tickets count
  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(collection(db, "support_tickets"), (snap) => {
      const list = snap.docs.map((d) => d.data());
      if (isTeacher) {
        const lastSeen = Number(localStorage.getItem("math_app_teacher_last_seen_tickets") || 0);
        // Count tickets pending teacher reply created/updated after lastSeen
        const pendingUnread = list.filter((t) => {
          if (t.status !== "pending") return false;
          const ticketTime = t.createdAt?.toDate ? t.createdAt.toDate().getTime() : new Date(t.createdAt || 0).getTime();
          return ticketTime > lastSeen;
        });
        const isSupportActive = location.pathname === "/support-tickets" || (location.pathname === "/dashboard" && location.search.includes("tab=support"));
        if (!isSupportActive) {
          setSupportCount(pendingUnread.length);
        }
      } else {
        const lastSeen = Number(localStorage.getItem("math_app_student_last_seen_replies") || 0);
        // Count tickets belonging to student that have new teacher replies after lastSeen
        const myRepliedUnread = list.filter((t) => {
          const matchUid = studentUid && t.studentUid === studentUid;
          const matchEmail = studentEmail && (t.studentEmail || "").trim().toLowerCase() === studentEmail;
          const matchPhone = studentPhone && (t.studentPhone || "").trim() === studentPhone;
          if (!matchUid && !matchEmail && !matchPhone) return false;

          if (!t.replyText) return false;
          const replyTime = t.repliedAt?.toDate ? t.repliedAt.toDate().getTime() : new Date(t.repliedAt || Date.now()).getTime();
          return replyTime > lastSeen;
        });
        const isSupportActive = location.pathname === "/support-tickets" || (location.pathname === "/dashboard" && location.search.includes("tab=support"));
        if (!isSupportActive) {
          setSupportCount(myRepliedUnread.length);
        }
      }
    });
    return () => unsub();
  }, [currentUser, isTeacher, studentUid, studentEmail, studentPhone, location.pathname, location.search]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  return (
    <header className="glass page-header header-sticky header-floating-rounded">
      {/* Right: Hamburger (mobile) + Brand Logo */}
      <div className="header-right-brand">
        {/* Hamburger: shown for teacher & student on mobile */}
        {currentUser && (isTeacher || isStudent) && (
          <button
            id="sidebar-toggle-btn"
            className="hamburger-btn"
            onClick={onToggleSidebar}
            aria-label={sidebarOpen ? "إغلاق القائمة" : "فتح القائمة"}
            aria-expanded={sidebarOpen}
          >
            <span className={`hamburger-icon ${sidebarOpen ? "open" : ""}`}>
              <span />
              <span />
              <span />
            </span>
          </button>
        )}

        {(() => {
          const isAuthPage = ["/login", "/register", "/register-teacher"].includes(location.pathname);
          const brandContent = (
            <>
              <img
                src="/logo-circle.png"
                alt="Math Teacher Logo"
                className="logo-animated"
                style={{ height: "36px", width: "36px", objectFit: "cover", borderRadius: "50%", flexShrink: 0 }}
              />
              <h1
                className="header-title-animated header-title-responsive"
                style={{ fontSize: "1rem", margin: 0 }}
              >
                منصة <span className="brand-highlight">الدكتور</span> فى الرياضيات
              </h1>
            </>
          );

          const brandStyle = {
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            textDecoration: "none",
            minWidth: 0,
            overflow: "hidden",
          };

          // أثناء تسجيل الدخول - بدون لينك
          if (isAuthPage) {
            return (
              <div className="header-brand-link" style={{ ...brandStyle, cursor: "default" }}>
                {brandContent}
              </div>
            );
          }

          // مسجّل دخول - يروح للداشبورد (للطالب يرجع لتبويب الرئيسية)
          if (currentUser) {
            const targetDashboard = isTeacher ? "/dashboard" : "/dashboard?tab=home";
            return (
              <Link to={targetDashboard} className="header-brand-link" style={brandStyle}>
                {brandContent}
              </Link>
            );
          }

          // مش مسجّل دخول - يروح للصفحة الرئيسية
          return (
            <Link to="/" className="header-brand-link" style={brandStyle}>
              {brandContent}
            </Link>
          );
        })()}
      </div>

      {/* Left: Notifications + Support + User Card Badge + Logout */}
      <nav className="header-left-actions">
        {currentUser && (
          <div className="header-left-inner">
            {/* 🔔 Modern Notifications Icon */}
            <Link
              to={isTeacher ? "/notifications" : "/dashboard?tab=notifications"}
              className="header-action-btn-modern notif-action-btn"
              title="الإشعارات والتنبيهات"
              aria-label="الإشعارات والتنبيهات"
            >
              <svg
                className="header-action-icon bell-ring-icon"
                viewBox="0 0 24 24"
                width="19"
                height="19"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {notifCount > 0 && (
                <span className="header-badge-count notif-badge-pulse">
                  {notifCount}
                </span>
              )}
            </Link>

            {/* 🧑‍💻 Modern Support Icon (الدعم الفني) */}
            <Link
              to={isTeacher ? "/support-tickets" : "/dashboard?tab=support"}
              className="header-action-btn-modern support-action-btn"
              title="الدعم والرسائل الفنية"
              aria-label="الدعم والرسائل"
            >
              <svg
                className="header-action-icon support-headset-icon"
                viewBox="0 0 24 24"
                width="19"
                height="19"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
              </svg>
              {supportCount > 0 && (
                <span
                  className="header-badge-count"
                  style={{
                    background: isTeacher
                      ? "linear-gradient(135deg, #f59e0b, #d97706)"
                      : "linear-gradient(135deg, #10b981, #059669)",
                  }}
                >
                  {supportCount}
                </span>
              )}
            </Link>

            {/* مستطيل صغير به اسم الطالب أو المعلم حسب نوع الحساب + أفاتار */}
            <div
              className="header-user-card-badge"
              title={userProfile?.fullName || (isTeacher ? "المعلم المدير" : "الطالب")}
            >
              <img
                src="/logo-circle.png"
                alt="Avatar"
                className="header-user-avatar"
              />
              <div className="header-user-card-info">
                <span className="header-user-card-name">
                  {userProfile?.fullName || (isTeacher ? "المعلم المدير" : "الطالب")}
                </span>
                <span className="header-user-card-role">
                  {isTeacher ? "👨‍🏫 المعلم المدير" : `👨‍🎓 ${userProfile?.grade || "طالب المنصة"}`}
                </span>
              </div>
            </div>

            {/* زر تسجيل الخروج العصري */}
            <button
              className="header-action-btn-modern logout-action-btn"
              onClick={handleLogout}
              title="تسجيل الخروج من المنصة"
              aria-label="تسجيل الخروج"
            >
              <svg
                className="header-action-icon"
                viewBox="0 0 24 24"
                width="17"
                height="17"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="logout-btn-label">خروج</span>
            </button>
          </div>
        )}
      </nav>
    </header>
  );
}
