import React, { useEffect, useRef, useState, useCallback } from "react";
import Header from "./Header";
import Footer from "./Footer";
import TeacherSidebar from "./TeacherSidebar";
import StudentSidebar from "./StudentSidebar";
import FloatingContactWidget from "./FloatingContactWidget";
import { useAuth } from "../context/AuthContext";
import { useLocation } from "react-router-dom";

export default function Layout({ children }) {
  const { isTeacher, isStudent, currentUser } = useAuth();
  const location = useLocation();
  const mainRef = useRef(null);

  // Mobile drawer open/close
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Desktop collapse/expand state for Teacher
  const [teacherSidebarCollapsed, setTeacherSidebarCollapsed] = useState(() => {
    return localStorage.getItem("math_app_teacher_sidebar_collapsed") === "true";
  });

  // Desktop collapse/expand state for Student
  const [studentSidebarCollapsed, setStudentSidebarCollapsed] = useState(() => {
    return localStorage.getItem("math_app_student_sidebar_collapsed") === "true";
  });

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  const toggleTeacherSidebarCollapsed = useCallback(() => {
    setTeacherSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("math_app_teacher_sidebar_collapsed", String(next));
      return next;
    });
  }, []);

  const toggleStudentSidebarCollapsed = useCallback(() => {
    setStudentSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("math_app_student_sidebar_collapsed", String(next));
      return next;
    });
  }, []);

  // Smooth page transition + scroll to top on route change
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    el.classList.remove("page-enter-active");
    void el.offsetWidth;
    el.classList.add("page-enter-active");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setSidebarOpen(false);
  }, [location.pathname]);

  // Close mobile drawer on Escape
  useEffect(() => {
    if (!sidebarOpen) return;
    const handleKey = (e) => { if (e.key === "Escape") closeSidebar(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [sidebarOpen, closeSidebar]);

  const hasTeacherSidebar = isTeacher && Boolean(currentUser);
  const hasStudentSidebar = isStudent && Boolean(currentUser);
  const hasSidebar = hasTeacherSidebar || hasStudentSidebar;

  return (
    <div className="site-root-layout">
      {/* Mobile Drawer Overlay */}
      {sidebarOpen && hasSidebar && (
        <div
          className="sidebar-mobile-overlay"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Main Body Section: Contains Sidebar + (Header + Content Area) */}
      <div className={`app-body-container ${hasSidebar ? "has-sidebar-layout" : ""}`}>
        {hasTeacherSidebar && (
          <TeacherSidebar
            isOpen={sidebarOpen}
            onClose={closeSidebar}
            isCollapsed={teacherSidebarCollapsed}
            onToggleCollapsed={toggleTeacherSidebarCollapsed}
          />
        )}

        {hasStudentSidebar && (
          <StudentSidebar
            isOpen={sidebarOpen}
            onClose={closeSidebar}
            isCollapsed={studentSidebarCollapsed}
            onToggleCollapsed={toggleStudentSidebarCollapsed}
          />
        )}

        {/* Dynamic Main Column: Holds Header + Page Content */}
        <div className="app-main-area-with-header">
          <Header onToggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />

          <div
            ref={mainRef}
            className="app-main-content page-enter-active"
          >
            <main>{children}</main>
          </div>
        </div>
      </div>

      <FloatingContactWidget />

      {/* 3️⃣ Full-Width Footer spanning 100% of page bottom */}
      <Footer />
    </div>
  );
}



