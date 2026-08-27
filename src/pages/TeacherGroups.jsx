// src/pages/TeacherGroups.jsx
import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import StudentCard, { getSubscriptionInfo, hasActiveSubscription } from "../components/StudentCard";

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

export default function TeacherGroups() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeStage, setActiveStage] = useState("all"); // 'all' | 'primary' | 'prep' | 'secondary'
  const [viewMode, setViewMode] = useState("byGrade"); // 'byGrade' | 'byGroup'
  const [cardStyle, setCardStyle] = useState("table"); // 'table' | 'grid'
  const [subFilter, setSubFilter] = useState("all"); // 'all' | 'active' | 'inactive'
  const [search, setSearch] = useState("");

  const isTeacher = userProfile?.role === "teacher";

  useEffect(() => {
    if (!isTeacher) navigate("/dashboard");
  }, [isTeacher, navigate]);

  useEffect(() => {
    setLoading(true);
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
        console.error("Error fetching live student groups:", err);
        setError("تعذر تحميل تنظيم المجموعات والطلاب.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Filtered Students list based on search and subscription status
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // Sub filter
      const isActive = hasActiveSubscription(s);
      if (subFilter === "active" && !isActive) return false;
      if (subFilter === "inactive" && isActive) return false;

      // Search
      const queryStr = search.trim().toLowerCase();
      if (queryStr) {
        const nameMatch = s.fullName?.toLowerCase().includes(queryStr);
        const emailMatch = s.email?.toLowerCase().includes(queryStr);
        const gradeMatch = s.grade?.toLowerCase().includes(queryStr);
        const groupMatch = s.group?.toLowerCase().includes(queryStr);
        const phoneMatch = s.phone?.includes(queryStr);
        if (!nameMatch && !emailMatch && !gradeMatch && !groupMatch && !phoneMatch) {
          return false;
        }
      }

      return true;
    });
  }, [students, subFilter, search]);

  // Total active groups list derived dynamically from students data
  const allGroups = useMemo(() => {
    const groupSet = new Set();
    students.forEach((s) => {
      if (s.group) groupSet.add(s.group);
    });
    return Array.from(groupSet).sort();
  }, [students]);

  // Grouping by Grades & Groups
  const organizedByGrade = useMemo(() => {
    const gradesMap = {};

    filteredStudents.forEach((student) => {
      const g = student.grade || "غير محدد للصف";
      const grp = student.group || "بدون مجموعة مخصصة";

      if (!gradesMap[g]) {
        gradesMap[g] = {};
      }
      if (!gradesMap[g][grp]) {
        gradesMap[g][grp] = [];
      }
      gradesMap[g][grp].push(student);
    });

    return gradesMap;
  }, [filteredStudents]);

  // Grouping by Groups & Grades
  const organizedByGroup = useMemo(() => {
    const groupsMap = {};

    filteredStudents.forEach((student) => {
      const grp = student.group || "بدون مجموعة مخصصة";
      const g = student.grade || "غير محدد للصف";

      if (!groupsMap[grp]) {
        groupsMap[grp] = {};
      }
      if (!groupsMap[grp][g]) {
        groupsMap[grp][g] = [];
      }
      groupsMap[grp][g].push(student);
    });

    return groupsMap;
  }, [filteredStudents]);

  // Statistics calculation
  const totalSubscribers = useMemo(() => {
    return students.filter(hasActiveSubscription).length;
  }, [students]);

  return (
    <div className="dashboard-modern fade-in" style={{ paddingBottom: "3rem" }}>
      {/* Welcome & Navigation Banner */}
      <div className="dashboard-banner glass">
        <div className="dashboard-banner-content">
          <img src="/logo-circle.png" alt="logo" className="dashboard-avatar" />
          <div>
            <h1 className="font-heading dashboard-welcome">
              <span className="text-gradient">تنظيم الطلاب حسب المراحل والمجموعات</span> 🏫
            </h1>
            <p className="dashboard-role">
              إجمالي الطلاب: <strong>{students.length}</strong> | المفعلون:{" "}
              <strong style={{ color: "#34d399" }}>{totalSubscribers}</strong> | المجموعات المفعلة:{" "}
              <strong>{allGroups.length}</strong>
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button onClick={() => navigate("/students/add")} className="button button-primary button-sm">
            + إضافة طالب جديد
          </button>
          <Link to="/students" className="button button-muted button-sm">
            📋 قائمة الطلاب العامة
          </Link>
        </div>
      </div>

      {/* Control Tabs & Filters */}
      <div className="glass" style={{ margin: "1.5rem 0", padding: "1.25rem", borderRadius: "var(--radius-lg)" }}>
        {/* Top Controls: Stage selector & View mode */}
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          {/* Stage Tabs */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              onClick={() => setActiveStage("all")}
              className={`button button-sm ${activeStage === "all" ? "button-primary" : "button-muted"}`}
            >
              🌐 جميع المراحل
            </button>
            {STAGES.map((stage) => (
              <button
                key={stage.id}
                onClick={() => setActiveStage(stage.id)}
                className={`button button-sm ${activeStage === stage.id ? "button-primary" : "button-muted"}`}
              >
                {stage.title}
              </button>
            ))}
          </div>

          {/* View Mode & Card Style Toggles */}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: "0.3rem", background: "rgba(0,0,0,0.06)", padding: "0.2rem", borderRadius: "var(--radius-md)" }}>
              <button
                onClick={() => setViewMode("byGrade")}
                className={`button button-sm ${viewMode === "byGrade" ? "button-primary" : "button-muted"}`}
                style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
              >
                🎓 تقسيم الصفوف أولاً
              </button>
              <button
                onClick={() => setViewMode("byGroup")}
                className={`button button-sm ${viewMode === "byGroup" ? "button-primary" : "button-muted"}`}
                style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
              >
                👥 تقسيم المجموعات أولاً
              </button>
            </div>

            <div style={{ display: "flex", gap: "0.3rem", background: "rgba(0,0,0,0.06)", padding: "0.2rem", borderRadius: "var(--radius-md)" }}>
              <button
                onClick={() => setCardStyle("table")}
                className={`button button-sm ${cardStyle === "table" ? "button-primary" : "button-muted"}`}
                style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
              >
                📊 جدول
              </button>
              <button
                onClick={() => setCardStyle("grid")}
                className={`button button-sm ${cardStyle === "grid" ? "button-primary" : "button-muted"}`}
                style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
              >
                📇 كروت
              </button>
            </div>
          </div>
        </div>

        {/* Search & Subscription Filter */}
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <button
              onClick={() => setSubFilter("all")}
              className={`button button-sm ${subFilter === "all" ? "button-primary" : "button-muted"}`}
              style={{ fontSize: "0.8rem" }}
            >
              الكل ({filteredStudents.length})
            </button>
            <button
              onClick={() => setSubFilter("active")}
              className={`button button-sm ${subFilter === "active" ? "button-primary" : "button-muted"}`}
              style={{ fontSize: "0.8rem" }}
            >
              🟢 المفعلين فقط
            </button>
            <button
              onClick={() => setSubFilter("inactive")}
              className={`button button-sm ${subFilter === "inactive" ? "button-primary" : "button-muted"}`}
              style={{ fontSize: "0.8rem" }}
            >
              🔴 غير المفعلين
            </button>
          </div>

          <div style={{ flex: 1, maxWidth: "340px" }}>
            <input
              type="text"
              className="form-input"
              placeholder="🔍 بحث باسم الطالب، المجموعة، أو الصف..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", padding: "0.5rem 0.9rem", fontSize: "0.88rem" }}
            />
          </div>
        </div>
      </div>

      {loading && (
        <div className="loading-state">
          <img src="/logo-circle.png" alt="Loading" className="logo-loading-sway" style={{ width: 60, height: 60, objectFit: "cover" }} />
          <p>جاري تجميع وتصنيف المجموعات والصفوف...</p>
        </div>
      )}

      {error && <p className="form-error-modern">⚠️ {error}</p>}

      {/* VIEW MODE 1: BY GRADES -> GROUPS */}
      {!loading && viewMode === "byGrade" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {STAGES.filter((st) => activeStage === "all" || activeStage === st.id).map((stage) => {
            // Find grades in this stage that have students matching filters
            const stageGrades = stage.grades.filter(
              (gradeName) => organizedByGrade[gradeName] && Object.keys(organizedByGrade[gradeName]).length > 0
            );

            if (stageGrades.length === 0 && activeStage !== "all") {
              return (
                <div key={stage.id} className="empty-state glass">
                  <span style={{ fontSize: "3rem" }}>🎒</span>
                  <p className="font-heading">لا يوجد طلاب مسجلون في {stage.title} حالياً</p>
                </div>
              );
            }

            if (stageGrades.length === 0) return null;

            return (
              <div key={stage.id} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <h2 className="font-heading" style={{
                  fontSize: "1.4rem",
                  paddingBottom: "0.5rem",
                  borderBottom: "2px solid rgba(14, 165, 233, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}>
                  <span>{stage.title}</span>
                  <span style={{ fontSize: "0.9rem", fontWeight: "normal", color: "var(--color-muted)" }}>
                    عدد الصفوف النشطة: {stageGrades.length}
                  </span>
                </h2>

                {stageGrades.map((gradeName) => {
                  const groupsInGrade = organizedByGrade[gradeName];
                  const gradeTotalStudents = Object.values(groupsInGrade).flat().length;
                  const gradeActiveSubscribers = Object.values(groupsInGrade).flat().filter(hasActiveSubscription).length;

                  return (
                    <div key={gradeName} className="glass" style={{ padding: "1.5rem", borderRadius: "var(--radius-lg)" }}>
                      {/* Grade Header */}
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                        marginBottom: "1.25rem",
                        background: "rgba(14, 165, 233, 0.08)",
                        padding: "0.75rem 1rem",
                        borderRadius: "var(--radius-md)",
                        borderRight: "4px solid var(--color-primary)"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          <span style={{ fontSize: "1.3rem" }}>🎓</span>
                          <h3 className="font-heading" style={{ margin: 0, fontSize: "1.2rem", color: "var(--color-primary)" }}>
                            {gradeName}
                          </h3>
                        </div>
                        <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.85rem" }}>
                          <span style={{ background: "rgba(255,255,255,0.6)", padding: "0.3rem 0.75rem", borderRadius: "20px" }}>
                            👥 الطلاب: <strong>{gradeTotalStudents}</strong>
                          </span>
                          <span style={{ background: "rgba(16, 185, 129, 0.15)", color: "#059669", padding: "0.3rem 0.75rem", borderRadius: "20px", fontWeight: "700" }}>
                            🟢 المفعلون: {gradeActiveSubscribers}
                          </span>
                        </div>
                      </div>

                      {/* Groups inside this grade */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                        {Object.entries(groupsInGrade).map(([groupName, groupStudents]) => (
                          <div key={groupName} style={{
                            background: "#ffffff",
                            border: "1px solid rgba(0, 0, 0, 0.08)",
                            borderRadius: "var(--radius-md)",
                            padding: "1rem"
                          }}>
                            {/* Group Header */}
                            <div style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: "0.85rem",
                              borderBottom: "1px dashed rgba(0,0,0,0.1)",
                              paddingBottom: "0.5rem"
                            }}>
                              <span style={{ fontWeight: "800", color: "#7c3aed", fontSize: "1rem" }}>
                                👥 {groupName} ({groupStudents.length} طالب)
                              </span>
                              <span style={{ fontSize: "0.8rem", color: "var(--color-muted)", fontWeight: "600" }}>
                                المفعلين: {groupStudents.filter(hasActiveSubscription).length} من {groupStudents.length}
                              </span>
                            </div>

                            {/* Group Student Cards / Table */}
                            {cardStyle === "table" ? (
                              <div className="recent-table-wrapper" style={{ overflowX: "auto" }}>
                                <table className="recent-students-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
                                  <thead>
                                    <tr style={{ borderBottom: "2px solid rgba(2, 132, 199, 0.2)", background: "rgba(2, 132, 199, 0.04)" }}>
                                      <th style={{ padding: "0.6rem 0.85rem", color: "#475569", fontSize: "0.85rem" }}>الطالب والتواصل</th>
                                      <th style={{ padding: "0.6rem 0.85rem", color: "#475569", fontSize: "0.85rem" }}>الصف والمجموعة</th>
                                      <th style={{ padding: "0.6rem 0.85rem", color: "#475569", fontSize: "0.85rem" }}>حالة الاشتراك</th>
                                      <th style={{ padding: "0.6rem 0.85rem", color: "#475569", fontSize: "0.85rem", textAlign: "left" }}>الإجراءات</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {groupStudents.map((s) => (
                                      <StudentCard key={s.id} student={s} viewMode="table-row" />
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="student-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 250px), 1fr))", gap: "0.85rem" }}>
                                {groupStudents.map((s) => (
                                  <StudentCard key={s.id} student={s} viewMode="card" />
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW MODE 2: BY GROUPS -> GRADES */}
      {!loading && viewMode === "byGroup" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {Object.keys(organizedByGroup).length === 0 ? (
            <div className="empty-state glass">
              <span style={{ fontSize: "3.5rem" }}>👥</span>
              <p className="font-heading">لا توجد مجموعات تطابق الفلتر أو البحث</p>
            </div>
          ) : (
            Object.entries(organizedByGroup).map(([groupName, gradesMap]) => {
              const allStudentsInGroup = Object.values(gradesMap).flat();
              const groupActiveSubscribers = allStudentsInGroup.filter(hasActiveSubscription).length;

              return (
                <div key={groupName} className="glass" style={{ padding: "1.5rem", borderRadius: "var(--radius-lg)" }}>
                  {/* Group Main Header */}
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                    marginBottom: "1.25rem",
                    background: "rgba(124, 58, 237, 0.08)",
                    padding: "0.85rem 1.1rem",
                    borderRadius: "var(--radius-md)",
                    borderRight: "4px solid #7c3aed"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <span style={{ fontSize: "1.4rem" }}>👥</span>
                      <h3 className="font-heading" style={{ margin: 0, fontSize: "1.25rem", color: "#7c3aed" }}>
                        {groupName}
                      </h3>
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.85rem" }}>
                      <span style={{ background: "rgba(0,0,0,0.05)", padding: "0.3rem 0.75rem", borderRadius: "20px" }}>
                        إجمالي طلاب المجموعة: <strong>{allStudentsInGroup.length}</strong>
                      </span>
                      <span style={{ background: "rgba(16, 185, 129, 0.15)", color: "#059669", padding: "0.3rem 0.75rem", borderRadius: "20px", fontWeight: "700" }}>
                        🟢 المفعلون: {groupActiveSubscribers}
                      </span>
                    </div>
                  </div>

                  {/* Grades distribution inside this group */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                    {Object.entries(gradesMap).map(([gradeName, groupStudents]) => (
                      <div key={gradeName} style={{
                        background: "#ffffff",
                        border: "1px solid rgba(0, 0, 0, 0.08)",
                        borderRadius: "var(--radius-md)",
                        padding: "1rem"
                      }}>
                        <div style={{ marginBottom: "0.75rem", fontWeight: "800", color: "var(--color-primary)", fontSize: "0.95rem" }}>
                          🎓 {gradeName} ({groupStudents.length} طالب)
                        </div>
                        {cardStyle === "table" ? (
                          <div className="recent-table-wrapper" style={{ overflowX: "auto" }}>
                            <table className="recent-students-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
                              <thead>
                                <tr style={{ borderBottom: "2px solid rgba(2, 132, 199, 0.2)", background: "rgba(2, 132, 199, 0.04)" }}>
                                  <th style={{ padding: "0.6rem 0.85rem", color: "#475569", fontSize: "0.85rem" }}>الطالب والتواصل</th>
                                  <th style={{ padding: "0.6rem 0.85rem", color: "#475569", fontSize: "0.85rem" }}>الصف والمجموعة</th>
                                  <th style={{ padding: "0.6rem 0.85rem", color: "#475569", fontSize: "0.85rem" }}>حالة الاشتراك</th>
                                  <th style={{ padding: "0.6rem 0.85rem", color: "#475569", fontSize: "0.85rem", textAlign: "left" }}>الإجراءات</th>
                                </tr>
                              </thead>
                              <tbody>
                                {groupStudents.map((s) => (
                                  <StudentCard key={s.id} student={s} viewMode="table-row" />
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="student-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 250px), 1fr))", gap: "0.85rem" }}>
                            {groupStudents.map((s) => (
                              <StudentCard key={s.id} student={s} viewMode="card" />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Footer Back Action */}
      <div style={{ marginTop: "2.5rem" }}>
        <Link to="/dashboard" className="button button-secondary">
          ← العودة إلى لوحة التحكم
        </Link>
      </div>
    </div>
  );
}
