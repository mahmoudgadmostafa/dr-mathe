// src/pages/TeacherQuizzes.jsx
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  onSnapshot,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

const STAGES_GRADES = [
  {
    stage: "المرحلة الابتدائية",
    grades: [
      "الصف الأول الابتدائي", "الصف الثاني الابتدائي", "الصف الثالث الابتدائي",
      "الصف الرابع الابتدائي", "الصف الخامس الابتدائي", "الصف السادس الابتدائي",
    ],
  },
  {
    stage: "المرحلة الإعدادية",
    grades: [
      "الصف الأول الإعدادي", "الصف الثاني الإعدادي", "الصف الثالث الإعدادي",
    ],
  },
  {
    stage: "المرحلة الثانوية",
    grades: [
      "الصف الأول الثانوي", "الصف الثاني الثانوي", "الصف الثالث الثانوي",
    ],
  },
];

const ALL_GRADES = [
  "جميع الصفوف الدراسية",
  ...STAGES_GRADES.flatMap((s) => s.grades),
];

const GROUPS = [
  "جميع المجموعات",
  "المجموعة A", "المجموعة B", "المجموعة C", "المجموعة D",
  "مجموعة الصباح", "مجموعة المساء",
];

const IMAGE_HEIGHT_PRESETS = [
  { label: "صغير (150px)", value: "150px" },
  { label: "متوسط (250px)", value: "250px" },
  { label: "كبير (350px)", value: "350px" },
  { label: "ضخم (500px)", value: "500px" },
  { label: "ملء العرض (100%)", value: "100%" },
];

export function getQuizEmbedUrl(url) {
  if (!url) return "";
  let cleanUrl = url.trim();
  if (cleanUrl.includes("docs.google.com/forms")) {
    if (!cleanUrl.includes("embedded=true")) {
      cleanUrl += cleanUrl.includes("?") ? "&embedded=true" : "?embedded=true";
    }
  }
  return cleanUrl;
}

