// src/pages/TeacherFinances.jsx
import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, orderBy, serverTimestamp } from "firebase/firestore";
import { getSubscriptionInfo } from "../components/StudentCard";
import StudentFinancialLedgerModal from "../components/StudentFinancialLedgerModal";

const PAYMENT_METHODS = [
  { id: "cash", label: "💵 نقدي (كاش)", icon: "💵" },
  { id: "vodafone_cash", label: "📱 فودافون كاش / محفظة إلكترونية", icon: "📱" },
  { id: "bank_transfer", label: "🏦 تحويل بنكي", icon: "🏦" },
];

const TRANSACTION_TYPES = [
  { id: "subscription", label: "🟢 إيراد اشتراك طالب", category: "income" },
  { id: "service", label: "📘 إيراد ملخصات وملازم", category: "income" },
  { id: "expense", label: "🔴 مصروفات وتكاليف تشغيل", category: "expense" },
];

function formatDateAr(dateOrTimestamp) {
  if (!dateOrTimestamp) return "—";
  let d = typeof dateOrTimestamp.toDate === "function" ? dateOrTimestamp.toDate() : new Date(dateOrTimestamp);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function TeacherFinances() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const printRef = useRef(null);

  const [transactions, setTransactions] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filterType, setFilterType] = useState("all"); // 'all' | 'income' | 'expense'
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // New Transaction Form state
  const [txForm, setTxForm] = useState({
    title: "",
    amount: "",
    type: "subscription",
    category: "income",
    paymentMethod: "cash",
    studentId: "",
    notes: "",
  });
  const [savingTx, setSavingTx] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [savingEditTx, setSavingEditTx] = useState(false);
  const [selectedStudentForLedger, setSelectedStudentForLedger] = useState(null);

  const isTeacher = userProfile?.role === "teacher";

  useEffect(() => {
    if (!isTeacher) navigate("/dashboard");
  }, [isTeacher, navigate]);

  // Live snapshot for students
  useEffect(() => {
    const qStudents = query(collection(db, "users"), where("role", "==", "student"));
    const unsubStudents = onSnapshot(qStudents, (snap) => {
      const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setStudents(list);
    });
    return () => unsubStudents();
  }, []);

  // Live snapshot for financial_transactions
  useEffect(() => {
    setLoading(true);
    const qTx = query(collection(db, "financial_transactions"), orderBy("createdAt", "desc"));
    const unsubTx = onSnapshot(
      qTx,
      (snap) => {
        const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setTransactions(list);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching financial transactions:", err);
        setError("تعذر تحميل السجل المالي.");
        setLoading(false);
      }
    );

    return () => unsubTx();
  }, []);

  // Compute Totals
  const totals = useMemo(() => {
    let totalIncome = 0;
    let totalExpenses = 0;
    let currentMonthIncome = 0;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    transactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      const isInc = tx.category === "income" || tx.type === "subscription" || tx.type === "service";

      if (isInc) {
        totalIncome += amt;

        let txDate = tx.createdAt?.toDate ? tx.createdAt.toDate() : new Date(tx.createdAt || Date.now());
        if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
          currentMonthIncome += amt;
        }
      } else {
        totalExpenses += amt;
      }
    });

    const netProfit = totalIncome - totalExpenses;
    return { totalIncome, totalExpenses, netProfit, currentMonthIncome };
  }, [transactions]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const isInc = tx.category === "income" || tx.type === "subscription" || tx.type === "service";
      if (filterType === "income" && !isInc) return false;
      if (filterType === "expense" && isInc) return false;

      const q = search.trim().toLowerCase();
      if (q) {
        const titleMatch = tx.title?.toLowerCase().includes(q);
        const studentMatch = tx.studentName?.toLowerCase().includes(q);
        const notesMatch = tx.notes?.toLowerCase().includes(q);
        const methodMatch = tx.paymentMethodLabel?.toLowerCase().includes(q);
        if (!titleMatch && !studentMatch && !notesMatch && !methodMatch) return false;
      }

      return true;
    });
  }, [transactions, filterType, search]);

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    const amountNum = Number(txForm.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("يرجى كتابة مبلغ مالي صحيح ورقمي.");
      return;
    }
    if (!txForm.title.trim()) {
      alert("يرجى كتابة عنوان المعاملة المالية.");
      return;
    }

    setSavingTx(true);
    try {
      const selectedStudent = students.find((s) => s.id === txForm.studentId);
      const methodObj = PAYMENT_METHODS.find((m) => m.id === txForm.paymentMethod);

      await addDoc(collection(db, "financial_transactions"), {
        title: txForm.title.trim(),
        amount: amountNum,
        type: txForm.type,
        category: txForm.type === "expense" ? "expense" : "income",
        paymentMethod: txForm.paymentMethod,
        paymentMethodLabel: methodObj ? methodObj.label : "نقدي",
        studentId: txForm.studentId || null,
        studentName: selectedStudent ? selectedStudent.fullName : null,
        studentGrade: selectedStudent ? selectedStudent.grade : null,
        notes: txForm.notes.trim() || "",
        createdAt: serverTimestamp(),
        createdByName: userProfile?.fullName || "المعلم المدير",
      });

      setShowAddModal(false);
      setTxForm({
        title: "",
        amount: "",
        type: "subscription",
        category: "income",
        paymentMethod: "cash",
        studentId: "",
        notes: "",
      });
    } catch (err) {
      console.error("Error saving transaction:", err);
      alert("حدث خطأ أثناء حفظ الحركة المالية.");
    } finally {
      setSavingTx(false);
    }
  };

  const handleUpdateTransaction = async (e) => {
    e.preventDefault();
    if (!editingTx) return;
    const amountNum = Number(editingTx.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("يرجى كتابة مبلغ مالي صحيح.");
      return;
    }
    setSavingEditTx(true);
    try {
      const methodObj = PAYMENT_METHODS.find((m) => m.id === editingTx.paymentMethod) || PAYMENT_METHODS[0];
      await updateDoc(doc(db, "financial_transactions", editingTx.id), {
        title: editingTx.title.trim(),
        amount: amountNum,
        type: editingTx.type,
        category: editingTx.type === "expense" ? "expense" : "income",
        paymentMethod: editingTx.paymentMethod,
        paymentMethodLabel: methodObj.label,
        notes: (editingTx.notes || "").trim(),
        updatedAt: serverTimestamp(),
      });
      setEditingTx(null);
    } catch (err) {
      console.error("Error updating transaction:", err);
      alert("حدث خطأ أثناء تعديل الحركة المالية.");
    } finally {
      setSavingEditTx(false);
    }
  };

  const handleDeleteTransaction = async (tx) => {
    if (!window.confirm(`هل أنت متأكد من حذف هذه المعاملة المالية؟\n"${tx.title}" بقيمة ${Number(tx.amount).toLocaleString()} ج.م`)) return;
    try {
      await deleteDoc(doc(db, "financial_transactions", tx.id));
    } catch (err) {
      console.error("Error deleting transaction:", err);
      alert("حدث خطأ أثناء حذف الحركة المالية.");
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="dashboard-modern fade-in">
      {/* Header Banner */}
      <div className="dashboard-banner glass">
        <div className="dashboard-banner-content">
          <img src="/logo-circle.png" alt="logo" className="dashboard-avatar" />
          <div>
            <h1 className="font-heading dashboard-welcome">
              💰 <span className="text-gradient">النظام المالي وإدارة الأرباح</span>
            </h1>
            <p className="dashboard-role">
              سجل المعاملات المالية المباشرة وإيرادات اشتراكات الطلاب
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button onClick={() => setShowAddModal(true)} className="button button-primary">
            + إضافة حركة مالية جديدة
          </button>
          <button onClick={handlePrintReport} className="button button-muted">
            🖨️ طباعة التقرير المالي
          </button>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="stats-grid">
        <div className="stat-card glass highlight-card">
          <div className="stat-icon">💰</div>
          <div className="stat-info">
            <span className="stat-value">{totals.totalIncome.toLocaleString()} ج.م</span>
            <span className="stat-label">إجمالي الإيرادات الكلية</span>
          </div>
        </div>

        <div className="stat-card glass success-card">
          <div className="stat-icon">📈</div>
          <div className="stat-info">
            <span className="stat-value">{totals.currentMonthIncome.toLocaleString()} ج.م</span>
            <span className="stat-label">إيرادات الشهر الحالي</span>
          </div>
        </div>

        <div className="stat-card glass warning-card">
          <div className="stat-icon">🛍️</div>
          <div className="stat-info">
            <span className="stat-value">{totals.totalExpenses.toLocaleString()} ج.م</span>
            <span className="stat-label">إجمالي المصروفات والتكاليف</span>
          </div>
        </div>

        <div className="stat-card glass action-card">
          <div className="stat-icon">⭐</div>
          <div className="stat-info">
            <span className="stat-value" style={{ color: "#7c3aed" }}>{totals.netProfit.toLocaleString()} ج.م</span>
            <span className="stat-label">صافي الأرباح الفعلية</span>
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="glass" style={{ padding: "1.1rem 1.4rem", borderRadius: "var(--radius-md)", display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            onClick={() => setFilterType("all")}
            className={`button button-sm ${filterType === "all" ? "button-primary" : "button-muted"}`}
          >
            جميع المعاملات ({transactions.length})
          </button>
          <button
            onClick={() => setFilterType("income")}
            className={`button button-sm ${filterType === "income" ? "button-primary" : "button-muted"}`}
          >
            🟢 الإيرادات والدفعات
          </button>
          <button
            onClick={() => setFilterType("expense")}
            className={`button button-sm ${filterType === "expense" ? "button-primary" : "button-muted"}`}
          >
            🔴 المصروفات
          </button>
        </div>

        <div style={{ flex: 1, maxWidth: "300px" }}>
          <input
            type="text"
            className="form-input"
            placeholder="🔍 بحث باسم الطالب، البيان، طريقة الدفع..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "0.45rem 0.9rem", fontSize: "0.88rem" }}
          />
        </div>
      </div>

      {loading && (
        <div className="loading-state">
          <img src="/logo-circle.png" alt="Loading" className="logo-loading-sway" style={{ width: 60, height: 60, objectFit: "cover" }} />
          <p>جاري تحميل السجلات المالية الحية...</p>
        </div>
      )}

      {error && <p className="form-error-modern">⚠️ {error}</p>}

      {/* Transactions Table */}
      {!loading && (
        <div ref={printRef} className="recent-students-section glass" style={{ padding: "1.5rem", borderRadius: "var(--radius-lg)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", borderBottom: "2px solid rgba(2, 132, 199, 0.15)", paddingBottom: "0.5rem" }}>
            <h3 className="font-heading" style={{ margin: 0, fontSize: "1.2rem", color: "#0f172a" }}>
              📋 سجل المعاملات المالية ({filteredTransactions.length} معاملة)
            </h3>
            <Link to="/students" className="link" style={{ fontSize: "0.85rem" }}>
              ← الانتقال لإدارة الطلاب والاشتراكات
            </Link>
          </div>

          {filteredTransactions.length === 0 ? (
            <p className="muted" style={{ textAlign: "center", padding: "2rem" }}>
              لا توجد معاملات مالية مسجلة حالياً تطابق الفلتر أو البحث.
            </p>
          ) : (
            <div className="recent-table-wrapper" style={{ overflowX: "auto" }}>
              <table className="recent-students-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid rgba(2, 132, 199, 0.2)", background: "rgba(2, 132, 199, 0.04)" }}>
                    <th style={{ padding: "0.75rem 1rem", color: "#475569", fontSize: "0.88rem" }}>التاريخ والوقت</th>
                    <th style={{ padding: "0.75rem 1rem", color: "#475569", fontSize: "0.88rem" }}>بيان المعاملة</th>
                    <th style={{ padding: "0.75rem 1rem", color: "#475569", fontSize: "0.88rem" }}>الطالب / الجهة</th>
                    <th style={{ padding: "0.75rem 1rem", color: "#475569", fontSize: "0.88rem" }}>طريقة الدفع</th>
                    <th style={{ padding: "0.75rem 1rem", color: "#475569", fontSize: "0.88rem" }}>المبلغ</th>
                    <th style={{ padding: "0.75rem 1rem", color: "#475569", fontSize: "0.88rem", textAlign: "center" }}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx) => {
                    const isIncome = tx.category === "income" || tx.type === "subscription" || tx.type === "service";
                    return (
                      <tr key={tx.id} style={{ borderBottom: "1px solid rgba(226, 232, 240, 0.7)", background: "#ffffff" }}>
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "#64748b" }}>
                          {formatDateAr(tx.createdAt)}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", fontWeight: 800, color: "#0f172a", fontSize: "0.92rem" }}>
                          {tx.title}
                          {tx.notes && <div style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: "normal" }}>📝 {tx.notes}</div>}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.88rem" }}>
                          {tx.studentName ? (
                            <div>
                              <span style={{ fontWeight: "700", color: "#0284c7" }}>👤 {tx.studentName}</span>
                              {tx.studentGrade && <span style={{ fontSize: "0.78rem", color: "#64748b", display: "block" }}>{tx.studentGrade}</span>}
                            </div>
                          ) : (
                            <span style={{ color: "#64748b" }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.85rem", fontWeight: "700", color: "#334155" }}>
                          {tx.paymentMethodLabel || "نقدي"}
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "0.25rem 0.7rem",
                            borderRadius: "20px",
                            fontWeight: "900",
                            fontSize: "0.9rem",
                            background: isIncome ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                            color: isIncome ? "#059669" : "#dc2626",
                            border: isIncome ? "1px solid rgba(16, 185, 129, 0.25)" : "1px solid rgba(239, 68, 68, 0.25)"
                          }}>
                            {isIncome ? `+ ${Number(tx.amount).toLocaleString()} ج.م` : `- ${Number(tx.amount).toLocaleString()} ج.م`}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: "0.4rem", justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
                            {tx.studentId && (
                              <button
                                onClick={() => {
                                  const st = students.find((s) => s.id === tx.studentId) || { id: tx.studentId, fullName: tx.studentName, grade: tx.studentGrade };
                                  setSelectedStudentForLedger(st);
                                }}
                                title="عرض وإدارة السجل المالي لاشتراك هذا الطالب"
                                style={{
                                  background: "rgba(16, 185, 129, 0.12)",
                                  border: "1px solid rgba(16, 185, 129, 0.3)",
                                  color: "#059669",
                                  borderRadius: "8px",
                                  padding: "0.3rem 0.55rem",
                                  cursor: "pointer",
                                  fontSize: "0.78rem",
                                  fontWeight: 700,
                                }}
                              >
                                💳 سجل الطالب
                              </button>
                            )}
                            <button
                              onClick={() => setEditingTx({ ...tx })}
                              title="تعديل هذه الحركة المالية"
                              style={{
                                background: "rgba(2, 132, 199, 0.12)",
                                border: "1px solid rgba(2, 132, 199, 0.3)",
                                color: "#0284c7",
                                borderRadius: "8px",
                                padding: "0.3rem 0.55rem",
                                cursor: "pointer",
                                fontSize: "0.78rem",
                                fontWeight: 700,
                              }}
                            >
                              ✏️ تعديل
                            </button>
                            <button
                              onClick={() => handleDeleteTransaction(tx)}
                              title="حذف هذه الحركة المالية"
                              style={{
                                background: "rgba(239, 68, 68, 0.12)",
                                border: "1px solid rgba(239, 68, 68, 0.3)",
                                color: "#dc2626",
                                borderRadius: "8px",
                                padding: "0.3rem 0.55rem",
                                cursor: "pointer",
                                fontSize: "0.78rem",
                                fontWeight: 700,
                              }}
                            >
                              🗑️ حذف
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="modal-overlay glass-backdrop fade-in" style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1rem"
        }}>
          <div className="modal-content glass" style={{
            background: "#ffffff", padding: "2rem", borderRadius: "var(--radius-lg)",
            maxWidth: "500px", width: "100%", boxShadow: "0 20px 50px rgba(0,0,0,0.2)"
          }}>
            <h3 className="font-heading" style={{ margin: "0 0 1.25rem 0", fontSize: "1.3rem", color: "#0f172a" }}>
              💵 تسجيل حركة مالية جديدة
            </h3>

            <form onSubmit={handleAddTransaction} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label">نوع الحركة المالية:</label>
                <select
                  className="form-input"
                  value={txForm.type}
                  onChange={(e) => setTxForm({ ...txForm, type: e.target.value })}
                >
                  {TRANSACTION_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">عنوان / بيان المعاملة:</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="مثال: رسوم اشتراك شهر أكتوبر / مصروفات طباعة ملازم"
                  value={txForm.title}
                  onChange={(e) => setTxForm({ ...txForm, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">المبلغ المالي (بالجنيه):</label>
                <input
                  type="number"
                  min="1"
                  className="form-input"
                  placeholder="أدخل المبلغ هنا..."
                  value={txForm.amount}
                  onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">طريقة الدفع / التحصيل:</label>
                <select
                  className="form-input"
                  value={txForm.paymentMethod}
                  onChange={(e) => setTxForm({ ...txForm, paymentMethod: e.target.value })}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>

              {txForm.type !== "expense" && (
                <div className="form-group">
                  <label className="form-label">ربط بطالب معين (اختياري):</label>
                  <select
                    className="form-input"
                    value={txForm.studentId}
                    onChange={(e) => setTxForm({ ...txForm, studentId: e.target.value })}
                  >
                    <option value="">-- اختر طالب من القائمة --</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({s.grade || "بدون صف"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">ملاحظات إضافية (اختياري):</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="رقم المحفظة / اسم المحوّل / تفاصيل أخرى..."
                  value={txForm.notes}
                  onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                <button type="submit" disabled={savingTx} className="button button-primary" style={{ flex: 1 }}>
                  {savingTx ? "جاري الحفظ..." : "💾 حفظ الحركة المالية"}
                </button>
                <button type="button" onClick={() => setShowAddModal(false)} className="button button-muted">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editingTx && (
        <div className="modal-overlay glass-backdrop fade-in" style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1rem"
        }}>
          <div className="modal-content glass" style={{
            background: "#ffffff", padding: "2rem", borderRadius: "var(--radius-lg)",
            maxWidth: "500px", width: "100%", boxShadow: "0 20px 50px rgba(0,0,0,0.2)"
          }}>
            <h3 className="font-heading" style={{ margin: "0 0 1.25rem 0", fontSize: "1.3rem", color: "#0f172a" }}>
              ✏️ تعديل الحركة المالية
            </h3>

            <form onSubmit={handleUpdateTransaction} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label">نوع الحركة المالية:</label>
                <select
                  className="form-input"
                  value={editingTx.type}
                  onChange={(e) => setEditingTx({ ...editingTx, type: e.target.value })}
                >
                  {TRANSACTION_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">بيان الحركة / العنوان:</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingTx.title}
                  onChange={(e) => setEditingTx({ ...editingTx, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">المبلغ (ج.م):</label>
                <input
                  type="number"
                  className="form-input"
                  value={editingTx.amount}
                  onChange={(e) => setEditingTx({ ...editingTx, amount: e.target.value })}
                  min="0"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">طريقة الدفع:</label>
                <select
                  className="form-input"
                  value={editingTx.paymentMethod}
                  onChange={(e) => setEditingTx({ ...editingTx, paymentMethod: e.target.value })}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">ملاحظات إضافية:</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingTx.notes || ""}
                  onChange={(e) => setEditingTx({ ...editingTx, notes: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                <button type="submit" disabled={savingEditTx} className="button button-primary" style={{ flex: 1 }}>
                  {savingEditTx ? "جاري التحديث..." : "💾 حفظ التعديل"}
                </button>
                <button type="button" onClick={() => setEditingTx(null)} className="button button-muted">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Financial Ledger Modal */}
      {selectedStudentForLedger && (
        <StudentFinancialLedgerModal
          student={selectedStudentForLedger}
          onClose={() => setSelectedStudentForLedger(null)}
        />
      )}
    </div>
  );
}
