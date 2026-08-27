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
  { id: "pdf", label: "📄 ملخص PDF (PDF Viewer)", icon: "📄", color: "#ef4444" },
  { id: "infographic", label: "🖼️ إنفوجرافيك ومخطط (Infographic)", icon: "🖼️", color: "#8b5cf6" },
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

  const [form, setForm] = useState({
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

  const openAddModal = (presetType = "video") => {
    setEditingId(null);
    setForm({
      title: "",
      type: presetType,
      url: "",
      grade: "جميع الصفوف الدراسية",
      group: "جميع المجموعات",
      description: "",
    });
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setForm({
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
        const descMatch = item.description?.toLowerCase().includes(qStr);
        const gradeMatch = item.grade?.toLowerCase().includes(qStr);
        const groupMatch = item.group?.toLowerCase().includes(qStr);
        if (!titleMatch && !descMatch && !gradeMatch && !groupMatch) return false;
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
              إضافة فيديوهات الشرح، ملخصات PDF، والإنفوجرافيك التفاعلي لكل صف ومجموعة
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
            + إضافة إنفوجرافيك 🖼️
          </button>
        </div>
      </div>

      {/* Control Bar & Filters */}
      <div className="glass" style={{ margin: "1.5rem 0", padding: "1.25rem", borderRadius: "var(--radius-lg)" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
          {/* Type Filter Tabs */}
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            <button
              onClick={() => setTypeFilter("all")}
              className={`button button-sm ${typeFilter === "all" ? "button-primary" : "button-muted"}`}
            >
              الكل ({counts.total})
            </button>
            <button
              onClick={() => setTypeFilter("video")}
              className={`button button-sm ${typeFilter === "video" ? "button-primary" : "button-muted"}`}
            >
              🎬 شروحات فيديو ({counts.video})
            </button>
            <button
              onClick={() => setTypeFilter("pdf")}
              className={`button button-sm ${typeFilter === "pdf" ? "button-primary" : "button-muted"}`}
            >
              📄 ملخصات PDF ({counts.pdf})
            </button>
            <button
              onClick={() => setTypeFilter("infographic")}
              className={`button button-sm ${typeFilter === "infographic" ? "button-primary" : "button-muted"}`}
            >
              🖼️ إنفوجرافيك ({counts.infographic})
            </button>
          </div>

          {/* Search Box */}
          <div style={{ flex: 1, maxWidth: "320px" }}>
            <input
              type="text"
              className="form-input"
              placeholder="🔍 بحث باسم الدرس، المجموعة، أو الصف..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", padding: "0.5rem 0.9rem", fontSize: "0.88rem" }}
            />
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

      {!loading && filteredItems.length === 0 && (
        <div className="empty-state glass" style={{ marginTop: "2rem" }}>
          <span style={{ fontSize: "3.5rem" }}>📚</span>
          <p className="font-heading">لا يوجد محتوى تعليمي مطابق حالياً</p>
          <button onClick={() => openAddModal("video")} className="button button-primary" style={{ marginTop: "1rem" }}>
            + إضافة محتوى تعليمي جديد
          </button>
        </div>
      )}

      {/* Items Grid */}
      {!loading && filteredItems.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
          gap: "1.25rem",
          marginTop: "1.5rem"
        }}>
          {filteredItems.map((item) => {
            const resType = RESOURCE_TYPES.find((t) => t.id === item.type) || RESOURCE_TYPES[0];
            return (
              <div key={item.id} className="glass" style={{
                padding: "1.25rem",
                borderRadius: "var(--radius-lg)",
                border: "1px solid rgba(14, 165, 233, 0.25)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between"
              }}>
                <div>
                  {/* Top Badges */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <span style={{
                      background: "rgba(14, 165, 233, 0.15)",
                      color: "var(--color-primary)",
                      fontWeight: "700",
                      fontSize: "0.8rem",
                      padding: "0.25rem 0.65rem",
                      borderRadius: "20px"
                    }}>
                      {resType.label}
                    </span>

                    <span style={{
                      background: "rgba(255, 255, 255, 0.08)",
                      fontSize: "0.78rem",
                      padding: "0.25rem 0.65rem",
                      borderRadius: "20px",
                      color: "var(--color-muted)"
                    }}>
                      👥 {item.group}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-heading" style={{ margin: "0 0 0.5rem 0", fontSize: "1.15rem" }}>
                    {item.title}
                  </h3>

                  <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
                    🎓 <strong>الصف:</strong> {item.grade}
                  </p>

                  {item.description && (
                    <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.8rem", color: "var(--color-muted)", fontStyle: "italic" }}>
                      📝 {item.description}
                    </p>
                  )}
                </div>

                {/* Card Actions */}
                <div style={{
                  display: "flex",
                  gap: "0.5rem",
                  marginTop: "1rem",
                  paddingTop: "0.75rem",
                  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                  flexWrap: "wrap"
                }}>
                  <button
                    onClick={() => setPreviewItem(item)}
                    className="button button-sm button-primary"
                    style={{ flex: 1, fontSize: "0.82rem" }}
                  >
                    👁️ معاينة في العارض
                  </button>
                  <button
                    onClick={() => openEditModal(item)}
                    className="button button-sm button-muted"
                    style={{ fontSize: "0.82rem", color: "#818cf8" }}
                  >
                    ✏️ تعديل
                  </button>
                  <button
                    onClick={() => handleDelete(item.id, item.title)}
                    className="button button-sm button-muted"
                    style={{ fontSize: "0.82rem", color: "var(--color-error)" }}
                  >
                    🗑️ حذف
                  </button>
                </div>
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
              {/* Title */}
              <div>
                <label style={{ display: "block", fontWeight: "700", marginBottom: "0.3rem", fontSize: "0.875rem" }}>
                  📌 عنوان الدرس / الشرح
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="مثال: شرح درس المشتقات العليا - الجزء الأول..."
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
              <button
                onClick={() => setPreviewItem(null)}
                className="button button-sm button-muted"
                style={{ fontSize: "1.2rem", padding: "0.2rem 0.6rem" }}
              >
                ✕
              </button>
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
                <div style={{ width: "100%", height: "65vh", borderRadius: "var(--radius-md)", overflow: "hidden", background: "#1e293b" }}>
                  <iframe
                    src={previewItem.embedUrl || previewItem.url}
                    title={previewItem.title}
                    style={{ width: "100%", height: "100%", border: 0 }}
                  />
                </div>
              )}

              {previewItem.type === "infographic" && (
                <div style={{ textAlign: "center", width: "100%", maxHeight: "70vh", overflow: "auto" }}>
                  <img
                    src={previewItem.url}
                    alt={previewItem.title}
                    style={{ maxWidth: "100%", maxHeight: "65vh", objectFit: "contain", borderRadius: "var(--radius-md)" }}
                  />
                </div>
              )}

              {previewItem.description && (
                <p style={{ marginTop: "1rem", width: "100%", fontSize: "0.9rem", color: "var(--color-text-secondary)", background: "rgba(0,0,0,0.2)", padding: "0.75rem", borderRadius: "var(--radius-sm)" }}>
                  📝 <strong>الوصف / الملاحظات:</strong> {previewItem.description}
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: "0.75rem 1.5rem", background: "rgba(0,0,0,0.2)", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <a
                href={previewItem.url}
                target="_blank"
                rel="noreferrer"
                className="button button-sm button-muted"
                style={{ fontSize: "0.85rem" }}
              >
                🔗 فتح في نافذة خارجية جديدة
              </a>
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
