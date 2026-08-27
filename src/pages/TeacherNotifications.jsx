// src/pages/TeacherNotifications.jsx
import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { createPortal } from "react-dom";

const STAGES = [
  { id: "primary", title: "🏫 المرحلة الابتدائية" },
  { id: "prep", title: "🎒 المرحلة الإعدادية" },
  { id: "secondary", title: "🎓 المرحلة الثانوية" },
];

const GRADES = [
  "الصف الأول الابتدائي", "الصف الثاني الابتدائي", "الصف الثالث الابتدائي",
  "الصف الرابع الابتدائي", "الصف الخامس الابتدائي", "الصف السادس الابتدائي",
  "الصف الأول الإعدادي", "الصف الثاني الإعدادي", "الصف الثالث الإعدادي",
  "الصف الأول الثانوي", "الصف الثاني الثانوي", "الصف الثالث الثانوي",
];

const GROUPS = [
  "المجموعة A", "المجموعة B", "المجموعة C", "المجموعة D",
  "مجموعة الصباح", "مجموعة المساء",
  "مجموعة خاصة 1", "مجموعة خاصة 2",
];

export default function TeacherNotifications() {
  const { userProfile } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [filterTarget, setFilterTarget] = useState("all");

  // New notification form state
  const [form, setForm] = useState({
    title: "",
    body: "",
    priority: "normal", // 'normal' | 'important' | 'urgent'
    targetType: "all", // 'all' | 'stage' | 'grade' | 'group' | 'student'
    targetValue: "",
    attachmentUrl: "",
  });

  // Edit Modal State
  const [editingNotif, setEditingNotif] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    body: "",
    priority: "normal",
    targetType: "all",
    targetValue: "",
    attachmentUrl: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Fetch all students for student target dropdown & display
  useEffect(() => {
    const qStudents = query(collection(db, "users"), where("role", "==", "student"));
    const unsubStudents = onSnapshot(qStudents, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setStudents(list);
    });
    return () => unsubStudents();
  }, []);

  // Fetch real-time notifications
  useEffect(() => {
    setLoading(true);
    const q = collection(db, "notifications");
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          const tA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
          const tB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
          return tB - tA;
        });
        setNotifications(list);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching notifications:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const handleSendNotification = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      alert("يرجى كتابة عنوان وتفاصيل الإشعار.");
      return;
    }

    setSubmitting(true);
    try {
      let targetLabel = "الجميع";
      let foundStudent = null;
      if (form.targetType === "stage") targetLabel = form.targetValue || "مرحلة محددة";
      else if (form.targetType === "grade") targetLabel = form.targetValue || "صف محدد";
      else if (form.targetType === "group") targetLabel = form.targetValue || "مجموعة محددة";
      else if (form.targetType === "student") {
        foundStudent = students.find((s) => s.id === form.targetValue);
        targetLabel = foundStudent ? `الطالب: ${foundStudent.fullName}` : "طالب محدد";
      }

      await addDoc(collection(db, "notifications"), {
        title: form.title.trim(),
        body: form.body.trim(),
        priority: form.priority,
        targetType: form.targetType,
        targetValue: form.targetValue,
        targetStudentEmail: foundStudent?.email || null,
        targetStudentPhone: foundStudent?.phone || null,
        targetLabel: targetLabel,
        attachmentUrl: form.attachmentUrl.trim() || null,
        senderName: userProfile?.fullName || "المعلم",
        senderRole: "teacher",
        senderUid: userProfile?.uid || "",
        createdAt: serverTimestamp(),
      });

      setForm({
        title: "",
        body: "",
        priority: "normal",
        targetType: "all",
        targetValue: "",
        attachmentUrl: "",
      });
      alert("تم إرسال وتوجيه الإشعار بنجاح! 🔔✨");
    } catch (err) {
      console.error("Error sending notification:", err);
      alert("حدث خطأ أثناء إرسال الإشعار: " + (err.message || err.toString()));
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (notif) => {
    setEditingNotif(notif);
    setEditForm({
      title: notif.title || "",
      body: notif.body || "",
      priority: notif.priority || "normal",
      targetType: notif.targetType || "all",
      targetValue: notif.targetValue || "",
      attachmentUrl: notif.attachmentUrl || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingNotif) return;
    if (!editForm.title.trim() || !editForm.body.trim()) {
      alert("يرجى كتابة عنوان وتفاصيل الإشعار.");
      return;
    }

    setSavingEdit(true);
    try {
      let targetLabel = "الجميع";
      if (editForm.targetType === "stage") targetLabel = editForm.targetValue || "مرحلة محددة";
      else if (editForm.targetType === "grade") targetLabel = editForm.targetValue || "صف محدد";
      else if (editForm.targetType === "group") targetLabel = editForm.targetValue || "مجموعة محددة";
      else if (editForm.targetType === "student") {
        const foundStudent = students.find((s) => s.id === editForm.targetValue);
        targetLabel = foundStudent ? `الطالب: ${foundStudent.fullName}` : "طالب محدد";
      }

      await updateDoc(doc(db, "notifications", editingNotif.id), {
        title: editForm.title.trim(),
        body: editForm.body.trim(),
        priority: editForm.priority,
        targetType: editForm.targetType,
        targetValue: editForm.targetValue,
        targetLabel: targetLabel,
        attachmentUrl: editForm.attachmentUrl.trim() || null,
        updatedAt: serverTimestamp(),
      });

      setEditingNotif(null);
      alert("تم تعديل الإشعار وتحديثه فورياً! ✏️✨");
    } catch (err) {
      console.error("Error updating notification:", err);
      alert("حدث خطأ أثناء تعديل الإشعار: " + (err.message || err.toString()));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteNotif = async (id, title) => {
    if (!window.confirm(`هل أنت تأكد من حذف الإشعار "${title}" بشكل نهائي؟`)) return;
    try {
      await deleteDoc(doc(db, "notifications", id));
    } catch (err) {
      console.error("Error deleting notification:", err);
      alert("حدث خطأ أثناء حذف الإشعار");
    }
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      const matchesTarget = filterTarget === "all" ? true : n.targetType === filterTarget;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        n.title?.toLowerCase().includes(q) ||
        n.body?.toLowerCase().includes(q) ||
        n.targetLabel?.toLowerCase().includes(q);
      return matchesTarget && matchesSearch;
    });
  }, [notifications, filterTarget, search]);

  const priorityBadges = {
    normal: { label: "🟢 عادي", bg: "rgba(34, 197, 94, 0.15)", color: "#22c55e" },
    important: { label: "🟡 هام", bg: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" },
    urgent: { label: "🔴 عاجل وتنبيه", bg: "rgba(239, 68, 68, 0.15)", color: "#ef4444" },
  };

  return (
    <div className="dashboard-modern fade-in">
      {/* Banner */}
      <div className="dashboard-banner glass">
        <div className="dashboard-banner-content">
          <img src="/logo-circle.png" alt="logo" className="dashboard-avatar" />
          <div>
            <h1 className="font-heading dashboard-welcome">
              🔔 مركز <span className="text-gradient">الإشعارات والتنبيهات الموجهة</span>
            </h1>
            <p className="dashboard-role">
              إرسال إشعارات جماعية أو مخصصة للطلاب حسب المرحلة، الصف، المجموعة، أو طالب بعينه مع إمكانية التعديل والحذف.
            </p>
          </div>
        </div>
        <Link to="/dashboard" className="button button-secondary" style={{ fontSize: "0.88rem" }}>
          ← العودة للوحة التحكم
        </Link>
      </div>

      {/* Main Grid: Compose Form + Notification List */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: "1.5rem", marginTop: "1.5rem" }}>
        {/* Compose Notification Form */}
        <form onSubmit={handleSendNotification} className="glass" style={{ padding: "1.5rem", borderRadius: "var(--radius-lg)" }}>
          <h3 className="font-heading" style={{ margin: "0 0 1.2rem 0", fontSize: "1.15rem", color: "#0f172a" }}>
            📣 إنشاء وتوجيه إشعار جديد
          </h3>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontWeight: "700", marginBottom: "0.35rem", fontSize: "0.85rem", color: "#0284c7" }}>
              🎯 الفئة المستهدفة بالإشعار *
            </label>
            <select
              className="form-input"
              value={form.targetType}
              onChange={(e) => setForm((f) => ({ ...f, targetType: e.target.value, targetValue: "" }))}
              style={{ width: "100%", padding: "0.6rem 0.8rem", fontSize: "0.88rem", background: "#f8fafc" }}
            >
              <option value="all">👥 جميع الطلاب بالمنصة</option>
              <option value="stage">🏫 مرحلة دراسية محددة</option>
              <option value="grade">🎓 صف دراسي معين</option>
              <option value="group">👥 مجموعة معينة</option>
              <option value="student">👤 طالب محدد باسمه</option>
            </select>
          </div>

          {/* Sub-select for Target Value */}
          {form.targetType === "stage" && (
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontWeight: "700", marginBottom: "0.35rem", fontSize: "0.85rem", color: "#475569" }}>
                اختر المرحلة الدراسية:
              </label>
              <select
                className="form-input"
                value={form.targetValue}
                onChange={(e) => setForm((f) => ({ ...f, targetValue: e.target.value }))}
                style={{ width: "100%", padding: "0.6rem 0.8rem", fontSize: "0.88rem" }}
                required
              >
                <option value="">-- اختر المرحلة --</option>
                {STAGES.map((s) => (
                  <option key={s.id} value={s.title}>{s.title}</option>
                ))}
              </select>
            </div>
          )}

          {form.targetType === "grade" && (
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontWeight: "700", marginBottom: "0.35rem", fontSize: "0.85rem", color: "#475569" }}>
                اختر الصف الدراسي:
              </label>
              <select
                className="form-input"
                value={form.targetValue}
                onChange={(e) => setForm((f) => ({ ...f, targetValue: e.target.value }))}
                style={{ width: "100%", padding: "0.6rem 0.8rem", fontSize: "0.88rem" }}
                required
              >
                <option value="">-- اختر الصف --</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          )}

          {form.targetType === "group" && (
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontWeight: "700", marginBottom: "0.35rem", fontSize: "0.85rem", color: "#475569" }}>
                اختر المجموعة:
              </label>
              <select
                className="form-input"
                value={form.targetValue}
                onChange={(e) => setForm((f) => ({ ...f, targetValue: e.target.value }))}
                style={{ width: "100%", padding: "0.6rem 0.8rem", fontSize: "0.88rem" }}
                required
              >
                <option value="">-- اختر المجموعة --</option>
                {GROUPS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          )}

          {form.targetType === "student" && (
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontWeight: "700", marginBottom: "0.35rem", fontSize: "0.85rem", color: "#475569" }}>
                اختر الطالب من القائمة:
              </label>
              <select
                className="form-input"
                value={form.targetValue}
                onChange={(e) => setForm((f) => ({ ...f, targetValue: e.target.value }))}
                style={{ width: "100%", padding: "0.6rem 0.8rem", fontSize: "0.88rem" }}
                required
              >
                <option value="">-- اختر الطالب --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} ({s.grade || "بدون صف"})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontWeight: "700", marginBottom: "0.35rem", fontSize: "0.85rem", color: "#475569" }}>
              📌 درجة الأهمية والتنبيه *
            </label>
            <select
              className="form-input"
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              style={{ width: "100%", padding: "0.6rem 0.8rem", fontSize: "0.88rem" }}
            >
              <option value="normal">🟢 عادي (إعلان عام / تنبيه أسبوعي)</option>
              <option value="important">🟡 هام (تذكير بااختبار / واجب مدرسة)</option>
              <option value="urgent">🔴 عاجل وتنبيه (تغيير موعد حصة / إلغاء)</option>
            </select>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontWeight: "700", marginBottom: "0.35rem", fontSize: "0.85rem", color: "#475569" }}>
              📝 عنوان الإشعار *
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="مثال: موعد اختبار الرياضيات الشهرية..."
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              style={{ width: "100%", padding: "0.6rem 0.8rem", fontSize: "0.88rem" }}
              required
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontWeight: "700", marginBottom: "0.35rem", fontSize: "0.85rem", color: "#475569" }}>
              💬 نص الإشعار والرسالة *
            </label>
            <textarea
              className="form-input"
              rows={4}
              placeholder="اكتب تفاصيل التنبيه أو الرسالة الموجهة للطلاب..."
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              style={{ width: "100%", padding: "0.65rem 0.8rem", fontSize: "0.88rem", resize: "vertical" }}
              required
            />
          </div>

          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ display: "block", fontWeight: "700", marginBottom: "0.35rem", fontSize: "0.85rem", color: "#475569" }}>
              🔗 رابط مرفق أو صورة (اختياري)
            </label>
            <input
              type="url"
              className="form-input"
              placeholder="https://example.com/file.pdf..."
              value={form.attachmentUrl}
              onChange={(e) => setForm((f) => ({ ...f, attachmentUrl: e.target.value }))}
              style={{ width: "100%", padding: "0.6rem 0.8rem", fontSize: "0.85rem" }}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="button button-primary"
            style={{ width: "100%", padding: "0.75rem", fontSize: "0.95rem", fontWeight: 800 }}
          >
            {submitting ? "⏳ جاري الإرسال..." : "🚀 إرسال وتوجيه الإشعار للطلاب"}
          </button>
        </form>

        {/* Sent Notifications List & Controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Controls Bar */}
          <div className="glass" style={{ padding: "1rem 1.2rem", borderRadius: "var(--radius-md)", display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setFilterTarget("all")}
                className={`button button-sm ${filterTarget === "all" ? "button-primary" : "button-muted"}`}
                style={{ fontSize: "0.8rem" }}
              >
                الجميع ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTarget("grade")}
                className={`button button-sm ${filterTarget === "grade" ? "button-primary" : "button-muted"}`}
                style={{ fontSize: "0.8rem" }}
              >
                الصف المباشر
              </button>
              <button
                type="button"
                onClick={() => setFilterTarget("student")}
                className={`button button-sm ${filterTarget === "student" ? "button-primary" : "button-muted"}`}
                style={{ fontSize: "0.8rem" }}
              >
                خاص بطالب
              </button>
            </div>
            <input
              type="text"
              className="form-input"
              placeholder="🔍 بحث في الإشعارات..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem", width: "100%", maxWidth: "200px" }}
            />
          </div>

          {/* List */}
          {loading ? (
            <p className="muted" style={{ textAlign: "center", padding: "2rem" }}>جاري تحميل سابقة الإشعارات...</p>
          ) : filteredNotifications.length === 0 ? (
            <div className="empty-state glass">
              <span style={{ fontSize: "3rem" }}>🔕</span>
              <p className="font-heading">لا توجد إشعارات مسجلة تطابق بحثك</p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const pInfo = priorityBadges[notif.priority] || priorityBadges.normal;
              const dateStr = notif.createdAt?.toDate
                ? notif.createdAt.toDate().toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                : "الآن";

              return (
                <div
                  key={notif.id}
                  className="glass fade-in"
                  style={{
                    padding: "1.2rem",
                    borderRadius: "16px",
                    border: `1.5px solid ${pInfo.color}40`,
                    background: "rgba(255, 255, 255, 0.95)",
                    position: "relative",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", marginBottom: "0.5rem" }}>
                    <div>
                      <span
                        style={{
                          background: pInfo.bg,
                          color: pInfo.color,
                          fontSize: "0.75rem",
                          fontWeight: 800,
                          padding: "0.2rem 0.6rem",
                          borderRadius: "20px",
                          marginLeft: "0.5rem",
                        }}
                      >
                        {pInfo.label}
                      </span>
                      <span style={{ fontSize: "0.78rem", color: "#0284c7", fontWeight: 700, background: "rgba(2,132,199,0.1)", padding: "0.2rem 0.6rem", borderRadius: "20px" }}>
                        🎯 {notif.targetLabel || "الجميع"}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "0.3rem" }}>
                      <button
                        onClick={() => openEditModal(notif)}
                        className="button button-sm button-muted"
                        style={{ padding: "0.25rem 0.55rem", fontSize: "0.78rem" }}
                        title="تعديل الإشعار"
                      >
                        ✏️ تعديل
                      </button>
                      <button
                        onClick={() => handleDeleteNotif(notif.id, notif.title)}
                        className="button button-sm button-muted"
                        style={{ padding: "0.25rem 0.55rem", fontSize: "0.78rem", color: "#ef4444" }}
                        title="حذف الإشعار"
                      >
                        🗑️ حذف
                      </button>
                    </div>
                  </div>

                  <h4 style={{ margin: "0.3rem 0 0.4rem 0", fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>
                    {notif.title}
                  </h4>

                  <p style={{ margin: 0, fontSize: "0.9rem", color: "#334155", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                    {notif.body}
                  </p>

                  {notif.attachmentUrl && (
                    <div style={{ marginTop: "0.6rem" }}>
                      <a
                        href={notif.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0284c7", textDecoration: "underline" }}
                      >
                        📎 فتح المرفق المرفق مع الإشعار ←
                      </a>
                    </div>
                  )}

                  <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "#94a3b8", display: "flex", justifyContent: "space-between", borderTop: "1px dashed #e2e8f0", paddingTop: "0.4rem" }}>
                    <span>✍️ بواسطة: {notif.senderName || "المعلم"}</span>
                    <span>🕒 {dateStr}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Edit Notification Modal */}
      {editingNotif && createPortal(
        <div className="modal-overlay-fix fade-in" onClick={(e) => e.target === e.currentTarget && setEditingNotif(null)}>
          <div className="modal-card-fix" style={{ maxWidth: "540px", background: "#ffffff", border: "1px solid #cbd5e1" }}>
            <div className="modal-header-pinned" style={{ background: "linear-gradient(90deg, #0284c7, #0369a1)" }}>
              <div>
                <h3 style={{ margin: 0, color: "#fff", fontSize: "1.1rem" }}>✏️ تعديل الإشعار والتنبيه</h3>
                <p style={{ margin: "0.2rem 0 0 0", color: "rgba(255,255,255,0.85)", fontSize: "0.8rem" }}>
                  {editingNotif.title}
                </p>
              </div>
              <button
                onClick={() => setEditingNotif(null)}
                style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", width: 32, height: 32, borderRadius: "50%", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body-scroll" style={{ padding: "1.2rem" }}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontWeight: "700", marginBottom: "0.3rem", fontSize: "0.85rem" }}>
                  📌 الأهمية:
                </label>
                <select
                  className="form-input"
                  value={editForm.priority}
                  onChange={(e) => setEditForm((f) => ({ ...f, priority: e.target.value }))}
                  style={{ width: "100%", padding: "0.55rem 0.75rem", fontSize: "0.88rem" }}
                >
                  <option value="normal">🟢 عادي</option>
                  <option value="important">🟡 هام</option>
                  <option value="urgent">🔴 عاجل وتنبيه</option>
                </select>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontWeight: "700", marginBottom: "0.3rem", fontSize: "0.85rem" }}>
                  📝 العنوان:
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.title}
                  onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  style={{ width: "100%", padding: "0.55rem 0.75rem", fontSize: "0.88rem" }}
                />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontWeight: "700", marginBottom: "0.3rem", fontSize: "0.85rem" }}>
                  💬 النص والرسالة:
                </label>
                <textarea
                  className="form-input"
                  rows={4}
                  value={editForm.body}
                  onChange={(e) => setEditForm((f) => ({ ...f, body: e.target.value }))}
                  style={{ width: "100%", padding: "0.55rem 0.75rem", fontSize: "0.88rem" }}
                />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontWeight: "700", marginBottom: "0.3rem", fontSize: "0.85rem" }}>
                  🔗 رابط المرفق:
                </label>
                <input
                  type="url"
                  className="form-input"
                  value={editForm.attachmentUrl}
                  onChange={(e) => setEditForm((f) => ({ ...f, attachmentUrl: e.target.value }))}
                  style={{ width: "100%", padding: "0.55rem 0.75rem", fontSize: "0.85rem" }}
                />
              </div>
            </div>

            <div className="modal-footer-pinned">
              <button
                type="button"
                onClick={() => setEditingNotif(null)}
                className="button button-muted"
                disabled={savingEdit}
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="button button-primary"
                disabled={savingEdit}
              >
                {savingEdit ? "جاري الحفظ..." : "💾 حفظ التعديلات"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