export default function TeacherQuizzes() {
  const { currentUser, isTeacher } = useAuth();
  const navigate = useNavigate();

  const [quizzes, setQuizzes] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active view: 'list' | 'create' | 'edit'
  const [activeTab, setActiveTab] = useState("list");
  const [filterGrade, setFilterGrade] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  // Quiz Form state
  const [editingQuizId, setEditingQuizId] = useState(null);
  const [quizMode, setQuizMode] = useState("native"); // 'native' | 'external'
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [targetGrade, setTargetGrade] = useState("جميع الصفوف الدراسية");
  const [targetGroup, setTargetGroup] = useState("جميع المجموعات");
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [passingPercentage, setPassingPercentage] = useState(60);
  const [externalUrl, setExternalUrl] = useState("");
  const [questions, setQuestions] = useState([
    {
      id: "q_1",
      type: "mcq",
      questionText: "أوجد قيمة س إذا كانت: 2س + 4 = 10",
      questionImageUrl: "",
      questionImageHeight: "250px",
      options: ["س = 2", "س = 3", "س = 4", "س = 5"],
      optionImages: ["", "", "", ""],
      correctAnswer: 1,
      explanation: "2س = 10 - 4 = 6 ، إذن س = 6 ÷ 2 = 3",
      points: 2,
    },
  ]);
  const [saving, setSaving] = useState(false);

  // Submissions Modal State
  const [selectedQuizForSubmissions, setSelectedQuizForSubmissions] = useState(null);
  const [inspectSubmission, setInspectSubmission] = useState(null);

  // Redirect if not teacher
  useEffect(() => {
    if (!isTeacher) {
      navigate("/dashboard");
    }
  }, [isTeacher, navigate]);

  // Real-time listener for Quizzes
  useEffect(() => {
    const q = query(collection(db, "quizzes"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setQuizzes(list);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading quizzes:", err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Real-time listener for Submissions
  useEffect(() => {
    const q = query(collection(db, "quiz_submissions"), orderBy("submittedAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setSubmissions(list);
      },
      (err) => {
        console.error("Error loading submissions:", err);
      }
    );
    return () => unsubscribe();
  }, []);

  // Filtered quizzes
  const filteredQuizzes = useMemo(() => {
    return quizzes.filter((q) => {
      const matchGrade = filterGrade === "ALL" || q.grade === filterGrade;
      const matchSearch =
        !searchTerm ||
        q.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.description?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchGrade && matchSearch;
    });
  }, [quizzes, filterGrade, searchTerm]);

  // Open Create Form
  const handleOpenCreate = () => {
    setEditingQuizId(null);
    setQuizMode("native");
    setQuizTitle("");
    setQuizDescription("");
    setTargetGrade("جميع الصفوف الدراسية");
    setTargetGroup("جميع المجموعات");
    setDurationMinutes(20);
    setPassingPercentage(60);
    setExternalUrl("");
    setQuestions([
      {
        id: "q_" + Date.now() + "_1",
        type: "mcq",
        questionText: "",
        questionImageUrl: "",
        questionImageHeight: "250px",
        options: ["أ) ", "ب) ", "ج) ", "د) "],
        optionImages: ["", "", "", ""],
        correctAnswer: 0,
        explanation: "",
        points: 1,
      },
    ]);
    setActiveTab("create");
  };

  // Open Edit Form
  const handleOpenEdit = (quiz) => {
    setEditingQuizId(quiz.id);
    setQuizMode(quiz.quizMode || (quiz.externalUrl ? "external" : "native"));
    setQuizTitle(quiz.title || "");
    setQuizDescription(quiz.description || "");
    setTargetGrade(quiz.grade || "جميع الصفوف الدراسية");
    setTargetGroup(quiz.group || "جميع المجموعات");
    setDurationMinutes(quiz.durationMinutes || 20);
    setPassingPercentage(quiz.passingPercentage || 60);
    setExternalUrl(quiz.externalUrl || "");
    setQuestions(quiz.questions || []);
    setActiveTab("edit");
  };

  // Save Quiz (Create / Update)
  const handleSaveQuiz = async (e) => {
    e.preventDefault();
    if (!quizTitle.trim()) {
      alert("يرجى كتابة عنوان للاختبار");
      return;
    }

    if (quizMode === "external") {
      if (!externalUrl.trim()) {
        alert("يرجى إدخال رابط نموذج الفورم الخارجي (مثل Google Form أو Microsoft Form)");
        return;
      }
    } else {
      if (questions.length === 0) {
        alert("يرجى إضافة سؤال واحد على الأقل في الاختبار");
        return;
      }
      for (let i = 0; i < questions.length; i++) {
        if (!questions[i].questionText.trim() && !questions[i].questionImageUrl?.trim()) {
          alert(`السؤال رقم ${i + 1} بدون نص أو صورة! يرجى إدخال نص أو رابط صورة للسؤال.`);
          return;
        }
      }
    }

    setSaving(true);
    const totalPoints = quizMode === "external" ? 10 : questions.reduce((acc, q) => acc + (Number(q.points) || 1), 0);

    const quizData = {
      title: quizTitle.trim(),
      description: quizDescription.trim(),
      grade: targetGrade,
      group: targetGroup,
      durationMinutes: Number(durationMinutes) || 0,
      passingPercentage: Number(passingPercentage) || 60,
      totalPoints,
      quizMode,
      externalUrl: externalUrl.trim(),
      questions: quizMode === "external" ? [] : questions,
      questionsCount: quizMode === "external" ? 0 : questions.length,
      isActive: true,
      teacherId: currentUser?.uid || "admin",
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingQuizId) {
        await updateDoc(doc(db, "quizzes", editingQuizId), quizData);
        alert("تم تحديث الاختبار بنجاح! 📝");
      } else {
        await addDoc(collection(db, "quizzes"), {
          ...quizData,
          createdAt: serverTimestamp(),
        });
        alert("تم إضافة الاختبار بنجاح! 🎉");
      }
      setActiveTab("list");
    } catch (err) {
      console.error("Error saving quiz:", err);
      alert("حدث خطأ أثناء حفظ الاختبار");
    } finally {
      setSaving(false);
    }
  };

  // Toggle Quiz Active Status
  const handleToggleActive = async (quiz) => {
    try {
      await updateDoc(doc(db, "quizzes", quiz.id), {
        isActive: !quiz.isActive,
      });
    } catch (err) {
      console.error("Error toggling active state:", err);
    }
  };

  // Delete Quiz
  const handleDeleteQuiz = async (quizId, title) => {
    if (!window.confirm(`هل أنت تأكد من حذف الاختبار "${title}"؟`)) return;
    try {
      await deleteDoc(doc(db, "quizzes", quizId));
      alert("تم حذف الاختبار بنجاح");
    } catch (err) {
      console.error("Error deleting quiz:", err);
      alert("حدث خطأ أثناء حذف الاختبار");
    }
  };

  // Questions Handlers
  const handleAddQuestion = () => {
    const newQ = {
      id: "q_" + Date.now() + "_" + (questions.length + 1),
      type: "mcq",
      questionText: "",
      questionImageUrl: "",
      questionImageHeight: "250px",
      options: ["أ) ", "ب) ", "ج) ", "د) "],
      optionImages: ["", "", "", ""],
      correctAnswer: 0,
      explanation: "",
      points: 1,
    };
    setQuestions([...questions, newQ]);
  };

  const handleUpdateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;
    setQuestions(updated);
  };

  const handleUpdateOption = (qIndex, optIndex, value) => {
    const updated = [...questions];
    const newOpts = [...(updated[qIndex].options || [])];
    newOpts[optIndex] = value;
    updated[qIndex].options = newOpts;
    setQuestions(updated);
  };

  const handleUpdateOptionImage = (qIndex, optIndex, value) => {
    const updated = [...questions];
    const newOptImgs = [...(updated[qIndex].optionImages || ["", "", "", ""])];
    newOptImgs[optIndex] = value;
    updated[qIndex].optionImages = newOptImgs;
    setQuestions(updated);
  };

  const handleRemoveQuestion = (index) => {
    if (questions.length <= 1) {
      alert("يجب أن يحتوي الاختبار على سؤال واحد على الأقل");
      return;
    }
    const updated = questions.filter((_, i) => i !== index);
    setQuestions(updated);
  };

  return (
    <div className="dashboard-container fade-in" style={{ padding: "1.5rem 1rem", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Top Header Banner */}
      <div
        className="glass"
        style={{
          padding: "1.5rem 2rem",
          borderRadius: "20px",
          marginBottom: "2rem",
          background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.12))",
          border: "1px solid rgba(168,85,247,0.3)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", marginBottom: "0.4rem" }}>
            <span style={{ fontSize: "2.2rem" }}>📝</span>
            <h1 className="font-heading" style={{ fontSize: "1.8rem", margin: 0, color: "var(--text-main, #f8fafc)" }}>
              منشئ ومصمم <span className="text-gradient">الاختبارات الذكية والأسئلة المصورة</span>
            </h1>
          </div>
          <p style={{ margin: 0, color: "rgba(255,255,255,0.7)", fontSize: "0.95rem" }}>
            صمم اختبارات تفاعلية مع دعم صور الأسئلة والخيارات والتحكم بالحجم، أو إدراج روابط Google/Microsoft Forms.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap" }}>
          {activeTab !== "list" && (
            <button
              onClick={() => setActiveTab("list")}
              className="button button-secondary"
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              ⬅️ العودة للقائمة
            </button>
          )}
          {activeTab === "list" && (
            <button
              onClick={handleOpenCreate}
              className="button button-primary glow-button"
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              ➕ إنشاء اختبار جديد
            </button>
          )}
        </div>
      </div>

      {/* VIEW 1: QUIZZES LIST & STATS */}
      {activeTab === "list" && (
        <>
          {/* Quick Stats Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "1.2rem",
              marginBottom: "2rem",
            }}
          >
            <div className="glass" style={{ padding: "1.2rem", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ color: "#a855f7", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.3rem" }}>
                📊 اجمالي الاختبارات
              </div>
              <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#fff" }}>{quizzes.length}</div>
            </div>

            <div className="glass" style={{ padding: "1.2rem", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ color: "#22c55e", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.3rem" }}>
                🟢 الاختبارات النشطة
              </div>
              <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#22c55e" }}>
                {quizzes.filter((q) => q.isActive).length}
              </div>
            </div>

            <div className="glass" style={{ padding: "1.2rem", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ color: "#38bdf8", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.3rem" }}>
                📑 إجابات ومحاولات الطلاب
              </div>
              <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#38bdf8" }}>{submissions.length}</div>
            </div>
          </div>

          {/* Filters & Search */}
          <div
            className="glass"
            style={{
              padding: "1rem 1.2rem",
              borderRadius: "16px",
              marginBottom: "1.5rem",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
            }}
          >
            <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", alignItems: "center", flex: 1 }}>
              <input
                type="text"
                className="form-input"
                placeholder="🔍 ابحث بعنوان الاختبار..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ minWidth: "220px", flex: 1, padding: "0.6rem 1rem", fontSize: "0.9rem" }}
              />

              <select
                className="form-input"
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                style={{ padding: "0.6rem 1rem", fontSize: "0.9rem" }}
              >
                <option value="ALL">🏫 جميع المراحل والصفوف</option>
                {ALL_GRADES.filter((g) => g !== "جميع الصفوف الدراسية").map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quizzes List Cards */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#a855f7" }}>
              ⏳ جاري تحميل قائمة الاختبارات...
            </div>
          ) : filteredQuizzes.length === 0 ? (
            <div
              className="glass"
              style={{
                textAlign: "center",
                padding: "3.5rem 1.5rem",
                borderRadius: "20px",
                border: "1px dashed rgba(255,255,255,0.2)",
              }}
            >
              <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>📝</div>
              <h3 style={{ fontSize: "1.3rem", color: "#fff", marginBottom: "0.5rem" }}>لا توجد اختبارات مضافة حالياً</h3>
              <p style={{ color: "rgba(255,255,255,0.6)", maxWidth: "450px", margin: "0 auto 1.5rem auto" }}>
                ابدأ الآن بإضافة أول اختبار ذكي، يمكنك إضافة أسئلة بالصور ورسومات هندسية وتحديد أحجامها.
              </p>
              <button onClick={handleOpenCreate} className="button button-primary">
                ➕ إضافة أول اختبار الآن
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
                gap: "1.25rem",
              }}
            >
              {filteredQuizzes.map((quiz) => {
                const quizSubs = submissions.filter((s) => s.quizId === quiz.id);
                const isExternal = quiz.quizMode === "external" || Boolean(quiz.externalUrl);

                return (
                  <div
                    key={quiz.id}
                    className="glass"
                    style={{
                      borderRadius: "20px",
                      padding: "1.4rem",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      border: quiz.isActive
                        ? "1px solid rgba(168,85,247,0.3)"
                        : "1px solid rgba(239,68,68,0.3)",
                      background: "rgba(30, 41, 59, 0.7)",
                      position: "relative",
                      transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    }}
                  >
                    {/* Status & Type Badges */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.8rem", gap: "0.4rem" }}>
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                        <span
                          style={{
                            background: quiz.isActive ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                            color: quiz.isActive ? "#4ade80" : "#f87171",
                            border: `1px solid ${quiz.isActive ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                            padding: "0.2rem 0.6rem",
                            borderRadius: "20px",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                          }}
                        >
                          {quiz.isActive ? "🟢 نشط" : "🔴 مخفي"}
                        </span>

                        <span
                          style={{
                            background: isExternal ? "rgba(14,165,233,0.15)" : "rgba(168,85,247,0.15)",
                            color: isExternal ? "#38bdf8" : "#c084fc",
                            border: `1px solid ${isExternal ? "rgba(14,165,233,0.3)" : "rgba(168,85,247,0.3)"}`,
                            padding: "0.2rem 0.6rem",
                            borderRadius: "20px",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                          }}
                        >
                          {isExternal ? "🔗 فورم خارجي" : "🖼️📝 اختبار تفاعلي ومصور"}
                        </span>
                      </div>

                      <button
                        onClick={() => handleToggleActive(quiz)}
                        className="button button-sm button-muted"
                        style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem" }}
                        title="تغيير حالة التفعيل"
                      >
                        {quiz.isActive ? "تعطيل ⏸️" : "تفعيل 🟢"}
                      </button>
                    </div>

                    {/* Content */}
                    <div>
                      <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#fff", marginBottom: "0.4rem" }}>
                        {quiz.title}
                      </h3>
                      {quiz.description && (
                        <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)", marginBottom: "1rem", lineHeight: 1.5 }}>
                          {quiz.description}
                        </p>
                      )}

                      {/* Meta Tags */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1.2rem" }}>
                        <span style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", fontSize: "0.78rem", padding: "0.2rem 0.6rem", borderRadius: "12px" }}>
                          🎓 {quiz.grade}
                        </span>
                        <span style={{ background: "rgba(168,85,247,0.15)", color: "#c084fc", fontSize: "0.78rem", padding: "0.2rem 0.6rem", borderRadius: "12px" }}>
                          👥 {quiz.group}
                        </span>
                        {!isExternal && (
                          <span style={{ background: "rgba(56,189,248,0.15)", color: "#38bdf8", fontSize: "0.78rem", padding: "0.2rem 0.6rem", borderRadius: "12px" }}>
                            ❓ {quiz.questionsCount || quiz.questions?.length || 0} أسئلة
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Submissions count bar */}
                    <div
                      style={{
                        padding: "0.6rem 0.8rem",
                        borderRadius: "12px",
                        background: "rgba(15, 23, 42, 0.6)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "1rem",
                        fontSize: "0.85rem",
                      }}
                    >
                      <span style={{ color: "rgba(255,255,255,0.7)" }}>📥 تسليمات وحلول الطلاب:</span>
                      <strong style={{ color: "#38bdf8", fontWeight: 800 }}>{quizSubs.length} تسليم</strong>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button
                        onClick={() => setSelectedQuizForSubmissions(quiz)}
                        className="button button-sm button-secondary"
                        style={{ flex: 1, fontSize: "0.8rem", whiteSpace: "nowrap" }}
                      >
                        📊 النتائج ({quizSubs.length})
                      </button>
                      <button
                        onClick={() => handleOpenEdit(quiz)}
                        className="button button-sm button-muted"
                        style={{ fontSize: "0.8rem" }}
                      >
                        ✏️ تعديل
                      </button>
                      <button
                        onClick={() => handleDeleteQuiz(quiz.id, quiz.title)}
                        className="button button-sm"
                        style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444", fontSize: "0.8rem" }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* VIEW 2: CREATE / EDIT QUIZ FORM */}
      {(activeTab === "create" || activeTab === "edit") && (
        <form onSubmit={handleSaveQuiz} className="glass" style={{ padding: "2rem", borderRadius: "24px" }}>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#fff", marginBottom: "1.5rem" }}>
            {editingQuizId ? "✏️ تعديل الاختبار" : "➕ إضافة اختبار جديد"}
          </h2>

          {/* Quiz Mode Selector Switch */}
          <div
            style={{
              background: "rgba(15, 23, 42, 0.7)",
              padding: "1.2rem",
              borderRadius: "18px",
              marginBottom: "1.8rem",
              border: "1px solid rgba(168,85,247,0.3)",
            }}
          >
            <label style={{ display: "block", fontWeight: 800, marginBottom: "0.8rem", fontSize: "1rem", color: "#38bdf8" }}>
              🛠️ اختر طريقة بناء وعرض الاختبار للطالب:
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: "1rem" }}>
              {/* Option 1: Native Interactive with Images */}
              <div
                onClick={() => setQuizMode("native")}
                style={{
                  padding: "1rem",
                  borderRadius: "14px",
                  border: quizMode === "native" ? "2px solid #a855f7" : "1px solid rgba(255,255,255,0.1)",
                  background: quizMode === "native" ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.03)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.8rem",
                }}
              >
                <input
                  type="radio"
                  name="quizModeChoice"
                  checked={quizMode === "native"}
                  onChange={() => setQuizMode("native")}
                  style={{ marginTop: "0.2rem" }}
                />
                <div>
                  <strong style={{ color: "#fff", display: "block", fontSize: "0.98rem" }}>
                    🖼️📝 اختبار تفاعلي ومصور (أسئلة وصور خيارات)
                  </strong>
                  <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.7)" }}>
                    إدخال الأسئلة، إدراج صور للرسومات والمعادلات، وإضافة صور للخيارات مع التحكم في أحجامها.
                  </span>
                </div>
              </div>

              {/* Option 2: External Form Link */}
              <div
                onClick={() => setQuizMode("external")}
                style={{
                  padding: "1rem",
                  borderRadius: "14px",
                  border: quizMode === "external" ? "2px solid #38bdf8" : "1px solid rgba(255,255,255,0.1)",
                  background: quizMode === "external" ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.03)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.8rem",
                }}
              >
                <input
                  type="radio"
                  name="quizModeChoice"
                  checked={quizMode === "external"}
                  onChange={() => setQuizMode("external")}
                  style={{ marginTop: "0.2rem" }}
                />
                <div>
                  <strong style={{ color: "#fff", display: "block", fontSize: "0.98rem" }}>
                    🔗 رابط نموذج كفورم خارجي (Google / Microsoft Forms)
                  </strong>
                  <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.7)" }}>
                    إدراج رابط نموذج جاهز ويفتح كفورم تفاعلي مدمج مباشرة للطالب في صفحته.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quiz Metadata section */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
              gap: "1.2rem",
              marginBottom: "2rem",
              background: "rgba(15, 23, 42, 0.5)",
              padding: "1.4rem",
              borderRadius: "16px",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div>
              <label style={{ display: "block", fontWeight: 700, marginBottom: "0.4rem", fontSize: "0.9rem" }}>
                عنوان الاختبار *
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="مثال: تطبيق الوحدة الأولى - الهندسة وحساب المثلثات"
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
                style={{ width: "100%", padding: "0.6rem 0.9rem" }}
                required
              />
            </div>

            <div>
              <label style={{ display: "block", fontWeight: 700, marginBottom: "0.4rem", fontSize: "0.9rem" }}>
                الوصف / التعليمات (اختياري)
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="مثال: اقرأ الأسئلة وتأمل الشكل المرفق قبل اختيار الإجابة"
                value={quizDescription}
                onChange={(e) => setQuizDescription(e.target.value)}
                style={{ width: "100%", padding: "0.6rem 0.9rem" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontWeight: 700, marginBottom: "0.4rem", fontSize: "0.9rem" }}>
                🎓 الصف الدراسي المستهدف
              </label>
              <select
                className="form-input"
                value={targetGrade}
                onChange={(e) => setTargetGrade(e.target.value)}
                style={{ width: "100%", padding: "0.6rem 0.9rem" }}
              >
                {ALL_GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontWeight: 700, marginBottom: "0.4rem", fontSize: "0.9rem" }}>
                👥 المجموعة المستهدفة
              </label>
              <select
                className="form-input"
                value={targetGroup}
                onChange={(e) => setTargetGroup(e.target.value)}
                style={{ width: "100%", padding: "0.6rem 0.9rem" }}
              >
                {GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* EXTERNAL FORM MODE INPUT */}
          {quizMode === "external" && (
            <div
              style={{
                background: "rgba(14, 165, 233, 0.1)",
                border: "1px solid rgba(14, 165, 233, 0.3)",
                borderRadius: "18px",
                padding: "1.5rem",
                marginBottom: "2rem",
              }}
            >
              <label style={{ display: "block", fontWeight: 800, marginBottom: "0.4rem", fontSize: "0.95rem", color: "#38bdf8" }}>
                🔗 رابط نموذج الفورم الخارجي (Google Form / Microsoft Form / Liveworksheets) *
              </label>
              <input
                type="url"
                className="form-input"
                placeholder="https://docs.google.com/forms/d/e/.../viewform"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                style={{ width: "100%", padding: "0.7rem 1rem", fontSize: "0.95rem", marginBottom: "1rem" }}
                required
              />

              {/* Form Embed Live Preview for Teacher */}
              {externalUrl && (
                <div style={{ marginTop: "1rem" }}>
                  <div style={{ fontSize: "0.85rem", color: "#a5b4fc", marginBottom: "0.5rem", fontWeight: 700 }}>
                    👁️ معاينة شكل النموذج كفورم يفتح للطالب:
                  </div>
                  <iframe
                    src={getQuizEmbedUrl(externalUrl)}
                    title="معاينة الفورم"
                    style={{
                      width: "100%",
                      height: "400px",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: "14px",
                      background: "#fff",
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* NATIVE QUESTIONS BUILDER SECTION WITH IMAGE SUPPORT & RESIZING */}
          {quizMode === "native" && (
            <div style={{ marginBottom: "2rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#a855f7", margin: 0 }}>
                  ❓ أسئلة الاختبار ({questions.length})
                </h3>

                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="button button-sm button-primary"
                  style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
                >
                  ➕ إضافة سؤال جديد
                </button>
              </div>

              {/* Questions List Builder */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1.8rem" }}>
                {questions.map((q, idx) => (
                  <div
                    key={q.id || idx}
                    style={{
                      background: "rgba(15, 23, 42, 0.7)",
                      borderRadius: "18px",
                      padding: "1.4rem",
                      border: "1px solid rgba(168,85,247,0.25)",
                      position: "relative",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                      <span
                        style={{
                          fontWeight: 900,
                          fontSize: "0.95rem",
                          color: "#38bdf8",
                          background: "rgba(56,189,248,0.15)",
                          padding: "0.3rem 0.8rem",
                          borderRadius: "12px",
                        }}
                      >
                        السؤال رقم ({idx + 1})
                      </span>

                      <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                        <label style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.7)" }}>درجات السؤال:</label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          className="form-input"
                          value={q.points || 1}
                          onChange={(e) => handleUpdateQuestion(idx, "points", Number(e.target.value))}
                          style={{ width: "70px", padding: "0.3rem 0.5rem", fontSize: "0.85rem", textAlign: "center" }}
                        />

                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(idx)}
                          className="button button-sm"
                          style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444", padding: "0.3rem 0.6rem" }}
                          title="حذف هذا السؤال"
                        >
                          🗑️ حذف السؤال
                        </button>
                      </div>
                    </div>

                    {/* Question Text */}
                    <div style={{ marginBottom: "1rem" }}>
                      <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.3rem" }}>
                        نص السؤال (أو وصف الشكل)
                      </label>
                      <textarea
                        rows="2"
                        className="form-input"
                        placeholder="أدخل نص السؤال هنا..."
                        value={q.questionText || ""}
                        onChange={(e) => handleUpdateQuestion(idx, "questionText", e.target.value)}
                        style={{ width: "100%", padding: "0.6rem 0.9rem", resize: "vertical" }}
                      />
                    </div>

                    {/* Question Image URL & Size Controls */}
                    <div
                      style={{
                        background: "rgba(99,102,241,0.08)",
                        border: "1px solid rgba(99,102,241,0.25)",
                        padding: "1rem",
                        borderRadius: "14px",
                        marginBottom: "1.2rem",
                      }}
                    >
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: "1rem", alignItems: "center" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "0.83rem", fontWeight: 700, marginBottom: "0.3rem", color: "#a5b4fc" }}>
                            🖼️ رابط صورة السؤال / الشكل الهندسي (اختياري)
                          </label>
                          <input
                            type="url"
                            className="form-input"
                            placeholder="ضع رابط الصورة (https://...)..."
                            value={q.questionImageUrl || ""}
                            onChange={(e) => handleUpdateQuestion(idx, "questionImageUrl", e.target.value)}
                            style={{ width: "100%", padding: "0.5rem 0.8rem", fontSize: "0.85rem" }}
                          />
                        </div>

                        <div>
                          <label style={{ display: "block", fontSize: "0.83rem", fontWeight: 700, marginBottom: "0.3rem", color: "#a5b4fc" }}>
                            📐 التحكم في حجم وارتفاع عرض صورة السؤال
                          </label>
                          <select
                            className="form-input"
                            value={q.questionImageHeight || "250px"}
                            onChange={(e) => handleUpdateQuestion(idx, "questionImageHeight", e.target.value)}
                            style={{ width: "100%", padding: "0.5rem 0.8rem", fontSize: "0.85rem" }}
                          >
                            {IMAGE_HEIGHT_PRESETS.map((p) => (
                              <option key={p.value} value={p.value}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Question Image Preview */}
                      {q.questionImageUrl && (
                        <div style={{ marginTop: "0.8rem", textAlign: "center", background: "rgba(0,0,0,0.3)", padding: "0.5rem", borderRadius: "10px" }}>
                          <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", display: "block", marginBottom: "0.3rem" }}>
                            معاينة صورة السؤال:
                          </span>
                          <img
                            src={q.questionImageUrl}
                            alt="Question Diagram"
                            style={{
                              maxHeight: q.questionImageHeight || "250px",
                              maxWidth: "100%",
                              borderRadius: "8px",
                              objectFit: "contain",
                              border: "1px solid rgba(255,255,255,0.2)",
                            }}
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Question Type */}
                    <div style={{ marginBottom: "1.2rem", display: "flex", gap: "1.5rem", alignItems: "center" }}>
                      <label style={{ fontSize: "0.85rem", fontWeight: 700 }}>نوع السؤال:</label>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", fontSize: "0.9rem" }}>
                        <input
                          type="radio"
                          name={`q_type_${idx}`}
                          checked={q.type === "mcq"}
                          onChange={() => handleUpdateQuestion(idx, "type", "mcq")}
                        />
                        اختيار من متعدد (MCQ)
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", fontSize: "0.9rem" }}>
                        <input
                          type="radio"
                          name={`q_type_${idx}`}
                          checked={q.type === "true_false"}
                          onChange={() => {
                            handleUpdateQuestion(idx, "type", "true_false");
                            handleUpdateQuestion(idx, "options", ["صح 🟢", "خطأ 🔴"]);
                            handleUpdateQuestion(idx, "correctAnswer", 0);
                          }}
                        />
                        صح أو خطأ (True/False)
                      </label>
                    </div>

                    {/* Options Input with Option Image Support */}
                    <div style={{ marginBottom: "1.2rem" }}>
                      <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.6rem" }}>
                        الخيارات والإجابات (يمكن إدخال نص و/أو صورة لكل خيار):
                      </label>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: "1rem" }}>
                        {q.options.map((opt, optIdx) => {
                          const isCorrect = q.correctAnswer === optIdx;
                          const optImg = q.optionImages?.[optIdx] || "";

                          return (
                            <div
                              key={optIdx}
                              style={{
                                background: isCorrect ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.03)",
                                padding: "0.8rem",
                                borderRadius: "14px",
                                border: isCorrect ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(255,255,255,0.1)",
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.5rem",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQuestion(idx, "correctAnswer", optIdx)}
                                  style={{
                                    background: isCorrect ? "#22c55e" : "transparent",
                                    color: isCorrect ? "#fff" : "rgba(255,255,255,0.6)",
                                    border: isCorrect ? "none" : "1px solid rgba(255,255,255,0.3)",
                                    borderRadius: "50%",
                                    width: "26px",
                                    height: "26px",
                                    cursor: "pointer",
                                    fontSize: "0.8rem",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                  }}
                                  title="تحديد كإجابة صحيحة"
                                >
                                  {isCorrect ? "✓" : ""}
                                </button>

                                <input
                                  type="text"
                                  className="form-input"
                                  value={opt}
                                  onChange={(e) => handleUpdateOption(idx, optIdx, e.target.value)}
                                  style={{ flex: 1, padding: "0.4rem 0.7rem", fontSize: "0.88rem" }}
                                  placeholder={`نص الخيار ${optIdx + 1}`}
                                />
                              </div>

                              {/* Option Image URL input */}
                              <div>
                                <input
                                  type="url"
                                  className="form-input"
                                  placeholder="🖼️ رابط صورة الخيار (اختياري)..."
                                  value={optImg}
                                  onChange={(e) => handleUpdateOptionImage(idx, optIdx, e.target.value)}
                                  style={{ width: "100%", padding: "0.35rem 0.6rem", fontSize: "0.78rem" }}
                                />
                              </div>

                              {/* Option Image Preview */}
                              {optImg && (
                                <div style={{ textAlign: "center", background: "rgba(0,0,0,0.3)", padding: "0.3rem", borderRadius: "8px" }}>
                                  <img
                                    src={optImg}
                                    alt={`Option ${optIdx + 1}`}
                                    style={{ maxHeight: "100px", maxWidth: "100%", borderRadius: "6px", objectFit: "contain" }}
                                    onError={(e) => {
                                      e.target.style.display = "none";
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Scientific Explanation */}
                    <div>
                      <label style={{ display: "block", fontSize: "0.83rem", fontWeight: 700, marginBottom: "0.3rem", color: "#fbbf24" }}>
                        💡 الشرح والتفسير التعليمي للإجابة:
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="خطوات الحل والشرح..."
                        value={q.explanation || ""}
                        onChange={(e) => handleUpdateQuestion(idx, "explanation", e.target.value)}
                        style={{ width: "100%", padding: "0.5rem 0.8rem", fontSize: "0.85rem" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit / Cancel Buttons */}
          <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => setActiveTab("list")}
              className="button button-muted"
              disabled={saving}
            >
              إلغاء
            </button>

            <button
              type="submit"
              className="button button-primary glow-button"
              disabled={saving}
              style={{ minWidth: "150px" }}
            >
              {saving ? "⏳ جاري الحفظ..." : "💾 حفظ ونشر الاختبار"}
            </button>
          </div>
        </form>
      )}

      {/* SUBMISSIONS MODAL */}
      {selectedQuizForSubmissions && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(8px)",
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
              maxWidth: "850px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "2rem",
              borderRadius: "24px",
              border: "1px solid rgba(168,85,247,0.3)",
              background: "#0f172a",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <div>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#fff", margin: 0 }}>
                  📊 نتائج وإجابات الطلاب
                </h3>
                <p style={{ margin: "0.2rem 0 0 0", color: "#a855f7", fontSize: "0.9rem" }}>
                  اختبار: {selectedQuizForSubmissions.title}
                </p>
              </div>

              <button
                onClick={() => {
                  setSelectedQuizForSubmissions(null);
                  setInspectSubmission(null);
                }}
                className="button button-sm button-muted"
                style={{ borderRadius: "50%", width: "36px", height: "36px" }}
              >
                ✕
              </button>
            </div>

            {/* List of Submissions for this quiz */}
            {submissions.filter((s) => s.quizId === selectedQuizForSubmissions.id).length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem 1rem", color: "rgba(255,255,255,0.6)" }}>
                📭 لم يقم أي طالب بتقديم إجابات لهذا الاختبار حتى الآن.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {submissions
                  .filter((s) => s.quizId === selectedQuizForSubmissions.id)
                  .map((sub) => {
                    const pass = sub.percentage >= (selectedQuizForSubmissions.passingPercentage || 60);
                    return (
                      <div
                        key={sub.id}
                        style={{
                          background: "rgba(30, 41, 59, 0.7)",
                          padding: "1rem 1.2rem",
                          borderRadius: "16px",
                          border: `1px solid ${pass ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                          display: "flex",
                          flexWrap: "wrap",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "1rem",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: "1rem", fontWeight: 800, color: "#fff" }}>
                            👤 {sub.studentName || "طالب"}
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.6)", marginTop: "0.2rem" }}>
                            📧 {sub.studentEmail} | 🎓 {sub.studentGrade}
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: "1.2rem", fontWeight: 900, color: pass ? "#4ade80" : "#f87171" }}>
                              {sub.isExternal ? "مكتمل (Form)" : `${sub.score} / ${sub.totalPoints} (${sub.percentage}%)`}
                            </div>
                            <span
                              style={{
                                fontSize: "0.75rem",
                                padding: "0.15rem 0.5rem",
                                borderRadius: "10px",
                                background: pass ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                                color: pass ? "#4ade80" : "#f87171",
                                fontWeight: 700,
                              }}
                            >
                              {sub.isExternal ? "🟢 تم التسليم" : pass ? "🟢 اجتاز الاختبار" : "🔴 لم يجتز"}
                            </span>
                          </div>

                          {!sub.isExternal && (
                            <button
                              onClick={() => setInspectSubmission(inspectSubmission?.id === sub.id ? null : sub)}
                              className="button button-sm button-secondary"
                              style={{ fontSize: "0.8rem" }}
                            >
                              {inspectSubmission?.id === sub.id ? "إخفاء التفاصيل ⬆️" : "فحص الإجابات 👁️"}
                            </button>
                          )}
                        </div>

                        {/* Inspecting submission detailed breakdown */}
                        {inspectSubmission?.id === sub.id && (
                          <div
                            style={{
                              width: "100%",
                              marginTop: "0.8rem",
                              paddingTop: "0.8rem",
                              borderTop: "1px solid rgba(255,255,255,0.1)",
                              fontSize: "0.85rem",
                            }}
                          >
                            <h4 style={{ color: "#38bdf8", marginBottom: "0.6rem" }}>📋 تفاصيل إجابات الطالب:</h4>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                              {selectedQuizForSubmissions.questions?.map((q, qIdx) => {
                                const studentAns = sub.answers?.[qIdx];
                                const isCorrect = studentAns === q.correctAnswer;
                                return (
                                  <div
                                    key={qIdx}
                                    style={{
                                      padding: "0.6rem 0.8rem",
                                      borderRadius: "10px",
                                      background: isCorrect ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                                      border: `1px solid ${isCorrect ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                                    }}
                                  >
                                    <div style={{ fontWeight: 700, color: "#fff", marginBottom: "0.2rem" }}>
                                      {qIdx + 1}. {q.questionText}
                                    </div>
                                    {q.questionImageUrl && (
                                      <img
                                        src={q.questionImageUrl}
                                        alt="Question"
                                        style={{ maxHeight: "150px", maxWidth: "100%", borderRadius: "8px", margin: "0.4rem 0" }}
                                      />
                                    )}
                                    <div style={{ color: isCorrect ? "#4ade80" : "#f87171" }}>
                                      إجابة الطالب: {q.options?.[studentAns] || "لم يجب"} {isCorrect ? "✓ (صحيحة)" : "✗ (خاطئة)"}
                                    </div>
                                    {!isCorrect && (
                                      <div style={{ color: "#38bdf8", marginTop: "0.2rem" }}>
                                        الإجابة الصحيحة: {q.options?.[q.correctAnswer]}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
