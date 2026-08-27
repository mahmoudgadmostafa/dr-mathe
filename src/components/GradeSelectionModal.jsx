// src/components/GradeSelectionModal.jsx
import { useState } from "react";
import { createPortal } from "react-dom";

export const STAGES = [
  {
    id: "primary",
    title: "المرحلة الابتدائية",
    icon: "🏫",
    color: "#0284c7",
    bgGradient: "linear-gradient(135deg, rgba(2,132,199,0.2) 0%, rgba(2,132,199,0.05) 100%)",
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
    title: "المرحلة الإعدادية",
    icon: "🎒",
    color: "#6366f1",
    bgGradient: "linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(99,102,241,0.05) 100%)",
    grades: [
      "الصف الأول الإعدادي",
      "الصف الثاني الإعدادي",
      "الصف الثالث الإعدادي",
    ],
  },
  {
    id: "secondary",
    title: "المرحلة الثانوية",
    icon: "🎓",
    color: "#ec4899",
    bgGradient: "linear-gradient(135deg, rgba(236,72,153,0.2) 0%, rgba(236,72,153,0.05) 100%)",
    grades: [
      "الصف الأول الثانوي",
      "الصف الثاني الثانوي",
      "الصف الثالث الثانوي",
    ],
  },
];

export default function GradeSelectionModal({
  user,
  onConfirm,
  onCancel,
  initialGrade = "",
}) {
  const [selectedStage, setSelectedStage] = useState("secondary");
  const [selectedGrade, setSelectedGrade] = useState(initialGrade || "الصف الأول الثانوي");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const currentStageObj = STAGES.find((s) => s.id === selectedStage) || STAGES[2];

  const handleStageChange = (stageId) => {
    setSelectedStage(stageId);
    const stage = STAGES.find((s) => s.id === stageId);
    if (stage && stage.grades.length > 0) {
      if (!stage.grades.includes(selectedGrade)) {
        setSelectedGrade(stage.grades[0]);
      }
    }
  };

  const handleSave = async () => {
    if (!selectedGrade) {
      setError("يرجى اختيار الصف الدراسي أولاً.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onConfirm(selectedGrade);
    } catch (err) {
      console.error("Error confirming grade:", err);
      setError("حدث خطأ أثناء حفظ الصف الدراسي، يرجى المحاولة مرة أخرى.");
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="modal-overlay-fix fade-in"
      style={{
        zIndex: 99999,
        background: "rgba(10, 15, 30, 0.88)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        className="modal-card-fix"
        style={{
          background: "linear-gradient(145deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
          maxWidth: "600px",
          width: "92%",
          border: "1.5px solid rgba(14, 165, 233, 0.4)",
          boxShadow: "0 20px 60px rgba(14, 165, 233, 0.25), 0 0 100px rgba(99, 102, 241, 0.2)",
          color: "#f8fafc",
          borderRadius: "24px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          className="modal-header-pinned"
          style={{
            background: "linear-gradient(90deg, #0284c7 0%, #4f46e5 100%)",
            padding: "1.25rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.5rem",
                boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
              }}
            >
              🎓
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#ffffff" }}>
                اختر مرحلتك وصفك الدراسي
              </h3>
              <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.82rem", color: "rgba(255, 255, 255, 0.88)" }}>
                منصة الدكتور في الرياضيات
              </p>
            </div>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={saving}
              style={{
                background: "rgba(255, 255, 255, 0.15)",
                border: "none",
                color: "#ffffff",
                width: 34,
                height: 34,
                borderRadius: "50%",
                cursor: "pointer",
                fontSize: "1.1rem",
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.2s",
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="modal-body-scroll" style={{ padding: "1.5rem" }}>
          {/* Welcome User Card */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.9rem",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "16px",
              padding: "0.9rem 1.1rem",
              marginBottom: "1.35rem",
            }}
          >
            <img
              src={user?.photoURL || "/logo-circle.png"}
              alt={user?.displayName || "User"}
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                objectFit: "cover",
                border: "2px solid #38bdf8",
              }}
            />
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#38bdf8" }}>
                مرحباً بك، {user?.displayName || "يا بطل"} 👋
              </div>
              <div style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: "0.15rem" }}>
                ✉️ {user?.email || "تم تسجيل الدخول بنجاح عبر حساب جوجل"}
              </div>
            </div>
          </div>

          <p
            style={{
              fontSize: "0.92rem",
              color: "#e2e8f0",
              fontWeight: 700,
              marginBottom: "1rem",
              lineHeight: "1.6",
            }}
          >
            حدد المرحلة والصف الدراسي لنقوم بتجهيز الدروس، بنوك الأسئلة، الاختبارات التفاعلية، ومجموعتك الخاصة:
          </p>

          {/* Stage Selector Tabs */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 130px), 1fr))",
              gap: "0.6rem",
              marginBottom: "1.35rem",
            }}
          >
            {STAGES.map((stage) => {
              const isCurrent = selectedStage === stage.id;
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => handleStageChange(stage.id)}
                  style={{
                    padding: "0.75rem 0.5rem",
                    borderRadius: "16px",
                    border: isCurrent
                      ? `2px solid ${stage.color}`
                      : "1.5px solid rgba(255, 255, 255, 0.1)",
                    background: isCurrent
                      ? stage.bgGradient
                      : "rgba(255, 255, 255, 0.03)",
                    color: isCurrent ? "#ffffff" : "#94a3b8",
                    fontWeight: isCurrent ? 800 : 600,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.35rem",
                    transition: "all 0.25s ease",
                    transform: isCurrent ? "scale(1.02)" : "scale(1)",
                    boxShadow: isCurrent
                      ? `0 4px 20px ${stage.color}33`
                      : "none",
                  }}
                >
                  <span style={{ fontSize: "1.4rem" }}>{stage.icon}</span>
                  <span style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                    {stage.title}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Grades Grid for Active Stage */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label
              style={{
                display: "block",
                fontWeight: 800,
                fontSize: "0.88rem",
                color: "#c4b5fd",
                marginBottom: "0.6rem",
              }}
            >
              اختر صفك الدراسي في ({currentStageObj.title}):
            </label>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))",
                gap: "0.65rem",
              }}
            >
              {currentStageObj.grades.map((grade) => {
                const isSelected = selectedGrade === grade;
                return (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => setSelectedGrade(grade)}
                    style={{
                      padding: "0.85rem 0.9rem",
                      borderRadius: "14px",
                      border: isSelected
                        ? "2px solid #38bdf8"
                        : "1px solid rgba(255, 255, 255, 0.08)",
                      background: isSelected
                        ? "linear-gradient(135deg, rgba(2, 132, 199, 0.3) 0%, rgba(14, 165, 233, 0.15) 100%)"
                        : "rgba(255, 255, 255, 0.03)",
                      color: isSelected ? "#ffffff" : "#cbd5e1",
                      fontWeight: isSelected ? 800 : 600,
                      fontSize: "0.88rem",
                      cursor: "pointer",
                      textAlign: "center",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.4rem",
                      transition: "all 0.2s ease",
                      boxShadow: isSelected
                        ? "0 4px 15px rgba(2, 132, 199, 0.3)"
                        : "none",
                    }}
                  >
                    <span>{grade}</span>
                    {isSelected ? (
                      <span
                        style={{
                          background: "#38bdf8",
                          color: "#0f172a",
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          fontSize: "0.75rem",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 900,
                        }}
                      >
                        ✓
                      </span>
                    ) : (
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          border: "1.5px solid rgba(255,255,255,0.2)",
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                color: "#fca5a5",
                padding: "0.65rem 0.9rem",
                borderRadius: "12px",
                fontSize: "0.85rem",
                marginBottom: "1rem",
                fontWeight: 700,
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {/* Selected Summary Callout */}
          <div
            style={{
              background: "rgba(2, 132, 199, 0.1)",
              border: "1px solid rgba(2, 132, 199, 0.3)",
              padding: "0.8rem 1.1rem",
              borderRadius: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
              الصف الذي تم اختياره:
            </span>
            <span
              style={{
                fontSize: "0.95rem",
                fontWeight: 800,
                color: "#38bdf8",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              <span>{currentStageObj.icon}</span> {selectedGrade}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer-pinned" style={{ padding: "1rem 1.5rem" }}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              style={{
                padding: "0.7rem 1.35rem",
                fontSize: "0.9rem",
                fontWeight: 700,
                borderRadius: "30px",
                background: "rgba(255, 255, 255, 0.08)",
                color: "#f1f5f9",
                border: "1.5px solid rgba(255, 255, 255, 0.2)",
                cursor: saving ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
              }}
            >
              ↩️ إلغاء
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !selectedGrade}
            style={{
              flex: 1,
              padding: "0.75rem 1.75rem",
              fontSize: "0.98rem",
              fontWeight: 800,
              borderRadius: "30px",
              background: "linear-gradient(135deg, #0284c7 0%, #4f46e5 100%)",
              color: "#ffffff",
              border: "none",
              boxShadow: "0 6px 25px rgba(2, 132, 199, 0.45)",
              cursor: saving || !selectedGrade ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              transition: "all 0.25s ease",
            }}
          >
            {saving ? "⏳ جاري حفظ وتجهيز حسابك..." : "تأكيد والبدء في رحلة التعلم 🚀"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
