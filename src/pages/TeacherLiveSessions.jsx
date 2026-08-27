// src/pages/TeacherLiveSessions.jsx
import { useState, useEffect } from "react";
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

const PLATFORMS = [
  { id: "google_meet", name: "Google Meet", icon: "🟢", color: "#00ac47" },
  { id: "zoom", name: "Zoom Meeting", icon: "🔵", color: "#2d8cff" },
  { id: "teams", name: "Microsoft Teams", icon: "🟣", color: "#6264a7" },
  { id: "youtube", name: "YouTube Live", icon: "🔴", color: "#ff0000" },
  { id: "custom", name: "رابط آخر مخصص", icon: "🔗", color: "#0ea5e9" },
];

export function getSessionTiming(sess, now = new Date()) {
  if (!sess?.scheduledAt) {
    return { isLive: true, isUpcoming: false, isEnded: false, remainingText: "متاحة الآن" };
  }
  const startTime = new Date(sess.scheduledAt).getTime();
  const durationMinutes = Number(sess.durationMinutes) || 90;
  const endTime = startTime + durationMinutes * 60 * 1000;
  const nowMs = now.getTime();

  if (nowMs > endTime) {
    return { isLive: false, isUpcoming: false, isEnded: true, remainingText: "انتهت الحصة" };
  }
  if (nowMs >= startTime) {
    return { isLive: true, isUpcoming: false, isEnded: false, remainingText: "جارية الآن" };
  }
  // Upcoming
  const diffMs = startTime - nowMs;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  let remainingText = "";
  if (days > 0) remainingText += `${days} يوم `;
  if (hours > 0) remainingText += `${hours} س `;
  remainingText += `${minutes} د`;
  return { isLive: false, isUpcoming: true, isEnded: false, remainingText: remainingText.trim() || "أقل من دقيقة" };
}

