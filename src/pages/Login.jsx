// src/pages/Login.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import GradeSelectionModal from "../components/GradeSelectionModal";

export default function Login() {
  const { login, signInWithGoogle, completeGoogleStudentProfile } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleUserPending, setGoogleUserPending] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setBusy(true);
    try {
      const res = await signInWithGoogle("student", null);
      if (res?.needsGrade) {
        setGoogleUserPending(res.user);
      } else {
        navigate("/dashboard");
      }
    } catch (e) {
      console.error(e);
      setError("فشل تسجيل الدخول عبر جوجل");
    } finally {
      setBusy(false);
    }
  }

  async function handleGradeConfirmed(selectedGrade) {
    if (!googleUserPending) return;
    await completeGoogleStudentProfile(googleUserPending, selectedGrade);
    setGoogleUserPending(null);
    navigate("/dashboard");
  }

  return (
    <div className="auth-page-modern">
      <div className="auth-card glass fade-in">
        <div className="auth-logo-wrap">
          <img src="/logo-circle.png" alt="Logo" className="auth-logo" />
        </div>
        <h1 className="font-heading auth-title">
          <span className="text-gradient">تسجيل الدخول</span>
        </h1>
        <p className="auth-subtitle">مرحباً بك في منصة الدكتور فى الرياضيات</p>

        <form onSubmit={handleSubmit} className="auth-form-modern">
          <div className="form-group">
            <label className="form-label">البريد الإلكتروني أو رقم الهاتف</label>
            <input
              className="form-input"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="أدخل بريدك الإلكتروني أو رقم الهاتف..."
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">كلمة المرور أو الرقم السري (Passcode/PIN)</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="أدخل كلمة المرور أو الرقم السري المعين لك..."
              required
            />
          </div>

          {error && <p className="form-error-modern">⚠️ {error}</p>}

          <button type="submit" disabled={busy} className="button button-primary auth-submit-btn">
            {busy ? "جاري التحقق والدخول..." : "دخول →"}
          </button>

          <div className="auth-divider"><span>أو بواسطة حساب جوجل المباشر</span></div>

          <button type="button" onClick={handleGoogle} disabled={busy} className="button button-google">
            <img src="https://www.google.com/favicon.ico" alt="Google" width={18} />
            {busy ? "جاري الدخول..." : "الدخول باستخدام جوجل"}
          </button>

          <p className="auth-link-text">
            ليس لديك حساب؟ <Link to="/register" className="auth-link">أنشئ حساباً الآن</Link>
          </p>
        </form>
      </div>

      {googleUserPending && (
        <GradeSelectionModal
          user={googleUserPending}
          onConfirm={handleGradeConfirmed}
          onCancel={() => setGoogleUserPending(null)}
        />
      )}
    </div>
  );
}
