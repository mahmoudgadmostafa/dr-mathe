// src/pages/TeacherReports.jsx
import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import { getSubscriptionInfo } from "../components/StudentCard";
import StudentFinancialLedgerModal from "../components/StudentFinancialLedgerModal";

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

function formatRelativeTime(dateOrTimestamp) {
  if (!dateOrTimestamp) return "لم يبدأ بعد";
  let d =
    typeof dateOrTimestamp.toDate === "function"
      ? dateOrTimestamp.toDate()
      : new Date(dateOrTimestamp);
  if (isNaN(d.getTime())) return "لم يبدأ بعد";

  const now = new Date();
  const diffMs = now - d;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 5) return "الآن / نشط حالياً";
  if (diffMinutes < 60) return `منذ ${diffMinutes} دقيقة`;
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;
  if (diffDays === 1) return "أمس";
  if (diffDays < 7) return `منذ ${diffDays} أيام`;
  if (diffDays < 30) return `منذ ${Math.floor(diffDays / 7)} أسابيع`;
  return d.toLocaleDateString("ar-EG", { month: "short", day: "numeric" });
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

function getAcademicRating(actualProgress, avgScore, totalSubs) {
  if (totalSubs === 0 && actualProgress === 0) {
    return { label: "لم يبدأ التعلم بعد", color: "#94a3b8", icon: "🌱", badge: "غير متفاعل" };
  }
  if (actualProgress >= 70 && (avgScore >= 80 || totalSubs === 0)) {
    return { label: "متفوق ومتميز بالمنهج", color: "#22c55e", icon: "🏆", badge: "متفوق 🌟" };
  }
  if (actualProgress >= 45 || avgScore >= 70) {
    return { label: "جيد جداً ومجتهد", color: "#38bdf8", icon: "💎", badge: "مجتهد 💎" };
  }
  if (actualProgress >= 20 || avgScore >= 50) {
    return { label: "مقبول / قيد المتابعة", color: "#f59e0b", icon: "⚡", badge: "قيد المتابعة ⚡" };
  }
  return { label: "يحتاج دعم وتنشيط", color: "#ef4444", icon: "⚠️", badge: "يحتاج دعم ⚠️" };
}

const GRADE_ORDER = [
  "الصف الأول الابتدائي", "الصف الثاني الابتدائي", "الصف الثالث الابتدائي",
  "الصف الرابع الابتدائي", "الصف الخامس الابتدائي", "الصف السادس الابتدائي",
  "الصف الأول الإعدادي", "الصف الثاني الإعدادي", "الصف الثالث الإعدادي",
  "الصف الأول الثانوي", "الصف الثاني الثانوي", "الصف الثالث الثانوي",
];

// ─── Actual Learning Progress Calculator ───────────────────────────────────
function calculateStudentLearningProgress(student, { libraryItems = [], quizzes = [], liveSessions = [], quizSubmissions = [], studentActivities = [] }) {
  const studentId = student?.id || student?.uid || "";
  const studentEmail = (student?.email || "").trim().toLowerCase();

  // Find all quiz submissions belonging to this student
  const studentSubs = quizSubmissions.filter((sub) => {
    if (studentId && (sub.studentUid === studentId || sub.studentId === studentId)) return true;
    if (studentEmail && sub.studentEmail && sub.studentEmail.trim().toLowerCase() === studentEmail) return true;
    return false;
  }).sort((a, b) => {
    const da = a.submittedAt?.toDate ? a.submittedAt.toDate() : new Date(a.submittedAt || 0);
    const db = b.submittedAt?.toDate ? b.submittedAt.toDate() : new Date(b.submittedAt || 0);
    return db - da;
  });

  // Find all activities belonging to this student
  const studentActs = studentActivities.filter((act) => {
    if (studentId && (act.studentUid === studentId || act.studentId === studentId)) return true;
    if (studentEmail && act.studentEmail && act.studentEmail.trim().toLowerCase() === studentEmail) return true;
    return false;
  }).sort((a, b) => {
    const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
    const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
    return db - da;
  });

  // Assigned library items based on student grade & group
  const assignedLibraryItems = libraryItems.filter((item) => {
    const matchGrade = !item.grade || item.grade === "جميع الصفوف الدراسية" || item.grade === student?.grade;
    const matchGroup = !item.group || item.group === "جميع المجموعات" || !student?.group || item.group === student?.group;
    return matchGrade && matchGroup;
  });

  // Assigned quizzes
  const assignedQuizzes = quizzes.filter((qz) => {
    if (qz.isActive === false) return false;
    const matchGrade = !qz.grade || qz.grade === "جميع الصفوف الدراسية" || qz.grade === student?.grade;
    const matchGroup = !qz.group || qz.group === "جميع المجموعات" || !student?.group || qz.group === student?.group;
    return matchGrade && matchGroup;
  });

  // Assigned live sessions
  const assignedLiveSessions = liveSessions.filter((sess) => {
    const matchGrade = !sess.grade || sess.grade === "جميع الصفوف الدراسية" || sess.grade === student?.grade;
    const matchGroup = !sess.group || sess.group === "جميع المجموعات" || !student?.group || sess.group === student?.group;
    return matchGrade && matchGroup;
  });

  const assignedVideos = assignedLibraryItems.filter((i) => i.type === "video");
  const assignedDocs = assignedLibraryItems.filter((i) => i.type === "pdf" || i.type === "infographic" || i.type === "other");

  // Track completed unique items from activities
  const viewedItemIds = new Set(studentActs.filter((a) => a.itemId).map((a) => a.itemId));
  const viewedTitles = new Set(studentActs.filter((a) => a.itemTitle).map((a) => a.itemTitle.trim().toLowerCase()));

  // Completed videos in assigned curriculum
  const completedVideosAssigned = assignedVideos.filter((v) =>
    (v.id && viewedItemIds.has(v.id)) || (v.title && viewedTitles.has(v.title.trim().toLowerCase()))
  ).length;
  const totalVideoViews = studentActs.filter((a) => a.type === "video").length;
  const completedVideos = Math.max(completedVideosAssigned, Math.min(totalVideoViews, Math.max(assignedVideos.length, totalVideoViews)));

  // Completed docs in assigned curriculum
  const completedDocsAssigned = assignedDocs.filter((d) =>
    (d.id && viewedItemIds.has(d.id)) || (d.title && viewedTitles.has(d.title.trim().toLowerCase()))
  ).length;
  const totalDocViews = studentActs.filter((a) => a.type === "pdf" || a.type === "infographic").length;
  const completedDocs = Math.max(completedDocsAssigned, Math.min(totalDocViews, Math.max(assignedDocs.length, totalDocViews)));

  // Total completed lessons
  const rawCompletedLibraryCount = assignedLibraryItems.filter((item) =>
    (item.id && viewedItemIds.has(item.id)) || (item.title && viewedTitles.has(item.title.trim().toLowerCase()))
  ).length;
  const totalUniqueViewsCount = new Set(studentActs.map((a) => a.itemId || a.itemTitle).filter(Boolean)).size;
  const completedLessons = Math.max(rawCompletedLibraryCount, Math.min(totalUniqueViewsCount, Math.max(assignedLibraryItems.length, totalUniqueViewsCount)));

  // Completed quizzes (distinct quizzes taken)
  const submittedQuizIds = new Set(studentSubs.map((s) => s.quizId).filter(Boolean));
  const submittedQuizTitles = new Set(studentSubs.map((s) => s.quizTitle?.trim().toLowerCase()).filter(Boolean));
  const rawCompletedQuizzesCount = assignedQuizzes.filter((qz) =>
    (qz.id && submittedQuizIds.has(qz.id)) || (qz.title && submittedQuizTitles.has(qz.title.trim().toLowerCase()))
  ).length;
  const totalUniqueQuizzesTaken = new Set(studentSubs.map((s) => s.quizId || s.quizTitle).filter(Boolean)).size;
  const completedQuizzes = Math.max(rawCompletedQuizzesCount, totalUniqueQuizzesTaken);

  // Targets
  const totalRequiredLessons = Math.max(assignedLibraryItems.length, completedLessons);
  const totalRequiredQuizzes = Math.max(assignedQuizzes.length, completedQuizzes);
  const totalCurriculumTargets = totalRequiredLessons + totalRequiredQuizzes;
  const totalCompletedTargets = completedLessons + completedQuizzes;

  let actualProgressPercent = 0;
  if (totalCurriculumTargets > 0) {
    actualProgressPercent = Math.min(100, Math.round((totalCompletedTargets / totalCurriculumTargets) * 100));
  } else if (studentSubs.length > 0 || studentActs.length > 0) {
    actualProgressPercent = Math.min(100, (studentSubs.length * 20) + (studentActs.length * 10));
  }

  // Quiz statistics
  const totalSubmissions = studentSubs.length;
  const avgScore = totalSubmissions > 0
    ? Math.round(studentSubs.reduce((acc, c) => acc + (Number(c.percentage) || 0), 0) / totalSubmissions)
    : 0;
  const passedCount = studentSubs.filter((s) => s.isPassed || (Number(s.percentage) || 0) >= 60).length;
  const passRate = totalSubmissions > 0 ? Math.round((passedCount / totalSubmissions) * 100) : 0;

  // Live sessions attended
  const liveJoinsCount = studentActs.filter((a) => a.type === "live_session").length;

  // Last active date
  let lastActiveDate = null;
  const allDateObjects = [
    ...studentSubs.map((s) => s.submittedAt),
    ...studentActs.map((a) => a.createdAt),
  ].filter(Boolean);

  allDateObjects.forEach((t) => {
    const d = typeof t?.toDate === "function" ? t.toDate() : new Date(t);
    if (!isNaN(d.getTime())) {
      if (!lastActiveDate || d > lastActiveDate) lastActiveDate = d;
    }
  });

  const academicRating = getAcademicRating(actualProgressPercent, avgScore, totalSubmissions);

  return {
    studentSubs,
    studentActs,
    assignedLibraryItems,
    assignedQuizzes,
    assignedVideos,
    assignedDocs,
    assignedLiveSessions,
    completedVideos,
    completedDocs,
    completedLessons,
    totalRequiredLessons,
    completedQuizzes,
    totalRequiredQuizzes,
    totalCurriculumTargets,
    totalCompletedTargets,
    actualProgressPercent,
    totalSubmissions,
    avgScore,
    passedCount,
    passRate,
    liveJoinsCount,
    lastActiveDate,
    lastActiveFormatted: formatRelativeTime(lastActiveDate),
    academicRating,
  };
}

