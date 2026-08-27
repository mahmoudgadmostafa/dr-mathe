// src/components/TeacherAIRoomsModal.jsx
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { db } from "../firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

export default function TeacherAIRoomsModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("add"); // "add" or "list"
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🤖");
  const [badgeText, setBadgeText] = useState("مساعد ذكي ⚡");
  const [targetGrade, setTargetGrade] = useState("all");
  const [isActive, setIsActive] = useState(true);

  // Fetch AI rooms in real-time
  useEffect(() => {
    if (!isOpen) return;
    const q = query(collection(db, "ai_rooms"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRooms(list);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching AI rooms:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [isOpen]);

  const resetForm = () => {
    setTitle("");
    setUrl("");
    setDescription("");
    setIcon("🤖");
    setBadgeText("مساعد ذكي ⚡");
    setTargetGrade("all");
    setIsActive(true);
    setEditingRoomId(null);
  };

  const handleStartEdit = (room) => {
    setEditingRoomId(room.id);
    setTitle(room.title || "");
    setUrl(room.url || "");
    setDescription(room.description || "");
    setIcon(room.icon || "🤖");
    setBadgeText(room.badgeText || "مساعد ذكي ⚡");
    setTargetGrade(room.targetGrade || "all");
    setIsActive(room.isActive !== false);
    setActiveTab("add");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) {
      alert("يرجى كتابة عنوان ورابط المساعد الذكي.");
      return;
    }

    // Ensure valid URL prefix
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      cleanUrl = "https://" + cleanUrl;
    }

    setSaving(true);
    try {
      if (editingRoomId) {
        // Update existing
        const docRef = doc(db, "ai_rooms", editingRoomId);
        await updateDoc(docRef, {
          title: title.trim(),
          url: cleanUrl,
          description: description.trim(),
          icon: icon.trim() || "🤖",
          badgeText: badgeText.trim() || "مساعد ذكي ⚡",
          targetGrade,
          isActive,
          updatedAt: serverTimestamp(),
        });
        alert("✅ تم حفظ وتحديث بيانات المساعد الذكي بنجاح!");
      } else {
        // Add new
        await addDoc(collection(db, "ai_rooms"), {
          title: title.trim(),
          url: cleanUrl,
          description: description.trim(),
          icon: icon.trim() || "🤖",
          badgeText: badgeText.trim() || "مساعد ذكي ⚡",
          targetGrade,
          isActive: true,
          createdAt: serverTimestamp(),
        });
        alert("✨ تم إضافة وتفعيل المساعد الذكي بنجاح! سيظهر الآن للطالب في الداشبورد.");
      }
      resetForm();
      setActiveTab("list");
    } catch (err) {
      console.error("Error saving AI room:", err);
      alert("حدث خطأ أثناء الحفظ. يرجى المحاولة مرة أخرى.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (room) => {
    try {
      const docRef = doc(db, "ai_rooms", room.id);
      await updateDoc(docRef, { isActive: !room.isActive });
    } catch (err) {
      console.error("Error toggling status:", err);
    }
  };

  const handleDelete = async (roomId) => {
    if (!window.confirm("هل أنت متأكد من حذف هذه الغرفة الذكية؟")) return;
    try {
      await deleteDoc(doc(db, "ai_rooms", roomId));
      if (editingRoomId === roomId) resetForm();
    } catch (err) {
      console.error("Error deleting AI room:", err);
      alert("حدث خطأ أثناء الحذف.");
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="modal-overlay-fix fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.88)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        className="glass modal-card-fix"
        style={{
          maxWidth: "760px",
          width: "100%",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: "24px",
          overflow: "hidden",
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
          border: "1.5px solid rgba(168, 85, 247, 0.4)",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(168, 85, 247, 0.25)",
        }}
      >
        {/* Pinned Modal Header */}
        <div
          style={{
            padding: "1.1rem 1.5rem",
            borderBottom: "1px solid rgba(168, 85, 247, 0.25)",
            background: "rgba(15, 23, 42, 0.85)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #7c3aed, #0284c7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.4rem",
                boxShadow: "0 4px 15px rgba(124, 58, 237, 0.4)",
                flexShrink: 0,
              }}
            >
              🤖
            </div>
            <div>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 900, color: "#ffffff", margin: 0 }}>
                غرف ومساعدي الذكاء الاصطناعي (AI)
              </h2>
              <p style={{ fontSize: "0.8rem", color: "#c084fc", margin: "2px 0 0 0", fontWeight: 700 }}>
                تظهر الأزرار تلقائياً للطالب في المستطيل الترحيبي أعلى الداشبورد
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="button button-sm button-muted"
            style={{ borderRadius: "50%", width: "36px", height: "36px", padding: 0 }}
          >
            ✕
          </button>
        </div>

        {/* Tab switcher buttons */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            padding: "0.75rem 1.5rem 0.25rem",
            background: "rgba(15, 23, 42, 0.5)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("add")}
            className="button button-sm"
            style={{
              borderRadius: "10px",
              fontWeight: 800,
              fontSize: "0.85rem",
              background: activeTab === "add" ? "linear-gradient(135deg, #7c3aed, #0284c7)" : "rgba(255, 255, 255, 0.08)",
              color: "#ffffff",
              border: activeTab === "add" ? "1px solid rgba(255, 255, 255, 0.3)" : "1px solid transparent",
              boxShadow: activeTab === "add" ? "0 4px 12px rgba(124, 58, 237, 0.35)" : "none",
            }}
          >
            {editingRoomId ? "✏️ تعديل المساعد الحالي" : "➕ إضافة مساعد ذكي جديد"}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("list")}
            className="button button-sm"
            style={{
              borderRadius: "10px",
              fontWeight: 800,
              fontSize: "0.85rem",
              background: activeTab === "list" ? "linear-gradient(135deg, #7c3aed, #0284c7)" : "rgba(255, 255, 255, 0.08)",
              color: "#ffffff",
              border: activeTab === "list" ? "1px solid rgba(255, 255, 255, 0.3)" : "1px solid transparent",
              boxShadow: activeTab === "list" ? "0 4px 12px rgba(124, 58, 237, 0.35)" : "none",
            }}
          >
            📋 قائمة الغرف المضافة ({rooms.length})
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "1.4rem 1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.2rem",
          }}
        >
          {/* TAB 1: ADD / EDIT FORM */}
          {activeTab === "add" && (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: "1rem" }}>
                {/* Title */}
                <div>
                  <label style={{ display: "block", fontSize: "0.86rem", fontWeight: 800, color: "#cbd5e1", marginBottom: "5px" }}>
                    عنوان المساعد أو الغرفة الذكية *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: المساعد الذكي لحل المسائل 🤖"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="form-input"
                    style={{ width: "100%", borderRadius: "12px", background: "rgba(15, 23, 42, 0.8)", color: "#fff", border: "1.5px solid rgba(168, 85, 247, 0.4)", padding: "0.65rem 0.9rem" }}
                  />
                </div>

                {/* URL */}
                <div>
                  <label style={{ display: "block", fontSize: "0.86rem", fontWeight: 800, color: "#cbd5e1", marginBottom: "5px" }}>
                    رابط المساعد أو البوت (URL) *
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://chatgpt.com/... أو رابط البوت"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="form-input"
                    dir="ltr"
                    style={{ width: "100%", borderRadius: "12px", background: "rgba(15, 23, 42, 0.8)", color: "#fff", border: "1.5px solid rgba(168, 85, 247, 0.4)", padding: "0.65rem 0.9rem", textAlign: "left" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: "1rem" }}>
                {/* Icon Emoji */}
                <div>
                  <label style={{ display: "block", fontSize: "0.86rem", fontWeight: 800, color: "#cbd5e1", marginBottom: "5px" }}>
                    الأيقونة التعبيرية
                  </label>
                  <select
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="form-input"
                    style={{ width: "100%", borderRadius: "12px", background: "rgba(15, 23, 42, 0.8)", color: "#fff", border: "1.5px solid rgba(168, 85, 247, 0.4)", padding: "0.65rem 0.9rem" }}
                  >
                    <option value="🤖">🤖 روبوت الذكاء الاصطناعي</option>
                    <option value="🧠">🧠 عقل ومفكر ذكي</option>
                    <option value="⚡">⚡ مساعد فوري سريع</option>
                    <option value="✨">✨ سحري وإبداعي</option>
                    <option value="📐">📐 مساعد هندسة ورياضيات</option>
                    <option value="💡">💡 فكرة وحلول ذكية</option>
                  </select>
                </div>

                {/* Badge Text */}
                <div>
                  <label style={{ display: "block", fontSize: "0.86rem", fontWeight: 800, color: "#cbd5e1", marginBottom: "5px" }}>
                    نص الشارة (Badge)
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: ذكاء اصطناعي ⚡"
                    value={badgeText}
                    onChange={(e) => setBadgeText(e.target.value)}
                    className="form-input"
                    style={{ width: "100%", borderRadius: "12px", background: "rgba(15, 23, 42, 0.8)", color: "#fff", border: "1.5px solid rgba(168, 85, 247, 0.4)", padding: "0.65rem 0.9rem" }}
                  />
                </div>

                {/* Target Grade */}
                <div>
                  <label style={{ display: "block", fontSize: "0.86rem", fontWeight: 800, color: "#cbd5e1", marginBottom: "5px" }}>
                    المرحلة المستهدفة
                  </label>
                  <select
                    value={targetGrade}
                    onChange={(e) => setTargetGrade(e.target.value)}
                    className="form-input"
                    style={{ width: "100%", borderRadius: "12px", background: "rgba(15, 23, 42, 0.8)", color: "#fff", border: "1.5px solid rgba(168, 85, 247, 0.4)", padding: "0.65rem 0.9rem" }}
                  >
                    <option value="all">جميع الصفوف والمراحل 🌐</option>
                    <option value="الصف الأول الثانوي">الصف الأول الثانوي 📘</option>
                    <option value="الصف الثاني الثانوي">الصف الثاني الثانوي 📗</option>
                    <option value="الصف الثالث الثانوي">الصف الثالث الثانوي 📕</option>
                    <option value="الصف الثالث الإعدادي">الصف الثالث الإعدادي 📙</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{ display: "block", fontSize: "0.86rem", fontWeight: 800, color: "#cbd5e1", marginBottom: "5px" }}>
                  وصف قصير أو توجيه للطلاب (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="مثال: متاح على مدار الساعة للإجابة الفورية وشرح الخطوات..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="form-input"
                  style={{ width: "100%", borderRadius: "12px", background: "rgba(15, 23, 42, 0.8)", color: "#fff", border: "1.5px solid rgba(168, 85, 247, 0.4)", padding: "0.65rem 0.9rem" }}
                />
              </div>

              {/* ⭐ PROMINENT SAVE BUTTON (زر الحفظ الواضح) */}
              <div
                style={{
                  marginTop: "1rem",
                  padding: "1rem",
                  borderRadius: "16px",
                  background: "rgba(30, 41, 59, 0.7)",
                  border: "1.5px solid rgba(124, 58, 237, 0.3)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                }}
              >
                <div style={{ fontSize: "0.85rem", color: "#cbd5e1" }}>
                  💡 سيتم تفعيل المساعد فورياً ويظهر زر مخصص له في داشبورد الطالب.
                </div>

                <div style={{ display: "flex", gap: "0.6rem" }}>
                  {editingRoomId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="button button-muted"
                      style={{ borderRadius: "12px", fontWeight: 700 }}
                    >
                      إلغاء التعديل
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={saving}
                    className="button button-primary"
                    style={{
                      background: "linear-gradient(135deg, #7c3aed, #0284c7)",
                      color: "#ffffff",
                      fontWeight: 900,
                      fontSize: "0.95rem",
                      padding: "0.65rem 2rem",
                      borderRadius: "14px",
                      boxShadow: "0 6px 20px rgba(124, 58, 237, 0.5), 0 0 15px rgba(2, 132, 199, 0.3)",
                      border: "1px solid rgba(255, 255, 255, 0.3)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <span>💾</span>
                    <span>{saving ? "⏳ جاري الحفظ..." : editingRoomId ? "حفظ وتحديث المساعد الذكي" : "حفظ وإضافة المساعد الذكي ✨"}</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 2: ROOMS LIST */}
          {activeTab === "list" && (
            <div>
              {loading ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "#cbd5e1" }}>⏳ جاري تحميل الغرف...</div>
              ) : rooms.length === 0 ? (
                <div
                  className="glass"
                  style={{
                    textAlign: "center",
                    padding: "2.5rem 1rem",
                    borderRadius: "16px",
                    color: "#cbd5e1",
                    background: "rgba(15, 23, 42, 0.4)",
                    border: "1px dashed rgba(168, 85, 247, 0.3)",
                  }}
                >
                  <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🤖</div>
                  <div style={{ fontWeight: 800, fontSize: "1rem" }}>لا توجد غرف ذكاء اصطناعي مضافة بعد</div>
                  <div style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: "4px" }}>
                    اضغط على تبويب <strong>(➕ إضافة مساعد ذكي جديد)</strong> بالأعلى لإضافة أول بوت أو مساعد.
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                  {rooms.map((room) => (
                    <div
                      key={room.id}
                      className="glass"
                      style={{
                        padding: "1.1rem 1.3rem",
                        borderRadius: "16px",
                        background: room.isActive ? "rgba(30, 41, 59, 0.8)" : "rgba(15, 23, 42, 0.4)",
                        border: room.isActive ? "1.5px solid rgba(168, 85, 247, 0.45)" : "1px solid rgba(255, 255, 255, 0.1)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "1rem",
                        flexWrap: "wrap",
                        opacity: room.isActive ? 1 : 0.65,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", minWidth: "220px", flex: 1 }}>
                        <span style={{ fontSize: "2rem" }}>{room.icon || "🤖"}</span>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 900, color: "#ffffff", fontSize: "1.05rem" }}>{room.title}</span>
                            <span
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: 800,
                                background: "rgba(168, 85, 247, 0.25)",
                                color: "#c084fc",
                                border: "1px solid rgba(168, 85, 247, 0.45)",
                                padding: "2px 9px",
                                borderRadius: "12px",
                              }}
                            >
                              {room.badgeText || "مساعد ذكي"}
                            </span>
                            <span
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                background: room.targetGrade === "all" ? "rgba(2, 132, 199, 0.25)" : "rgba(16, 185, 129, 0.25)",
                                color: room.targetGrade === "all" ? "#38bdf8" : "#34d399",
                                padding: "2px 9px",
                                borderRadius: "12px",
                              }}
                            >
                              {room.targetGrade === "all" ? "لجميع المراحل" : room.targetGrade}
                            </span>
                          </div>
                          {room.description && (
                            <p style={{ margin: "4px 0 0 0", fontSize: "0.84rem", color: "#cbd5e1", fontWeight: 600 }}>
                              {room.description}
                            </p>
                          )}
                          <a
                            href={room.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: "0.78rem", color: "#38bdf8", direction: "ltr", display: "inline-block", marginTop: "3px", textDecoration: "none" }}
                          >
                            🔗 {room.url}
                          </a>
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(room)}
                          className="button button-sm"
                          style={{
                            background: room.isActive ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.25)",
                            color: room.isActive ? "#4ade80" : "#fca5a5",
                            border: `1px solid ${room.isActive ? "#22c55e" : "#ef4444"}`,
                            fontWeight: 800,
                            fontSize: "0.8rem",
                            borderRadius: "10px",
                            padding: "0.35rem 0.75rem",
                          }}
                        >
                          {room.isActive ? "🟢 مفعّل للطالب" : "⚪ معطّل"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStartEdit(room)}
                          className="button button-sm button-muted"
                          style={{ fontSize: "0.85rem", borderRadius: "10px", padding: "0.35rem 0.65rem" }}
                          title="تعديل المساعد"
                        >
                          ✏️ تعديل
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(room.id)}
                          className="button button-sm button-muted"
                          style={{ fontSize: "0.85rem", color: "#ef4444", borderRadius: "10px", padding: "0.35rem 0.65rem" }}
                          title="حذف"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
