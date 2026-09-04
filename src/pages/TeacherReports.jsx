// src/pages/TeacherReports.jsx
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import { getSubscriptionInfo } from "../components/StudentCard";

// ─── Helpers ────────────────────────────────────────────────────────────────
function getSubscriptionDays(student) {
  if (!student?.subscribedUntil) return 0;
  let activatedAt = null;
  let endDate = null;

  if (student.subscriptionActivatedAt) {
    activatedAt =
      typeof student.subscriptionActivatedAt.toDate === "function"
        ? student.subscriptionActivatedAt.toDate()
        : new Date(student.subscriptionActivatedAt);
  }
  if (student.subscribedUntil) {
    endDate =
      typeof student.subscribedUntil.toDate === "function"
        ? student.subscribedUntil.toDate()
        : new Date(student.subscribedUntil);
  }
  if (!activatedAt || !endDate) return 0;
  return Math.max(0, Math.round((endDate - activatedAt) / (1000 * 60 * 60 * 24)));
}

function getGradeStage(grade) {
  if (!grade) return { stage: "غير محدد", color: "#6b7280", icon: "❓" };
  if (grade.includes("ابتدائي")) return { stage: "المرحلة الابتدائية", color: "#3b82f6", icon: "🏫" };
  if (grade.includes("إعدادي") || grade.includes("اعدادي")) return { stage: "المرحلة الإعدادية", color: "#8b5cf6", icon: "📐" };
  if (grade.includes("ثانوي")) return { stage: "المرحلة الثانوية", color: "#f59e0b", icon: "🎓" };
  return { stage: "أخرى", color: "#6b7280", icon: "📚" };
}

function formatDateAr(dateOrTimestamp) {
  if (!dateOrTimestamp) return "—";
  let d =
    typeof dateOrTimestamp.toDate === "function"
      ? dateOrTimestamp.toDate()
      : new Date(dateOrTimestamp);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
}

function formatPhoneForWhatsApp(phone) {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("01") && digits.length === 11) {
    return "20" + digits.substring(1);
  }
  return digits;
}

const GRADE_ORDER = [
  "الصف الأول الابتدائي", "الصف الثاني الابتدائي", "الصف الثالث الابتدائي",
  "الصف الرابع الابتدائي", "الصف الخامس الابتدائي", "الصف السادس الابتدائي",
  "الصف الأول الإعدادي", "الصف الثاني الإعدادي", "الصف الثالث الإعدادي",
  "الصف الأول الثانوي", "الصف الثاني الثانوي", "الصف الثالث الثانوي",
];

