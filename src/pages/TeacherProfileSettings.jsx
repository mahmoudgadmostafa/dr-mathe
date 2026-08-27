// src/pages/TeacherProfileSettings.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db, auth } from "../firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { updatePassword } from "firebase/auth";

export default function TeacherProfileSettings() {
  const { currentUser, userProfile, isTeacher } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [passcode, setPasscode] = useState(""); // current/old passcode
  const [newPasscode, setNewPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  const [subject, setSubject] = useState("الرياضيات");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (userProfile) {
      setFullName(userProfile.fullName || "");
      setEmail(userProfile.email || currentUser?.email || "");
      setPhone(userProfile.phone || "");
      setPasscode(userProfile.passcode || userProfile.teacherPasscode || "");
      setSubject(userProfile.subject || "الرياضيات");
      setBio(userProfile.bio || "");
    }
  }, [userProfile, currentUser]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      alert("يرجى كتابة الاسم الكامل");
      return;
    }

    // Validate new passcode if provided
    const wantsNewPasscode = newPasscode.trim() !== "";
    if (wantsNewPasscode) {
      if (newPasscode.trim() !== confirmPasscode.trim()) {
        alert("كلمة المرور الجديدة وتأكيدها غير متطابقتين! يرجى المراجعة.");
        return;
      }
    }
    const finalPasscode = wantsNewPasscode ? newPasscode.trim() : passcode.trim();

    setSaving(true);
    setSuccessMsg("");

    try {
      if (currentUser?.uid) {
        const teacherRef = doc(db, "users", currentUser.uid);
        await updateDoc(teacherRef, {
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          passcode: finalPasscode,
          teacherPasscode: finalPasscode,
          password: finalPasscode,
          subject: subject.trim(),
          bio: bio.trim(),
          updatedAt: serverTimestamp(),
        });
      }

      // Try updating Firebase Auth password if logged in via Firebase Auth
      if (wantsNewPasscode && auth.currentUser) {
        try {
          await updatePassword(auth.currentUser, finalPasscode);
        } catch (authErr) {
          console.log("Firebase Auth updatePassword notice (managed via passcode):", authErr.message);
        }
      }

      // Update local state to reflect new passcode
      if (wantsNewPasscode) {
        setPasscode(finalPasscode);
        setNewPasscode("");
        setConfirmPasscode("");
      }

      setSuccessMsg("تم حفظ وتحديث بيانات المعلم والرقم السري بنجاح! 💾✨");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Error updating teacher profile:", err);
      alert("حدث خطأ أثناء حفظ التعديلات");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dashboard-container fade-in" style={{ padding: "2rem 1rem", maxWidth: "800px", margin: "0 auto" }}>
      {/* Header Banner */}
      <div
        className="glass"
        style={{
          padding: "1.8rem",
          borderRadius: "24px",
          marginBottom: "2rem",
          background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15))",
          border: "1px solid rgba(168,85,247,0.3)",
          display: "flex",
          alignItems: "center",
          gap: "1.2rem",
        }}
      >
        <img
          src="/logo-circle.png"
          alt="Avatar"
          style={{ width: "64px", height: "64px", borderRadius: "50%", border: "2px solid #a855f7" }}
        />
        <div>
          <h1 className="font-heading" style={{ fontSize: "1.6rem", margin: 0, color: "#fff" }}>
            ⚙️ إعدادات <span className="text-gradient">حساب المعلم والملف الشخصي</span>
          </h1>
          <p style={{ margin: "0.2rem 0 0 0", color: "rgba(255,255,255,0.7)", fontSize: "0.9rem" }}>
            تعديل بياناتك الشخصية، رقم الهاتف، والتحكم بالرقم السري كمدير للمنصة.
          </p>
        </div>
      </div>

      {successMsg && (
        <div
          style={{
            background: "rgba(34,197,94,0.15)",
            border: "1px solid rgba(34,197,94,0.4)",
            color: "#4ade80",
            padding: "1rem 1.2rem",
            borderRadius: "16px",
            marginBottom: "1.5rem",
            fontWeight: 700,
            textAlign: "center",
            fontSize: "1rem",
          }}
        >
          {successMsg}
        </div>
      )}

      {/* Profile Form */}
      <form onSubmit={handleSaveProfile} className="glass" style={{ padding: "2rem", borderRadius: "24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}>
          <div>
            <label style={{ display: "block", fontWeight: 700, marginBottom: "0.4rem", fontSize: "0.9rem" }}>
              👤 اسم المعلم الكامل *
            </label>
            <input
              type="text"
              className="form-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={{ width: "100%", padding: "0.7rem 1rem", fontSize: "0.95rem" }}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "1.2rem" }}>
            <div>
              <label style={{ display: "block", fontWeight: 700, marginBottom: "0.4rem", fontSize: "0.9rem" }}>
                ✉️ البريد الإلكتروني
              </label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: "100%", padding: "0.7rem 1rem", fontSize: "0.95rem" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontWeight: 700, marginBottom: "0.4rem", fontSize: "0.9rem" }}>
                📱 رقم الهاتف / الواتساب
              </label>
              <input
                type="tel"
                className="form-input"
                placeholder="010..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ width: "100%", padding: "0.7rem 1rem", fontSize: "0.95rem" }}
              />
            </div>
          </div>

          {/* Passcode / Password Section */}
          <div
            style={{
              background: "rgba(168,85,247,0.1)",
              border: "1px solid rgba(168,85,247,0.3)",
              padding: "1.2rem",
              borderRadius: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#c084fc" }}>
              🔑 الرقم السري / كلمة المرور الخاصة بالمعلم
            </div>

            {/* Current (old) passcode — readonly display */}
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: "0.3rem", fontSize: "0.82rem", color: "rgba(255,255,255,0.6)" }}>
                كلمة المرور الحالية (للعرض فقط)
              </label>
              <input
                type="text"
                readOnly
                value={passcode || "لا يوجد رقم سري مسجل"}
                style={{
                  width: "100%",
                  padding: "0.65rem 1rem",
                  fontSize: "1rem",
                  fontWeight: 700,
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "10px",
                  color: "#e9d5ff",
                  letterSpacing: "2px",
                  cursor: "default",
                  direction: "ltr",
                }}
              />
            </div>

            {/* New passcode + confirm */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontWeight: 700, marginBottom: "0.3rem", fontSize: "0.85rem" }}>
                  كلمة المرور الجديدة
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="أدخل كلمة مرور جديدة..."
                  value={newPasscode}
                  onChange={(e) => setNewPasscode(e.target.value)}
                  style={{ width: "100%", padding: "0.65rem 1rem", fontSize: "1rem", fontWeight: 700, letterSpacing: "1px" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 700, marginBottom: "0.3rem", fontSize: "0.85rem" }}>
                  تأكيد كلمة المرور الجديدة
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="أعد كتابة كلمة المرور..."
                  value={confirmPasscode}
                  onChange={(e) => setConfirmPasscode(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.65rem 1rem",
                    fontSize: "1rem",
                    fontWeight: 700,
                    letterSpacing: "1px",
                    border: confirmPasscode && newPasscode !== confirmPasscode
                      ? "1.5px solid #f87171"
                      : confirmPasscode && newPasscode === confirmPasscode
                      ? "1.5px solid #4ade80"
                      : undefined,
                  }}
                />
              </div>
            </div>

            {/* Match indicator */}
            {newPasscode && confirmPasscode && (
              <div style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: newPasscode === confirmPasscode ? "#4ade80" : "#f87171",
              }}>
                {newPasscode === confirmPasscode
                  ? "✅ كلمتا المرور متطابقتان — سيتم التحديث عند الحفظ"
                  : "❌ كلمتا المرور غير متطابقتين"}
              </div>
            )}
            {!newPasscode && (
              <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>
                💡 اترك خانتي كلمة المرور فارغتين إذا لم ترد تغييرها.
              </span>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "1.2rem" }}>
            <div>
              <label style={{ display: "block", fontWeight: 700, marginBottom: "0.4rem", fontSize: "0.9rem" }}>
                📚 التخصص / المادة
              </label>
              <input
                type="text"
                className="form-input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{ width: "100%", padding: "0.7rem 1rem", fontSize: "0.95rem" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontWeight: 700, marginBottom: "0.4rem", fontSize: "0.9rem" }}>
                📝 نبذة أو وصف مختصر
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="أستاذ الرياضيات والمدير..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                style={{ width: "100%", padding: "0.7rem 1rem", fontSize: "0.95rem" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
            <button
              type="submit"
              disabled={saving}
              className="button button-primary glow-button"
              style={{ minWidth: "180px", fontSize: "1rem", padding: "0.8rem 1.5rem" }}
            >
              {saving ? "⏳ جاري الحفظ..." : "💾 حفظ التعديلات فوراً"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