export default function TeacherLiveSessions() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(new Date());

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    url: "",
    platform: "google_meet",
    grade: "جميع الصفوف الدراسية",
    group: "جميع المجموعات",
    scheduledAt: "",
    durationMinutes: 90,
    passcode: "",
    notes: "",
  });

  const isTeacher = userProfile?.role === "teacher";

  useEffect(() => {
    if (!isTeacher) navigate("/dashboard");
  }, [isTeacher, navigate]);

  // Live timer tick to evaluate session states every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(timer);
  }, []);

  // Fetch live sessions
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "live_sessions"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setSessions(list);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching live sessions:", err);
        setError("تعذر تحميل الحصص المباشرة.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Automatically delete expired sessions from Firestore
  useEffect(() => {
    if (!isTeacher || sessions.length === 0) return;
    const nowMs = Date.now();
    sessions.forEach(async (sess) => {
      if (sess.scheduledAt) {
        const startTime = new Date(sess.scheduledAt).getTime();
        const durationMs = (Number(sess.durationMinutes) || 90) * 60 * 1000;
        const endTime = startTime + durationMs;
        if (nowMs > endTime) {
          try {
            console.log(`Auto-deleting expired live session: ${sess.title} (${sess.id})`);
            await deleteDoc(doc(db, "live_sessions", sess.id));
          } catch (err) {
            console.error("Error auto-deleting ended session:", err);
          }
        }
      }
    });
  }, [sessions, isTeacher, now]);

  const openAddModal = () => {
    setEditingId(null);
    setForm({
      title: "",
      url: "",
      platform: "google_meet",
      grade: "جميع الصفوف الدراسية",
      group: "جميع المجموعات",
      scheduledAt: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
      durationMinutes: 90,
      passcode: "",
      notes: "",
    });
    setShowModal(true);
  };

  const openEditModal = (session) => {
    setEditingId(session.id);
    setForm({
      title: session.title || "",
      url: session.url || "",
      platform: session.platform || "google_meet",
      grade: session.grade || "جميع الصفوف الدراسية",
      group: session.group || "جميع المجموعات",
      scheduledAt: session.scheduledAt || "",
      durationMinutes: Number(session.durationMinutes) || 90,
      passcode: session.passcode || "",
      notes: session.notes || "",
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.url.trim()) {
      alert("يرجى إدخال عنوان الحصة والرابط الفرعي للحصة.");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        // Update existing session link
        await updateDoc(doc(db, "live_sessions", editingId), {
          ...form,
          durationMinutes: Number(form.durationMinutes) || 90,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Add new session link
        await addDoc(collection(db, "live_sessions"), {
          ...form,
          durationMinutes: Number(form.durationMinutes) || 90,
          teacherId: userProfile?.uid || "teacher",
          createdAt: serverTimestamp(),
        });
      }
      setShowModal(false);
    } catch (err) {
      console.error("Error saving live session link:", err);
      alert("حدث خطأ أثناء حفظ رابط الحصة.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`هل أنت تأكد من حذف رابط الحصة "${title}"؟`)) return;
    try {
      await deleteDoc(doc(db, "live_sessions", id));
    } catch (err) {
      console.error("Error deleting session:", err);
      alert("حدث خطأ أثناء حذف الرابط.");
    }
  };

  // Filter out any session that has ended
  const activeSessions = sessions.filter((s) => !getSessionTiming(s, now).isEnded);

  return (
    <div className="dashboard-modern fade-in" style={{ paddingBottom: "3rem" }}>
      {/* Banner */}
      <div className="dashboard-banner glass">
        <div className="dashboard-banner-content">
          <img src="/logo-circle.png" alt="logo" className="dashboard-avatar" />
          <div>
            <h1 className="font-heading dashboard-welcome">
              <span className="text-gradient">إدارة الحصص المباشرة والافتراضية</span> 📡
            </h1>
            <p className="dashboard-role">
              إضافة وتعديل روابط البث المباشر المخصصة لكل صف ومجموعة دراسية
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={openAddModal} className="button button-primary">
            + إضافة رابط حصة جديدة
          </button>
          <Link to="/groups" className="button button-muted">
            🏫 عرض المجموعات
          </Link>
        </div>
      </div>

      {loading && (
        <div className="loading-state" style={{ marginTop: "2rem" }}>
          <img src="/logo-circle.png" alt="Loading" className="logo-loading-sway" style={{ width: 60, height: 60, objectFit: "cover" }} />
          <p>جاري تحميل روابط الحصص المباشرة...</p>
        </div>
      )}

      {error && <p className="form-error-modern">⚠️ {error}</p>}

      {!loading && sessions.length === 0 && (
        <div className="empty-state glass" style={{ marginTop: "2rem" }}>
          <span style={{ fontSize: "3.5rem" }}>📡</span>
          <p className="font-heading">لا توجد روابط حصص مباشرة مضافة بعد</p>
          <p style={{ color: "var(--color-muted)" }}>اضغط على "+ إضافة رابط حصة جديدة" لإنشاء أول رابط حصة طلابك.</p>
          <button onClick={openAddModal} className="button button-primary" style={{ marginTop: "1rem" }}>
            + إضافة رابط حصة جديدة
          </button>
        </div>
      )}

      {/* Sessions Grid */}
      {!loading && activeSessions.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
          gap: "1.25rem",
          marginTop: "2rem"
        }}>
          {activeSessions.map((sess) => {
            const platformInfo = PLATFORMS.find((p) => p.id === sess.platform) || PLATFORMS[4];
            const timing = getSessionTiming(sess, now);
            const duration = Number(sess.durationMinutes) || 90;

            return (
              <div key={sess.id} className="glass" style={{
                padding: "1.25rem",
                borderRadius: "var(--radius-lg)",
                border: timing.isLive ? "1.5px solid #22c55e" : "1px solid rgba(14, 165, 233, 0.25)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: timing.isLive ? "0 0 25px rgba(34, 197, 94, 0.2)" : undefined,
              }}>
                <div>
                  {/* Top Badge Row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.4rem" }}>
                    <span style={{
                      background: "rgba(14, 165, 233, 0.15)",
                      color: "var(--color-primary)",
                      fontWeight: "700",
                      fontSize: "0.8rem",
                      padding: "0.25rem 0.6rem",
                      borderRadius: "20px"
                    }}>
                      {platformInfo.icon} {platformInfo.name}
                    </span>

                    <span style={{
                      background: timing.isLive ? "rgba(34, 197, 94, 0.25)" : "rgba(245, 158, 11, 0.2)",
                      color: timing.isLive ? "#4ade80" : "#fbbf24",
                      fontWeight: 800,
                      fontSize: "0.78rem",
                      padding: "0.25rem 0.65rem",
                      borderRadius: "20px",
                      border: `1px solid ${timing.isLive ? "#22c55e" : "#f59e0b"}`
                    }}>
                      {timing.isLive ? "🔴 جارية الآن ومتاحة للطلاب" : `⏳ قادمة (تبدأ بعد ${timing.remainingText})`}
                    </span>
                  </div>

                  {/* Title & Target */}
                  <h3 className="font-heading" style={{ margin: "0 0 0.5rem 0", fontSize: "1.15rem" }}>
                    {sess.title}
                  </h3>

                  <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
                    🎓 <strong>الصف:</strong> {sess.grade} | 👥 <strong>المجموعة:</strong> {sess.group}
                  </p>

                  {sess.scheduledAt && (
                    <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.85rem", color: "#34d399", fontWeight: "600" }}>
                      ⏰ <strong>الموعد:</strong> {new Date(sess.scheduledAt).toLocaleString("ar-EG", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })} ({duration} دقيقة)
                    </p>
                  )}

                  {sess.passcode && (
                    <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.82rem", background: "rgba(0,0,0,0.2)", padding: "0.4rem 0.6rem", borderRadius: "var(--radius-sm)" }}>
                      🔑 <strong>رمز الدخول / Passcode:</strong> {sess.passcode}
                    </p>
                  )}

                  {sess.notes && (
                    <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.8rem", color: "var(--color-muted)", fontStyle: "italic" }}>
                      📝 {sess.notes}
                    </p>
                  )}
                </div>

                {/* ───── Open Session Button (prominent, context-aware) ───── */}
                <a
                  href={sess.url}
                  target="_blank"
                  rel="noreferrer"
                  className="button button-primary"
                  style={{
                    display: "block",
                    textAlign: "center",
                    marginTop: "1rem",
                    padding: "0.75rem 1rem",
                    fontSize: "1rem",
                    fontWeight: 800,
                    borderRadius: "14px",
                    textDecoration: "none",
                    background: timing.isLive
                      ? "linear-gradient(135deg, #16a34a, #22c55e)"
                      : "linear-gradient(135deg, #6d28d9, #818cf8)",
                    color: "#fff",
                    boxShadow: timing.isLive
                      ? "0 0 20px rgba(34, 197, 94, 0.5), 0 4px 12px rgba(0,0,0,0.2)"
                      : "0 4px 12px rgba(109, 40, 217, 0.3)",
                    border: "none",
                    letterSpacing: "0.02em",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = timing.isLive
                      ? "0 0 30px rgba(34, 197, 94, 0.7), 0 6px 20px rgba(0,0,0,0.25)"
                      : "0 6px 20px rgba(109, 40, 217, 0.5)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = timing.isLive
                      ? "0 0 20px rgba(34, 197, 94, 0.5), 0 4px 12px rgba(0,0,0,0.2)"
                      : "0 4px 12px rgba(109, 40, 217, 0.3)";
                  }}
                >
                  {timing.isLive ? "🎬 افتح الحصة الآن وابدأ البث" : "🔗 فتح رابط الحصة"}
                </a>

                {/* Actions Footer */}
                <div style={{
                  display: "flex",
                  gap: "0.5rem",
                  marginTop: "0.75rem",
                  paddingTop: "0.75rem",
                  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                  flexWrap: "wrap"
                }}>
                  <button
                    onClick={() => openEditModal(sess)}
                    className="button button-sm button-muted"
                    style={{ flex: 1, fontSize: "0.82rem", color: "#818cf8" }}
                  >
                    ✏️ تعديل
                  </button>
                  <button
                    onClick={() => handleDelete(sess.id, sess.title)}
                    className="button button-sm button-muted"
                    style={{ flex: 1, fontSize: "0.82rem", color: "var(--color-error)" }}
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
            border: "1px solid rgba(14, 165, 233, 0.3)",
            maxHeight: "90vh",
            overflowY: "auto",
          }}>
            <h3 className="font-heading" style={{ margin: "0 0 1rem 0", fontSize: "1.3rem" }}>
              {editingId ? "✏️ تعديل رابط الحصة المباشرة" : "⚡ إضافة رابط حصة جديدة"}
            </h3>

            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Session Title */}
              <div>
                <label style={{ display: "block", fontWeight: "700", marginBottom: "0.3rem", fontSize: "0.875rem" }}>
                  📌 عنوان الحصة المباشرة
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="مثال: حصة مراجعة الجبر والهندسة الفراغية..."
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  style={{ width: "100%", padding: "0.6rem 0.8rem" }}
                />
              </div>

              {/* Platform & URL */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.8rem" }}>
                <div>
                  <label style={{ display: "block", fontWeight: "700", marginBottom: "0.3rem", fontSize: "0.875rem" }}>
                    📡 المنصة
                  </label>
                  <select
                    className="form-input"
                    value={form.platform}
                    onChange={(e) => setForm({ ...form, platform: e.target.value })}
                    style={{ width: "100%", padding: "0.6rem" }}
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.icon} {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: "700", marginBottom: "0.3rem", fontSize: "0.875rem" }}>
                    🔗 رابط الحصة (Meet / Zoom / Youtube)
                  </label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://..."
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

              {/* Scheduled Date Time & Duration */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.8rem" }}>
                <div>
                  <label style={{ display: "block", fontWeight: "700", marginBottom: "0.3rem", fontSize: "0.875rem" }}>
                    ⏰ موعد الحصة المباشرة
                  </label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={form.scheduledAt}
                    onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                    style={{ width: "100%", padding: "0.6rem 0.8rem" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: "700", marginBottom: "0.3rem", fontSize: "0.875rem" }}>
                    ⏳ مدة الحصة (تُحذف تلقائياً بعدها)
                  </label>
                  <select
                    className="form-input"
                    value={form.durationMinutes || 90}
                    onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                    style={{ width: "100%", padding: "0.6rem" }}
                  >
                    <option value={30}>30 دقيقة (نصف ساعة)</option>
                    <option value={45}>45 دقيقة</option>
                    <option value={60}>60 دقيقة (ساعة كاملة)</option>
                    <option value={90}>90 دقيقة (ساعة ونصف - افتراضي)</option>
                    <option value={120}>120 دقيقة (ساعتان)</option>
                    <option value={150}>150 دقيقة (ساعتان ونصف)</option>
                    <option value={180}>180 دقيقة (3 ساعات)</option>
                  </select>
                </div>
              </div>

              {/* Passcode & Notes */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                <div>
                  <label style={{ display: "block", fontWeight: "700", marginBottom: "0.3rem", fontSize: "0.875rem" }}>
                    🔑 رمز الدخول (اختياري)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="مثال: 123456"
                    value={form.passcode}
                    onChange={(e) => setForm({ ...form, passcode: e.target.value })}
                    style={{ width: "100%", padding: "0.6rem 0.8rem" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: "700", marginBottom: "0.3rem", fontSize: "0.875rem" }}>
                    📝 ملاحظات (اختياري)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="تحضير كشكول الشرح..."
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    style={{ width: "100%", padding: "0.6rem 0.8rem" }}
                  />
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1rem" }}>
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
                  {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديلات 💾" : "إضافة رابط الحصة ⚡"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ marginTop: "2rem" }}>
        <Link to="/dashboard" className="button button-secondary">
          ← العودة إلى لوحة التحكم
        </Link>
      </div>
    </div>
  );
}
