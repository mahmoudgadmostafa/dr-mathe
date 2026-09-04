// src/pages/TeacherLibrary.jsx
import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
} from "firebase/firestore";

const GRADES = [
  "جميع الصفوف الدراسية",
  "الصف الأول الابتدائي", "الصف الثاني الابتدائي", "الصف الثالث الابتدائي",
  "الصف الرابع الابتدائي", "الصف الخامس الابتدائي", "الصف السادس الابتدائي",
  "الصف الأول الإعدادي", "الصف الثاني الإعدادي", "الصف الثالث الإعدادي",
  "الصف الأول الثانوي", "الصف الثاني الثانوي", "الصف الثالث الثانوي",
];

const GROUPS = [
  "جميع المجموعات",
  "المجموعة A", "المجموعة B", "المجموعة C", "المجموعة D",
  "مجموعة الصباح", "مجموعة المساء",
  "مجموعة خاصة 1", "مجموعة خاصة 2",
];

const RESOURCE_TYPES = [
  { id: "video", label: "🎬 فيديو شرح (Embed Player)", icon: "🎬", color: "#0ea5e9" },
  { id: "pdf", label: "📄 ملازم وشروحات (PDF Viewer)", icon: "📄", color: "#ef4444" },
  { id: "infographic", label: "🖼️ محتويات أخرى (Infographic)", icon: "🖼️", color: "#8b5cf6" },
];

