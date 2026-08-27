// src/pages/TeacherAddStudent.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const GRADES = [
  "الصف الأول الابتدائي", "الصف الثاني الابتدائي", "الصف الثالث الابتدائي",
  "الصف الرابع الابتدائي", "الصف الخامس الابتدائي", "الصف السادس الابتدائي",
  "الصف الأول الإعدادي", "الصف الثاني الإعدادي", "الصف الثالث الإعدادي",
  "الصف الأول الثانوي", "الصف الثاني الثانوي", "الصف الثالث الثانوي",
];

export default function TeacherAddStudent() {
  const { registerStudent } = useAuth();
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
      await registerStudent({ ...form, role: "student", grade: form.grade });
      navigate("/students");
    } catch (err) {
      setError(err.code === "auth/email-already-in-use"
        ? "البريد الإلكتروني مستخدم بالفعل"
        : "حصل خطأ أثناء إنشاء الحساب، حاول مرة أخرى");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dashboard-modern fade-in">
      <div className="dashboard-banner glass">
        <div className="dashboard-banner-content">
          <img src="/logo-circle.png" alt="logo" className="dashboard-avatar" />
          <div>
            <h1 className="font-heading dashboard-welcome">
              <span className="text-gradient">➕ إضافة طالب جديد للمنصة</span>
            </h1>
            <p className="dashboard-role">إنشاء حساب جديد للطالب مع تحديد الصف الدراسي وكلمة المرور</p>
          </div>
        </div>
        <Link to="/students" className="button button-secondary" style={{ fontSize: "0.88rem" }}>
          ← عودة لإدارة الطلاب
        </Link>
      </div>

      <div
        className="glass"
        style={{
          maxWidth: "600px",
          margin: "0 auto",
          width: "100%",
          padding: "2rem",
          borderRadius: "24px",
          background: "rgba(15, 23, 42, 0.85)",
          border: "1.5px solid rgba(2, 132, 199, 0.25)",
        }}
      >
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
          <div>
            <label style={{ display: "block", fontWeight: 700, marginBottom: "0.4rem", color: "#e2e8f0", fontSize: "0.9rem" }}>
              👤 اسم الطالب بالكامل *
            </label>
            <input
              type="text"
              className="form-input"
              value={form.fullName}
              onChange={(e) => update("fullName", e.target.value)}
              placeholder="مثال: أحمد محمد علي"
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontWeight: 700, marginBottom: "0.4rem", color: "#e2e8f0", fontSize: "0.9rem" }}>
                ✉️ البريد الإلكتروني *
              </label>
              <input
                type="email"
                className="form-input"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="student@example.com"
                required
              />
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 700, marginBottom: "0.4rem", color: "#e2e8f0", fontSize: "0.9rem" }}>
                📱 رقم الموبايل *
              </label>
              <input
                type="tel"
                className="form-input"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="01012345678"
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 700, marginBottom: "0.4rem", color: "#e2e8f0", fontSize: "0.9rem" }}>
              🎓 الصف الدراسي *
            </label>
            <select
              className="form-input"
              value={form.grade}
              onChange={(e) => update("grade", e.target.value)}
              required
            >
              {GRADES.map((g) => (
                <option key={g} value={g} style={{ background: "#0f172a", color: "#fff" }}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 700, marginBottom: "0.4rem", color: "#e2e8f0", fontSize: "0.9rem" }}>
              🔑 كلمة المرور (الرقم السري) *
            </label>
            <input
              type="password"
              className="form-input"
              minLength={6}
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              placeholder="لا يقل عن 6 خانات..."
              required
            />
          </div>

          {error && <p className="form-error-modern">{error}</p>}

          <button
            type="submit"
            className="button button-primary"
            disabled={busy}
            style={{ width: "100%", padding: "0.85rem", fontSize: "1rem", marginTop: "0.5rem" }}
          >
            {busy ? "جاري الإنشاء والحفظ..." : "➕ إنشاء حساب الطالب الآن"}
          </button>
        </form>
      </div>
    </div>
  );
}
