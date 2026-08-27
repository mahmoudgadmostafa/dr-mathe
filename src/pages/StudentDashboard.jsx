// src/pages/StudentDashboard.jsx
import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getSubscriptionInfo, hasActiveSubscription } from "../components/StudentCard";
import { db } from "../firebase";
import { collection, query, onSnapshot, orderBy, addDoc, serverTimestamp } from "firebase/firestore";
import { getEmbedUrl } from "./TeacherLibrary";
import { getQuizEmbedUrl } from "./TeacherQuizzes";
import StudentQuizRunner from "../components/StudentQuizRunner";
import StudentNotifications from "./StudentNotifications";
import SupportTickets from "./SupportTickets";
import StudentAIRoomModal from "../components/StudentAIRoomModal";

const PLATFORMS_MAP = {
  google_meet: { name: "Google Meet", icon: "🟢", color: "#00ac47" },
  zoom: { name: "Zoom Meeting", icon: "🔵", color: "#2d8cff" },
  teams: { name: "Microsoft Teams", icon: "🟣", color: "#6264a7" },
  youtube: { name: "YouTube Live", icon: "🔴", color: "#ff0000" },
  custom: { name: "رابط مخصص", icon: "🔗", color: "#0ea5e9" },
};

// Helper to format date in Arabic
function formatDateAr(dateOrStr) {
  if (!dateOrStr) return "—";
  let d = typeof dateOrStr.toDate === "function" ? dateOrStr.toDate() : new Date(dateOrStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
}

export function getLiveSessionTiming(sess, now = new Date()) {
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

// ─── Countdown Card for Next Upcoming Session ────────────────────────────────
function NextSessionCountdownCard({ sessions, handleLogActivity, now }) {
  const activeSessions = useMemo(() => {
    return sessions
      .map((s) => ({
        ...s,
        timing: getLiveSessionTiming(s, now),
        date: s.scheduledAt ? new Date(s.scheduledAt) : null,
      }))
      .filter((s) => !s.timing.isEnded)
      .sort((a, b) => {
        const aTime = a.date ? a.date.getTime() : 0;
        const bTime = b.date ? b.date.getTime() : 0;
        return aTime - bTime;
      });
  }, [sessions, now]);

  const nextSession = activeSessions[0] || null;

  if (!nextSession) {
    return (
      <div className="glass" style={{ padding: "1.8rem", borderRadius: "24px", textAlign: "center", border: "1px solid rgba(168,85,247,0.3)", background: "rgba(15,23,42,0.6)" }}>
        <span style={{ fontSize: "2.8rem" }}>📡</span>
        <h3 style={{ margin: "0.5rem 0 0.2rem 0", color: "#e2e8f0", fontWeight: 900, fontSize: "1.2rem" }}>لا توجد حصص مباشرة مجدولة حالياً</h3>
        <p style={{ fontSize: "0.92rem", color: "#cbd5e1", margin: 0, fontWeight: 600 }}>سيقوم المعلم بإضافة وتحديث مواعيد الحصص المباشرة القادمة هنا، وتُحذف الحصص تلقائياً بعد انتهائها.</p>
      </div>
    );
  }

  const timing = nextSession.timing;
  const isUpcoming = timing.isUpcoming;
  const isLive = timing.isLive;

  const diffMs = nextSession.date ? nextSession.date.getTime() - now.getTime() : 0;
  const days = Math.floor(Math.max(0, diffMs) / (1000 * 60 * 60 * 24));
  const hours = Math.floor((Math.max(0, diffMs) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((Math.max(0, diffMs) % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((Math.max(0, diffMs) % (1000 * 60)) / 1000);

  const plat = PLATFORMS_MAP[nextSession.platform] || PLATFORMS_MAP.custom;

  return (
    <div
      className="glass"
      style={{
        background: isLive
          ? "linear-gradient(135deg, rgba(6, 78, 59, 0.85), rgba(15, 23, 42, 0.95))"
          : "linear-gradient(135deg, rgba(30, 27, 75, 0.85), rgba(15, 23, 42, 0.95))",
        border: isLive ? "2px solid #10b981" : "1.5px solid rgba(168, 85, 247, 0.45)",
        borderRadius: "24px",
        padding: "1.8rem",
        boxShadow: isLive
          ? "0 20px 40px rgba(0,0,0,0.4), 0 0 30px rgba(16, 185, 129, 0.3)"
          : "0 20px 40px rgba(0,0,0,0.4), 0 0 25px rgba(168, 85, 247, 0.15)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <span style={{
          background: isLive ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.25)",
          border: `1px solid ${isLive ? "#22c55e" : "#f87171"}`,
          color: isLive ? "#4ade80" : "#fca5a5",
          padding: "0.4rem 1rem",
          borderRadius: "20px",
          fontWeight: 800,
          fontSize: "0.88rem"
        }}>
          {isLive ? "🔴 الحصة جارية ومباشرة الآن" : "🚨 الحصة المباشرة القادمة"}
        </span>
        <span style={{ background: "rgba(14, 165, 233, 0.25)", border: "1px solid #38bdf8", color: "#7dd3fc", padding: "0.4rem 1rem", borderRadius: "20px", fontWeight: 800, fontSize: "0.85rem" }}>
          {plat.icon} {plat.name}
        </span>
      </div>

      <h2 style={{ fontSize: "1.5rem", fontWeight: 900, color: "#ffffff", margin: "0 0 0.5rem 0", letterSpacing: "0.3px", textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
        {nextSession.title}
      </h2>

      {nextSession.date && (
        <p style={{ margin: "0 0 1rem 0", color: "#4ade80", fontWeight: 800, fontSize: "1rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span>⏰</span> <strong>الموعد:</strong> <span style={{ color: "#fef08a" }}>{nextSession.date.toLocaleString("ar-EG", { weekday: "long", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
          <span style={{ color: "#94a3b8", fontSize: "0.85rem", marginRight: "0.5rem" }}>({nextSession.durationMinutes || 90} دقيقة)</span>
        </p>
      )}

      {/* Countdown Timer Display */}
      {isUpcoming && (
        <div style={{ margin: "1.4rem 0" }}>
          <div style={{ fontSize: "0.88rem", color: "#e2e8f0", marginBottom: "0.6rem", fontWeight: 800, textAlign: "center" }}>
            ⏳ الوقت المتبقي على بدء الحصة:
          </div>
          <div style={{ display: "flex", gap: "0.8rem", justifyContent: "center", flexWrap: "wrap" }}>
            {[
              { label: "يوم", val: days, color: "#a855f7" },
              { label: "ساعة", val: hours, color: "#38bdf8" },
              { label: "دقيقة", val: minutes, color: "#4ade80" },
              { label: "ثانية", val: seconds, color: "#fbbf24" },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ background: "rgba(15, 23, 42, 0.8)", border: `1.5px solid ${color}66`, borderRadius: "16px", padding: "0.7rem 1rem", minWidth: "70px", textAlign: "center", boxShadow: `0 0 15px ${color}20` }}>
                <div style={{ fontSize: "1.6rem", fontWeight: 900, color, lineHeight: 1 }}>{String(val).padStart(2, "0")}</div>
                <div style={{ fontSize: "0.78rem", color: "#cbd5e1", fontWeight: 700, marginTop: "0.3rem" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLive && (
        <div style={{ background: "rgba(34,197,94,0.25)", border: "1.5px solid #22c55e", borderRadius: "14px", padding: "0.9rem", textAlign: "center", color: "#4ade80", fontWeight: 900, fontSize: "1.05rem", margin: "1rem 0" }}>
          🔴 الحصة جارية الآن — الانضمام متاح لجميع الطلاب!
        </div>
      )}

      {nextSession.passcode && (
        <div style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.15)", padding: "0.6rem 1.2rem", borderRadius: "14px", fontSize: "0.92rem", marginBottom: "1.2rem", display: "inline-block", color: "#e2e8f0" }}>
          🔑 رمز الدخول (Passcode): <code style={{ color: "#fde047", fontWeight: 900, fontSize: "1.05rem", padding: "0.1rem 0.4rem", background: "rgba(253,224,71,0.15)", borderRadius: "6px" }}>{nextSession.passcode}</code>
        </div>
      )}

      {/* Button: Active when Live, Disabled when Upcoming */}
      {isLive ? (
        <a
          href={nextSession.url}
          target="_blank"
          rel="noreferrer"
          onClick={() => handleLogActivity("live_session", nextSession.title, nextSession.id, { platform: nextSession.platform })}
          className="button button-primary glow-button"
          style={{
            width: "100%",
            justifyContent: "center",
            padding: "0.95rem",
            fontSize: "1.05rem",
            fontWeight: 800,
            background: "linear-gradient(135deg, #10b981, #059669)",
            borderRadius: "16px",
            boxShadow: "0 0 25px rgba(16, 185, 129, 0.4)",
          }}
        >
          🚀 الدخول إلى الحصة المباشرة الآن
        </a>
      ) : (
        <button
          type="button"
          disabled
          style={{
            width: "100%",
            justifyContent: "center",
            padding: "0.95rem",
            fontSize: "0.95rem",
            fontWeight: 800,
            background: "rgba(100, 116, 139, 0.25)",
            color: "#94a3b8",
            border: "1.5px dashed rgba(255, 255, 255, 0.2)",
            borderRadius: "16px",
            cursor: "not-allowed",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem"
          }}
        >
          🔒 زر الانضمام غير متاح الآن — يتاح الدخول عند موعد الحصة ⏰
        </button>
      )}
    </div>
  );
}

// ─── Main Student Dashboard Component ───────────────────────────────────────
export default function StudentDashboard() {
  const { userProfile } = useAuth();
  const subInfo = getSubscriptionInfo(userProfile);
  const isSubscriberActive = hasActiveSubscription(userProfile);

  const [now, setNow] = useState(new Date());
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");
  const [activeMainTab, setActiveMainTab] = useState(urlTab || "home");

  // Sync state if URL search param changes (e.g. from header brand click or icon clicks)
  useEffect(() => {
    if (urlTab && ["home", "live", "library", "quizzes", "notifications", "support", "profile"].includes(urlTab)) {
      setActiveMainTab(urlTab);
    } else if (!urlTab) {
      setActiveMainTab("home");
    }
  }, [urlTab]);

  const handleSelectTab = (tabId) => {
    setActiveMainTab(tabId);
    setSearchParams({ tab: tabId }, { replace: true });
    if (tabId === "notifications") {
      localStorage.setItem("math_app_last_seen_notif", Date.now().toString());
    }
    if (tabId === "support") {
      localStorage.setItem("math_app_student_last_seen_replies", Date.now().toString());
    }
  };

  const [liveSessions, setLiveSessions] = useState([]);
  const [libraryItems, setLibraryItems] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [aiRooms, setAiRooms] = useState([]);
  const [activeAIRoomModal, setActiveAIRoomModal] = useState(null);

  // Timer ticker to evaluate session states every 3 seconds
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 3000);
    return () => clearInterval(timer);
  }, []);

  // Active Embedded Viewer item state
  const [activeViewerItem, setActiveViewerItem] = useState(null);
  const [libraryTab, setLibraryTab] = useState("all");

  // Active Quiz Runner state
  const [activeQuizToRun, setActiveQuizToRun] = useState(null);
  const [activeExternalQuiz, setActiveExternalQuiz] = useState(null);
  const [markingComplete, setMarkingComplete] = useState(false);

  const studentGrade = userProfile?.grade;
  const studentGroup = userProfile?.group;
  const studentUid = userProfile?.uid;

  // Filter out any session that has ended
  const activeLiveSessions = useMemo(() => {
    return liveSessions.filter((s) => !getLiveSessionTiming(s, now).isEnded);
  }, [liveSessions, now]);

  // Listen to Live Sessions in real time
  useEffect(() => {
    if (!isSubscriberActive) return;
    const q = query(collection(db, "live_sessions"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const allSessions = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        const relevant = allSessions.filter((s) => {
          const matchGrade = s.grade === "جميع الصفوف الدراسية" || s.grade === studentGrade;
          const matchGroup = s.group === "جميع المجموعات" || s.group === studentGroup;
          return matchGrade && matchGroup;
        });
        setLiveSessions(relevant);
      },
      (err) => console.error("Error loading student live sessions:", err)
    );
    return () => unsubscribe();
  }, [isSubscriberActive, studentGrade, studentGroup]);

  // Listen to Library Items in real time
  useEffect(() => {
    if (!isSubscriberActive) return;
    const q = query(collection(db, "library_items"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const allItems = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        const relevant = allItems.filter((item) => {
          const matchGrade = item.grade === "جميع الصفوف الدراسية" || item.grade === studentGrade;
          const matchGroup = item.group === "جميع المجموعات" || item.group === studentGroup;
          return matchGrade && matchGroup;
        });
        setLibraryItems(relevant);
      },
      (err) => console.error("Error loading student library items:", err)
    );
    return () => unsubscribe();
  }, [isSubscriberActive, studentGrade, studentGroup]);

  // Listen to Active Quizzes in real time
  useEffect(() => {
    if (!isSubscriberActive) return;
    const q = query(collection(db, "quizzes"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const allQuizzes = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        const activeRelevant = allQuizzes.filter((qz) => {
          if (!qz.isActive) return false;
          const matchGrade = qz.grade === "جميع الصفوف الدراسية" || qz.grade === studentGrade;
          const matchGroup = qz.group === "جميع المجموعات" || qz.group === studentGroup;
          return matchGrade && matchGroup;
        });
        setQuizzes(activeRelevant);
      },
      (err) => console.error("Error loading quizzes:", err)
    );
    return () => unsubscribe();
  }, [isSubscriberActive, studentGrade, studentGroup]);

  // Listen to My Quiz Submissions in real time
  useEffect(() => {
    if (!isSubscriberActive || !studentUid) return;
    const q = query(collection(db, "quiz_submissions"), orderBy("submittedAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((sub) => sub.studentUid === studentUid);
        setMySubmissions(list);
      },
      (err) => console.error("Error loading quiz submissions:", err)
    );
    return () => unsubscribe();
  }, [isSubscriberActive, studentUid]);

  // Listen to AI Assistant Rooms in real time
  useEffect(() => {
    const q = query(collection(db, "ai_rooms"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((r) => r.isActive !== false && (r.targetGrade === "all" || !r.targetGrade || r.targetGrade === studentGrade));
        setAiRooms(list);
      },
      (err) => console.error("Error loading AI rooms:", err)
    );
    return () => unsubscribe();
  }, [studentGrade]);

  // Activity logger
  const handleLogActivity = async (type, itemTitle, itemId, extra = {}) => {
    if (!studentUid) return;
    try {
      await addDoc(collection(db, "student_activities"), {
        studentUid,
        studentName: userProfile?.fullName || "طالب",
        studentEmail: userProfile?.email || "",
        type,
        itemTitle: itemTitle || "",
        itemId: itemId || "",
        createdAt: serverTimestamp(),
        ...extra,
      });
    } catch (err) {
      console.error("Error logging activity:", err);
    }
  };

  // Mark External Quiz Form Completed
  const handleMarkExternalComplete = async () => {
    if (!activeExternalQuiz) return;
    setMarkingComplete(true);
    try {
      await addDoc(collection(db, "quiz_submissions"), {
        quizId: activeExternalQuiz.id,
        quizTitle: activeExternalQuiz.title,
        studentUid: userProfile?.uid || "student",
        studentName: userProfile?.fullName || "طالب",
        studentEmail: userProfile?.email || "",
        studentGrade: userProfile?.grade || "",
        score: 10,
        totalPoints: 10,
        percentage: 100,
        isPassed: true,
        isExternal: true,
        submittedAt: serverTimestamp(),
      });
      alert("تم تسجيل تسليم الفوورم بنجاح! 🎉");
      setActiveExternalQuiz(null);
    } catch (err) {
      console.error("Error saving external quiz submission:", err);
      alert("حدث خطأ أثناء حفظ النتيجة");
    } finally {
      setMarkingComplete(false);
    }
  };

  // Categorized library items
  const videosList = useMemo(() => libraryItems.filter((i) => i.type === "video"), [libraryItems]);
  const pdfsList = useMemo(() => libraryItems.filter((i) => i.type === "pdf"), [libraryItems]);
  const infographicsList = useMemo(() => libraryItems.filter((i) => i.type === "infographic"), [libraryItems]);

  const filteredLibraryItems = useMemo(() => {
    if (libraryTab === "all") return libraryItems;
    return libraryItems.filter((i) => i.type === libraryTab);
  }, [libraryItems, libraryTab]);

  return (
    <div className="dashboard-modern fade-in" style={{ paddingBottom: "3rem" }}>
      {/* Top Welcome Header */}
      <div className="dashboard-banner glass" style={{ background: "linear-gradient(135deg, rgba(30,27,75,0.9), rgba(15,23,42,0.95))", border: "1.5px solid rgba(139,92,246,0.3)" }}>
        <div className="dashboard-banner-content">
          <img src="/logo-circle.png" alt="logo" className="dashboard-avatar" style={{ border: "2px solid #a855f7" }} />
          <div>
            <h1 className="font-heading dashboard-welcome" style={{ color: "#ffffff", fontWeight: 900 }}>
              مرحباً، <span style={{ background: "linear-gradient(90deg, #c084fc, #38bdf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 900 }}>{userProfile?.fullName || "طالب العزيز"}</span> 🎓
            </h1>
            <p className="dashboard-role" style={{ color: "#cbd5e1", fontWeight: 700, fontSize: "0.95rem" }}>
              الصف: <span style={{ color: "#38bdf8" }}>{userProfile?.grade || "غير محدد"}</span> | المجموعة: <span style={{ color: "#4ade80" }}>{userProfile?.group || "عامة"}</span> | منصة الدكتور فى الرياضيات
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          {/* AI Assistant Rooms interactive buttons */}
          {aiRooms.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => setActiveAIRoomModal(room)}
              className="student-ai-room-badge-btn"
              title={room.description || room.title}
            >
              <span className="ai-room-pulse-glow" />
              <span style={{ fontSize: "1.15rem", lineHeight: 1 }}>{room.icon || "🤖"}</span>
              <span className="ai-room-btn-title">{room.title}</span>
              <span className="ai-room-sparkle-pill">{room.badgeText || "AI ⚡"}</span>
            </button>
          ))}

          <span className={`subscription-badge ${subInfo.badgeClass}`} style={{ fontSize: "0.95rem", padding: "0.55rem 1.2rem", fontWeight: 800 }}>
            {subInfo.label}
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="student-tab-display-area">
        {/* 1️⃣ TAB 1: HOME (الرئيسية) */}
          {activeMainTab === "home" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {/* Countdown Card for Next Upcoming Session */}
              <NextSessionCountdownCard sessions={activeLiveSessions} handleLogActivity={handleLogActivity} now={now} />

              {/* Overview Stats Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                <div className="glass" style={{ padding: "1.3rem", borderRadius: "20px", border: "1.5px solid rgba(56,189,248,0.35)", background: "rgba(15,23,42,0.7)" }}>
                  <div style={{ fontSize: "2rem" }}>📡</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#38bdf8", marginTop: "0.3rem" }}>{activeLiveSessions.length}</div>
                  <div style={{ fontSize: "0.88rem", color: "#e2e8f0", fontWeight: 700 }}>حصص مباشرة مجدولة</div>
                </div>

                <div className="glass" style={{ padding: "1.3rem", borderRadius: "20px", border: "1.5px solid rgba(52,211,153,0.35)", background: "rgba(15,23,42,0.7)" }}>
                  <div style={{ fontSize: "2rem" }}>📚</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#4ade80", marginTop: "0.3rem" }}>{libraryItems.length}</div>
                  <div style={{ fontSize: "0.88rem", color: "#e2e8f0", fontWeight: 700 }}>مواد مضافة للمكتبة</div>
                </div>

                <div className="glass" style={{ padding: "1.3rem", borderRadius: "20px", border: "1.5px solid rgba(192,132,252,0.35)", background: "rgba(15,23,42,0.7)" }}>
                  <div style={{ fontSize: "2rem" }}>📝</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#c084fc", marginTop: "0.3rem" }}>{quizzes.length}</div>
                  <div style={{ fontSize: "0.88rem", color: "#e2e8f0", fontWeight: 700 }}>اختبارات تفاعلية متاحة</div>
                </div>

                <div className="glass" style={{ padding: "1.3rem", borderRadius: "20px", border: "1.5px solid rgba(251,191,36,0.35)", background: "rgba(15,23,42,0.7)" }}>
                  <div style={{ fontSize: "2rem" }}>⭐</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#fde047", marginTop: "0.3rem" }}>{mySubmissions.length}</div>
                  <div style={{ fontSize: "0.88rem", color: "#e2e8f0", fontWeight: 700 }}>اختبارات تم تسليمها</div>
                </div>
              </div>
            </div>
          )}

          {/* 2️⃣ TAB 2: LIVE SESSIONS (الحصص المباشرة) */}
          {activeMainTab === "live" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              <div className="glass" style={{ padding: "1.4rem 1.8rem", borderRadius: "22px", background: "rgba(15,23,42,0.8)", border: "1.5px solid rgba(56,189,248,0.35)" }}>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 900, margin: 0, color: "#ffffff" }}>
                  📡 جدول الحصص الأسبوعية المباشرة والافتراضية ({activeLiveSessions.length})
                </h2>
                <p style={{ fontSize: "0.9rem", color: "#cbd5e1", margin: "0.4rem 0 0 0", fontWeight: 600 }}>
                  جدول الحصص المخصصة لـ: <span style={{ color: "#38bdf8", fontWeight: 800 }}>{studentGrade || "جميع الصفوف"}</span> — <span style={{ color: "#4ade80", fontWeight: 800 }}>{studentGroup || "جميع المجموعات"}</span>
                </p>
              </div>

              {activeLiveSessions.length === 0 ? (
                <div className="glass" style={{ textAlign: "center", padding: "3.5rem 1rem", borderRadius: "22px", background: "rgba(15,23,42,0.6)" }}>
                  <span style={{ fontSize: "3.2rem" }}>📡</span>
                  <p style={{ color: "#cbd5e1", margin: "0.6rem 0 0 0", fontWeight: 700, fontSize: "1rem" }}>لا توجد حصص مباشرة مجدولة حالياً.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.25rem" }}>
                  {activeLiveSessions.map((sess) => {
                    const plat = PLATFORMS_MAP[sess.platform] || PLATFORMS_MAP.custom;
                    const timing = getLiveSessionTiming(sess, now);
                    const duration = Number(sess.durationMinutes) || 90;

                    return (
                      <div
                        key={sess.id}
                        style={{
                          background: timing.isLive
                            ? "linear-gradient(135deg, rgba(6, 78, 59, 0.75), rgba(15, 23, 42, 0.9))"
                            : "linear-gradient(135deg, rgba(30, 27, 75, 0.75), rgba(15, 23, 42, 0.9))",
                          border: timing.isLive ? "2px solid #10b981" : "1.5px solid rgba(56, 189, 248, 0.35)",
                          borderRadius: "22px",
                          padding: "1.4rem",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          gap: "1rem",
                          boxShadow: timing.isLive ? "0 10px 25px rgba(16, 185, 129, 0.3)" : "0 10px 25px rgba(0,0,0,0.3)",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.4rem" }}>
                            <span style={{ background: "rgba(14, 165, 233, 0.25)", color: "#38bdf8", fontWeight: 800, fontSize: "0.85rem", padding: "0.3rem 0.8rem", borderRadius: "20px", border: "1px solid #38bdf8" }}>
                              {plat.icon} {plat.name}
                            </span>
                            {timing.isLive ? (
                              <span style={{ background: "rgba(34, 197, 94, 0.25)", color: "#4ade80", fontWeight: 800, fontSize: "0.82rem", padding: "0.3rem 0.8rem", borderRadius: "20px", border: "1px solid #4ade80" }}>
                                🔴 مباشر (جارية الآن)
                              </span>
                            ) : (
                              <span style={{ background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24", fontWeight: 800, fontSize: "0.82rem", padding: "0.3rem 0.8rem", borderRadius: "20px", border: "1px solid #f59e0b" }}>
                                ⏳ تبدأ بعد: {timing.remainingText}
                              </span>
                            )}
                          </div>

                          <h3 style={{ fontSize: "1.25rem", fontWeight: 900, color: "#ffffff", margin: "0 0 0.6rem 0" }}>
                            {sess.title}
                          </h3>

                          {sess.scheduledAt && (
                            <p style={{ margin: "0 0 0.6rem 0", fontSize: "0.92rem", color: "#4ade80", fontWeight: 700 }}>
                              ⏰ <strong>الموعد:</strong> <span style={{ color: "#fef08a" }}>{new Date(sess.scheduledAt).toLocaleString("ar-EG", { weekday: "long", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                              <span style={{ color: "#94a3b8", fontSize: "0.85rem", marginRight: "0.4rem" }}>({duration} دقيقة)</span>
                            </p>
                          )}

                          {sess.passcode && (
                            <div style={{ background: "rgba(0, 0, 0, 0.4)", padding: "0.5rem 0.85rem", borderRadius: "12px", fontSize: "0.88rem", border: "1px solid rgba(255,255,255,0.12)", color: "#e2e8f0" }}>
                              🔑 <strong>رمز الدخول:</strong> <code style={{ color: "#fde047", fontWeight: 900, fontSize: "1rem" }}>{sess.passcode}</code>
                            </div>
                          )}
                        </div>

                        {timing.isLive ? (
                          <a
                            href={sess.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => handleLogActivity("live_session", sess.title, sess.id, { platform: sess.platform })}
                            className="button button-primary glow-button"
                            style={{
                              width: "100%",
                              justifyContent: "center",
                              padding: "0.85rem",
                              fontWeight: 800,
                              fontSize: "0.95rem",
                              background: "linear-gradient(135deg, #10b981, #059669)",
                              borderRadius: "14px",
                              boxShadow: "0 0 20px rgba(16, 185, 129, 0.35)",
                            }}
                          >
                            🚀 الانضمام للحصة المباشرة الآن
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled
                            style={{
                              width: "100%",
                              justifyContent: "center",
                              padding: "0.85rem",
                              fontWeight: 800,
                              fontSize: "0.88rem",
                              cursor: "not-allowed",
                              background: "rgba(100, 116, 139, 0.25)",
                              color: "#94a3b8",
                              border: "1.5px dashed rgba(255, 255, 255, 0.2)",
                              borderRadius: "14px",
                            }}
                          >
                            🔒 غير متاح الآن — يبدأ في موعد الحصة ⏰
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3️⃣ TAB 3: LIBRARY (المكتبة والشروحات) */}
          {activeMainTab === "library" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              <div className="glass" style={{ padding: "1.4rem 1.8rem", borderRadius: "22px", background: "rgba(15,23,42,0.8)", border: "1.5px solid rgba(168,85,247,0.35)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: 900, margin: 0, color: "#ffffff" }}>
                    📚 المكتبة الشاملة المرفقة ({libraryItems.length})
                  </h2>
                  <p style={{ fontSize: "0.9rem", color: "#cbd5e1", margin: "0.3rem 0 0 0", fontWeight: 600 }}>
                    شروحات فيديو، ملخصات PDF، وإنفوجرافيك للمنهج
                  </p>
                </div>

                {/* Sub-filters */}
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button onClick={() => setLibraryTab("all")} className={`button button-sm ${libraryTab === "all" ? "button-primary" : "button-muted"}`} style={{ fontSize: "0.85rem", fontWeight: 800 }}>
                    الكل ({libraryItems.length})
                  </button>
                  <button onClick={() => setLibraryTab("video")} className={`button button-sm ${libraryTab === "video" ? "button-primary" : "button-muted"}`} style={{ fontSize: "0.85rem", fontWeight: 800 }}>
                    🎬 فيديوهات ({videosList.length})
                  </button>
                  <button onClick={() => setLibraryTab("pdf")} className={`button button-sm ${libraryTab === "pdf" ? "button-primary" : "button-muted"}`} style={{ fontSize: "0.85rem", fontWeight: 800 }}>
                    📄 ملفات PDF ({pdfsList.length})
                  </button>
                  <button onClick={() => setLibraryTab("infographic")} className={`button button-sm ${libraryTab === "infographic" ? "button-primary" : "button-muted"}`} style={{ fontSize: "0.85rem", fontWeight: 800 }}>
                    🖼️ إنفوجرافيك ({infographicsList.length})
                  </button>
                </div>
              </div>

              {filteredLibraryItems.length === 0 ? (
                <div className="glass" style={{ textAlign: "center", padding: "3.5rem 1rem", borderRadius: "22px", background: "rgba(15,23,42,0.6)" }}>
                  <span style={{ fontSize: "3.2rem" }}>📚</span>
                  <p style={{ color: "#cbd5e1", margin: "0.6rem 0 0 0", fontWeight: 700, fontSize: "1rem" }}>لا توجد ملفات أو شروحات مضافة في هذا الفرز حالياً.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(285px, 1fr))", gap: "1.25rem" }}>
                  {filteredLibraryItems.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        background: "rgba(30, 41, 59, 0.85)",
                        border: "1.5px solid rgba(255, 255, 255, 0.12)",
                        borderRadius: "20px",
                        padding: "1.3rem",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: "0.9rem",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.7rem" }}>
                          <span
                            style={{
                              background: item.type === "video" ? "rgba(239,68,68,0.25)" : item.type === "pdf" ? "rgba(56,189,248,0.25)" : "rgba(168,85,247,0.25)",
                              color: item.type === "video" ? "#fca5a5" : item.type === "pdf" ? "#7dd3fc" : "#e9d5ff",
                              border: `1px solid ${item.type === "video" ? "#f87171" : item.type === "pdf" ? "#38bdf8" : "#c084fc"}`,
                              fontSize: "0.78rem",
                              fontWeight: 800,
                              padding: "0.25rem 0.7rem",
                              borderRadius: "14px",
                            }}
                          >
                            {item.type === "video" ? "🎬 فيديو شرح" : item.type === "pdf" ? "📄 تلخيص PDF" : "🖼️ إنفوجرافيك"}
                          </span>
                          {item.chapter && <span style={{ fontSize: "0.78rem", color: "#cbd5e1", fontWeight: 700 }}>📖 {item.chapter}</span>}
                        </div>

                        <h3 style={{ fontSize: "1.15rem", fontWeight: 900, color: "#ffffff", margin: "0 0 0.5rem 0" }}>{item.title}</h3>
                        {item.description && <p style={{ fontSize: "0.85rem", color: "#cbd5e1", margin: "0 0 0.6rem 0", lineHeight: 1.5, fontWeight: 600 }}>{item.description}</p>}
                      </div>

                      <button
                        onClick={() => {
                          handleLogActivity(item.type || "library_view", item.title, item.id);
                          setActiveViewerItem(item);
                        }}
                        className="button button-secondary"
                        style={{ width: "100%", justifyContent: "center", fontSize: "0.9rem", fontWeight: 800 }}
                      >
                        {item.type === "video" ? "▶️ تشغيل الفيديو داخل المنصة" : item.type === "pdf" ? "👁️ عرض وقراءة ملف PDF" : "🖼️ فتح الإنفوجرافيك"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4️⃣ TAB 4: QUIZZES (الاختبارات والتطبيقات الذكية) */}
          {activeMainTab === "quizzes" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              <div className="glass" style={{ padding: "1.4rem 1.8rem", borderRadius: "22px", background: "rgba(15,23,42,0.8)", border: "1.5px solid rgba(192,132,252,0.35)" }}>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 900, margin: 0, color: "#ffffff" }}>
                  📝 الاختبارات والتطبيقات الذكية المتاحة ({quizzes.length})
                </h2>
                <p style={{ fontSize: "0.9rem", color: "#cbd5e1", margin: "0.3rem 0 0 0", fontWeight: 600 }}>
                  اختبارات تفاعلية مصممة من المعلم ونماذج إلكترونية
                </p>
              </div>

              {quizzes.length === 0 ? (
                <div className="glass" style={{ textAlign: "center", padding: "3.5rem 1rem", borderRadius: "22px", background: "rgba(15,23,42,0.6)" }}>
                  <span style={{ fontSize: "3.2rem" }}>📝</span>
                  <p style={{ color: "#cbd5e1", margin: "0.6rem 0 0 0", fontWeight: 700, fontSize: "1rem" }}>لا توجد اختبارات مضافة لمجموعتك حالياً.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: "1.25rem" }}>
                  {quizzes.map((quiz) => {
                    const sub = mySubmissions.find((s) => s.quizId === quiz.id);
                    const isCompleted = Boolean(sub);
                    const isExternal = quiz.quizType === "external" || Boolean(quiz.externalUrl);

                    return (
                      <div
                        key={quiz.id}
                        style={{
                          background: "rgba(30, 41, 59, 0.85)",
                          border: "1.5px solid rgba(255, 255, 255, 0.12)",
                          borderRadius: "20px",
                          padding: "1.3rem",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          gap: "0.9rem",
                          boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                            <span
                              style={{
                                background: isCompleted ? "rgba(34,197,94,0.25)" : isExternal ? "rgba(14,165,233,0.25)" : "rgba(168,85,247,0.25)",
                                color: isCompleted ? "#4ade80" : isExternal ? "#7dd3fc" : "#e9d5ff",
                                border: `1px solid ${isCompleted ? "#22c55e" : isExternal ? "#38bdf8" : "#c084fc"}`,
                                fontWeight: "800",
                                fontSize: "0.82rem",
                                padding: "0.25rem 0.7rem",
                                borderRadius: "20px",
                              }}
                            >
                              {isCompleted ? "✅ مكتمل التسليم" : isExternal ? "🔗 فورم تفاعلي" : "🆕 اختبار تفاعلي"}
                            </span>
                          </div>

                          <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.2rem", color: "#ffffff", fontWeight: 900 }}>
                            {quiz.title}
                          </h3>

                          {quiz.description && <p style={{ fontSize: "0.88rem", color: "#cbd5e1", margin: "0 0 0.8rem 0", fontWeight: 600, lineHeight: 1.4 }}>{quiz.description}</p>}

                          {/* Submission score badge */}
                          {isCompleted && (
                            <div style={{ marginTop: "0.6rem", padding: "0.6rem 0.8rem", borderRadius: "12px", background: sub.isPassed ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)", border: `1.5px solid ${sub.isPassed ? "#22c55e" : "#ef4444"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: "0.88rem", color: sub.isPassed ? "#4ade80" : "#fca5a5", fontWeight: 800 }}>
                                {sub.isExternal ? "🟢 تم التسليم" : sub.isPassed ? "🎉 ناجح" : "🔴 يحتاج مراجعة"}
                              </span>
                              {!sub.isExternal && <span style={{ fontSize: "1rem", fontWeight: 900, color: "#ffffff" }}>{sub.score} / {sub.totalPoints} ({sub.percentage}%)</span>}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            if (isExternal) setActiveExternalQuiz(quiz);
                            else setActiveQuizToRun(quiz);
                          }}
                          className={`button ${isCompleted ? "button-secondary" : "button-primary glow-button"}`}
                          style={{ width: "100%", justifyContent: "center", fontWeight: 800, fontSize: "0.9rem" }}
                        >
                          {isCompleted ? (isExternal ? "👁️ فتح الفوورم" : "🔄 مراجعة الإجابات والشرح") : isExternal ? "📝 فتح وإجابة الفوورم" : "🚀 بدء الاختبار الآن"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 5️⃣ TAB 5: PROFILE (الملف الشخصي — بدون الرقم السري) */}
          {activeMainTab === "profile" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              <div className="glass" style={{ padding: "1.6rem 2rem", borderRadius: "24px", background: "linear-gradient(135deg, rgba(30,27,75,0.9), rgba(15,23,42,0.95))", border: "1.5px solid rgba(168,85,247,0.35)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1.2rem" }}>
                  <img src="/logo-circle.png" alt="Avatar" style={{ width: "68px", height: "68px", borderRadius: "50%", border: "2px solid #38bdf8" }} />
                  <div>
                    <h2 style={{ fontSize: "1.55rem", fontWeight: 900, color: "#ffffff", margin: 0 }}>
                      👤 الملف الشخصي للطالب: <span style={{ background: "linear-gradient(90deg, #c084fc, #38bdf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{userProfile?.fullName}</span>
                    </h2>
                    <p style={{ margin: "0.3rem 0 0 0", color: "#cbd5e1", fontSize: "0.92rem", fontWeight: 600 }}>
                      بيانات الحساب الأكاديمي والاشتراك المنظم في المنصة
                    </p>
                  </div>
                </div>
              </div>

              <div className="glass" style={{ padding: "1.8rem", borderRadius: "24px", background: "rgba(15,23,42,0.85)", border: "1.5px solid rgba(255,255,255,0.1)" }}>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 900, color: "#c4b5fd", marginBottom: "1.2rem" }}>
                  📋 البيانات الشخصية والدراسية
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
                  {[
                    { label: "👤 اسم الطالب الكامل", val: userProfile?.fullName || "—", color: "#ffffff" },
                    { label: "✉️ البريد الإلكتروني", val: userProfile?.email || "—", color: "#38bdf8" },
                    { label: "📱 رقم الهاتف / الواتساب", val: userProfile?.phone || "—", color: "#4ade80" },
                    { label: "🎓 الصف الدراسي", val: userProfile?.grade || "غير محدد", color: "#c084fc" },
                    { label: "👥 المجموعة الدراسية", val: userProfile?.group || "بدون مجموعة", color: "#fde047" },
                    { label: "📅 العام الدراسي", val: userProfile?.academicYear || "غير محدد", color: "#38bdf8" },
                    { label: "⭐ حالة الاشتراك بالمنصة", val: subInfo.label, color: "#4ade80" },
                    { label: "🗓️ تاريخ انتهاء الاشتراك", val: formatDateAr(userProfile?.subscribedUntil), color: "#fca5a5" },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ background: "rgba(30,41,59,0.7)", border: "1px solid rgba(255,255,255,0.1)", padding: "1.1rem", borderRadius: "18px" }}>
                      <div style={{ fontSize: "0.82rem", color: "#cbd5e1", marginBottom: "0.4rem", fontWeight: 700 }}>{label}</div>
                      <div style={{ fontSize: "1.05rem", fontWeight: 900, color }}>{val}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: "1.6rem", padding: "1.1rem", background: "rgba(99,102,241,0.12)", border: "1.5px solid rgba(99,102,241,0.3)", borderRadius: "16px", fontSize: "0.88rem", color: "#e2e8f0", fontWeight: 700, lineHeight: 1.6 }}>
                  💡 <strong>تنويه أمان للحساب:</strong> البيانات المعروضة أعلاه خاصة بحساب الطالب المنظم. لتحديث كلمة المرور، يرجى التواصل مباشرة مع المعلم/المدير عبر الواتساب.
                </div>
              </div>
            </div>
          )}

          {/* 6️⃣ TAB 6: NOTIFICATIONS (الإشعارات) */}
          {activeMainTab === "notifications" && (
            <StudentNotifications />
          )}

          {/* 7️⃣ TAB 7: SUPPORT (الدعم والرسائل) */}
          {activeMainTab === "support" && (
            <SupportTickets defaultTab="support" />
          )}

      </div>

      {/* EMBEDDED LIBRARY ITEM VIEWER MODAL */}
      {activeViewerItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.88)",
            backdropFilter: "blur(12px)",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            className="glass fade-in"
            style={{
              maxWidth: "900px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "1.5rem",
              borderRadius: "24px",
              border: "1.5px solid rgba(56, 189, 248, 0.4)",
              background: "#0f172a",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 900, color: "#fff", margin: 0 }}>
                  {activeViewerItem.title}
                </h3>
                <p style={{ margin: "0.2rem 0 0 0", color: "#38bdf8", fontSize: "0.88rem", fontWeight: 700 }}>
                  {activeViewerItem.type === "video" ? "🎬 مشغّل الشرح الفيديوي" : activeViewerItem.type === "pdf" ? "📄 عارض ملخص PDF" : "🖼️ عارض الإنفوجرافيك"}
                </p>
              </div>

              <button
                onClick={() => setActiveViewerItem(null)}
                className="button button-sm button-muted"
                style={{ borderRadius: "50%", width: "36px", height: "36px", padding: 0 }}
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, minHeight: "420px", display: "flex", flexDirection: "column" }}>
              {activeViewerItem.type === "video" && (
                <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: "16px", background: "#000" }}>
                  <iframe
                    src={getEmbedUrl(activeViewerItem.url, "video")}
                    title={activeViewerItem.title}
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              )}

              {activeViewerItem.type === "pdf" && (
                <iframe
                  src={getEmbedUrl(activeViewerItem.url, "pdf")}
                  title={activeViewerItem.title}
                  style={{ width: "100%", height: "550px", border: 0, borderRadius: "16px", background: "#fff" }}
                />
              )}

              {activeViewerItem.type === "infographic" && (
                <div style={{ textAlign: "center", padding: "1rem", overflow: "auto" }}>
                  <img
                    src={activeViewerItem.url}
                    alt={activeViewerItem.title}
                    style={{ maxWidth: "100%", maxHeight: "65vh", borderRadius: "16px", objectFit: "contain" }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EMBEDDED EXTERNAL QUIZ FORM VIEWER MODAL */}
      {activeExternalQuiz && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.9)",
            backdropFilter: "blur(12px)",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            className="glass fade-in"
            style={{
              maxWidth: "950px",
              width: "100%",
              height: "90vh",
              padding: "1.5rem",
              borderRadius: "24px",
              border: "1.5px solid rgba(56, 189, 248, 0.4)",
              background: "#0f172a",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <h3 style={{ fontSize: "1.35rem", fontWeight: 900, color: "#fff", margin: 0 }}>
                  📝 {activeExternalQuiz.title}
                </h3>
                <p style={{ margin: "0.2rem 0 0 0", color: "#38bdf8", fontSize: "0.88rem", fontWeight: 700 }}>
                  نموذج إلكتروني (Form) تفاعلي للطالب
                </p>
              </div>

              <div style={{ display: "flex", gap: "0.8rem", alignItems: "center" }}>
                <button
                  onClick={handleMarkExternalComplete}
                  disabled={markingComplete}
                  className="button button-sm button-primary glow-button"
                  style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", fontWeight: 800 }}
                >
                  {markingComplete ? "⏳ جاري التوثيق..." : "✅ تم الإجابة وتسليم الفوورم"}
                </button>

                <button
                  onClick={() => setActiveExternalQuiz(null)}
                  className="button button-sm button-muted"
                  style={{ borderRadius: "50%", width: "36px", height: "36px", padding: 0 }}
                >
                  ✕
                </button>
              </div>
            </div>

            <div style={{ flex: 1, height: "100%", borderRadius: "16px", overflow: "hidden", background: "#fff" }}>
              <iframe
                src={getQuizEmbedUrl(activeExternalQuiz.externalUrl)}
                title={activeExternalQuiz.title}
                style={{ width: "100%", height: "100%", border: 0 }}
              />
            </div>
          </div>
        </div>
      )}

      {/* NATIVE INTERACTIVE QUIZ RUNNER MODAL */}
      {activeQuizToRun && (
        <StudentQuizRunner
          quiz={activeQuizToRun}
          studentProfile={userProfile}
          onClose={() => setActiveQuizToRun(null)}
          onComplete={() => {}}
        />
      )}

      {/* INTERACTIVE AI ASSISTANT ROOM VIEWER MODAL */}
      {activeAIRoomModal && (
        <StudentAIRoomModal
          room={activeAIRoomModal}
          onClose={() => setActiveAIRoomModal(null)}
        />
      )}
    </div>
  );
}
