// src/components/StudentQuizRunner.jsx
import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function StudentQuizRunner({ quiz, studentProfile, onClose, onComplete }) {
  const questions = quiz.questions || [];
  const totalQuestions = questions.length;

  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState({}); // { [questionIdx]: selectedOptionIndex }
  const [timeLeft, setTimeLeft] = useState(
    quiz.durationMinutes > 0 ? quiz.durationMinutes * 60 : null
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);

  // Timer effect
  useEffect(() => {
    if (timeLeft === null || submissionResult) return;

    if (timeLeft <= 0) {
      // Auto submit on time expire
      handleSubmitQuiz();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, submissionResult]);

  // Format timer
  const formatTime = (seconds) => {
    if (seconds === null) return "بدون وقت";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Handle option select
  const handleSelectOption = (optIndex) => {
    if (submissionResult) return; // locked if finished
    setUserAnswers((prev) => ({
      ...prev,
      [currentIdx]: optIndex,
    }));
  };

  // Calculate score and submit
  const handleSubmitQuiz = async () => {
    if (isSubmitting) return;

    // Check answered count
    const answeredCount = Object.keys(userAnswers).length;
    if (answeredCount < totalQuestions && timeLeft > 0) {
      const confirmSubmit = window.confirm(
        `لقد أجبت على ${answeredCount} من أصل ${totalQuestions} أسئلة. هل أنت تأكد من تسليم الاختبار الآن؟`
      );
      if (!confirmSubmit) return;
    }

    setIsSubmitting(true);

    // Calculate score
    let score = 0;
    let totalPoints = 0;

    questions.forEach((q, idx) => {
      const qPoints = Number(q.points) || 1;
      totalPoints += qPoints;
      const selected = userAnswers[idx];
      if (selected !== undefined && selected === q.correctAnswer) {
        score += qPoints;
      }
    });

    const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
    const isPassed = percentage >= (quiz.passingPercentage || 60);

    const submissionData = {
      quizId: quiz.id,
      quizTitle: quiz.title,
      studentUid: studentProfile?.uid || "student",
      studentName: studentProfile?.fullName || "طالب",
      studentEmail: studentProfile?.email || "",
      studentGrade: studentProfile?.grade || "",
      score,
      totalPoints,
      percentage,
      isPassed,
      answers: userAnswers,
      submittedAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, "quiz_submissions"), submissionData);
      setSubmissionResult({
        score,
        totalPoints,
        percentage,
        isPassed,
      });
      if (onComplete) onComplete();
    } catch (err) {
      console.error("Error submitting quiz:", err);
      alert("حدث خطأ أثناء حفظ النتيجة، يرجى المحاولة مرة أخرى.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentQ = questions[currentIdx] || {};
  const answeredCount = Object.keys(userAnswers).length;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11, 15, 25, 0.94)",
        backdropFilter: "blur(12px)",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
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
          maxHeight: "92vh",
          overflowY: "auto",
          borderRadius: "24px",
          border: "1px solid rgba(168, 85, 247, 0.35)",
          background: "#0f172a",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Quiz Runner Header Bar */}
        <div
          style={{
            padding: "1.2rem 1.8rem",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.1))",
          }}
        >
          <div>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#a855f7",
                background: "rgba(168,85,247,0.15)",
                padding: "0.2rem 0.6rem",
                borderRadius: "10px",
              }}
            >
              🖼️📝 اختبار تفاعلي ومصور
            </span>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#fff", margin: "0.3rem 0 0 0" }}>
              {quiz.title}
            </h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            {/* Live Timer Display */}
            {timeLeft !== null && !submissionResult && (
              <div
                style={{
                  background: timeLeft <= 60 ? "rgba(239,68,68,0.2)" : "rgba(15, 23, 42, 0.8)",
                  border: `1px solid ${timeLeft <= 60 ? "#ef4444" : "rgba(255,255,255,0.15)"}`,
                  color: timeLeft <= 60 ? "#f87171" : "#38bdf8",
                  padding: "0.4rem 0.9rem",
                  borderRadius: "14px",
                  fontWeight: 900,
                  fontSize: "1.1rem",
                  fontFamily: "monospace",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <span>⏱️</span>
                <span>{formatTime(timeLeft)}</span>
              </div>
            )}

            <button
              onClick={onClose}
              className="button button-sm button-muted"
              style={{ borderRadius: "50%", width: "38px", height: "38px", padding: 0 }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* SCREEN 1: RESULTS & DETAILED REVIEW */}
        {submissionResult ? (
          <div style={{ padding: "2.5rem 1.8rem", textAlign: "center" }}>
            <div style={{ fontSize: "4rem", marginBottom: "0.5rem" }}>
              {submissionResult.isPassed ? "🎉" : "📚"}
            </div>

            <h2 style={{ fontSize: "1.8rem", fontWeight: 900, color: "#fff", marginBottom: "0.5rem" }}>
              {submissionResult.isPassed ? "أحسنت! تم اجتياز الاختبار بنجاح" : "حاول مرة أخرى، يمكنك تحسين النتيجة!"}
            </h2>

            <div
              style={{
                display: "inline-flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: "1.5rem",
                margin: "1.5rem auto",
                padding: "1rem 1.8rem",
                maxWidth: "100%",
                borderRadius: "20px",
                background: submissionResult.isPassed ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                border: `1px solid ${submissionResult.isPassed ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
              }}
            >
              <div>
                <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)" }}>الدرجة الحاصل عليها</div>
                <div style={{ fontSize: "2.2rem", fontWeight: 900, color: submissionResult.isPassed ? "#4ade80" : "#f87171" }}>
                  {submissionResult.score} / {submissionResult.totalPoints}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)" }}>النسبة المئوية</div>
                <div style={{ fontSize: "2.2rem", fontWeight: 900, color: submissionResult.isPassed ? "#4ade80" : "#f87171" }}>
                  {submissionResult.percentage}%
                </div>
              </div>
            </div>

            {/* Detailed Questions Review */}
            <div style={{ marginTop: "2rem", textAlign: "right" }}>
              <h3 style={{ fontSize: "1.2rem", color: "#38bdf8", marginBottom: "1.2rem", fontWeight: 800 }}>
                🔍 مراجعة التفاصيل والتفسيرات العلمية للأسئلة:
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
                {questions.map((q, idx) => {
                  const userSel = userAnswers[idx];
                  const isCorrect = userSel === q.correctAnswer;
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: "1.2rem",
                        borderRadius: "16px",
                        background: "rgba(15, 23, 42, 0.7)",
                        border: `1px solid ${isCorrect ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                      }}
                    >
                      <div style={{ fontWeight: 800, color: "#fff", fontSize: "1rem", marginBottom: "0.8rem" }}>
                        س{idx + 1}: {q.questionText}
                      </div>

                      {/* Question Image if present */}
                      {q.questionImageUrl && (
                        <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                          <img
                            src={q.questionImageUrl}
                            alt="Question Diagram"
                            style={{
                              maxHeight: q.questionImageHeight || "250px",
                              maxWidth: "100%",
                              borderRadius: "10px",
                              objectFit: "contain",
                              border: "1px solid rgba(255,255,255,0.2)",
                            }}
                          />
                        </div>
                      )}

                      {/* Options Review */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.6rem", marginBottom: "0.8rem" }}>
                        {q.options.map((opt, optIdx) => {
                          const wasChosen = userSel === optIdx;
                          const isTheCorrectOpt = optIdx === q.correctAnswer;
                          const optImg = q.optionImages?.[optIdx];

                          let bg = "rgba(255,255,255,0.04)";
                          let borderColor = "rgba(255,255,255,0.1)";
                          let color = "rgba(255,255,255,0.7)";

                          if (isTheCorrectOpt) {
                            bg = "rgba(34,197,94,0.2)";
                            borderColor = "#22c55e";
                            color = "#4ade80";
                          } else if (wasChosen && !isTheCorrectOpt) {
                            bg = "rgba(239,68,68,0.2)";
                            borderColor = "#ef4444";
                            color = "#f87171";
                          }

                          return (
                            <div
                              key={optIdx}
                              style={{
                                padding: "0.5rem 0.8rem",
                                borderRadius: "10px",
                                background: bg,
                                border: `1px solid ${borderColor}`,
                                color,
                                fontSize: "0.88rem",
                                fontWeight: wasChosen || isTheCorrectOpt ? 700 : 400,
                              }}
                            >
                              <div>
                                {opt} {isTheCorrectOpt && "✓ (الإجابة الصحيحة)"} {wasChosen && !isTheCorrectOpt && "✗ (إجابتك)"}
                              </div>
                              {optImg && (
                                <img
                                  src={optImg}
                                  alt={`Option ${optIdx + 1}`}
                                  style={{ maxHeight: "90px", maxWidth: "100%", borderRadius: "6px", marginTop: "0.3rem" }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation */}
                      {q.explanation && (
                        <div
                          style={{
                            padding: "0.6rem 0.9rem",
                            borderRadius: "10px",
                            background: "rgba(245,158,11,0.1)",
                            border: "1px solid rgba(245,158,11,0.25)",
                            color: "#fbbf24",
                            fontSize: "0.85rem",
                          }}
                        >
                          💡 <strong>الشرح والتفسير:</strong> {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={onClose}
              className="button button-primary glow-button"
              style={{ marginTop: "2rem", minWidth: "160px" }}
            >
              إغلاق الاختبار
            </button>
          </div>
        ) : (
          /* SCREEN 2: ACTIVE QUESTION TAKING */
          <div style={{ padding: "1.5rem 1.8rem", flex: 1, display: "flex", flexDirection: "column" }}>
            {/* Progress Bar & Question Selector */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
                <span style={{ fontSize: "0.88rem", color: "rgba(255,255,255,0.7)" }}>
                  السؤال <strong style={{ color: "#a855f7" }}>{currentIdx + 1}</strong> من إجمالي {totalQuestions}
                </span>
                <span style={{ fontSize: "0.85rem", color: "#38bdf8" }}>
                  تم إجابة ({answeredCount} / {totalQuestions})
                </span>
              </div>

              {/* Progress Track */}
              <div
                style={{
                  height: "8px",
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: "10px",
                  overflow: "hidden",
                  marginBottom: "1rem",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${((currentIdx + 1) / totalQuestions) * 100}%`,
                    background: "linear-gradient(90deg, #6366f1, #a855f7)",
                    borderRadius: "10px",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>

              {/* Question Navigation Chips */}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {questions.map((_, qIdx) => {
                  const isCurrent = qIdx === currentIdx;
                  const isAnswered = userAnswers[qIdx] !== undefined;

                  let bg = "rgba(255,255,255,0.05)";
                  let color = "rgba(255,255,255,0.6)";

                  if (isCurrent) {
                    bg = "#a855f7";
                    color = "#fff";
                  } else if (isAnswered) {
                    bg = "rgba(56,189,248,0.2)";
                    color = "#38bdf8";
                  }

                  return (
                    <button
                      key={qIdx}
                      onClick={() => setCurrentIdx(qIdx)}
                      style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "10px",
                        border: isCurrent ? "2px solid #fff" : "1px solid rgba(255,255,255,0.1)",
                        background: bg,
                        color,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontSize: "0.85rem",
                      }}
                    >
                      {qIdx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Current Question Box */}
            <div
              style={{
                flex: 1,
                background: "rgba(15, 23, 42, 0.6)",
                borderRadius: "20px",
                padding: "1.5rem",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                marginBottom: "1.5rem",
              }}
            >
              <div>
                <div
                  style={{
                    display: "inline-block",
                    background: "rgba(99,102,241,0.15)",
                    color: "#a5b4fc",
                    fontSize: "0.8rem",
                    padding: "0.2rem 0.7rem",
                    borderRadius: "10px",
                    fontWeight: 700,
                    marginBottom: "0.8rem",
                  }}
                >
                  درجة السؤال: {currentQ.points || 1}
                </div>

                {currentQ.questionText && (
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#fff", lineHeight: 1.6, marginBottom: "1rem" }}>
                    {currentQ.questionText}
                  </h3>
                )}

                {/* QUESTION IMAGE DISPLAY WITH CUSTOM HEIGHT */}
                {currentQ.questionImageUrl && (
                  <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                    <img
                      src={currentQ.questionImageUrl}
                      alt="شكل/صورة السؤال"
                      style={{
                        maxHeight: currentQ.questionImageHeight || "250px",
                        maxWidth: "100%",
                        borderRadius: "14px",
                        objectFit: "contain",
                        border: "1px solid rgba(255,255,255,0.2)",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
                      }}
                    />
                  </div>
                )}

                {/* Options list */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                  {currentQ.options?.map((opt, optIdx) => {
                    const isSelected = userAnswers[currentIdx] === optIdx;
                    const optImg = currentQ.optionImages?.[optIdx];

                    return (
                      <button
                        key={optIdx}
                        onClick={() => handleSelectOption(optIdx)}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          gap: "0.5rem",
                          padding: "1rem 1.2rem",
                          borderRadius: "14px",
                          border: isSelected
                            ? "2px solid #a855f7"
                            : "1px solid rgba(255, 255, 255, 0.12)",
                          background: isSelected
                            ? "linear-gradient(135deg, rgba(99,102,241,0.25), rgba(168,85,247,0.25))"
                            : "rgba(30, 41, 59, 0.5)",
                          color: isSelected ? "#fff" : "rgba(255,255,255,0.85)",
                          fontSize: "1rem",
                          fontWeight: isSelected ? 800 : 500,
                          cursor: "pointer",
                          textAlign: "right",
                          transition: "all 0.15s ease",
                          width: "100%",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.9rem", width: "100%" }}>
                          <div
                            style={{
                              width: "22px",
                              height: "22px",
                              borderRadius: "50%",
                              border: isSelected ? "2px solid #a855f7" : "2px solid rgba(255,255,255,0.3)",
                              background: isSelected ? "#a855f7" : "transparent",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {isSelected && <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#fff" }} />}
                          </div>
                          <span style={{ flex: 1 }}>{opt}</span>
                        </div>

                        {/* Option Image Display */}
                        {optImg && (
                          <div style={{ width: "100%", textAlign: "center", marginTop: "0.4rem" }}>
                            <img
                              src={optImg}
                              alt={`Option ${optIdx + 1}`}
                              style={{
                                maxHeight: "120px",
                                maxWidth: "100%",
                                borderRadius: "8px",
                                objectFit: "contain",
                                border: "1px solid rgba(255,255,255,0.15)",
                              }}
                            />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Footer Navigation */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
              <button
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                className="button button-secondary"
                style={{ opacity: currentIdx === 0 ? 0.5 : 1 }}
              >
                السابق ➡️
              </button>

              {currentIdx < totalQuestions - 1 ? (
                <button
                  onClick={() => setCurrentIdx((i) => Math.min(totalQuestions - 1, i + 1))}
                  className="button button-primary"
                >
                  التالي ⬅️
                </button>
              ) : (
                <button
                  onClick={handleSubmitQuiz}
                  disabled={isSubmitting}
                  className="button button-primary glow-button"
                  style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
                >
                  {isSubmitting ? "⏳ جاري تسليم الاختبار..." : "🚀 تسليم الاختبار ورؤية النتيجة"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
