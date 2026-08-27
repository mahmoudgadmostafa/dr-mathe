// src/components/TeacherSidebar.jsx
import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";

export default function TeacherSidebar({ isOpen, onClose, isCollapsed, onToggleCollapsed }) {
  const location = useLocation();
  const { userProfile } = useAuth();
  const [pendingTicketsCount, setPendingTicketsCount] = useState(0);

  const [hoveredNav, setHoveredNav] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0 });

  const toggleCollapsed = () => {
    setHoveredNav(null);
    if (onToggleCollapsed) onToggleCollapsed();
  };

  useEffect(() => {
    if (location.pathname === "/support-tickets") {
      localStorage.setItem("math_app_teacher_last_seen_tickets", Date.now().toString());
      setPendingTicketsCount(0);
      return;
    }

    const q = query(collection(db, "support_tickets"), where("status", "==", "pending"));
    const unsub = onSnapshot(q, (snap) => {
      const lastSeen = Number(localStorage.getItem("math_app_teacher_last_seen_tickets") || 0);
      const unreadPending = snap.docs.filter((d) => {
        const ticketTime = d.data().createdAt?.toDate ? d.data().createdAt.toDate().getTime() : new Date(d.data().createdAt || 0).getTime();
        return ticketTime > lastSeen;
      });
      setPendingTicketsCount(unreadPending.length);
    });
    return () => unsub();
  }, [location.pathname]);

  const navItems = [
    { path: "/dashboard", label: "الرئيسية والإحصائيات", icon: "📊" },
    { path: "/students", label: "إدارة الطلاب والاشتراكات", icon: "👥" },
    { path: "/students/add", label: "إضافة طالب جديد", icon: "➕" },
    { path: "/groups", label: "المراحل والمجموعات", icon: "🏫" },
    { path: "/finances", label: "النظام المالي والأرباح", icon: "💰" },
    { path: "/quizzes", label: "الاختبارات والتطبيقات الذكية", icon: "📝" },
    { path: "/library", label: "المكتبة والشروحات", icon: "📚" },
    { path: "/live-sessions", label: "الحصص المباشرة", icon: "📡" },
    { path: "/notifications", label: "مركز الإشعارات والتنبيهات", icon: "🔔" },
    { path: "/support-tickets", label: "الدعم والطلبات", icon: "🧑‍💻", badge: pendingTicketsCount },
    { path: "/reports", label: "تقارير الطلاب", icon: "📈" },
    { path: "/profile", label: "إعدادات الحساب والرقم السري", icon: "⚙️" },
  ];

  return (
    <aside
      className={`teacher-sidebar${isOpen ? " sidebar-mobile-open" : ""}${
        isCollapsed ? " collapsed" : ""
      }`}
    >
      {/* Close button — visible on mobile only */}
      {onClose && (
        <button
          className="sidebar-close-btn"
          onClick={onClose}
          aria-label="إغلاق القائمة"
        >
          ✕
        </button>
      )}

      {/* Header section with Logo & 3-Bars + Arrow Toggle Button */}
      <div className="sidebar-teacher-header">
        <div className="sidebar-teacher-profile-wrapper">
          <img
            src="/logo-circle.png"
            alt="Teacher Avatar"
            className="sidebar-teacher-avatar"
            title={userProfile?.fullName || "المعلم المدير"}
            onClick={toggleCollapsed}
            style={{ cursor: "pointer" }}
          />
          <div className="sidebar-teacher-info">
            <span className="sidebar-teacher-name">{userProfile?.fullName || "المعلم المدير"}</span>
            <span className="sidebar-teacher-badge">مدير المنصة والمعلم</span>
          </div>
        </div>

        {/* 3-Bars + Arrow Toggle Button */}
        <button
          type="button"
          className="sidebar-collapse-toggle-btn"
          onClick={toggleCollapsed}
          title={isCollapsed ? "توسيع القائمة الجانبية" : "طي القائمة الجانبية"}
          aria-label={isCollapsed ? "توسيع القائمة الجانبية" : "طي القائمة الجانبية"}
        >
          <span className="toggle-btn-bars">☰</span>
          <span className="toggle-btn-arrow">{isCollapsed ? "⮜" : "⮞"}</span>
        </button>
      </div>

      <div className="sidebar-menu-divider" />

      {/* Navigation list */}
      <nav className="teacher-sidebar-nav">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`teacher-nav-item ${isActive ? "active" : ""}`}
              title={isCollapsed ? item.label : undefined}
              onClick={() => {
                setHoveredNav(null);
                if (onClose) onClose();
              }}
              onMouseEnter={(e) => {
                if (!isCollapsed) return;
                const rect = e.currentTarget.getBoundingClientRect();
                setTooltipPos({ top: rect.top + rect.height / 2 });
                setHoveredNav(item);
              }}
              onMouseLeave={() => setHoveredNav(null)}
            >
              <div className="teacher-nav-content">
                <span className="teacher-nav-icon">{item.icon}</span>
                <span className="teacher-nav-label">{item.label}</span>
              </div>

              {Boolean(item.badge) && item.badge > 0 && (
                <span className="teacher-nav-badge">
                  {item.badge}
                </span>
              )}

              {isActive && <span className="teacher-nav-indicator" />}
            </Link>
          );
        })}
      </nav>

      {/* Direct Fixed Floating Tooltip when Collapsed */}
      {isCollapsed && hoveredNav && (
        <div
          className="sidebar-floating-tooltip"
          style={{
            position: "fixed",
            top: `${tooltipPos.top}px`,
            right: "82px",
            transform: "translateY(-50%)",
            opacity: 1,
            visibility: "visible",
            zIndex: 9999999,
            pointerEvents: "none",
            background: "linear-gradient(135deg, #0f172a, #1e293b)",
            border: "1.5px solid #0284c7",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.7), 0 0 15px rgba(2, 132, 199, 0.4)",
            display: "flex",
            alignItems: "center",
            gap: "0.55rem",
            padding: "0.55rem 1rem",
            borderRadius: "12px",
            color: "#ffffff",
            fontSize: "0.88rem",
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontSize: "1.15rem" }}>{hoveredNav.icon}</span>
          <span>{hoveredNav.label}</span>
          {Boolean(hoveredNav.badge) && hoveredNav.badge > 0 && (
            <span className="tooltip-badge-pill">{hoveredNav.badge}</span>
          )}
        </div>
      )}
    </aside>
  );
}
