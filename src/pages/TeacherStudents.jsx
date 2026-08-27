// src/pages/TeacherStudents.jsx
import { useState, useEffect, useMemo } from "react";
import StudentCard from "../components/StudentCard";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

const STAGES = [
  {
    id: "primary",
    title: "🏫 المرحلة الابتدائية",
    grades: [
      "الصف الأول الابتدائي",
      "الصف الثاني الابتدائي",
      "الصف الثالث الابتدائي",
      "الصف الرابع الابتدائي",
      "الصف الخامس الابتدائي",
      "الصف السادس الابتدائي",
    ],
  },
  {
    id: "prep",
    title: "🎒 المرحلة الإعدادية",
    grades: [
      "الصف الأول الإعدادي",
      "الصف الثاني الإعدادي",
      "الصف الثالث الإعدادي",
    ],
  },
  {
    id: "secondary",
    title: "🎓 المرحلة الثانوية",
    grades: [
      "الصف الأول الثانوي",
      "الصف الثاني الثانوي",
      "الصف الثالث الثانوي",
    ],
  },
];

export default function TeacherStudents() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all"); // 'all' | 'active' | 'inactive'
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("table"); // 'table' | 'grid'

  const isTeacher = userProfile?.role === "teacher";

  useEffect(() => {
    if (!isTeacher) navigate("/dashboard");
  }, [isTeacher, navigate]);

  useEffect(() => {
    setLoading(true);
    setError("");
    const q = query(collection(db, "users"), where("role", "==", "student"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setStudents(list);
        setLoading(false);
      },
      (err) => {
        console.error("Firestore onSnapshot error:", err);
        setError(err.message || "خطأ في جلب بيانات الطلاب");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "active"
          ? Boolean(s.isSubscribed)
          : !s.isSubscribed;

      const queryStr = search.trim().toLowerCase();
      const matchesSearch =
        !queryStr ||
        s.fullName?.toLowerCase().includes(queryStr) ||
        s.email?.toLowerCase().includes(queryStr) ||
        s.grade?.toLowerCase().includes(queryStr) ||
        s.phone?.includes(queryStr);

      return matchesFilter && matchesSearch;
    });
  }, [students, filter, search]);

  const stageGroups = useMemo(() => {
    const primary = [];
    const prep = [];
    const secondary = [];
    const others = [];

    filteredStudents.forEach((student) => {
      const g = student.grade || "";
      if (STAGES[0].grades.includes(g)) {
        primary.push(student);
      } else if (STAGES[1].grades.includes(g)) {
        prep.push(student);
      } else if (STAGES[2].grades.includes(g)) {
        secondary.push(student);
      } else {
        others.push(student);
      }
    });

    return [
      { ...STAGES[0], students: primary },
      { ...STAGES[1], students: prep },
      { ...STAGES[2], students: secondary },
      { id: "others", title: "📌 طلاب بدون مرحلة محددة", grades: [], students: others },
    ].filter((group) => group.students.length > 0);
  }, [filteredStudents]);

  const activeCount = students.filter((s) => Boolean(s.isSubscribed)).length;
  const inactiveCount = students.filter((s) => !s.isSubscribed).length;

  return (
    <div className="dashboard-modern fade-in">
      {/* Header Banner */}
      <div className="dashboard-banner glass">
        <div className="dashboard-banner-content">
          <img src="/logo-circle.png" alt="logo" className="dashboard-avatar" />
          <div>
            <h1 className="font-heading dashboard-welcome">
              <span className="text-gradient">إدارة اشتراكات الطلاب المنظمة</span>
            </h1>
            <p className="dashboard-role">
              إجمالي الطلاب: {students.length} | المفعلون: {activeCount} | المعلقون: {inactiveCount}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <Link
            to="/dashboard"
            className="button"
            style={{
              background: "rgba(255, 255, 255, 0.9)",
              color: "#0f172a",
              border: "1px solid #cbd5e1",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              fontSize: "0.88rem",
              padding: "0.6rem 1.1rem"
            }}
          >
            ← العودة للوحة التحكم
          </Link>
          <button onClick={() => navigate("/students/add")} className="button button-primary" style={{ padding: "0.6rem 1.25rem", fontSize: "0.88rem" }}>
            + إضافة طالب جديد
          </button>
        </div>
      </div>

      {/* Filter, Search, and View Controls */}
      <div className="student-controls glass" style={{ margin: "1.25rem 0", padding: "1.1rem 1.5rem", borderRadius: "var(--radius-md)", display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
        <div className="filter-tabs" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            onClick={() => setFilter("all")}
            className={`button button-sm ${filter === "all" ? "button-primary" : "button-muted"}`}
          >
            الجميع ({students.length})
          </button>
          <button
            onClick={() => setFilter("active")}
            className={`button button-sm ${filter === "active" ? "button-primary" : "button-muted"}`}
          >
            🟢 المفعلون ({activeCount})
          </button>
          <button
            onClick={() => setFilter("inactive")}
            className={`button button-sm ${filter === "inactive" ? "button-primary" : "button-muted"}`}
          >
            🔴 غير المفعلين ({inactiveCount})
          </button>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", flex: 1, justifyContent: "flex-end" }}>
          {/* View Mode Toggle */}
          <div style={{ display: "flex", background: "#e2e8f0", padding: "0.2rem", borderRadius: "20px" }}>
            <button
              onClick={() => setViewMode("table")}
              className={`button button-sm ${viewMode === "table" ? "button-primary" : "button-muted"}`}
              style={{ borderRadius: "18px", padding: "0.35rem 0.8rem", fontSize: "0.82rem" }}
            >
              📊 جدول مفصل
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`button button-sm ${viewMode === "grid" ? "button-primary" : "button-muted"}`}
              style={{ borderRadius: "18px", padding: "0.35rem 0.8rem", fontSize: "0.82rem" }}
            >
              📇 كروت مصغرة
            </button>
          </div>

          <div className="search-box" style={{ width: "100%", maxWidth: "280px" }}>
            <input
              type="text"
              className="form-input"
              placeholder="🔍 بحث باسم الطالب، الصف، أو البريد..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: "0.45rem 0.9rem", fontSize: "0.88rem" }}
            />
          </div>
        </div>
      </div>

      {loading && (
        <div className="loading-state">
          <img src="/logo-circle.png" alt="Loading" className="logo-loading-sway" style={{ width: 60, height: 60, objectFit: "cover" }} />
          <p>جاري تحميل بيانات الطلاب والاشتراكات...</p>
        </div>
      )}

      {error && <p className="form-error-modern">⚠️ {error}</p>}

      {!loading && filteredStudents.length === 0 && (
        <div className="empty-state glass">
          <span style={{ fontSize: "3.5rem" }}>👥</span>
          <p className="font-heading">لا توجد نتائج تطابق بحثك أو الفلتر المحدد</p>
        </div>
      )}

      {/* Grouped Stage Tables or Grids */}
      {!loading && stageGroups.map((group) => (
        <div key={group.id} className="stage-group-container glass" style={{ marginBottom: "1.75rem", padding: "1.25rem 1.5rem", borderRadius: "var(--radius-lg)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", paddingBottom: "0.5rem", borderBottom: "2px solid rgba(2, 132, 199, 0.15)" }}>
            <h3 className="font-heading" style={{ margin: 0, fontSize: "1.2rem", color: "#0f172a" }}>
              {group.title} <span style={{ fontSize: "0.85rem", color: "#0284c7", fontWeight: 700 }}>({group.students.length} طالب)</span>
            </h3>
          </div>

          {viewMode === "table" ? (
            <div className="recent-table-wrapper" style={{ overflowX: "auto" }}>
              <table className="recent-students-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid rgba(2, 132, 199, 0.2)", background: "rgba(2, 132, 199, 0.04)" }}>
                    <th style={{ padding: "0.75rem 1rem", color: "#475569", fontSize: "0.88rem" }}>الطالب والتواصل</th>
                    <th style={{ padding: "0.75rem 1rem", color: "#475569", fontSize: "0.88rem" }}>الصف والمجموعة</th>
                    <th style={{ padding: "0.75rem 1rem", color: "#475569", fontSize: "0.88rem" }}>حالة الاشتراك</th>
                    <th style={{ padding: "0.75rem 1rem", color: "#475569", fontSize: "0.88rem", textAlign: "left" }}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {group.students.map((s) => (
                    <StudentCard key={s.id} student={s} viewMode="table-row" />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="student-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))", gap: "1rem" }}>
              {group.students.map((s) => (
                <StudentCard key={s.id} student={s} viewMode="card" />
              ))}
            </div>
          )}
        </div>
      ))}

      <div style={{ marginTop: "1rem" }}>
        <Link to="/dashboard" className="button button-secondary">
          ← العودة إلى لوحة التحكم
        </Link>
      </div>
    </div>
  );
}