// ─── Individual Student Actual Performance Report Modal ─────────────────────
function StudentReportModal({ student, progress, onClose }) {
  const reportRef = useRef(null);
  const subInfo = getSubscriptionInfo(student);
  const days = getSubscriptionDays(student);
  const gradeInfo = getGradeStage(student.grade);
  const [toastMessage, setToastMessage] = useState("");
  const [showFinancialModal, setShowFinancialModal] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

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

  // Dynamic progress bar styling
  const pColor =
    progress.actualProgressPercent >= 75 ? "#22c55e"
      : progress.actualProgressPercent >= 50 ? "#38bdf8"
        : progress.actualProgressPercent >= 25 ? "#f59e0b"
          : "#94a3b8";

  const generateReportText = () => {
    return [
      "📊 تقرير التقدم والتحصيل التعليمي الفعلي للطالب",
      "👨‍🎓 اسم الطالب: " + student.fullName,
      "🎓 الصف الدراسي: " + (student.grade || "غير محدد"),
      student.group ? "👥 المجموعة: " + student.group : "",
      "-----------------------------------",
      "📈 نسبة التقدم وإنجاز المنهج الفعلي: " + progress.actualProgressPercent + "%",
      "📚 إجمالي المحتويات المنجزة: " + progress.totalCompletedTargets + " من أصل " + progress.totalCurriculumTargets + " مقرر",
      "🎥 فيديوهات الشرح المكتملة: " + progress.completedVideos + " من " + Math.max(progress.assignedVideos.length, progress.completedVideos) + " فيديو",
      "📄 الملازم والملخصات المقروءة: " + progress.completedDocs + " من " + Math.max(progress.assignedDocs.length, progress.completedDocs) + " ملزمة",
      "📝 الاختبارات المنجزة: " + progress.completedQuizzes + " من " + Math.max(progress.assignedQuizzes.length, progress.completedQuizzes) + " اختبار",
      "🎯 متوسط درجات الاختبارات: " + (progress.totalSubmissions > 0 ? progress.avgScore + "%" : "لم يختبر بعد"),
      "🌟 التقييم الأكاديمي العام: " + progress.academicRating.icon + " " + progress.academicRating.label,
      "📡 حضور الحصص المباشرة: " + progress.liveJoinsCount + " حصة تفاعلية",
      "🕒 آخر نشاط وتفاعل تعليمي: " + progress.lastActiveFormatted,
      "-----------------------------------",
      "🟢 حالة الاشتراك: " + subInfo.label + (daysLeft !== null ? ` (متبقي ${daysLeft} يوم)` : ""),
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
    showToast("🟢 جاري فتح الواتساب لمشاركة تقرير الأداء الفعلي...");
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
          title: "تقرير الأداء والتقدم التعليمي: " + student.fullName,
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
        showToast("📋 تم نسخ تقرير التقدم الفعلي إلى الحافظة بنجاح!");
      });
    } else {
      showToast("⚠️ يتعذر النسخ التلقائي في هذا المتصفح.");
    }
  };

  const handlePrint = () => {
    const content = reportRef.current?.innerHTML || "";
    const printWindow = window.open("", "_blank");
    printWindow.document.write(
      "<html dir=\"rtl\"><head><title>تقرير التقدم والتحصيل التعليمي: " + student.fullName + "</title>" +
      "<meta charset=\"UTF-8\" />" +
      "<style>" +
      "*{box-sizing:border-box;margin:0;padding:0;}" +
      "body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#0f172a;color:#e2e8f0;direction:rtl;padding:2rem;}" +
      ".report-print{max-width:680px;margin:0 auto;background:linear-gradient(135deg,#1e1b4b,#1e293b);border-radius:20px;padding:2rem;}" +
      ".stat-row{display:flex;justify-content:space-between;align-items:center;padding:0.65rem 0;border-bottom:1px solid rgba(255,255,255,0.08);}" +
      ".stat-label{color:#94a3b8;font-size:0.9rem;}" +
      ".stat-value{font-weight:700;color:#e2e8f0;font-size:0.9rem;}" +
      ".footer{text-align:center;margin-top:1.5rem;color:#64748b;font-size:0.78rem;border-top:1px solid rgba(255,255,255,0.06);padding-top:1rem;}" +
      "@media print{body{background:white;color:black;}.report-print{background:white;color:black;border:1px solid #ccc;}}" +
      "</style>" +
      "</head><body><div class=\"report-print\">" + content + "</div></body></html>"
    );
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(10px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: "linear-gradient(135deg,#1e1b4b 0%,#0f172a 100%)", borderRadius: "24px", border: "1px solid rgba(139,92,246,0.35)", width: "100%", maxWidth: "660px", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 0 60px rgba(139,92,246,0.3)" }}>
        {/* Top bar */}
        <div style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)", padding: "1.2rem 1.5rem", borderRadius: "24px 24px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "#fff", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>📊</span> تقرير التقدم والتحصيل التعليمي الفعلي للطالب
          </div>
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
          {/* Student Profile Header */}
          <div style={{ textAlign: "center", marginBottom: "1.2rem", paddingBottom: "1rem", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", margin: "0 auto 0.75rem", boxShadow: "0 0 25px rgba(124,58,237,0.5)" }}>
              {gradeInfo.icon}
            </div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 900, color: "#c4b5fd", margin: 0 }}>{student.fullName}</h2>
            <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", marginTop: "0.4rem", flexWrap: "wrap", fontSize: "0.82rem" }}>
              <span style={{ color: "#38bdf8", fontWeight: 700 }}>🎓 {student.grade || "غير محدد"}</span>
              {student.group && <span style={{ color: "#a78bfa" }}>👥 {student.group}</span>}
              <span style={{ color: "#94a3b8" }}>🕒 آخر نشاط: {progress.lastActiveFormatted}</span>
            </div>
          </div>

          {/* 🌟 MAIN HERO SECTION: ACTUAL LEARNING PROGRESS */}
          <div style={{
            background: "linear-gradient(135deg, rgba(30,27,75,0.7), rgba(15,23,42,0.9))",
            border: `1.5px solid ${pColor}55`,
            borderRadius: "18px",
            padding: "1.3rem",
            marginBottom: "1.2rem",
            position: "relative",
            overflow: "hidden"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "0.6rem" }}>
              <div>
                <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.7)", display: "block" }}>📈 إنجاز ومسار المنهج</span>
                <span style={{ fontSize: "1.1rem", fontWeight: 900, color: "#fff" }}>نسبة التقدم التعليمي الفعلي</span>
              </div>
              <div style={{ fontSize: "2.2rem", fontWeight: 900, color: pColor, lineHeight: 1 }}>
                {progress.actualProgressPercent}%
              </div>
            </div>

            {/* Giant Progress Bar */}
            <div style={{ height: 14, background: "rgba(255,255,255,0.08)", borderRadius: 10, overflow: "hidden", marginBottom: "0.75rem" }}>
              <div style={{
                height: "100%",
                width: `${progress.actualProgressPercent}%`,
                background: `linear-gradient(90deg, ${pColor}88, ${pColor})`,
                borderRadius: 10,
                transition: "width 0.8s ease-in-out",
                boxShadow: `0 0 15px ${pColor}66`
              }} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "rgba(255,255,255,0.6)" }}>
              <span>أكمل الطالب <strong>{progress.totalCompletedTargets}</strong> من أصل <strong>{progress.totalCurriculumTargets}</strong> محتوى واختبار مقرر</span>
              <span>{progress.actualProgressPercent >= 75 ? "متقدم جداً 🚀" : progress.actualProgressPercent >= 50 ? "تقدم جيد 💎" : progress.actualProgressPercent > 0 ? "قيد المتابعة ⚡" : "لم يبدأ بعد 💤"}</span>
            </div>
          </div>

          {/* Academic Rating & Overall Mastery */}
          <div style={{
            background: `${progress.academicRating.color}15`,
            border: `1.5px solid ${progress.academicRating.color}`,
            borderRadius: "16px",
            padding: "1rem",
            textAlign: "center",
            marginBottom: "1.2rem",
          }}>
            <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.7)", marginBottom: "0.2rem" }}>🎯 التقييم والمستوى الأكاديمي العام</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 900, color: progress.academicRating.color }}>
              {progress.academicRating.icon} {progress.academicRating.label}
              {progress.totalSubmissions > 0 && ` (${progress.avgScore}%)`}
            </div>
            <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.7)", marginTop: "0.35rem" }}>
              {progress.totalSubmissions > 0
                ? `أكمل ${progress.totalSubmissions} اختبارات بنسبة نجاح ${progress.passRate}% • ${progress.passedCount} اختبار ناجح`
                : "لم يقم الطالب بأداء أي اختبار ذكي حتى الآن"}
            </div>
          </div>

          {/* Detailed Learning Milestones Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.6rem", marginBottom: "1.2rem" }}>
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", padding: "0.7rem 0.5rem", borderRadius: "14px", textAlign: "center" }}>
              <div style={{ fontSize: "1.3rem" }}>🎥</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#f87171" }}>
                {progress.completedVideos} <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>/ {Math.max(progress.assignedVideos.length, progress.completedVideos)}</span>
              </div>
              <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.7)", marginTop: "0.1rem" }}>فيديوهات الشرح</div>
            </div>

            <div style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)", padding: "0.7rem 0.5rem", borderRadius: "14px", textAlign: "center" }}>
              <div style={{ fontSize: "1.3rem" }}>📄</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#38bdf8" }}>
                {progress.completedDocs} <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>/ {Math.max(progress.assignedDocs.length, progress.completedDocs)}</span>
              </div>
              <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.7)", marginTop: "0.1rem" }}>ملازم وملخصات</div>
            </div>

            <div style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)", padding: "0.7rem 0.5rem", borderRadius: "14px", textAlign: "center" }}>
              <div style={{ fontSize: "1.3rem" }}>📝</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#c084fc" }}>
                {progress.completedQuizzes} <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>/ {Math.max(progress.assignedQuizzes.length, progress.completedQuizzes)}</span>
              </div>
              <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.7)", marginTop: "0.1rem" }}>اختبارات مكتملة</div>
            </div>

            <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", padding: "0.7rem 0.5rem", borderRadius: "14px", textAlign: "center" }}>
              <div style={{ fontSize: "1.3rem" }}>📡</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#4ade80" }}>{progress.liveJoinsCount}</div>
              <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.7)", marginTop: "0.1rem" }}>حصص مباشرة</div>
            </div>
          </div>

          {/* Quiz Submissions Detail Section */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "1rem", marginBottom: "1.2rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#c4b5fd", margin: "0 0 0.8rem 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>📝 نتائج ودرجات الاختبارات والتطبيقات الذكية ({progress.studentSubs.length})</span>
              {progress.totalSubmissions > 0 && <span style={{ fontSize: "0.8rem", color: "#4ade80" }}>المتوسط: {progress.avgScore}%</span>}
            </h3>

            {progress.studentSubs.length === 0 ? (
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.82rem", margin: 0, textAlign: "center", padding: "0.6rem" }}>
                لم يقم الطالب بأداء أي اختبار ذكي حتى الآن.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "180px", overflowY: "auto" }}>
                {progress.studentSubs.map((sub, i) => {
                  const isPass = sub.isPassed || (Number(sub.percentage) || 0) >= 60;
                  const itemColor = isPass ? "#4ade80" : "#f87171";
                  return (
                    <div key={sub.id || i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.8rem", background: "rgba(0,0,0,0.25)", borderRadius: "10px", borderRight: `3px solid ${itemColor}` }}>
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

          {/* Recent Learning Activity Log */}
          {progress.studentActs.length > 0 && (
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "1rem", marginBottom: "1.2rem" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#c4b5fd", margin: "0 0 0.8rem 0" }}>
                🕒 آخر التفاعلات والدروس المكتملة حديثاً ({Math.min(progress.studentActs.length, 5)})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", maxHeight: "150px", overflowY: "auto" }}>
                {progress.studentActs.slice(0, 5).map((act, idx) => {
                  const icon =
                    act.type === "video" ? "🎥"
                      : act.type === "pdf" ? "📄"
                        : act.type === "live_session" ? "📡"
                          : act.type === "ai_room" ? "🤖"
                            : "📌";
                  return (
                    <div key={act.id || idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.45rem 0.7rem", background: "rgba(0,0,0,0.2)", borderRadius: "8px", fontSize: "0.82rem" }}>
                      <span style={{ color: "#e2e8f0" }}>{icon} {act.itemTitle || "محتوى تعليمي"}</span>
                      <span style={{ color: "#94a3b8", fontSize: "0.72rem" }}>{formatRelativeTime(act.createdAt)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Subscription and Profile Info Summary */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "0.8rem" }}>
            {[
              ["📱 رقم الهاتف", student.phone || "—"],
              ["🎓 الصف الدراسي", student.grade || "غير محدد"],
              ["👥 المجموعة", student.group || "—"],
              ["🟢 حالة الحساب", subInfo.label],
              ["🗓️ تاريخ انتهاء الصلاحية", formatDateAr(student.subscribedUntil)],
              ["⏱️ الأيام المتبقية للاشتراك", daysLeft !== null ? daysLeft + " يوم" : "—"],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.45rem 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ color: "#94a3b8", fontSize: "0.82rem" }}>{label}</span>
                <span style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "0.85rem" }}>{value}</span>
              </div>
            ))}

            {/* Direct Trigger to Financial Ledger & Subscription Management */}
            <div style={{ marginTop: "0.85rem" }}>
              <button
                type="button"
                onClick={() => setShowFinancialModal(true)}
                style={{
                  width: "100%",
                  background: "linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.45))",
                  border: "1.5px solid #10b981",
                  color: "#6ee7b7",
                  padding: "0.65rem 1rem",
                  borderRadius: "14px",
                  fontWeight: 800,
                  fontSize: "0.88rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  boxShadow: "0 4px 15px rgba(16, 185, 129, 0.2)",
                }}
              >
                <span>💳</span> التحكم في السجل المالي والاشتراك (إضافة / تعديل / حذف)
              </button>
            </div>
          </div>

          {/* Footer */}
          <div style={{ textAlign: "center", marginTop: "1.2rem", color: "#64748b", fontSize: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "0.8rem" }}>
            منصة الدكتور في الرياضيات 📐 | تقرير الأداء والتقدم الفعلي صادر بتاريخ: {new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>

        {/* Action Toolbar */}
        <div style={{ padding: "1.2rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(15, 23, 42, 0.5)" }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#c4b5fd" }}>
            📤 خيارات مشاركة تقرير التقدم الفعلي مع الطالب وولي الأمر:
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

      {/* Student Financial Ledger Modal */}
      {showFinancialModal && (
        <StudentFinancialLedgerModal
          student={student}
          onClose={() => setShowFinancialModal(false)}
        />
      )}
    </div>
  );
}

// ─── Stat Card Component ───────────────────────────────────────────────────
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

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function TeacherReports() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const isTeacher = userProfile?.role === "teacher";

  // Data Collections
  const [students, setStudents] = useState([]);
  const [libraryItems, setLibraryItems] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [liveSessions, setLiveSessions] = useState([]);
  const [quizSubmissions, setQuizSubmissions] = useState([]);
  const [studentActivities, setStudentActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & State
  const [search, setSearch] = useState("");
  const [filterGrade, setFilterGrade] = useState("all");
  const [filterProgress, setFilterProgress] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("progress_desc");
  const [selectedStudentData, setSelectedStudentData] = useState(null);
  const [ledgerStudent, setLedgerStudent] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (!isTeacher) navigate("/dashboard");
  }, [isTeacher, navigate]);

  // Real-time Firestore Listeners
  useEffect(() => {
    // 1. Students
    const qStudents = query(collection(db, "users"), where("role", "==", "student"));
    const unsubStudents = onSnapshot(qStudents, (snap) => {
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    // 2. Library Items
    const unsubLibrary = onSnapshot(collection(db, "library_items"), (snap) => {
      setLibraryItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    // 3. Quizzes
    const unsubQuizzes = onSnapshot(collection(db, "quizzes"), (snap) => {
      setQuizzes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    // 4. Live Sessions
    const unsubSessions = onSnapshot(collection(db, "live_sessions"), (snap) => {
      setLiveSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    // 5. Quiz Submissions
    const unsubSubs = onSnapshot(collection(db, "quiz_submissions"), (snap) => {
      setQuizSubmissions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    // 6. Student Activities
    const unsubActs = onSnapshot(collection(db, "student_activities"), (snap) => {
      setStudentActivities(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubStudents();
      unsubLibrary();
      unsubQuizzes();
      unsubSessions();
      unsubSubs();
      unsubActs();
    };
  }, []);

  // Compute Actual Progress for ALL students in real-time
  const studentProgressMap = useMemo(() => {
    const map = {};
    students.forEach((student) => {
      const sId = student.id || student.uid;
      map[sId] = calculateStudentLearningProgress(student, {
        libraryItems,
        quizzes,
        liveSessions,
        quizSubmissions,
        studentActivities,
      });
    });
    return map;
  }, [students, libraryItems, quizzes, liveSessions, quizSubmissions, studentActivities]);

  // Overall Global Platform Analytics
  const analytics = useMemo(() => {
    const totalStudents = students.length;
    if (totalStudents === 0) {
      return {
        avgPlatformProgress: 0,
        totalQuizzesSubmitted: quizSubmissions.length,
        platformAvgScore: 0,
        platformPassRate: 0,
        totalLessonsCompleted: studentActivities.length,
        highAchieversCount: 0,
        activeLearnersCount: 0,
        notStartedCount: 0,
        stageProgress: {},
        progressBrackets: { veryHigh: 0, good: 0, initial: 0, beginner: 0, notStarted: 0 },
      };
    }

    let progressSum = 0;
    let highAchievers = 0;
    let notStarted = 0;
    let activeLearners = 0;

    const brackets = { veryHigh: 0, good: 0, initial: 0, beginner: 0, notStarted: 0 };
    const stageSum = {};
    const stageCount = {};

    students.forEach((s) => {
      const p = studentProgressMap[s.id || s.uid] || { actualProgressPercent: 0, avgScore: 0, totalCompletedTargets: 0 };
      const pct = p.actualProgressPercent || 0;
      progressSum += pct;

      const { stage } = getGradeStage(s.grade);
      stageSum[stage] = (stageSum[stage] || 0) + pct;
      stageCount[stage] = (stageCount[stage] || 0) + 1;

      if (pct >= 75) {
        brackets.veryHigh += 1;
        if (p.avgScore >= 80 || p.totalSubmissions === 0) highAchievers += 1;
      } else if (pct >= 50) {
        brackets.good += 1;
      } else if (pct >= 25) {
        brackets.initial += 1;
      } else if (pct > 0) {
        brackets.beginner += 1;
      } else {
        brackets.notStarted += 1;
        notStarted += 1;
      }

      if (pct > 0 || (p.studentSubs && p.studentSubs.length > 0) || (p.studentActs && p.studentActs.length > 0)) {
        activeLearners += 1;
      }
    });

    const avgPlatformProgress = Math.round(progressSum / totalStudents);

    const totalSubs = quizSubmissions.length;
    const platformAvgScore = totalSubs > 0
      ? Math.round(quizSubmissions.reduce((acc, c) => acc + (Number(c.percentage) || 0), 0) / totalSubs)
      : 0;
    const passedSubs = quizSubmissions.filter((c) => c.isPassed || (Number(c.percentage) || 0) >= 60).length;
    const platformPassRate = totalSubs > 0 ? Math.round((passedSubs / totalSubs) * 100) : 0;

    const stageProgress = {};
    Object.keys(stageSum).forEach((st) => {
      stageProgress[st] = Math.round(stageSum[st] / stageCount[st]);
    });

    return {
      avgPlatformProgress,
      totalQuizzesSubmitted: totalSubs,
      platformAvgScore,
      platformPassRate,
      totalLessonsCompleted: studentActivities.length,
      highAchieversCount: highAchievers,
      activeLearnersCount: activeLearners,
      notStartedCount: notStarted,
      stageProgress,
      progressBrackets: brackets,
    };
  }, [students, studentProgressMap, quizSubmissions, studentActivities]);

  // Top Achievers Leaderboard (Top 5)
  const topAchievers = useMemo(() => {
    return [...students]
      .map((s) => ({
        student: s,
        progress: studentProgressMap[s.id || s.uid] || { actualProgressPercent: 0, avgScore: 0 },
      }))
      .filter((item) => item.progress.actualProgressPercent > 0 || item.progress.avgScore > 0)
      .sort((a, b) => {
        if (b.progress.actualProgressPercent !== a.progress.actualProgressPercent) {
          return b.progress.actualProgressPercent - a.progress.actualProgressPercent;
        }
        return b.progress.avgScore - a.progress.avgScore;
      })
      .slice(0, 5);
  }, [students, studentProgressMap]);

  // Filter & Sort Students List
  const allGrades = useMemo(() => {
    return [...new Set(students.map((s) => s.grade).filter(Boolean))].sort(
      (a, b) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b)
    );
  }, [students]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const p = studentProgressMap[s.id || s.uid] || { actualProgressPercent: 0 };
      const subInfo = getSubscriptionInfo(s);

      // Status Match
      const statusMatch =
        filterStatus === "all" ? true
          : filterStatus === "active" ? (subInfo.status === "active" || subInfo.status === "expiring_soon")
            : filterStatus === "inactive" ? (subInfo.status === "inactive" || subInfo.status === "expired")
              : filterStatus === "expiring" ? subInfo.status === "expiring_soon"
                : true;

      // Grade Match
      const gradeMatch = filterGrade === "all" || s.grade === filterGrade;

      // Progress Match
      const pct = p.actualProgressPercent || 0;
      const progressMatch =
        filterProgress === "all" ? true
          : filterProgress === "advanced" ? pct >= 75
            : filterProgress === "good" ? pct >= 50 && pct < 75
              : filterProgress === "initial" ? pct >= 25 && pct < 50
                : filterProgress === "beginner" ? pct > 0 && pct < 25
                  : filterProgress === "not_started" ? pct === 0
                    : true;

      // Search Match
      const q = search.trim().toLowerCase();
      const searchMatch =
        !q ||
        s.fullName?.toLowerCase().includes(q) ||
        s.grade?.toLowerCase().includes(q) ||
        s.group?.toLowerCase().includes(q) ||
        s.phone?.includes(q) ||
        s.email?.toLowerCase().includes(q);

      return statusMatch && gradeMatch && progressMatch && searchMatch;
    }).sort((a, b) => {
      const pa = studentProgressMap[a.id || a.uid] || { actualProgressPercent: 0, avgScore: 0, lastActiveDate: null };
      const pb = studentProgressMap[b.id || b.uid] || { actualProgressPercent: 0, avgScore: 0, lastActiveDate: null };

      if (sortBy === "progress_desc") return pb.actualProgressPercent - pa.actualProgressPercent;
      if (sortBy === "progress_asc") return pa.actualProgressPercent - pb.actualProgressPercent;
      if (sortBy === "score_desc") return pb.avgScore - pa.avgScore;
      if (sortBy === "recent_active") {
        const da = pa.lastActiveDate ? pa.lastActiveDate.getTime() : 0;
        const db = pb.lastActiveDate ? pb.lastActiveDate.getTime() : 0;
        return db - da;
      }
      if (sortBy === "name") return (a.fullName || "").localeCompare(b.fullName || "", "ar");
      if (sortBy === "grade") return GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade);
      return 0;
    });
  }, [students, studentProgressMap, filterStatus, filterGrade, filterProgress, search, sortBy]);

  const STAGE_META = [
    { stage: "المرحلة الابتدائية", color: "#3b82f6", icon: "🏫" },
    { stage: "المرحلة الإعدادية", color: "#8b5cf6", icon: "📐" },
    { stage: "المرحلة الثانوية", color: "#f59e0b", icon: "🎓" },
  ];

  return (
    <div className="dashboard-modern fade-in">
      {/* Header */}
      <div className="glass" style={{ padding: "1.5rem 2rem", borderRadius: "20px", marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", background: "linear-gradient(135deg,rgba(124,58,237,0.22),rgba(79,70,229,0.22))", border: "1px solid rgba(124,58,237,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ fontSize: "2.5rem" }}>📊</span>
          <div>
            <h1 className="font-heading" style={{ fontSize: "1.6rem", margin: 0 }}>
              <span className="text-gradient">تقارير أداء وتقدم الطلاب الفعلي</span>
            </h1>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.7)", fontSize: "0.9rem" }}>
              متابعة حية ومباشرة لتقدم كل طالب في عملية التعلم، إنجاز المنهج، ودرجات الاختبارات
            </p>
          </div>
        </div>
        <Link to="/dashboard" className="button button-muted" style={{ fontSize: "0.9rem" }}>← لوحة التحكم</Link>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {[
          { id: "overview", icon: "📈", label: "نظرة عامة وإحصائيات التقدم الفعلي" },
          { id: "students", icon: "👥", label: "قائمة تقارير الطلاب ومسار التعلم" },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={"button " + (activeTab === tab.id ? "button-primary" : "button-muted")} style={{ fontSize: "0.9rem" }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-state">
          <img src="/logo-circle.png" alt="Loading" className="logo-loading-sway" style={{ width: 60, height: 60 }} />
          <p>جاري تحميل وتحليل بيانات التقدم الفعلي للطلاب...</p>
        </div>
      ) : (
        <>
          {/* ══════════════════════════════════════════════════════════════════
              TAB 1: OVERVIEW & LEARNING PROGRESS ANALYTICS
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {/* Actual Learning Progress KPI Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "1rem" }}>
                <StatCard
                  icon="📈"
                  label="متوسط إنجاز المنهج الفعلي"
                  value={`${analytics.avgPlatformProgress}%`}
                  color="#22c55e"
                  sub="معدل إكمال الدروس والاختبارات"
                />
                <StatCard
                  icon="📝"
                  label="إجمالي الاختبارات المنجزة"
                  value={analytics.totalQuizzesSubmitted}
                  color="#a78bfa"
                  sub={analytics.totalQuizzesSubmitted > 0 ? `نسبة النجاح ${analytics.platformPassRate}% (متوسط ${analytics.platformAvgScore}%)` : "—"}
                />
                <StatCard
                  icon="🎥"
                  label="مشاهدات الدروس والملازم"
                  value={analytics.totalLessonsCompleted}
                  color="#38bdf8"
                  sub="إجمالي تفاعلات المواد"
                />
                <StatCard
                  icon="🌟"
                  label="طلاب متفوقون بالمنهج"
                  value={analytics.highAchieversCount}
                  color="#f59e0b"
                  sub="إنجاز 75% فأكثر وبدرجات عالية"
                />
                <StatCard
                  icon="👥"
                  label="الطلاب المتفاعلون بالتعلم"
                  value={analytics.activeLearnersCount}
                  color="#818cf8"
                  sub={students.length > 0 ? `${Math.round((analytics.activeLearnersCount / students.length) * 100)}% من إجمالي الطلاب` : ""}
                />
                <StatCard
                  icon="⚠️"
                  label="طلاب يحتاجون متابعة"
                  value={analytics.notStartedCount}
                  color="#ef4444"
                  sub="0% إنجاز (لم يبدأوا التعلم بعد)"
                />
              </div>

              {/* Learning Progress Distribution & Stages Comparison */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: "1.5rem" }}>
                {/* Distribution by Progress Brackets */}
                <div className="glass" style={{ padding: "1.5rem", borderRadius: "20px" }}>
                  <h2 style={{ fontSize: "1.05rem", fontWeight: 800, marginBottom: "1.2rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span>🎯</span> توزيع الطلاب حسب مستوى التقدم الفعلي في المنهج
                  </h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {[
                      { label: "🚀 متقدم جداً (75% - 100%)", count: analytics.progressBrackets.veryHigh, color: "#22c55e" },
                      { label: "💎 تقدم ملحوظ (50% - 74%)", count: analytics.progressBrackets.good, color: "#38bdf8" },
                      { label: "⚡ تقدم أولي (25% - 49%)", count: analytics.progressBrackets.initial, color: "#f59e0b" },
                      { label: "🌱 في البداية (1% - 24%)", count: analytics.progressBrackets.beginner, color: "#818cf8" },
                      { label: "💤 لم يبدأ بعد (0%)", count: analytics.progressBrackets.notStarted, color: "#ef4444" },
                    ].map((b) => {
                      const pct = students.length > 0 ? Math.round((b.count / students.length) * 100) : 0;
                      return (
                        <div key={b.label}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: "0.3rem" }}>
                            <span style={{ color: "#e2e8f0" }}>{b.label}</span>
                            <span style={{ fontWeight: 800, color: b.color }}>{b.count} طالب ({pct}%)</span>
                          </div>
                          <div style={{ height: 10, background: "rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: b.color, borderRadius: 10, transition: "width 0.6s" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Progress by Academic Stage */}
                <div className="glass" style={{ padding: "1.5rem", borderRadius: "20px" }}>
                  <h2 style={{ fontSize: "1.05rem", fontWeight: 800, marginBottom: "1.2rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span>🏫</span> متوسط التقدم الفعلي حسب المرحلة الدراسية
                  </h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {STAGE_META.map(({ stage, color, icon }) => {
                      const avgProg = analytics.stageProgress[stage] || 0;
                      const count = students.filter((s) => getGradeStage(s.grade).stage === stage).length;
                      return (
                        <div key={stage} style={{ background: color + "12", border: "1px solid " + color + "33", borderRadius: "14px", padding: "1rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                            <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                              <span>{icon}</span> {stage}
                            </span>
                            <span style={{ fontWeight: 900, color, fontSize: "1.1rem" }}>
                              {avgProg}% <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>({count} طالب)</span>
                            </span>
                          </div>
                          <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 10, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${avgProg}%`, background: color, borderRadius: 10, transition: "width 0.6s" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 🌟 Top Students Leaderboard */}
              {topAchievers.length > 0 && (
                <div className="glass" style={{ padding: "1.5rem", borderRadius: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem", flexWrap: "wrap", gap: "0.5rem" }}>
                    <h2 style={{ fontSize: "1.05rem", fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span>🏆</span> لوحة شرف المتميزين: أعلى الطلاب إنجازاً وتقدماً في المنهج
                    </h2>
                    <span style={{ fontSize: "0.8rem", color: "#a78bfa" }}>مرتبة حسب التقدم الفعلي ودرجات الاختبارات</span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
                    {topAchievers.map(({ student, progress }, idx) => (
                      <div
                        key={student.id}
                        style={{
                          background: "linear-gradient(135deg, rgba(30,27,75,0.6), rgba(15,23,42,0.8))",
                          border: "1px solid rgba(139,92,246,0.3)",
                          borderRadius: "16px",
                          padding: "1rem",
                          position: "relative",
                          overflow: "hidden"
                        }}
                      >
                        <div style={{ position: "absolute", top: "0.6rem", left: "0.8rem", fontSize: "1.4rem" }}>
                          {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "⭐"}
                        </div>
                        <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff", marginBottom: "0.2rem" }}>
                          {student.fullName}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "#38bdf8", marginBottom: "0.6rem" }}>
                          {student.grade || "غير محدد"}
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem", fontSize: "0.8rem" }}>
                          <span style={{ color: "rgba(255,255,255,0.7)" }}>نسبة إنجاز المنهج:</span>
                          <span style={{ fontWeight: 900, color: "#22c55e" }}>{progress.actualProgressPercent}%</span>
                        </div>
                        <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 10, overflow: "hidden", marginBottom: "0.6rem" }}>
                          <div style={{ height: "100%", width: `${progress.actualProgressPercent}%`, background: "#22c55e", borderRadius: 10 }} />
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem", color: "rgba(255,255,255,0.6)" }}>
                          <span>متوسط الاختبارات:</span>
                          <span style={{ fontWeight: 800, color: "#c084fc" }}>{progress.avgScore > 0 ? `${progress.avgScore}%` : "—"}</span>
                        </div>

                        <button
                          onClick={() => setSelectedStudentData({ student, progress })}
                          className="button button-sm button-primary"
                          style={{ width: "100%", marginTop: "0.75rem", fontSize: "0.75rem", padding: "0.35rem 0" }}
                        >
                          📊 عرض التقرير الفعلي
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 2: STUDENTS ACADEMIC PROGRESS TABLE
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "students" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Filters Bar */}
              <div className="glass" style={{ padding: "1rem 1.2rem", borderRadius: "16px", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="🔍 بحث باسم الطالب أو الهاتف أو الصف أو المجموعة..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ flex: 1, minWidth: "220px", padding: "0.5rem 0.9rem", fontSize: "0.9rem" }}
                />

                {/* Filter by Learning Progress */}
                <select
                  className="form-input"
                  value={filterProgress}
                  onChange={(e) => setFilterProgress(e.target.value)}
                  style={{ padding: "0.5rem 0.9rem", fontSize: "0.9rem" }}
                >
                  <option value="all">🎯 كل مستويات التقدم</option>
                  <option value="advanced">🚀 متقدم (75% فأكثر)</option>
                  <option value="good">💎 تقدم ملحوظ (50% - 74%)</option>
                  <option value="initial">⚡ تقدم أولي (25% - 49%)</option>
                  <option value="beginner">🌱 في البداية (1% - 24%)</option>
                  <option value="not_started">💤 لم يبدأ بعد (0%)</option>
                </select>

                {/* Filter by Grade */}
                <select
                  className="form-input"
                  value={filterGrade}
                  onChange={(e) => setFilterGrade(e.target.value)}
                  style={{ padding: "0.5rem 0.9rem", fontSize: "0.9rem" }}
                >
                  <option value="all">🎓 كل الصفوف</option>
                  {allGrades.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>

                {/* Filter by Subscription Status */}
                <select
                  className="form-input"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  style={{ padding: "0.5rem 0.9rem", fontSize: "0.9rem" }}
                >
                  <option value="all">📋 كل الاشتراكات</option>
                  <option value="active">🟢 نشط</option>
                  <option value="expiring">⚠️ ينتهي قريباً</option>
                  <option value="inactive">🔴 غير نشط / منتهي</option>
                </select>

                {/* Sort By */}
                <select
                  className="form-input"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{ padding: "0.5rem 0.9rem", fontSize: "0.9rem" }}
                >
                  <option value="progress_desc">📈 الأكثر تقدماً بالمنهج</option>
                  <option value="progress_asc">📉 الأقل تقدماً (بحاجة لمتابعة)</option>
                  <option value="score_desc">🎯 الأعلى درجات باختبارات</option>
                  <option value="recent_active">🕒 الأحدث نشاطاً وتفاعلاً</option>
                  <option value="name">🔤 الاسم أبجدياً</option>
                  <option value="grade">🎓 الصف الدراسي</option>
                </select>

                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                  {filteredStudents.length} طالب
                </span>
              </div>

              {/* Table of Actual Learning Progress */}
              <div className="glass" style={{ borderRadius: "18px", overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem", minWidth: "960px" }}>
                    <thead>
                      <tr style={{ background: "rgba(99,102,241,0.18)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                        {[
                          "الطالب",
                          "الصف الدراسي والمجموعة",
                          "التقدم الفعلي في المنهج",
                          "متوسط الدرجات والتقييم",
                          "الاختبارات الذكية",
                          "الدروس والمشاهدات",
                          "آخر نشاط وتفاعل",
                          "حالة الحساب",
                          "تقرير الأداء الفعلي",
                        ].map((h) => (
                          <th key={h} style={{ padding: "0.8rem 0.85rem", fontWeight: 800, color: "#818cf8", textAlign: "right", whiteSpace: "nowrap" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.length === 0 && (
                        <tr>
                          <td colSpan={9} style={{ textAlign: "center", padding: "2.5rem", color: "#64748b" }}>
                            لا توجد نتائج تطابق خيارات البحث والفلترة المحددة
                          </td>
                        </tr>
                      )}
                      {filteredStudents.map((s, idx) => {
                        const p = studentProgressMap[s.id || s.uid] || {
                          actualProgressPercent: 0,
                          totalCompletedTargets: 0,
                          totalCurriculumTargets: 0,
                          avgScore: 0,
                          academicRating: { label: "لم يبدأ", color: "#94a3b8", badge: "غير متفاعل" },
                          completedQuizzes: 0,
                          totalRequiredQuizzes: 0,
                          completedVideos: 0,
                          completedDocs: 0,
                          lastActiveFormatted: "لم يبدأ",
                        };

                        const subInfo = getSubscriptionInfo(s);
                        const sc =
                          subInfo.status === "active" ? "#22c55e"
                            : subInfo.status === "expiring_soon" ? "#f59e0b"
                              : "#ef4444";
                        const { color: gc } = getGradeStage(s.grade);

                        const progressColor =
                          p.actualProgressPercent >= 75 ? "#22c55e"
                            : p.actualProgressPercent >= 50 ? "#38bdf8"
                              : p.actualProgressPercent >= 25 ? "#f59e0b"
                                : "#94a3b8";

                        return (
                          <tr
                            key={s.id}
                            style={{
                              borderBottom: "1px solid rgba(255,255,255,0.04)",
                              background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                              transition: "background 0.2s",
                              cursor: "default"
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(99,102,241,0.08)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)")}
                          >
                            {/* Student Name & Contacts */}
                            <td style={{ padding: "0.75rem 0.85rem" }}>
                              <div style={{ fontWeight: 800, color: "#fff", fontSize: "0.92rem" }}>{s.fullName}</div>
                              <div style={{ fontSize: "0.74rem", color: "#94a3b8", direction: "ltr", textAlign: "right" }}>
                                {s.phone || s.email}
                              </div>
                            </td>

                            {/* Grade & Group */}
                            <td style={{ padding: "0.75rem 0.85rem" }}>
                              <div style={{ color: gc, fontWeight: 700, fontSize: "0.82rem" }}>{s.grade || "—"}</div>
                              {s.group && <div style={{ fontSize: "0.74rem", color: "#a78bfa" }}>{s.group}</div>}
                            </td>

                            {/* 🌟 ACTUAL LEARNING PROGRESS (BAR & PERCENTAGE) */}
                            <td style={{ padding: "0.75rem 0.85rem", minWidth: "160px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                                <span style={{ fontWeight: 900, color: progressColor, fontSize: "0.95rem" }}>
                                  {p.actualProgressPercent}%
                                </span>
                                <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.5)" }}>
                                  ({p.totalCompletedTargets} / {p.totalCurriculumTargets} مقرر)
                                </span>
                              </div>
                              <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 10, overflow: "hidden" }}>
                                <div
                                  style={{
                                    height: "100%",
                                    width: `${p.actualProgressPercent}%`,
                                    background: progressColor,
                                    borderRadius: 10,
                                    transition: "width 0.6s ease"
                                  }}
                                />
                              </div>
                            </td>

                            {/* Academic Score & Rating Badge */}
                            <td style={{ padding: "0.75rem 0.85rem" }}>
                              <div style={{ fontWeight: 800, color: p.avgScore >= 75 ? "#22c55e" : p.avgScore >= 50 ? "#38bdf8" : p.avgScore > 0 ? "#f59e0b" : "#94a3b8", fontSize: "0.9rem" }}>
                                {p.avgScore > 0 ? `${p.avgScore}%` : "—"}
                              </div>
                              <span style={{ fontSize: "0.72rem", color: p.academicRating.color, fontWeight: 700 }}>
                                {p.academicRating.badge}
                              </span>
                            </td>

                            {/* Quizzes Taken / Passed */}
                            <td style={{ padding: "0.75rem 0.85rem" }}>
                              <div style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "0.84rem" }}>
                                {p.completedQuizzes} من {p.totalRequiredQuizzes}
                              </div>
                              <div style={{ fontSize: "0.72rem", color: p.passedCount > 0 ? "#4ade80" : "rgba(255,255,255,0.4)" }}>
                                {p.totalSubmissions > 0 ? `${p.passedCount} ناجح` : "لم يختبر"}
                              </div>
                            </td>

                            {/* Lessons / Videos / Docs Viewed */}
                            <td style={{ padding: "0.75rem 0.85rem" }}>
                              <div style={{ fontSize: "0.82rem", color: "#e2e8f0" }}>
                                🎥 {p.completedVideos} فيديو
                              </div>
                              <div style={{ fontSize: "0.74rem", color: "#38bdf8" }}>
                                📄 {p.completedDocs} ملزمة
                              </div>
                            </td>

                            {/* Last Active Timestamp */}
                            <td style={{ padding: "0.75rem 0.85rem", whiteSpace: "nowrap" }}>
                              <span style={{ fontSize: "0.78rem", color: p.lastActiveFormatted.includes("الآن") || p.lastActiveFormatted.includes("دقيقة") ? "#4ade80" : "rgba(255,255,255,0.6)" }}>
                                🕒 {p.lastActiveFormatted}
                              </span>
                            </td>

                            {/* Subscription Status */}
                            <td style={{ padding: "0.75rem 0.85rem" }}>
                              <span style={{ background: sc + "18", border: "1px solid " + sc, color: sc, padding: "0.2rem 0.55rem", borderRadius: "20px", fontSize: "0.74rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                                {subInfo.status === "active" ? "🟢 نشط" : subInfo.status === "expiring_soon" ? "⚠️ ينتهي قريباً" : subInfo.status === "expired" ? "🔴 منتهي" : "🔴 غير مفعل"}
                              </span>
                            </td>

                            {/* Action Buttons */}
                            <td style={{ padding: "0.75rem 0.85rem", textAlign: "center" }}>
                              <div style={{ display: "flex", gap: "0.4rem", justifyContent: "center", flexWrap: "wrap" }}>
                                <button
                                  onClick={() => setSelectedStudentData({ student: s, progress: p })}
                                  className="button button-sm button-primary"
                                  style={{ fontSize: "0.76rem", padding: "0.35rem 0.65rem", whiteSpace: "nowrap" }}
                                >
                                  📊 تقرير الأداء
                                </button>
                                <button
                                  onClick={() => setLedgerStudent(s)}
                                  className="button button-sm"
                                  title="التحكم في السجل المالي والاشتراك (إضافة / تعديل / حذف)"
                                  style={{
                                    fontSize: "0.76rem",
                                    padding: "0.35rem 0.65rem",
                                    whiteSpace: "nowrap",
                                    background: "rgba(16, 185, 129, 0.15)",
                                    border: "1px solid #10b981",
                                    color: "#6ee7b7",
                                    cursor: "pointer",
                                    borderRadius: "8px",
                                    fontWeight: 700,
                                  }}
                                >
                                  💳 السجل المالي
                                </button>
                              </div>
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
      {selectedStudentData && (
        <StudentReportModal
          student={selectedStudentData.student}
          progress={selectedStudentData.progress}
          onClose={() => setSelectedStudentData(null)}
        />
      )}

      {/* Individual Student Financial Ledger & Subscription Studio Modal */}
      {ledgerStudent && (
        <StudentFinancialLedgerModal
          student={ledgerStudent}
          onClose={() => setLedgerStudent(null)}
        />
      )}
    </div>
  );
}