// ─── Individual Student Report Modal ───────────────────────────────────────
function StudentReportModal({ student, onClose }) {
  const reportRef = useRef(null);
  const subInfo = getSubscriptionInfo(student);
  const days = getSubscriptionDays(student);
  const gradeInfo = getGradeStage(student.grade);

  const [submissions, setSubmissions] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [toastMessage, setToastMessage] = useState("");

  const studentId = student.id || student.uid;

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Listen to Quiz Submissions & Student Activities
  useEffect(() => {
    if (!studentId) return;

    let unsubSubs = () => {};
    let unsubAct = () => {};

    try {
      const qSub = query(collection(db, "quiz_submissions"), where("studentUid", "==", studentId));
      unsubSubs = onSnapshot(qSub, (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setSubmissions(list);
      });

      const qAct = query(collection(db, "student_activities"), where("studentUid", "==", studentId));
      unsubAct = onSnapshot(qAct, (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setActivities(list);
      });
    } catch (e) {
      console.error("Error loading student report stats:", e);
    } finally {
      setLoadingData(false);
    }

    return () => {
      unsubSubs();
      unsubAct();
    };
  }, [studentId]);

  let endDate = null;
  if (student.subscribedUntil) {
    endDate =
      typeof student.subscribedUntil.toDate === "function"
        ? student.subscribedUntil.toDate()
        : new Date(student.subscribedUntil);
  }

  const daysLeft = endDate
    ? Math.max(0, Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  const statusColor =
    subInfo.status === "active" ? "#22c55e"
    : subInfo.status === "expiring_soon" ? "#f59e0b"
    : "#ef4444";

  // Academic calculations
  const totalQuizzes = submissions.length;
  const avgPercentage = totalQuizzes > 0
    ? Math.round(submissions.reduce((acc, curr) => acc + (Number(curr.percentage) || 0), 0) / totalQuizzes)
    : 0;
  const passedQuizzes = submissions.filter((s) => s.isPassed || (Number(s.percentage) || 0) >= 60).length;

  const liveJoinsCount = activities.filter((a) => a.type === "live_session").length;
  const videoViewsCount = activities.filter((a) => a.type === "video").length;
  const pdfViewsCount = activities.filter((a) => a.type === "pdf").length;
  const infographicViewsCount = activities.filter((a) => a.type === "infographic").length;

  // Composite overall grade evaluation
  let academicRating = { label: "جديد / لم يبدأ الاختبارات", color: "#94a3b8", icon: "🌱" };
  if (totalQuizzes > 0) {
    if (avgPercentage >= 90) academicRating = { label: "⭐ ممتاز مرتفع", color: "#22c55e", icon: "🌟" };
    else if (avgPercentage >= 80) academicRating = { label: "🟢 جيد جداً", color: "#38bdf8", icon: "💎" };
    else if (avgPercentage >= 70) academicRating = { label: "🔵 جيد", color: "#818cf8", icon: "👍" };
    else if (avgPercentage >= 60) academicRating = { label: "🟡 مقبول", color: "#f59e0b", icon: "⚡" };
    else academicRating = { label: "🔴 يحتاج متابعة ودعم", color: "#ef4444", icon: "⚠️" };
  }

  const generateReportText = () => {
    return [
      "📊 تقرير الأداء التعليمي للطالب: " + student.fullName,
      "🎓 الصف الدراسي: " + (student.grade || "غير محدد"),
      "👥 المجموعة: " + (student.group || "—"),
      "📅 العام الدراسي: " + (student.academicYear || "—"),
      "🟢 حالة الاشتراك: " + subInfo.label,
      "-----------------------------------",
      "🎯 التقييم والدرجة العامة: " + academicRating.icon + " " + academicRating.label + (totalQuizzes > 0 ? ` (${avgPercentage}%)` : ""),
      "📝 الاختبارات والواجبات المنجزة: " + totalQuizzes + " اختبارات (نسبة النجاح " + (totalQuizzes > 0 ? Math.round((passedQuizzes / totalQuizzes) * 100) : 0) + "%)",
      "📡 حضور الحصص المباشرة: " + liveJoinsCount + " حصة",
      "🎥 مشاهدة فيديوهات الشرح: " + videoViewsCount + " فيديو",
      "📄 الاطلاع على الملازم والشروحات والمحتويات الأخرى: " + (pdfViewsCount + infographicViewsCount) + " ملف",
      daysLeft !== null ? "📆 ينتهي الاشتراك في: " + formatDateAr(student.subscribedUntil) : "",
      "━━━━━━━━━━━━━━━━",
      "منصة الدكتور في الرياضيات 📐"
    ].filter(Boolean).join("\n");
  };

  const handleShareWhatsApp = () => {
    const text = generateReportText();
    const phone = formatPhoneForWhatsApp(student.phone);
    const waUrl = phone
      ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");
    showToast("🟢 جاري فتح الواتساب لمشاركة تقرير الأداء...");
  };

  const handleShareMessenger = () => {
    const text = generateReportText();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    window.open("https://m.me/", "_blank");
    showToast("⚡ تم نسخ التقرير! تم فتح ماسينجر لتتمكن من لصقه وإرساله مباشرة.");
  };

  const handleShareNative = async () => {
    const text = generateReportText();
    if (navigator.share) {
      try {
        await navigator.share({
          title: "تقرير أداء الطالب: " + student.fullName,
          text: text
        });
        showToast("✅ تمت مشاركة التقرير بنجاح!");
        return;
      } catch (e) {
        if (e.name === "AbortError") return;
      }
    }
    handleCopyText();
  };

  const handleCopyText = () => {
    const text = generateReportText();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        showToast("📋 تم نسخ نص تقرير أداء الطالب إلى الحافظة بنجاح!");
      });
    } else {
      showToast("⚠️ يتعذر النسخ التلقائي في هذا المتصفح.");
    }
  };

  const handlePrint = () => {
    const content = reportRef.current?.innerHTML || "";
    const printWindow = window.open("", "_blank");
    printWindow.document.write(
      "<html dir=\"rtl\"><head><title>تقرير أداء الطالب: " + student.fullName + "</title>" +
      "<meta charset=\"UTF-8\" />" +
      "<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#0f172a;color:#e2e8f0;direction:rtl;padding:2rem;}.report-print{max-width:650px;margin:0 auto;background:linear-gradient(135deg,#1e1b4b,#1e293b);border-radius:20px;padding:2rem;}.stat-row{display:flex;justify-content:space-between;align-items:center;padding:0.65rem 0;border-bottom:1px solid rgba(255,255,255,0.08);}.stat-label{color:#94a3b8;font-size:0.9rem;}.stat-value{font-weight:700;color:#e2e8f0;font-size:0.9rem;}.footer{text-align:center;margin-top:1.5rem;color:#64748b;font-size:0.78rem;border-top:1px solid rgba(255,255,255,0.06);padding-top:1rem;}@media print{body{background:white;color:black;}}</style>" +
      "</head><body><div class=\"report-print\">" + content + "</div></body></html>"
    );
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  const progressPercent =
    subInfo.status === "inactive" || subInfo.status === "expired" ? 0
    : !endDate ? 100
    : daysLeft !== null && days > 0
    ? Math.min(100, Math.round((daysLeft / days) * 100))
    : 0;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(10px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: "linear-gradient(135deg,#1e1b4b 0%,#1e293b 100%)", borderRadius: "24px", border: "1px solid rgba(139,92,246,0.35)", width: "100%", maxWidth: "640px", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 0 60px rgba(139,92,246,0.3)" }}>
        {/* Top bar */}
        <div style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)", padding: "1.2rem 1.5rem", borderRadius: "24px 24px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "#fff" }}>📊 تقرير الأداء والتقدم التعليمي للطالب</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: "1rem", fontWeight: 700 }}>✕</button>
        </div>

        {/* Toast Feedback */}
        {toastMessage && (
          <div style={{ margin: "1rem 1.5rem 0", background: "rgba(34,197,94,0.2)", border: "1px solid #22c55e", color: "#4ade80", padding: "0.65rem 1rem", borderRadius: "12px", textAlign: "center", fontSize: "0.85rem", fontWeight: 700 }}>
            {toastMessage}
          </div>
        )}

        {/* Printable body */}
        <div ref={reportRef} style={{ padding: "1.5rem" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "1.2rem", paddingBottom: "1rem", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", margin: "0 auto 0.75rem" }}>{gradeInfo.icon}</div>
            <h2 style={{ fontSize: "1.45rem", fontWeight: 900, color: "#c4b5fd", margin: 0 }}>{student.fullName}</h2>
            <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.3rem" }}>{student.email}</p>
          </div>

          {/* Academic Overall Rating Banner */}
          <div style={{
            background: `${academicRating.color}15`,
            border: `1.5px solid ${academicRating.color}`,
            borderRadius: "16px",
            padding: "1rem",
            textAlign: "center",
            marginBottom: "1.2rem",
          }}>
            <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.7)", marginBottom: "0.2rem" }}>🎯 المستوى والتقييم الأكاديمي العام</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 900, color: academicRating.color }}>
              {academicRating.icon} {academicRating.label} {totalQuizzes > 0 && `(${avgPercentage}%)`}
            </div>
            {totalQuizzes > 0 && (
              <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", marginTop: "0.3rem" }}>
                أكمل {totalQuizzes} اختبارات بنسبة نجاح {Math.round((passedQuizzes / totalQuizzes) * 100)}%
              </div>
            )}
          </div>

          {/* Engagement Metrics Summary Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.6rem", marginBottom: "1.2rem" }}>
            <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", padding: "0.6rem", borderRadius: "12px", textAlign: "center" }}>
              <div style={{ fontSize: "1.3rem" }}>📡</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#4ade80" }}>{liveJoinsCount}</div>
              <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.7)" }}>حصص مباشرة</div>
            </div>
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", padding: "0.6rem", borderRadius: "12px", textAlign: "center" }}>
              <div style={{ fontSize: "1.3rem" }}>🎥</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#f87171" }}>{videoViewsCount}</div>
              <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.7)" }}>فيديوهات شرح</div>
            </div>
            <div style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)", padding: "0.6rem", borderRadius: "12px", textAlign: "center" }}>
              <div style={{ fontSize: "1.3rem" }}>📄</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#38bdf8" }}>{pdfViewsCount}</div>
              <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.7)" }}>ملازم وشروحات</div>
            </div>
            <div style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)", padding: "0.6rem", borderRadius: "12px", textAlign: "center" }}>
              <div style={{ fontSize: "1.3rem" }}>🖼️</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#c084fc" }}>{infographicViewsCount}</div>
              <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.7)" }}>محتويات أخرى</div>
            </div>
          </div>

          {/* Status badge & Progress bar */}
          <div style={{ marginBottom: "1.2rem" }}>
            <div style={{ textAlign: "center", marginBottom: "0.8rem" }}>
              <span style={{ display: "inline-block", background: statusColor + "22", border: "1.5px solid " + statusColor, color: statusColor, padding: "0.35rem 1.1rem", borderRadius: "30px", fontWeight: 800, fontSize: "0.9rem" }}>{subInfo.label}</span>
            </div>

            {subInfo.status !== "inactive" && subInfo.status !== "expired" && daysLeft !== null && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.3rem" }}>
                  <span>مدة صلاحية الحساب الأكاديمي</span>
                  <span>متبقي {daysLeft} يوم من أصل {days} يوم</span>
                </div>
                <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: progressPercent + "%", background: progressPercent > 30 ? "#22c55e" : "#f59e0b", borderRadius: 10, transition: "width 0.6s" }} />
                </div>
              </div>
            )}
          </div>

          {/* Quiz Grades Detail Section */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "1rem", marginBottom: "1.2rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#c4b5fd", margin: "0 0 0.8rem 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>📝 نتائج ودرجات الاختبارات والتطبيقات الذكية ({submissions.length})</span>
              {totalQuizzes > 0 && <span style={{ fontSize: "0.8rem", color: "#4ade80" }}>المتوسط: {avgPercentage}%</span>}
            </h3>

            {submissions.length === 0 ? (
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.82rem", margin: 0, textAlign: "center", padding: "0.5rem" }}>
                لم يقم الطالب بأداء أي اختبار ذكي حتى الآن.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "180px", overflowY: "auto" }}>
                {submissions.map((sub, i) => {
                  const isPass = sub.isPassed || (Number(sub.percentage) || 0) >= 60;
                  const itemColor = isPass ? "#4ade80" : "#f87171";
                  return (
                    <div key={sub.id || i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.8rem", background: "rgba(0,0,0,0.2)", borderRadius: "10px", borderRight: `3px solid ${itemColor}` }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#e2e8f0" }}>{sub.quizTitle || "اختبار رياضيات"}</div>
                        <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.5)" }}>{formatDateAr(sub.submittedAt)}</div>
                      </div>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontWeight: 900, fontSize: "0.9rem", color: itemColor }}>
                          {sub.isExternal ? "تسليم مفعل" : `${sub.score} / ${sub.totalPoints} (${sub.percentage}%)`}
                        </div>
                        <span style={{ fontSize: "0.72rem", color: itemColor, fontWeight: 700 }}>
                          {sub.isExternal ? "🟢 مكتمل" : isPass ? "🎉 ناجح" : "🔴 يحتاج مراجعة"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Student General Academic Profile Info */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              ["📱 رقم الهاتف", student.phone || "—"],
              ["🎓 الصف الدراسي", student.grade || "غير محدد"],
              [gradeInfo.icon + " المرحلة", gradeInfo.stage],
              ["👥 المجموعة", student.group || "—"],
              ["📅 العام الدراسي", student.academicYear || "—"],
              ["🗓️ تاريخ انتهاء الصلاحية", formatDateAr(student.subscribedUntil)],
              ["⏳ الأيام الكلية للصلاحية", days > 0 ? days + " يوم" : "—"],
              ["⏱️ الأيام المتبقية", daysLeft !== null ? daysLeft + " يوم" : "—"],
              ["🟢 حالة الحساب", subInfo.label],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.55rem 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>{label}</span>
                <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "0.88rem" }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ textAlign: "center", marginTop: "1.2rem", color: "#64748b", fontSize: "0.76rem", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "0.8rem" }}>
            منصة الدكتور في الرياضيات 📐 | تقرير الأداء الأكاديمي صادر بتاريخ: {new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>

        {/* Enhanced Multi-Platform Share Action Toolbar */}
        <div style={{ padding: "1.2rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(15, 23, 42, 0.4)" }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#c4b5fd" }}>
            📤 خيارات مشاركة تقرير الأداء عبر وسائط التواصل:
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.6rem" }}>
            {/* WhatsApp */}
            <button
              onClick={handleShareWhatsApp}
              style={{
                background: "linear-gradient(135deg, #25D366, #128C7E)",
                color: "#fff",
                border: "none",
                borderRadius: "12px",
                padding: "0.65rem 0.8rem",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.4rem",
                boxShadow: "0 4px 12px rgba(37, 211, 102, 0.25)"
              }}
            >
              <span>💬</span> واتساب
            </button>

            {/* Messenger */}
            <button
              onClick={handleShareMessenger}
              style={{
                background: "linear-gradient(135deg, #0084FF, #00C6FF)",
                color: "#fff",
                border: "none",
                borderRadius: "12px",
                padding: "0.65rem 0.8rem",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.4rem",
                boxShadow: "0 4px 12px rgba(0, 132, 255, 0.25)"
              }}
            >
              <span>⚡</span> ماسينجر
            </button>

            {/* Native Share */}
            <button
              onClick={handleShareNative}
              style={{
                background: "linear-gradient(135deg, #8B5CF6, #6366F1)",
                color: "#fff",
                border: "none",
                borderRadius: "12px",
                padding: "0.65rem 0.8rem",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.4rem",
                boxShadow: "0 4px 12px rgba(139, 92, 246, 0.25)"
              }}
            >
              <span>📲</span> مشاركة عامة
            </button>

            {/* Copy Text */}
            <button
              onClick={handleCopyText}
              style={{
                background: "rgba(255, 255, 255, 0.1)",
                color: "#e2e8f0",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                borderRadius: "12px",
                padding: "0.65rem 0.8rem",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.4rem"
              }}
            >
              <span>📋</span> نسخ التقرير
            </button>

            {/* Print / PDF */}
            <button
              onClick={handlePrint}
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                color: "#94a3b8",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "12px",
                padding: "0.65rem 0.8rem",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.4rem"
              }}
            >
              <span>🖨️</span> طباعة / PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color = "#818cf8", sub }) {
  return (
    <div className="glass" style={{ padding: "1.2rem 1.4rem", borderRadius: "18px", border: "1px solid " + color + "33", textAlign: "center" }}>
      <div style={{ fontSize: "2rem", marginBottom: "0.4rem" }}>{icon}</div>
      <div style={{ fontSize: "1.7rem", fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.6)", marginTop: "0.3rem" }}>{label}</div>
      {sub && <div style={{ fontSize: "0.75rem", color, fontWeight: 700, marginTop: "0.2rem" }}>{sub}</div>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TeacherReports() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const isTeacher = userProfile?.role === "teacher";

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterGrade, setFilterGrade] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  const [quizStats, setQuizStats] = useState({ totalSubmissions: 0, avgScore: 0, passRate: 0 });

  useEffect(() => { if (!isTeacher) navigate("/dashboard"); }, [isTeacher, navigate]);

  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "student"));
    const unsub = onSnapshot(q, (snap) => {
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  // Listen to platform quiz submissions for overall performance analytics
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "quiz_submissions"), (snap) => {
      const list = snap.docs.map((d) => d.data());
      const total = list.length;
      if (total > 0) {
        const avg = Math.round(list.reduce((acc, c) => acc + (Number(c.percentage) || 0), 0) / total);
        const passed = list.filter((c) => c.isPassed || (Number(c.percentage) || 0) >= 60).length;
        const passRate = Math.round((passed / total) * 100);
        setQuizStats({ totalSubmissions: total, avgScore: avg, passRate });
      }
    });
    return unsub;
  }, []);

  // Analytics
  const active = students.filter((s) => { const i = getSubscriptionInfo(s); return i.status === "active" || i.status === "expiring_soon"; });
  const inactive = students.filter((s) => { const i = getSubscriptionInfo(s); return i.status === "inactive" || i.status === "expired"; });
  const expiringSoon = students.filter((s) => getSubscriptionInfo(s).status === "expiring_soon");

  const stageBreakdown = {};
  students.forEach((s) => { const { stage } = getGradeStage(s.grade); stageBreakdown[stage] = (stageBreakdown[stage] || 0) + 1; });

  const gradeBreakdown = {};
  students.forEach((s) => { const g = s.grade || "غير محدد"; gradeBreakdown[g] = (gradeBreakdown[g] || 0) + 1; });
  const sortedGrades = Object.entries(gradeBreakdown).sort(([a], [b]) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b));

  const groupBreakdown = {};
  students.forEach((s) => { const g = s.group || "بدون مجموعة"; groupBreakdown[g] = (groupBreakdown[g] || 0) + 1; });

  const allGrades = [...new Set(students.map((s) => s.grade).filter(Boolean))].sort((a, b) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b));

  const filtered = students.filter((s) => {
    const info = getSubscriptionInfo(s);
    const statusMatch = filterStatus === "all" ? true
      : filterStatus === "active" ? (info.status === "active" || info.status === "expiring_soon")
      : filterStatus === "inactive" ? (info.status === "inactive" || info.status === "expired")
      : filterStatus === "expiring" ? info.status === "expiring_soon"
      : true;
    const gradeMatch = filterGrade === "all" || s.grade === filterGrade;
    const q = search.trim().toLowerCase();
    const searchMatch = !q || s.fullName?.toLowerCase().includes(q) || s.grade?.includes(q) || s.group?.includes(q);
    return statusMatch && gradeMatch && searchMatch;
  }).sort((a, b) => {
    if (sortBy === "name") return (a.fullName || "").localeCompare(b.fullName || "", "ar");
    if (sortBy === "grade") return GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade);
    if (sortBy === "days") return (getSubscriptionInfo(b).daysLeft || 0) - (getSubscriptionInfo(a).daysLeft || 0);
    return 0;
  });

  const maxCount = Math.max(...Object.values(gradeBreakdown), 1);

  const STAGE_META = [
    { stage: "المرحلة الابتدائية", color: "#3b82f6", icon: "🏫" },
    { stage: "المرحلة الإعدادية", color: "#8b5cf6", icon: "📐" },
    { stage: "المرحلة الثانوية", color: "#f59e0b", icon: "🎓" },
    { stage: "غير محدد", color: "#6b7280", icon: "❓" },
  ];

  return (
    <div className="dashboard-modern fade-in">
      {/* Header */}
      <div className="glass" style={{ padding: "1.5rem 2rem", borderRadius: "20px", marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", background: "linear-gradient(135deg,rgba(124,58,237,0.2),rgba(79,70,229,0.2))", border: "1px solid rgba(124,58,237,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ fontSize: "2.5rem" }}>📊</span>
          <div>
            <h1 className="font-heading" style={{ fontSize: "1.6rem", margin: 0 }}>
              <span className="text-gradient">تقارير أداء الطلاب الدراسي</span>
            </h1>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.6)", fontSize: "0.9rem" }}>تحليل شامل للتقدم التعليمي، الأداء، ونتائج درجات الطلاب</p>
          </div>
        </div>
        <Link to="/dashboard" className="button button-muted" style={{ fontSize: "0.9rem" }}>← لوحة التحكم</Link>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {[
          { id: "overview", icon: "📈", label: "نظرة عامة وإحصائيات الأداء" },
          { id: "students", icon: "👥", label: "قائمة تقارير الطلاب الأكاديمية" },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={"button " + (activeTab === tab.id ? "button-primary" : "button-muted")} style={{ fontSize: "0.9rem" }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-state">
          <img src="/logo-circle.png" alt="Loading" className="logo-loading-sway" style={{ width: 60, height: 60 }} />
          <p>جاري تحميل تقارير الأداء...</p>
        </div>
      ) : (
        <>
          {/* ── OVERVIEW TAB ── */}
          {activeTab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {/* Performance & Academic KPI Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "1rem" }}>
                <StatCard icon="👥" label="إجمالي الطلاب" value={students.length} color="#818cf8" />
                <StatCard icon="🟢" label="مشتركون نشطون" value={active.length} color="#22c55e" sub={students.length > 0 ? Math.round((active.length / students.length) * 100) + "% من الكل" : ""} />
                <StatCard icon="🔴" label="غير مشتركين / منتهي" value={inactive.length} color="#ef4444" />
                <StatCard icon="⚠️" label="ينتهي خلال 7 أيام" value={expiringSoon.length} color="#f59e0b" />
                <StatCard icon="📝" label="إجمالي حل الاختبارات" value={quizStats.totalSubmissions} color="#a78bfa" sub={quizStats.totalSubmissions > 0 ? `نسبة النجاح ${quizStats.passRate}%` : "—"} />
                <StatCard icon="🎯" label="متوسط درجات المنصة" value={quizStats.avgScore > 0 ? `${quizStats.avgScore}%` : "—"} color="#38bdf8" sub="التقييم الأكاديمي العام" />
              </div>

              {/* Stage breakdown */}
              <div className="glass" style={{ padding: "1.5rem", borderRadius: "20px" }}>
                <h2 style={{ fontSize: "1.05rem", fontWeight: 800, marginBottom: "1.2rem" }}>🏫 توزيع الطلاب حسب المرحلة الدراسية</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: "1rem" }}>
                  {STAGE_META.filter((m) => stageBreakdown[m.stage]).map(({ stage, color, icon }) => {
                    const count = stageBreakdown[stage] || 0;
                    return (
                      <div key={stage} style={{ background: color + "15", border: "1px solid " + color + "33", borderRadius: "14px", padding: "1rem", textAlign: "center" }}>
                        <div style={{ fontSize: "1.8rem" }}>{icon}</div>
                        <div style={{ fontSize: "1.6rem", fontWeight: 900, color }}>{count}</div>
                        <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.6)", marginTop: "0.2rem" }}>{stage}</div>
                        <div style={{ fontSize: "0.75rem", color, fontWeight: 700 }}>{students.length > 0 ? Math.round((count / students.length) * 100) : 0}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Grade bar chart */}
              <div className="glass" style={{ padding: "1.5rem", borderRadius: "20px" }}>
                <h2 style={{ fontSize: "1.05rem", fontWeight: 800, marginBottom: "1.2rem" }}>🎓 عدد الطلاب لكل صف دراسي</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                  {sortedGrades.map(([grade, count]) => {
                    const { color } = getGradeStage(grade);
                    const pct = Math.round((count / maxCount) * 100);
                    return (
                      <div key={grade} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <span style={{ width: "210px", fontSize: "0.8rem", color: "rgba(255,255,255,0.7)", flexShrink: 0, textAlign: "right" }}>{grade}</span>
                        <div style={{ flex: 1, height: 16, background: "rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: pct + "%", background: color, borderRadius: 10, minWidth: 4 }} />
                        </div>
                        <span style={{ fontWeight: 800, color, fontSize: "0.88rem", width: "22px", textAlign: "center" }}>{count}</span>
                      </div>
                    );
                  })}
                  {sortedGrades.length === 0 && <p style={{ color: "#64748b" }}>لا توجد بيانات</p>}
                </div>
              </div>

              {/* Group breakdown */}
              {Object.keys(groupBreakdown).length > 0 && (
                <div className="glass" style={{ padding: "1.5rem", borderRadius: "20px" }}>
                  <h2 style={{ fontSize: "1.05rem", fontWeight: 800, marginBottom: "1.2rem" }}>👥 توزيع الطلاب حسب المجموعة</h2>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                    {Object.entries(groupBreakdown).sort((a, b) => b[1] - a[1]).map(([group, count]) => (
                      <div key={group} style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: "12px", padding: "0.6rem 1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <span style={{ fontWeight: 900, color: "#818cf8", fontSize: "1.1rem" }}>{count}</span>
                        <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)" }}>{group}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STUDENTS TAB ── */}
          {activeTab === "students" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Controls */}
              <div className="glass" style={{ padding: "1rem 1.2rem", borderRadius: "16px", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                <input type="text" className="form-input" placeholder="🔍 بحث بالاسم أو الصف أو المجموعة..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: "200px", padding: "0.5rem 0.9rem", fontSize: "0.9rem" }} />
                <select className="form-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: "0.5rem 0.9rem", fontSize: "0.9rem" }}>
                  <option value="all">📋 كل الحالات</option>
                  <option value="active">🟢 نشط</option>
                  <option value="expiring">⚠️ ينتهي قريباً</option>
                  <option value="inactive">🔴 غير نشط / منتهي</option>
                </select>
                <select className="form-input" value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} style={{ padding: "0.5rem 0.9rem", fontSize: "0.9rem" }}>
                  <option value="all">🎓 كل الصفوف</option>
                  {allGrades.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                <select className="form-input" value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: "0.5rem 0.9rem", fontSize: "0.9rem" }}>
                  <option value="name">ترتيب: الاسم</option>
                  <option value="grade">ترتيب: الصف</option>
                  <option value="days">ترتيب: الأيام المتبقية</option>
                </select>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", whiteSpace: "nowrap" }}>{filtered.length} طالب</span>
              </div>

              {/* Table */}
              <div className="glass" style={{ borderRadius: "18px", overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem", minWidth: "760px" }}>
                    <thead>
                      <tr style={{ background: "rgba(99,102,241,0.15)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                        {["الطالب", "الصف الدراسي", "المجموعة", "العام الدراسي", "الحالة", "الأيام المتبقية", "مدة الصلاحية", "تقرير الأداء"].map((h) => (
                          <th key={h} style={{ padding: "0.75rem 0.8rem", fontWeight: 800, color: "#818cf8", textAlign: "right", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 && (
                        <tr><td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>لا توجد نتائج</td></tr>
                      )}
                      {filtered.map((s, idx) => {
                        const info = getSubscriptionInfo(s);
                        const d = getSubscriptionDays(s);
                        const sc =
                          info.status === "active" ? "#22c55e"
                          : info.status === "expiring_soon" ? "#f59e0b"
                          : "#ef4444";
                        const { color: gc } = getGradeStage(s.grade);
                        return (
                          <tr key={s.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)", transition: "background 0.2s", cursor: "default" }}
                            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(99,102,241,0.07)"}
                            onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)"}>
                            <td style={{ padding: "0.65rem 0.8rem" }}>
                              <div style={{ fontWeight: 700, color: "#e2e8f0" }}>{s.fullName}</div>
                              <div style={{ fontSize: "0.74rem", color: "#64748b" }}>{s.email}</div>
                            </td>
                            <td style={{ padding: "0.65rem 0.8rem" }}><span style={{ color: gc, fontWeight: 600, fontSize: "0.8rem" }}>{s.grade || "—"}</span></td>
                            <td style={{ padding: "0.65rem 0.8rem", color: "#94a3b8" }}>{s.group || "—"}</td>
                            <td style={{ padding: "0.65rem 0.8rem", color: "#94a3b8" }}>{s.academicYear || "—"}</td>
                            <td style={{ padding: "0.65rem 0.8rem" }}>
                              <span style={{ background: sc + "18", border: "1px solid " + sc, color: sc, padding: "0.2rem 0.55rem", borderRadius: "20px", fontSize: "0.76rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                                {info.status === "active" ? "🟢 نشط" : info.status === "expiring_soon" ? "⚠️ ينتهي قريباً" : info.status === "expired" ? "🔴 منتهي" : "🔴 غير مفعل"}
                              </span>
                            </td>
                            <td style={{ padding: "0.65rem 0.8rem", fontWeight: 700, color: info.daysLeft > 0 ? "#22c55e" : "#ef4444", textAlign: "center" }}>
                              {info.daysLeft === Infinity ? "∞" : info.daysLeft > 0 ? info.daysLeft : "—"}
                            </td>
                            <td style={{ padding: "0.65rem 0.8rem", color: "#94a3b8", textAlign: "center" }}>{d > 0 ? d + " يوم" : "—"}</td>
                            <td style={{ padding: "0.65rem 0.8rem", textAlign: "center" }}>
                              <button onClick={() => setSelectedStudent(s)} className="button button-sm button-primary" style={{ fontSize: "0.76rem", padding: "0.3rem 0.65rem" }}>📊 تقرير الأداء</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Individual Report Modal */}
      {selectedStudent && <StudentReportModal student={selectedStudent} onClose={() => setSelectedStudent(null)} />}
    </div>
  );
}
