// src/components/StudentSidebar.jsx
import { useState } from "react";
import { useLocation, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function StudentSidebar({ isOpen, onClose, isCollapsed, onToggleCollapsed }) {
  const { userProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "home";

  const [hoveredTab, setHoveredTab] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0 });

  const toggleCollapsed = onToggleCollapsed;

  const sidebarItems = [
    { id: "home", icon: "🏠", label: "الرئيسية" },
    { id: "live", icon: "📡", label: "الحصص المباشرة" },
    { id: "library", icon: "📚", label: "المكتبة والشروحات" },
    { id: "quizzes", icon: "📝", label: "الاختبارات الذكية" },
    { id: "notifications", icon: "🔔", label: "الإشعارات والتنبيهات" },
    { id: "support", icon: "🧑‍💻", label: "الدعم والرسائل" },
    { id: "profile", icon: "👤", label: "الملف الشخصي" },
  ];

  const handleSelectTab = (tabId) => {
    setHoveredTab(null);
    if (location.pathname !== "/dashboard") {
      navigate(`/dashboard?tab=${tabId}`);
    } else {
      setSearchParams({ tab: tabId }, { replace: true });
    }
    if (tabId === "notifications") {
      localStorage.setItem("math_app_last_seen_notif", Date.now().toString());
    }
    if (tabId === "support") {
      localStorage.setItem("math_app_student_last_seen_replies", Date.now().toString());
    }
    if (onClose) onClose();
  };

  return (
    <aside
      className={`student-sidebar${isOpen ? " sidebar-mobile-open" : ""}${
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

      {/* Header section with Student Avatar & 3-Bars + Arrow Toggle Button */}
      <div className="sidebar-teacher-header">
        <div className="sidebar-teacher-profile-wrapper">
          <img
            src="/logo-circle.png"
            alt="Student Avatar"
            className="student-sidebar-avatar"
            title={userProfile?.fullName || "طالب"}
            onClick={toggleCollapsed}
            style={{ cursor: "pointer" }}
          />
          <div className="sidebar-teacher-info">
            <span className="sidebar-teacher-name">{userProfile?.fullName || "طالب"}</span>
            <span className="sidebar-teacher-badge" style={{ color: "#7c3aed" }}>
              {userProfile?.grade || "طالب المنصة"}
            </span>
          </div>
        </div>

        {/* 3-Bars + Arrow Toggle Button */}
        <button
          type="button"
          className="sidebar-collapse-toggle-btn student-toggle-btn"
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
      <div className="sidebar-buttons-group">
        {sidebarItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelectTab(item.id)}
              className={`sidebar-tab-btn ${isActive ? "active" : ""}`}
              title={isCollapsed ? item.label : undefined}
              onMouseEnter={(e) => {
                if (!isCollapsed) return;
                const rect = e.currentTarget.getBoundingClientRect();
                setTooltipPos({ top: rect.top + rect.height / 2 });
                setHoveredTab(item);
              }}
              onMouseLeave={() => setHoveredTab(null)}
            >
              <span className="sidebar-tab-icon" style={{ fontSize: "1.25rem" }}>{item.icon}</span>
              <span className="sidebar-tab-label">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Direct Fixed Floating Tooltip when Collapsed */}
      {isCollapsed && hoveredTab && (
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
            background: "linear-gradient(135deg, #1e1b4b, #0f172a)",
            border: "1.5px solid #a855f7",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.7), 0 0 15px rgba(168, 85, 247, 0.4)",
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
          <span style={{ fontSize: "1.15rem" }}>{hoveredTab.icon}</span>
          <span>{hoveredTab.label}</span>
        </div>
      )}
    </aside>
  );
}