// Helper to get embeddable iframe URL for Youtube & Google Drive
export function getEmbedUrl(url, type) {
  if (!url) return "";
  const trimmed = url.trim();

  if (type === "video") {
    // YouTube links
    const ytMatch = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (ytMatch && ytMatch[1]) {
      return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0`;
    }
    // Vimeo link
    const vimeoMatch = trimmed.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch && vimeoMatch[1]) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }
  }

  if (type === "pdf") {
    // Google Drive PDF link
    const driveMatch = trimmed.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
    if (driveMatch && driveMatch[1]) {
      return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    }
  }

  return trimmed;
}

export default function TeacherLibrary() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [typeFilter, setTypeFilter] = useState("all"); // 'all' | 'video' | 'pdf' | 'infographic'
  const [gradeFilter, setGradeFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedLessons, setExpandedLessons] = useState({});

  const [form, setForm] = useState({
    lessonNumber: "",
    lessonTitle: "",
    title: "",
    type: "video",
    url: "",
    grade: "جميع الصفوف الدراسية",
    group: "جميع المجموعات",
    description: "",
  });

  const isTeacher = userProfile?.role === "teacher";

  useEffect(() => {
    if (!isTeacher) navigate("/dashboard");
  }, [isTeacher, navigate]);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "library_items"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setItems(list);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading library items:", err);
        setError("تعذر تحميل المحتوى التعليمي.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const openAddModal = (presetType = "video", presetLessonNum = "", presetLessonTitle = "") => {
    setEditingId(null);
    setForm({
      lessonNumber: presetLessonNum || "",
      lessonTitle: presetLessonTitle || "",
      title: "",
      type: presetType,
      url: "",
      grade: gradeFilter !== "all" ? gradeFilter : "جميع الصفوف الدراسية",
      group: groupFilter !== "all" ? groupFilter : "جميع المجموعات",
      description: "",
    });
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setForm({
      lessonNumber: item.lessonNumber ?? "",
      lessonTitle: item.lessonTitle ?? "",
      title: item.title || "",
      type: item.type || "video",
      url: item.url || "",
      grade: item.grade || "جميع الصفوف الدراسية",
      group: item.group || "جميع المجموعات",
      description: item.description || "",
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.url.trim()) {
      alert("يرجى إدخال عنوان المحتوى والرابط.");
      return;
    }

    setSaving(true);
    const embedUrl = getEmbedUrl(form.url, form.type);

    try {
      if (editingId) {
        await updateDoc(doc(db, "library_items", editingId), {
          ...form,
          embedUrl,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "library_items"), {
          ...form,
          embedUrl,
          teacherId: userProfile?.uid || "teacher",
          createdAt: serverTimestamp(),
        });
      }
      setShowModal(false);
    } catch (err) {
      console.error("Error saving content item:", err);
      alert("حدث خطأ أثناء حفظ المحتوى التعليمي.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`هل أنت تأكد من حذف المحتوى التعليمي "${title}"؟`)) return;
    try {
      await deleteDoc(doc(db, "library_items", id));
    } catch (err) {
      console.error("Error deleting library item:", err);
      alert("حدث خطأ أثناء حذف المحتوى.");
    }
  };

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (gradeFilter !== "all" && item.grade !== gradeFilter && item.grade !== "جميع الصفوف الدراسية") return false;
      if (groupFilter !== "all" && item.group !== groupFilter && item.group !== "جميع المجموعات") return false;

      const qStr = search.trim().toLowerCase();
      if (qStr) {
        const titleMatch = item.title?.toLowerCase().includes(qStr);
        const lessonTitleMatch = item.lessonTitle?.toLowerCase().includes(qStr);
        const lessonNumMatch = String(item.lessonNumber || "").includes(qStr);
        const descMatch = item.description?.toLowerCase().includes(qStr);
        const gradeMatch = item.grade?.toLowerCase().includes(qStr);
        const groupMatch = item.group?.toLowerCase().includes(qStr);
        if (!titleMatch && !lessonTitleMatch && !lessonNumMatch && !descMatch && !gradeMatch && !groupMatch) return false;
      }

      return true;
    });
  }, [items, typeFilter, gradeFilter, groupFilter, search]);

  const counts = useMemo(() => {
    return {
      total: items.length,
      video: items.filter((i) => i.type === "video").length,
      pdf: items.filter((i) => i.type === "pdf").length,
      infographic: items.filter((i) => i.type === "infographic").length,
    };
  }, [items]);

  // Group filtered items by lesson number (primary key) then title
  const groupedLessons = useMemo(() => {
    const map = new Map();

    filteredItems.forEach((item) => {
      const rawNum = item.lessonNumber != null ? String(item.lessonNumber).trim() : "";
      const rawTitle = item.lessonTitle ? String(item.lessonTitle).trim() : "";

      let groupKey;
      let displayNum = rawNum;
      let displayTitle = rawTitle;

      if (rawNum !== "") {
        groupKey = `num_${rawNum}`;
        if (!displayTitle && map.has(groupKey)) {
          displayTitle = map.get(groupKey).lessonTitle;
        }
      } else {
        if (!displayTitle && item.title) {
          const match = item.title.match(/^(?:الدرس|درس)\s*([0-9]+)\s*[:\-–]\s*(.+)/i);
          if (match) {
            displayNum = match[1].trim();
            displayTitle = match[2].trim();
            groupKey = `num_${displayNum}`;
          } else if (item.chapter) {
            displayTitle = item.chapter.trim();
            groupKey = `chapter_${displayTitle}`;
          } else {
            displayTitle = item.title.trim();
            groupKey = `title_${displayTitle}`;
          }
        } else {
          groupKey = displayTitle ? `title_${displayTitle}` : `other_ungrouped`;
        }
      }

      if (!displayTitle) displayTitle = "شروحات ومواد إضافية";

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          id: groupKey,
          lessonNumber: displayNum,
          lessonTitle: displayTitle,
          videos: [],
          pdfs: [],
          infographics: [],
          allItems: [],
        });
      }

      const grp = map.get(groupKey);
      if (!grp.lessonTitle && displayTitle) grp.lessonTitle = displayTitle;
      if (!grp.lessonNumber && displayNum) grp.lessonNumber = displayNum;

      grp.allItems.push(item);
      if (item.type === "video") grp.videos.push(item);
      else if (item.type === "pdf") grp.pdfs.push(item);
      else if (item.type === "infographic") grp.infographics.push(item);
    });

    const list = Array.from(map.values());

    // Sort items inside each lesson: videos first, then pdfs, then infographics
    list.forEach((l) => {
      l.allItems = [...l.videos, ...l.pdfs, ...l.infographics];
    });

    // Sort lessons numerically
    list.sort((a, b) => {
      const numA = parseInt(a.lessonNumber, 10);
      const numB = parseInt(b.lessonNumber, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      if (!isNaN(numA)) return -1;
      if (!isNaN(numB)) return 1;
      return (a.lessonTitle || "").localeCompare(b.lessonTitle || "", "ar");
    });

    return list;
  }, [filteredItems]);

  const toggleLesson = (id) => {
    setExpandedLessons((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  const expandAllLessons = () => {
    const all = {};
    groupedLessons.forEach((l) => { all[l.id] = true; });
    setExpandedLessons(all);
  };

  const collapseAllLessons = () => {
    const none = {};
    groupedLessons.forEach((l) => { none[l.id] = false; });
    setExpandedLessons(none);
  };

  return (
    <div className="dashboard-modern fade-in" style={{ paddingBottom: "3rem" }}>
      {/* Banner */}
      <div className="dashboard-banner glass">
        <div className="dashboard-banner-content">
          <img src="/logo-circle.png" alt="logo" className="dashboard-avatar" />
          <div>
            <h1 className="font-heading dashboard-welcome">
              <span className="text-gradient">المكتبة التعليمية والشروحات</span> 🎬📄🖼️
            </h1>
            <p className="dashboard-role">
              إضافة فيديوهات الشرح، ملازم وشروحات PDF، والمحتويات الأخرى لكل صف ومجموعة
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button onClick={() => openAddModal("video")} className="button button-primary button-sm">
            + إضافة فيديو شرح 🎬
          </button>
          <button onClick={() => openAddModal("pdf")} className="button button-secondary button-sm">
            + إضافة ملف PDF 📄
          </button>
          <button onClick={() => openAddModal("infographic")} className="button button-muted button-sm">
            + إضافة محتوى آخر 🖼️
          </button>
        </div>
      </div>

      {/* 🎯 Grade & Group Selection Box */}
      <div
        className="glass"
        style={{
          margin: "1.5rem 0 1rem",
          padding: "1.4rem 1.8rem",
          borderRadius: "var(--radius-lg)",
          background: "linear-gradient(135deg, rgba(30, 27, 75, 0.8), rgba(15, 23, 42, 0.95))",
          border: "1.5px solid rgba(139, 92, 246, 0.35)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.3)"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 900, color: "#ffffff", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>🎯</span>
              <span>تحديد الصف والمجموعة لتنظيم عرض الدروس</span>
            </h3>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: "#cbd5e1", fontWeight: 600 }}>
              اختر الصف والمجموعة لعرض الدروس والمحتويات التابعة لهما بتنظيم متسلسل
            </p>
          </div>

          {(gradeFilter !== "all" || groupFilter !== "all") && (
            <button
              onClick={() => {
                setGradeFilter("all");
                setGroupFilter("all");
              }}
              className="button button-sm button-muted"
              style={{ fontSize: "0.8rem", fontWeight: 700, borderRadius: "10px", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)" }}
            >
              🔄 عرض جميع الصفوف والمجموعات
            </button>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
          {/* Grade Selector */}
          <div>
            <label style={{ display: "block", fontSize: "0.84rem", fontWeight: 800, color: "#38bdf8", marginBottom: "0.4rem" }}>
              🎓 الصف الدراسي المستهدف:
            </label>
            <select
              className="form-input"
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              style={{
                width: "100%",
                padding: "0.65rem 0.9rem",
                borderRadius: "12px",
                background: "rgba(15, 23, 42, 0.85)",
                border: "1.5px solid rgba(56, 189, 248, 0.4)",
                color: "#ffffff",
                fontWeight: 800,
                fontSize: "0.9rem"
              }}
            >
              <option value="all">🌐 جميع الصفوف الدراسية</option>
              {GRADES.filter((g) => g !== "جميع الصفوف الدراسية").map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Group Selector */}
          <div>
            <label style={{ display: "block", fontSize: "0.84rem", fontWeight: 800, color: "#4ade80", marginBottom: "0.4rem" }}>
              👥 المجموعة المستهدفة:
            </label>
            <select
              className="form-input"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              style={{
                width: "100%",
                padding: "0.65rem 0.9rem",
                borderRadius: "12px",
                background: "rgba(15, 23, 42, 0.85)",
                border: "1.5px solid rgba(74, 222, 128, 0.4)",
                color: "#ffffff",
                fontWeight: 800,
                fontSize: "0.9rem"
              }}
            >
              <option value="all">👥 جميع المجموعات</option>
              {GROUPS.filter((grp) => grp !== "جميع المجموعات").map((grp) => (
                <option key={grp} value={grp}>{grp}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Current Active Selection Summary */}
        <div style={{ marginTop: "1rem", paddingTop: "0.8rem", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.8rem" }}>
          <div style={{ fontSize: "0.85rem", color: "#e2e8f0", fontWeight: 700 }}>
            📌 المعروض حالياً: <span style={{ color: "#38bdf8", fontWeight: 900 }}>{gradeFilter === "all" ? "جميع الصفوف" : gradeFilter}</span> — <span style={{ color: "#4ade80", fontWeight: 900 }}>{groupFilter === "all" ? "جميع المجموعات" : groupFilter}</span>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", fontSize: "0.78rem" }}>
            <span style={{ background: "rgba(168,85,247,0.18)", color: "#d8b4fe", padding: "0.2rem 0.6rem", borderRadius: "8px", fontWeight: 800, border: "1px solid rgba(168,85,247,0.3)" }}>
              📖 {groupedLessons.length} درس
            </span>
            <span style={{ background: "rgba(14,165,233,0.18)", color: "#38bdf8", padding: "0.2rem 0.6rem", borderRadius: "8px", fontWeight: 800, border: "1px solid rgba(14,165,233,0.3)" }}>
              🎬 {filteredItems.filter((i) => i.type === "video").length} فيديو
            </span>
            <span style={{ background: "rgba(239,68,68,0.18)", color: "#fca5a5", padding: "0.2rem 0.6rem", borderRadius: "8px", fontWeight: 800, border: "1px solid rgba(239,68,68,0.3)" }}>
              📄 {filteredItems.filter((i) => i.type === "pdf").length} ملازم وشروحات
            </span>
            <span style={{ background: "rgba(34,197,94,0.18)", color: "#86efac", padding: "0.2rem 0.6rem", borderRadius: "8px", fontWeight: 800, border: "1px solid rgba(34,197,94,0.3)" }}>
              🖼️ {filteredItems.filter((i) => i.type === "infographic").length} محتويات أخرى
            </span>
          </div>
        </div>
      </div>

      {/* Control Bar & Type Filters */}
      <div className="glass" style={{ margin: "0 0 1.5rem", padding: "1.1rem 1.4rem", borderRadius: "var(--radius-lg)", background: "rgba(15,23,42,0.75)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
          {/* Type Filter Tabs */}
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            <button
              onClick={() => setTypeFilter("all")}
              className={`button button-sm ${typeFilter === "all" ? "button-primary" : "button-muted"}`}
              style={{ fontSize: "0.84rem", fontWeight: 800, borderRadius: "10px" }}
            >
              الكل ({counts.total})
            </button>
            <button
              onClick={() => setTypeFilter("video")}
              className={`button button-sm ${typeFilter === "video" ? "button-primary" : "button-muted"}`}
              style={{ fontSize: "0.84rem", fontWeight: 800, borderRadius: "10px" }}
            >
              🎬 فيديوهات ({counts.video})
            </button>
            <button
              onClick={() => setTypeFilter("pdf")}
              className={`button button-sm ${typeFilter === "pdf" ? "button-primary" : "button-muted"}`}
              style={{ fontSize: "0.84rem", fontWeight: 800, borderRadius: "10px" }}
            >
              📄 ملازم وشروحات ({counts.pdf})
            </button>
            <button
              onClick={() => setTypeFilter("infographic")}
              className={`button button-sm ${typeFilter === "infographic" ? "button-primary" : "button-muted"}`}
              style={{ fontSize: "0.84rem", fontWeight: 800, borderRadius: "10px" }}
            >
              🖼️ محتويات أخرى ({counts.infographic})
            </button>
          </div>

          {/* Bulk Accordion Controls & Search */}
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap", flex: "1 1 320px", justifyContent: "flex-end" }}>
            <div style={{ display: "flex", gap: "0.35rem" }}>
              <button
                onClick={expandAllLessons}
                className="button button-sm button-muted"
                style={{ fontSize: "0.78rem", fontWeight: 700, borderRadius: "10px", border: "1px solid rgba(255,255,255,0.12)" }}
                title="فتح جميع محتويات الدروس"
              >
                📂 فتح الكل
              </button>
              <button
                onClick={collapseAllLessons}
                className="button button-sm button-muted"
                style={{ fontSize: "0.78rem", fontWeight: 700, borderRadius: "10px", border: "1px solid rgba(255,255,255,0.12)" }}
                title="طي جميع القوائم"
              >
                📁 طي الكل
              </button>
            </div>

            <div style={{ minWidth: "200px", flex: 1, maxWidth: "300px" }}>
              <input
                type="text"
                className="form-input"
                placeholder="🔍 بحث باسم الدرس أو العنوان..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: "100%", padding: "0.5rem 0.85rem", fontSize: "0.85rem", borderRadius: "10px" }}
              />
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="loading-state" style={{ marginTop: "2rem" }}>
          <img src="/logo-circle.png" alt="Loading" className="logo-loading-sway" style={{ width: 60, height: 60, objectFit: "cover" }} />
          <p>جاري تحميل المكتبة والمحتوى التعليمي...</p>
        </div>
      )}

      {error && <p className="form-error-modern">⚠️ {error}</p>}

      {!loading && groupedLessons.length === 0 && (
        <div className="empty-state glass" style={{ marginTop: "2rem" }}>
          <span style={{ fontSize: "3.5rem" }}>📚</span>
          <p className="font-heading">لا يوجد محتوى تعليمي مطابق لهذا الصف أو المجموعة</p>
          <button onClick={() => openAddModal("video")} className="button button-primary" style={{ marginTop: "1rem" }}>
            + إضافة محتوى تعليمي جديد
          </button>
        </div>
      )}

      {/* Grouped Lessons Accordion List */}
      {!loading && groupedLessons.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          {groupedLessons.map((lesson, idx) => {
            const isExpanded = expandedLessons[lesson.id] ?? true;

            return (
              <div
                key={lesson.id}
                className="glass"
                style={{
                  borderRadius: "20px",
                  background: isExpanded
                    ? "linear-gradient(180deg, rgba(24, 32, 54, 0.95), rgba(15, 23, 42, 0.98))"
                    : "rgba(20, 28, 48, 0.8)",
                  border: isExpanded
                    ? "1.5px solid rgba(168, 85, 247, 0.45)"
                    : "1.5px solid rgba(255, 255, 255, 0.1)",
                  overflow: "hidden",
                  boxShadow: isExpanded
                    ? "0 10px 30px rgba(0, 0, 0, 0.35), 0 0 18px rgba(168, 85, 247, 0.12)"
                    : "0 4px 15px rgba(0, 0, 0, 0.2)",
                  transition: "all 0.25s ease"
                }}
              >
                {/* Accordion Header */}
                <div
                  style={{
                    padding: "1.15rem 1.5rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.8rem",
                    background: isExpanded ? "rgba(168, 85, 247, 0.08)" : "transparent"
                  }}
                >
                  {/* Right: Lesson Number Badge + Title */}
                  <div
                    onClick={() => toggleLesson(lesson.id)}
                    style={{ display: "flex", alignItems: "center", gap: "0.8rem", cursor: "pointer", flexWrap: "wrap", flex: 1 }}
                  >
                    <div
                      style={{
                        background: "linear-gradient(135deg, #8b5cf6, #3b82f6)",
                        color: "#ffffff",
                        padding: "0.38rem 0.85rem",
                        borderRadius: "11px",
                        fontWeight: 900,
                        fontSize: "0.88rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        boxShadow: "0 4px 12px rgba(139, 92, 246, 0.3)",
                        whiteSpace: "nowrap"
                      }}
                    >
                      <span>📖</span>
                      <span>{lesson.lessonNumber ? `الدرس ${lesson.lessonNumber}` : `الدرس ${idx + 1}`}</span>
                    </div>

                    <h3
                      style={{
                        margin: 0,
                        fontSize: "1.18rem",
                        fontWeight: 900,
                        color: "#ffffff",
                        letterSpacing: "0.2px"
                      }}
                    >
                      {lesson.lessonTitle}
                    </h3>

                    {/* Summary counts */}
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                      {lesson.videos.length > 0 && (
                        <span style={{ background: "rgba(14, 165, 233, 0.18)", color: "#7dd3fc", border: "1px solid rgba(14, 165, 233, 0.3)", fontSize: "0.74rem", fontWeight: 800, padding: "0.15rem 0.5rem", borderRadius: "8px" }}>
                          🎬 {lesson.videos.length} فيديو
                        </span>
                      )}
                      {lesson.pdfs.length > 0 && (
                        <span style={{ background: "rgba(239, 68, 68, 0.18)", color: "#fca5a5", border: "1px solid rgba(239, 68, 68, 0.3)", fontSize: "0.74rem", fontWeight: 800, padding: "0.15rem 0.5rem", borderRadius: "8px" }}>
                          📄 {lesson.pdfs.length} ملازم وشروحات
                        </span>
                      )}
                      {lesson.infographics.length > 0 && (
                        <span style={{ background: "rgba(34, 197, 94, 0.18)", color: "#86efac", border: "1px solid rgba(34, 197, 94, 0.3)", fontSize: "0.74rem", fontWeight: 800, padding: "0.15rem 0.5rem", borderRadius: "8px" }}>
                          🖼️ {lesson.infographics.length} محتويات أخرى
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Left: Quick Add for This Lesson + Accordion Chevron */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <button
                      type="button"
                      onClick={() => openAddModal("video", lesson.lessonNumber, lesson.lessonTitle)}
                      className="button button-sm button-primary"
                      style={{ fontSize: "0.78rem", padding: "0.35rem 0.75rem", borderRadius: "10px", fontWeight: 800 }}
                      title="إضافة فيديو أو ملف لهذا الدرس مباشرة"
                    >
                      + إضافة لهذا الدرس
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleLesson(lesson.id)}
                      style={{
                        background: isExpanded ? "rgba(168, 85, 247, 0.2)" : "rgba(255, 255, 255, 0.08)",
                        color: isExpanded ? "#e9d5ff" : "#cbd5e1",
                        border: `1px solid ${isExpanded ? "rgba(168, 85, 247, 0.4)" : "rgba(255, 255, 255, 0.12)"}`,
                        padding: "0.35rem 0.75rem",
                        borderRadius: "10px",
                        fontSize: "0.78rem",
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.4rem"
                      }}
                    >
                      <span>{isExpanded ? "طي" : `عرض (${lesson.allItems.length})`}</span>
                      <span
                        style={{
                          display: "inline-block",
                          transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.25s ease",
                          fontSize: "0.7rem"
                        }}
                      >
                        ▼
                      </span>
                    </button>
                  </div>
                </div>

                {/* Collapsible Lesson Content (Compact rows) */}
                {isExpanded && (
                  <div
                    className="fade-in"
                    style={{
                      padding: "0.85rem 1.2rem 1.1rem",
                      borderTop: "1px solid rgba(255, 255, 255, 0.07)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem"
                    }}
                  >
                    {lesson.allItems.map((item, itemIdx) => {
                      const isVideo = item.type === "video";
                      const isPdf = item.type === "pdf";
                      const accent = isVideo
                        ? { bg: "rgba(14,165,233,0.1)", border: "rgba(14,165,233,0.28)", tag: "#38bdf8", tagBg: "rgba(14,165,233,0.18)", icon: "🎬", label: "فيديو" }
                        : isPdf
                        ? { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.25)", tag: "#f87171", tagBg: "rgba(239,68,68,0.18)", icon: "📄", label: "ملازم وشروحات" }
                        : { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.25)", tag: "#4ade80", tagBg: "rgba(34,197,94,0.18)", icon: "🖼️", label: "محتويات أخرى" };

                      const prevItem = lesson.allItems[itemIdx - 1];
                      const typeChanged = itemIdx > 0 && prevItem.type !== item.type;

                      return (
                        <div key={item.id}>
                          {typeChanged && (
                            <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", margin: "0.35rem 0" }} />
                          )}

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.75rem",
                              background: accent.bg,
                              border: `1px solid ${accent.border}`,
                              borderRadius: "12px",
                              padding: "0.55rem 0.85rem",
                              flexWrap: "wrap"
                            }}
                          >
                            {/* Type Icon */}
                            <span style={{ fontSize: "1.15rem", lineHeight: 1, flexShrink: 0 }}>
                              {accent.icon}
                            </span>

                            {/* Item details */}
                            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
                                <span style={{ background: accent.tagBg, color: accent.tag, fontSize: "0.68rem", fontWeight: 800, padding: "0.1rem 0.45rem", borderRadius: "6px", flexShrink: 0 }}>
                                  {accent.label}
                                </span>
                                <span style={{ fontSize: "0.92rem", fontWeight: 800, color: "#ffffff" }}>
                                  {item.title}
                                </span>
                                <span style={{ fontSize: "0.75rem", color: "#94a3b8", background: "rgba(255,255,255,0.06)", padding: "0.1rem 0.45rem", borderRadius: "6px" }}>
                                  🎓 {item.grade}
                                </span>
                                <span style={{ fontSize: "0.75rem", color: "#94a3b8", background: "rgba(255,255,255,0.06)", padding: "0.1rem 0.45rem", borderRadius: "6px" }}>
                                  👥 {item.group}
                                </span>
                              </div>

                              {item.description && (
                                <p style={{ margin: "0.15rem 0 0 0", fontSize: "0.76rem", color: "#94a3b8", fontWeight: 600 }}>
                                  📝 {item.description}
                                </p>
                              )}
                            </div>

                            {/* Teacher Actions */}
                            <div style={{ display: "flex", gap: "0.35rem", alignItems: "center", flexShrink: 0 }}>
                              <button
                                onClick={() => setPreviewItem(item)}
                                className="button button-sm button-secondary"
                                style={{ fontSize: "0.75rem", padding: "0.3rem 0.65rem", borderRadius: "8px", fontWeight: 700 }}
                                title="معاينة المورد داخل العارض"
                              >
                                👁️ معاينة
                              </button>
                              <button
                                onClick={() => openEditModal(item)}
                                className="button button-sm button-muted"
                                style={{ fontSize: "0.75rem", padding: "0.3rem 0.65rem", borderRadius: "8px", color: "#818cf8", fontWeight: 700 }}
                                title="تعديل تفاصيل المورد"
                              >
                                ✏️ تعديل
                              </button>
                              <button
                                onClick={() => handleDelete(item.id, item.title)}
                                className="button button-sm button-muted"
                                style={{ fontSize: "0.75rem", padding: "0.3rem 0.65rem", borderRadius: "8px", color: "var(--color-error)", fontWeight: 700 }}
                                title="حذف المورد"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "1rem"
        }}>
          <div className="glass" style={{
            background: "var(--color-surface)",
            padding: "2rem",
            borderRadius: "var(--radius-lg)",
            maxWidth: "520px",
            width: "100%",
            boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
            border: "1px solid rgba(14, 165, 233, 0.3)"
          }}>
            <h3 className="font-heading" style={{ margin: "0 0 1rem 0", fontSize: "1.3rem" }}>
              {editingId ? "✏️ تعديل المحتوى التعليمي" : "⚡ إضافة محتوى تعليمي جديد"}
            </h3>

            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Lesson Number & Lesson Title */}
              <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: "0.8rem" }}>
                <div>
                  <label style={{ display: "block", fontWeight: "700", marginBottom: "0.3rem", fontSize: "0.875rem" }}>
                    🔢 رقم الدرس
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="مثال: 1"
                    value={form.lessonNumber}
                    onChange={(e) => setForm({ ...form, lessonNumber: e.target.value })}
                    style={{ width: "100%", padding: "0.6rem 0.8rem", textAlign: "center", fontWeight: "bold" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: "700", marginBottom: "0.3rem", fontSize: "0.875rem" }}>
                    📖 اسم الدرس الأساسي
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="مثال: الاشتقاق وقواعد السلسلة..."
                    value={form.lessonTitle}
                    onChange={(e) => setForm({ ...form, lessonTitle: e.target.value })}
                    style={{ width: "100%", padding: "0.6rem 0.8rem" }}
                  />
                </div>
              </div>

              {/* Specific Resource Title */}
              <div>
                <label style={{ display: "block", fontWeight: "700", marginBottom: "0.3rem", fontSize: "0.875rem" }}>
                  📌 عنوان المورد أو الملف المحدد
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="مثال: شرح الجزء الأول بالفيديو، أو ملخص القوانين..."
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  style={{ width: "100%", padding: "0.6rem 0.8rem" }}
                />
              </div>

              {/* Resource Type & URL */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.8rem" }}>
                <div>
                  <label style={{ display: "block", fontWeight: "700", marginBottom: "0.3rem", fontSize: "0.875rem" }}>
                    📁 نوع المحتوى
                  </label>
                  <select
                    className="form-input"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    style={{ width: "100%", padding: "0.6rem" }}
                  >
                    {RESOURCE_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontWeight: "700", marginBottom: "0.3rem", fontSize: "0.875rem" }}>
                    🔗 رابط الفيديو / الملف / الصورة
                  </label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://youtube.com/... أو رابط PDF أو صورة..."
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    required
                    style={{ width: "100%", padding: "0.6rem 0.8rem" }}
                  />
                </div>
              </div>

              {/* Target Grade & Group */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.8rem" }}>
                <div>
                  <label style={{ display: "block", fontWeight: "700", marginBottom: "0.3rem", fontSize: "0.875rem" }}>
                    🎓 الصف المستهدف
                  </label>
                  <select
                    className="form-input"
                    value={form.grade}
                    onChange={(e) => setForm({ ...form, grade: e.target.value })}
                    style={{ width: "100%", padding: "0.6rem" }}
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: "700", marginBottom: "0.3rem", fontSize: "0.875rem" }}>
                    👥 المجموعة المستهدفة
                  </label>
                  <select
                    className="form-input"
                    value={form.group}
                    onChange={(e) => setForm({ ...form, group: e.target.value })}
                    style={{ width: "100%", padding: "0.6rem" }}
                  >
                    {GROUPS.map((grp) => (
                      <option key={grp} value={grp}>{grp}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{ display: "block", fontWeight: "700", marginBottom: "0.3rem", fontSize: "0.875rem" }}>
                  📝 وصف أو ملاحظات للطلاب (اختياري)
                </label>
                <textarea
                  className="form-input"
                  placeholder="اكتب ملاحظات حول هذا الفيديو أو التلخيص..."
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  style={{ width: "100%", padding: "0.6rem 0.8rem", resize: "vertical" }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="button button-muted"
                  disabled={saving}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={saving}
                >
                  {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديلات 💾" : "إضافة المحتوى ⚡"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Embedded Viewer Modal (Form/Iframe Lightbox for Videos, PDFs, Infographics) */}
      {previewItem && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.85)",
          backdropFilter: "blur(10px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10000,
          padding: "1rem"
        }}>
          <div className="glass" style={{
            background: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            maxWidth: "900px",
            width: "100%",
            maxHeight: "90vh",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
            border: "1px solid rgba(14, 165, 233, 0.4)"
          }}>
            {/* Modal Header */}
            <div style={{
              padding: "1rem 1.5rem",
              background: "rgba(14, 165, 233, 0.1)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <h3 className="font-heading" style={{ margin: 0, fontSize: "1.2rem", color: "var(--color-primary)" }}>
                  {previewItem.title}
                </h3>
                <span style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>
                  🎓 {previewItem.grade} | 👥 {previewItem.group}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                {(previewItem.type === "pdf" || previewItem.type === "infographic") && (
                  <a
                    href={previewItem.url}
                    target="_blank"
                    rel="noreferrer"
                    title="فتح في نافذة خارجية جديدة"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      background: previewItem.type === "pdf"
                        ? "linear-gradient(135deg, #ef4444, #b91c1c)"
                        : "linear-gradient(135deg, #22c55e, #15803d)",
                      color: "#fff",
                      fontWeight: 800,
                      fontSize: "0.8rem",
                      padding: "0.4rem 0.9rem",
                      borderRadius: "10px",
                      textDecoration: "none",
                      boxShadow: previewItem.type === "pdf"
                        ? "0 4px 14px rgba(239,68,68,0.4)"
                        : "0 4px 14px rgba(34,197,94,0.4)",
                      transition: "all 0.2s ease",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.filter = "brightness(1.15)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.filter = "brightness(1)"; }}
                  >
                    <span style={{ fontSize: "0.95rem" }}>↗</span>
                    فتح خارجياً
                  </a>
                )}
                <button
                  onClick={() => setPreviewItem(null)}
                  className="button button-sm button-muted"
                  style={{ fontSize: "1.2rem", padding: "0.2rem 0.6rem" }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Embedded Body Container */}
            <div style={{ flex: 1, padding: "1rem", overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
              {previewItem.type === "video" && (
                <div style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: "var(--radius-md)", overflow: "hidden", background: "#000" }}>
                  <iframe
                    src={previewItem.embedUrl || previewItem.url}
                    title={previewItem.title}
                    style={{ width: "100%", height: "100%", border: 0 }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}

              {previewItem.type === "pdf" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", width: "100%", height: "65vh" }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    background: "linear-gradient(135deg, rgba(239,68,68,0.1), rgba(15,23,42,0.9))",
                    border: "1px solid rgba(239,68,68,0.2)",
                    borderRadius: "12px",
                    padding: "0.5rem 1rem",
                    flexWrap: "wrap",
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: "1rem" }}>⚠️</span>
                    <span style={{ fontSize: "0.8rem", color: "#fca5a5", fontWeight: 600, flex: 1 }}>
                      إذا لم يظهر الملف داخل العارض، استخدم زر <strong style={{ color: "#f87171" }}>&ldquo;فتح خارجياً&rdquo;</strong> في الأعلى لعرضه في نافذة مستقلة
                    </span>
                  </div>
                  <div style={{ flex: 1, borderRadius: "var(--radius-md)", overflow: "hidden", background: "#1e293b" }}>
                    <iframe
                      src={previewItem.embedUrl || previewItem.url}
                      title={previewItem.title}
                      style={{ width: "100%", height: "100%", border: 0 }}
                    />
                  </div>
                </div>
              )}

              {previewItem.type === "infographic" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", width: "100%" }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    background: "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(15,23,42,0.9))",
                    border: "1px solid rgba(34,197,94,0.2)",
                    borderRadius: "12px",
                    padding: "0.5rem 1rem",
                    flexWrap: "wrap",
                  }}>
                    <span style={{ fontSize: "1rem" }}>💡</span>
                    <span style={{ fontSize: "0.8rem", color: "#86efac", fontWeight: 600, flex: 1 }}>
                      لعرض المحتوى بأعلى جودة أو في حال عدم ظهوره، استخدم زر <strong style={{ color: "#4ade80" }}>&ldquo;فتح خارجياً&rdquo;</strong> في الأعلى
                    </span>
                  </div>
                  <div style={{ textAlign: "center", width: "100%", maxHeight: "70vh", overflow: "auto" }}>
                    <img
                      src={previewItem.url}
                      alt={previewItem.title}
                      style={{ maxWidth: "100%", maxHeight: "65vh", objectFit: "contain", borderRadius: "var(--radius-md)" }}
                    />
                  </div>
                </div>
              )}

              {previewItem.description && (
                <p style={{ marginTop: "1rem", width: "100%", fontSize: "0.9rem", color: "var(--color-text-secondary)", background: "rgba(0,0,0,0.2)", padding: "0.75rem", borderRadius: "var(--radius-sm)" }}>
                  📝 <strong>الوصف / الملاحظات:</strong> {previewItem.description}
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: "0.75rem 1.5rem", background: "rgba(0,0,0,0.2)", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
              <button
                onClick={() => setPreviewItem(null)}
                className="button button-sm button-primary"
              >
                إغلاق العارض
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: "2.5rem" }}>
        <Link to="/dashboard" className="button button-secondary">
          ← العودة إلى لوحة التحكم
        </Link>
      </div>
    </div>
  );
}
