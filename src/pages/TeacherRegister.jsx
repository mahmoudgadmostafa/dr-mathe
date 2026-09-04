import { useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const GRADES = [
  "الصف الأول الابتدائي", "الصف الثاني الابتدائي", "الصف الثالث الابتدائي",
  "الصف الرابع الابتدائي", "الصف الخامس الابتدائي", "الصف السادس الابتدائي",
  "الصف الأول الإعدادي", "الصف الثاني الإعدادي", "الصف الثالث الإعدادي",
  "الصف الأول الثانوي", "الصف الثاني الثانوي", "الصف الثالث الثانوي",
];

export default function TeacherRegister() {
  const { registerTeacher, currentUser } = useAuth();
  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    grade: GRADES[0],
    password: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await registerTeacher(form);
      navigate("/dashboard");
    } catch (err) {
      setError(err.code === "auth/email-already-in-use"
        ? "البريد الإلكتروني مستخدم بالفعل"
        : "حصل خطأ أثناء إنشاء الحساب، حاول تاني");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page-modern">
      <div className="auth-card glass fade-in">
        <div className="auth-logo-wrap">
          <img src="/logo-circle.png" alt="Logo" className="auth-logo" />
        </div>
        <h1 className="font-heading auth-title">
          <span className="text-gradient">إنشاء حساب معلم</span>
        </h1>
        <p className="auth-subtitle">إدارة الحصص والاختبارات ومتابعة أداء الطلاب</p>

        <form onSubmit={handleSubmit} className="auth-form-modern">
          <div className="form-group">
            <label className="form-label">الاسم بالكامل</label>
            <input
              className="form-input"
              value={form.fullName}
              onChange={(e) => update("fullName", e.target.value)}
              placeholder="اسم المعلم..."
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">البريد الإلكتروني</label>
            <input
              className="form-input"
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="teacher@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">رقم الموبايل</label>
            <input
              className="form-input"
              type="tel"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="010XXXXXXXX"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">المرحلة / الصف الأساسي</label>
            <select
              className="form-input"
              value={form.grade}
              onChange={(e) => update("grade", e.target.value)}
            >
              {GRADES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">كلمة المرور</label>
            <input
              className="form-input"
              type="password"
              minLength={6}
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              placeholder="لا تقل عن 6 أحرف أو أرقام..."
              required
            />
          </div>

          {error && <p className="form-error-modern">⚠️ {error}</p>}

          <button type="submit" disabled={busy} className="button button-primary auth-submit-btn">
            {busy ? "جاري الإنشاء..." : "إنشاء الحساب ←"}
          </button>

          <p className="auth-link-text">
            لديك حساب بالفعل؟ <Link to="/login" className="auth-link">سجّل دخولك الآن</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
