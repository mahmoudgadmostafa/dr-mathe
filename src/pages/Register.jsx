import { useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import GradeSelectionModal from "../components/GradeSelectionModal";

const GRADES = [
  "الصف الأول الابتدائي", "الصف الثاني الابتدائي", "الصف الثالث الابتدائي",
  "الصف الرابع الابتدائي", "الصف الخامس الابتدائي", "الصف السادس الابتدائي",
  "الصف الأول الإعدادي", "الصف الثاني الإعدادي", "الصف الثالث الإعدادي",
  "الصف الأول الثانوي", "الصف الثاني الثانوي", "الصف الثالث الثانوي",
];

export default function Register() {
  const { registerStudent, signInWithGoogle, completeGoogleStudentProfile, currentUser } = useAuth();
  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }
  const navigate = useNavigate();

  const [form, setForm] = useState({ fullName: "", email: "", phone: "", grade: GRADES[0], password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selectedRole = "student";
  const [selectedGrade, setSelectedGrade] = useState(GRADES[0]);
  const [googleUserPending, setGoogleUserPending] = useState(null);

  function update(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await registerStudent({ ...form, role: selectedRole, grade: selectedGrade });
      navigate("/dashboard");
    } catch (err) {
      setError(err.code === "auth/email-already-in-use" ? "البريد الإلكتروني مستخدم بالفعل" : "حصل خطأ أثناء إنشاء الحساب، حاول تاني");
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
      setError("فشل إنشاء الحساب عبر جوجل");
    } finally {
      setBusy(false);
    }
  }

  async function handleGradeConfirmed(grade) {
    if (!googleUserPending) return;
    await completeGoogleStudentProfile(googleUserPending, grade);
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
          <span className="text-gradient">إنشاء حساب جديد</span>
        </h1>
        <p className="auth-subtitle">انضم لمنصة الدكتور وابدأ رحلة التفوق</p>

        <form onSubmit={handleSubmit} className="auth-form-modern">
          <div className="form-group">
            <label className="form-label">الاسم بالكامل</label>
            <input className="form-input" value={form.fullName} onChange={(e) => update('fullName', e.target.value)} placeholder="أدخل اسمك الكامل" required />
          </div>
          <div className="form-group">
            <label className="form-label">البريد الإلكتروني</label>
            <input className="form-input" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="أدخل بريدك الإلكتروني" required />
          </div>
          <div className="form-group">
            <label className="form-label">رقم الموبايل</label>
            <input className="form-input" type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="أدخل رقم الموبايل" required />
          </div>
          <div className="form-group">
            <label className="form-label">الصف الدراسي</label>
            <select className="form-input" value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)}>
              {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">كلمة المرور</label>
            <input className="form-input" type="password" minLength={6} value={form.password} onChange={(e) => update('password', e.target.value)} placeholder="أدخل كلمة مرور قوية" required />
          </div>

          {error && <p className="form-error-modern">⚠️ {error}</p>}

          <button type="submit" disabled={busy} className="button button-primary auth-submit-btn">
            {busy ? "جاري الإنشاء..." : "إنشاء الحساب →"}
          </button>

          <div className="auth-divider"><span>أو</span></div>

          <button type="button" onClick={handleGoogle} disabled={busy} className="button button-google">
            <img src="https://www.google.com/favicon.ico" alt="Google" width={18} />
            {busy ? "جاري الإنشاء..." : "إنشاء حساب باستخدام جوجل"}
          </button>

          <p className="auth-link-text">
            عندك حساب بالفعل؟ <Link to="/login" className="auth-link">سجّل دخولك</Link>
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
