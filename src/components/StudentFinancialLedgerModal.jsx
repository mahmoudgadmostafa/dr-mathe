// src/components/StudentFinancialLedgerModal.jsx
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { db } from "../firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import Avatar from "./Avatar";
import { getSubscriptionInfo } from "./StudentCard";

const PAYMENT_METHODS = [
  { id: "cash", label: "💵 نقدي (كاش)" },
  { id: "vodafone_cash", label: "📱 فودافون كاش" },
  { id: "instapay", label: "⚡ إنستاباي (InstaPay)" },
  { id: "bank_transfer", label: "🏦 تحويل بنكي" },
  { id: "other", label: "💳 طريقة أخرى" },
];

const DURATION_PRESETS = [
  { days: 30, label: "شهر (30 يوم)", defaultAmount: 150 },
  { days: 60, label: "شهران (60 يوم)", defaultAmount: 280 },
  { days: 90, label: "3 أشهر (90 يوم)", defaultAmount: 400 },
  { days: 120, label: "ترم كامل (120 يوم)", defaultAmount: 500 },
  { days: 365, label: "عام دراسي (365 يوم)", defaultAmount: 1200 },
];

function formatDateAr(dateOrTimestamp) {
  if (!dateOrTimestamp) return "—";
  let d = typeof dateOrTimestamp?.toDate === "function" ? dateOrTimestamp.toDate() : new Date(dateOrTimestamp);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
}

function formatDateTimeAr(dateOrTimestamp) {
  if (!dateOrTimestamp) return "—";
  let d = typeof dateOrTimestamp?.toDate === "function" ? dateOrTimestamp.toDate() : new Date(dateOrTimestamp);
  if (isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" })} • ${d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function StudentFinancialLedgerModal({ student, onClose, onStudentUpdated }) {
  const studentId = student?.id || student?.uid;

  // Live student data
  const [currentStudent, setCurrentStudent] = useState(student);
  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [toastMessage, setToastMessage] = useState("");

  // Mode states: 'view' | 'add' | 'edit' | 'direct_expiry'
  const [activeMode, setActiveMode] = useState("view");
  const [savingAction, setSavingAction] = useState(false);

  // Form for ADD
  const [addForm, setAddForm] = useState({
    title: "تفعيل اشتراك شهري",
    amount: 150,
    paymentMethod: "cash",
    presetDays: 30,
    customDays: "",
    expiryDateMode: "preset", // 'preset' | 'date'
    specificExpiryDate: "",
    updateStudentExpiry: true,
    notes: "",
  });

  // Form for EDIT
  const [editingTx, setEditingTx] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    amount: "",
    paymentMethod: "cash",
    notes: "",
    newExpiryDate: "",
    updateStudentExpiry: false,
  });

  // Direct Expiry Adjustment state
  const [directDate, setDirectDate] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // 1. Listen to live student user document
  useEffect(() => {
    if (!studentId) return;
    const unsub = onSnapshot(doc(db, "users", studentId), (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setCurrentStudent(data);
        if (onStudentUpdated) onStudentUpdated(data);
      }
    });
    return () => unsub();
  }, [studentId, onStudentUpdated]);

  // 2. Listen to live financial transactions for this student
  useEffect(() => {
    if (!studentId) return;
    setLoadingTx(true);
    const q = query(collection(db, "financial_transactions"), where("studentId", "==", studentId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          const tA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
          const tB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
          return tB - tA;
        });
        setTransactions(list);
        setLoadingTx(false);
      },
      (err) => {
        console.error("Error listening to student transactions:", err);
        setLoadingTx(false);
      }
    );
    return () => unsub();
  }, [studentId]);

  const subInfo = getSubscriptionInfo(currentStudent);

  // Compute total paid
  const totalPaid = transactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  // Helper to compute target expiry for Add Form
  const computeAddExpiryDate = () => {
    if (addForm.expiryDateMode === "date" && addForm.specificExpiryDate) {
      return new Date(`${addForm.specificExpiryDate}T23:59:59`);
    }
    const days = addForm.expiryDateMode === "custom" ? Number(addForm.customDays) || 0 : Number(addForm.presetDays) || 30;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  };

  // ─── ADD TRANSACTION & SUBSCRIPTION ───────────────────────────────────────
  const handleSaveAdd = async (e) => {
    e.preventDefault();
    const amountNum = Number(addForm.amount);
    if (isNaN(amountNum) || amountNum < 0) {
      alert("يرجى إدخال مبلغ صحيح.");
      return;
    }

    setSavingAction(true);
    try {
      const targetExpiry = computeAddExpiryDate();
      const methodObj = PAYMENT_METHODS.find((m) => m.id === addForm.paymentMethod) || PAYMENT_METHODS[0];

      // 1. Add financial transaction
      await addDoc(collection(db, "financial_transactions"), {
        title: addForm.title.trim() || `اشتراك - ${currentStudent.fullName}`,
        amount: amountNum,
        type: "subscription",
        category: "income",
        paymentMethod: addForm.paymentMethod,
        paymentMethodLabel: methodObj.label,
        studentId: studentId,
        studentName: currentStudent.fullName,
        studentGrade: currentStudent.grade || "",
        notes: addForm.notes.trim(),
        targetExpiryDate: Timestamp.fromDate(targetExpiry),
        createdAt: serverTimestamp(),
      });

      // 2. If update student expiry is checked, update user profile
      if (addForm.updateStudentExpiry) {
        await updateDoc(doc(db, "users", studentId), {
          isSubscribed: true,
          subscribedUntil: Timestamp.fromDate(targetExpiry),
          subscriptionActivatedAt: serverTimestamp(),
        });
      }

      showToast("✅ تم إضافة المعاملة المالية وتفعيل/تمديد الاشتراك بنجاح!");
      setActiveMode("view");
      // Reset
      setAddForm({
        title: "تفعيل اشتراك شهري",
        amount: 150,
        paymentMethod: "cash",
        presetDays: 30,
        customDays: "",
        expiryDateMode: "preset",
        specificExpiryDate: "",
        updateStudentExpiry: true,
        notes: "",
      });
    } catch (err) {
      console.error("Error adding transaction:", err);
      alert("حدث خطأ أثناء حفظ المعاملة المالية.");
    } finally {
      setSavingAction(false);
    }
  };

  // ─── EDIT TRANSACTION ─────────────────────────────────────────────────────
  const openEdit = (tx) => {
    setEditingTx(tx);
    let defaultExpStr = "";
    if (tx.targetExpiryDate) {
      const d = tx.targetExpiryDate.toDate ? tx.targetExpiryDate.toDate() : new Date(tx.targetExpiryDate);
      defaultExpStr = d.toISOString().split("T")[0];
    }
    setEditForm({
      title: tx.title || "",
      amount: tx.amount || "",
      paymentMethod: tx.paymentMethod || "cash",
      notes: tx.notes || "",
      newExpiryDate: defaultExpStr,
      updateStudentExpiry: false,
    });
    setActiveMode("edit");
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingTx) return;
    const amountNum = Number(editForm.amount);
    if (isNaN(amountNum) || amountNum < 0) {
      alert("يرجى إدخال مبلغ صحيح.");
      return;
    }

    setSavingAction(true);
    try {
      const methodObj = PAYMENT_METHODS.find((m) => m.id === editForm.paymentMethod) || PAYMENT_METHODS[0];
      const updates = {
        title: editForm.title.trim(),
        amount: amountNum,
        paymentMethod: editForm.paymentMethod,
        paymentMethodLabel: methodObj.label,
        notes: editForm.notes.trim(),
        updatedAt: serverTimestamp(),
      };

      if (editForm.newExpiryDate) {
        const expDate = new Date(`${editForm.newExpiryDate}T23:59:59`);
        if (!isNaN(expDate.getTime())) {
          updates.targetExpiryDate = Timestamp.fromDate(expDate);

          if (editForm.updateStudentExpiry) {
            await updateDoc(doc(db, "users", studentId), {
              isSubscribed: true,
              subscribedUntil: Timestamp.fromDate(expDate),
            });
          }
        }
      }

      await updateDoc(doc(db, "financial_transactions", editingTx.id), updates);

      showToast("✅ تم تعديل بيانات المعاملة المالية والاشتراك بنجاح!");
      setActiveMode("view");
      setEditingTx(null);
    } catch (err) {
      console.error("Error editing transaction:", err);
      alert("حدث خطأ أثناء تعديل المعاملة المالية.");
    } finally {
      setSavingAction(false);
    }
  };

  // ─── DELETE TRANSACTION ───────────────────────────────────────────────────
  const handleDeleteTx = async (tx) => {
    const confirmMsg = `هل أنت متأكد من حذف هذه المعاملة المالية؟\n"${tx.title}" بقيمة ${Number(tx.amount).toLocaleString()} ج.م`;
    if (!window.confirm(confirmMsg)) return;

    setSavingAction(true);
    try {
      await deleteDoc(doc(db, "financial_transactions", tx.id));

      // Check if user wants to deactivate student subscription as well
      if (transactions.length <= 1) {
        const deactPrompt = window.confirm(
          `هذه كانت المعاملة الوحيدة المسجلة للطالب "${currentStudent.fullName}".\nهل ترغب أيضاً في إيقاف وإلغاء تفعيل اشتراكه الحالي؟`
        );
        if (deactPrompt) {
          await updateDoc(doc(db, "users", studentId), {
            isSubscribed: false,
            subscribedUntil: null,
            subscriptionDeactivatedAt: serverTimestamp(),
          });
        }
      }

      showToast("🗑️ تم حذف المعاملة المالية بنجاح!");
    } catch (err) {
      console.error("Error deleting transaction:", err);
      alert("حدث خطأ أثناء حذف المعاملة المالية.");
    } finally {
      setSavingAction(false);
    }
  };

  // ─── DIRECT SUBSCRIPTION EXPIRY ADJUSTMENT ─────────────────────────────────
  const handleSaveDirectExpiry = async (e) => {
    e.preventDefault();
    if (!directDate) {
      alert("يرجى اختيار تاريخ انتهاء صالح.");
      return;
    }
    const expDate = new Date(`${directDate}T23:59:59`);
    if (isNaN(expDate.getTime())) {
      alert("تاريخ غير صالح.");
      return;
    }

    setSavingAction(true);
    try {
      await updateDoc(doc(db, "users", studentId), {
        isSubscribed: true,
        subscribedUntil: Timestamp.fromDate(expDate),
        subscriptionActivatedAt: currentStudent.subscriptionActivatedAt || serverTimestamp(),
      });
      showToast("✅ تم تحديث تاريخ انتهاء اشتراك الطالب بنجاح!");
      setActiveMode("view");
    } catch (err) {
      console.error("Error updating expiry directly:", err);
      alert("حدث خطأ أثناء تحديث تاريخ الاشتراك.");
    } finally {
      setSavingAction(false);
    }
  };

  // ─── DEACTIVATE SUBSCRIPTION ──────────────────────────────────────────────
  const handleDeactivateSubscription = async () => {
    if (!window.confirm(`هل أنت متأكد من إيقاف وإلغاء تفعيل اشتراك الطالب "${currentStudent.fullName}"؟`)) return;
    setSavingAction(true);
    try {
      await updateDoc(doc(db, "users", studentId), {
        isSubscribed: false,
        subscribedUntil: null,
        subscriptionDeactivatedAt: serverTimestamp(),
      });
      showToast("⛔ تم إيقاف الاشتراك بنجاح.");
    } catch (err) {
      console.error("Error deactivating subscription:", err);
      alert("حدث خطأ أثناء إيقاف الاشتراك.");
    } finally {
      setSavingAction(false);
    }
  };

  const statusColor =
    subInfo.status === "active" ? "#22c55e"
      : subInfo.status === "expiring_soon" ? "#f59e0b"
        : "#ef4444";

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={(e) => e.target === e.currentTarget && !savingAction && onClose()}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
          borderRadius: "24px",
          border: "1.5px solid rgba(16, 185, 129, 0.45)",
          width: "100%",
          maxWidth: "700px",
          maxHeight: "92vh",
          overflowY: "auto",
          boxShadow: "0 0 60px rgba(16, 185, 129, 0.25)",
          color: "#e2e8f0",
        }}
      >
        {/* Pinned Header */}
        <div
          style={{
            background: "linear-gradient(90deg, #059669, #047857)",
            padding: "1.2rem 1.5rem",
            borderRadius: "24px 24px 0 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>💰</span> إدارة السجل المالي والاشتراكات للطالب
            </h3>
            <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.82rem", color: "rgba(255,255,255,0.85)" }}>
              إضافة، تعديل، وحذف الحركات المالية وصلاحية اشتراك الطالب
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={savingAction}
            style={{
              background: "rgba(255,255,255,0.2)",
              border: "none",
              color: "#fff",
              width: 34,
              height: 34,
              borderRadius: "50%",
              cursor: "pointer",
              fontSize: "1.1rem",
              fontWeight: 800,
            }}
          >
            ✕
          </button>
        </div>

        {/* Toast Feedback */}
        {toastMessage && (
          <div style={{ margin: "1rem 1.5rem 0", background: "rgba(34,197,94,0.2)", border: "1px solid #22c55e", color: "#4ade80", padding: "0.65rem 1rem", borderRadius: "12px", textAlign: "center", fontSize: "0.85rem", fontWeight: 700 }}>
            {toastMessage}
          </div>
        )}

        <div style={{ padding: "1.5rem" }}>
          {/* Student Profile & Quick Overview */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              padding: "1rem 1.2rem",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "18px",
              marginBottom: "1.2rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
              <Avatar src={currentStudent.photoURL || "/logo-circle.png"} alt={currentStudent.fullName} size={48} />
              <div>
                <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#fff" }}>{currentStudent.fullName}</div>
                <div style={{ fontSize: "0.8rem", color: "#94a3b8", display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.15rem" }}>
                  <span>🎓 {currentStudent.grade || "غير محدد"}</span>
                  {currentStudent.group && <span>👥 {currentStudent.group}</span>}
                  {currentStudent.phone && <span>📱 {currentStudent.phone}</span>}
                </div>
              </div>
            </div>

            {/* Subscription Status Badge */}
            <div style={{ textAlign: "left" }}>
              <span
                style={{
                  display: "inline-block",
                  background: statusColor + "22",
                  border: "1px solid " + statusColor,
                  color: statusColor,
                  padding: "0.3rem 0.8rem",
                  borderRadius: "20px",
                  fontSize: "0.8rem",
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                }}
              >
                {subInfo.label}
              </span>
              {currentStudent.subscribedUntil && (
                <div style={{ fontSize: "0.74rem", color: "#94a3b8", marginTop: "0.3rem" }}>
                  ينتهي: {formatDateAr(currentStudent.subscribedUntil)}
                </div>
              )}
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1.2rem" }}>
            <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.25)", padding: "0.75rem", borderRadius: "14px", textAlign: "center" }}>
              <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.7)" }}>إجمالي المدفوعات</div>
              <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#4ade80", marginTop: "0.2rem" }}>
                {totalPaid.toLocaleString()} ج.م
              </div>
            </div>
            <div style={{ background: "rgba(99, 102, 241, 0.1)", border: "1px solid rgba(99, 102, 241, 0.25)", padding: "0.75rem", borderRadius: "14px", textAlign: "center" }}>
              <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.7)" }}>عدد الحركات المالية</div>
              <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#818cf8", marginTop: "0.2rem" }}>
                {transactions.length}
              </div>
            </div>
            <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.25)", padding: "0.75rem", borderRadius: "14px", textAlign: "center" }}>
              <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.7)" }}>الأيام المتبقية</div>
              <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#fbbf24", marginTop: "0.2rem" }}>
                {subInfo.daysLeft === Infinity ? "∞" : subInfo.daysLeft > 0 ? `${subInfo.daysLeft} يوم` : "0"}
              </div>
            </div>
          </div>

          {/* Action Navigation Tabs */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.2rem", flexWrap: "wrap" }}>
            <button
              onClick={() => { setActiveMode("view"); setEditingTx(null); }}
              className={`button button-sm ${activeMode === "view" ? "button-primary" : "button-muted"}`}
              style={{ fontSize: "0.84rem" }}
            >
              📋 كشف الحركات المالية ({transactions.length})
            </button>
            <button
              onClick={() => { setActiveMode("add"); setEditingTx(null); }}
              className={`button button-sm ${activeMode === "add" ? "button-primary" : "button-secondary"}`}
              style={{ fontSize: "0.84rem", background: activeMode === "add" ? "#059669" : undefined }}
            >
              ➕ إضافة اشتراك / دفعة مالية
            </button>
            <button
              onClick={() => { setActiveMode("direct_expiry"); setEditingTx(null); }}
              className={`button button-sm ${activeMode === "direct_expiry" ? "button-primary" : "button-muted"}`}
              style={{ fontSize: "0.84rem" }}
            >
              🗓️ ضبط تاريخ الاشتراك مباشرة
            </button>
            {currentStudent.isSubscribed && (
              <button
                onClick={handleDeactivateSubscription}
                className="button button-sm"
                style={{ fontSize: "0.82rem", background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", color: "#f87171" }}
              >
                ⛔ إيقاف الاشتراك
              </button>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              MODE: VIEW TRANSACTIONS LIST
          ══════════════════════════════════════════════════════════════════ */}
          {activeMode === "view" && (
            <div>
              {loadingTx ? (
                <p style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>جاري تحميل كشف الحساب المالي...</p>
              ) : transactions.length === 0 ? (
                <div style={{ textAlign: "center", padding: "2.5rem 1rem", background: "rgba(255,255,255,0.02)", borderRadius: "16px", border: "1px dashed rgba(255,255,255,0.1)" }}>
                  <p style={{ fontSize: "2.5rem", margin: "0 0 0.5rem" }}>💳</p>
                  <p style={{ color: "#94a3b8", fontSize: "0.95rem", margin: 0 }}>لا توجد حركات مالية أو اشتراكات مسجلة لهذا الطالب حتى الآن.</p>
                  <button
                    onClick={() => setActiveMode("add")}
                    className="button button-sm button-primary"
                    style={{ marginTop: "1rem", fontSize: "0.85rem" }}
                  >
                    + إضافة أول اشتراك الآن
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "360px", overflowY: "auto" }}>
                  {transactions.map((tx) => {
                    let expStr = "";
                    if (tx.targetExpiryDate) {
                      expStr = formatDateAr(tx.targetExpiryDate);
                    }
                    return (
                      <div
                        key={tx.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "0.85rem 1rem",
                          background: "rgba(255, 255, 255, 0.03)",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                          borderRadius: "14px",
                          gap: "0.75rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: "220px" }}>
                          <div style={{ fontWeight: 800, color: "#fff", fontSize: "0.92rem" }}>
                            {tx.title}
                          </div>
                          <div style={{ fontSize: "0.76rem", color: "#94a3b8", marginTop: "0.25rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                            <span>{tx.paymentMethodLabel || "نقدي"}</span>
                            <span>•</span>
                            <span>{formatDateTimeAr(tx.createdAt)}</span>
                            {expStr && (
                              <>
                                <span>•</span>
                                <span style={{ color: "#38bdf8" }}>ينتهي: {expStr}</span>
                              </>
                            )}
                          </div>
                          {tx.notes && (
                            <div style={{ fontSize: "0.75rem", color: "#cbd5e1", marginTop: "0.3rem" }}>
                              📝 {tx.notes}
                            </div>
                          )}
                        </div>

                        {/* Amount & Actions */}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          <span
                            style={{
                              fontWeight: 900,
                              fontSize: "0.95rem",
                              color: "#4ade80",
                              background: "rgba(74, 222, 128, 0.12)",
                              padding: "0.3rem 0.75rem",
                              borderRadius: "20px",
                              border: "1px solid rgba(74, 222, 128, 0.25)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            + {Number(tx.amount).toLocaleString()} ج.م
                          </span>

                          {/* Edit Button */}
                          <button
                            onClick={() => openEdit(tx)}
                            title="تعديل هذه الحركة المالية"
                            style={{
                              background: "rgba(56, 189, 248, 0.15)",
                              border: "1px solid rgba(56, 189, 248, 0.3)",
                              color: "#38bdf8",
                              borderRadius: "8px",
                              padding: "0.35rem 0.55rem",
                              cursor: "pointer",
                              fontSize: "0.8rem",
                              fontWeight: 700,
                            }}
                          >
                            ✏️ تعديل
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => handleDeleteTx(tx)}
                            title="حذف هذه الحركة المالية"
                            style={{
                              background: "rgba(239, 68, 68, 0.15)",
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                              color: "#f87171",
                              borderRadius: "8px",
                              padding: "0.35rem 0.55rem",
                              cursor: "pointer",
                              fontSize: "0.8rem",
                              fontWeight: 700,
                            }}
                          >
                            🗑️ حذف
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              MODE: ADD TRANSACTION & SUBSCRIPTION
          ══════════════════════════════════════════════════════════════════ */}
          {activeMode === "add" && (
            <form onSubmit={handleSaveAdd} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ background: "rgba(5, 150, 105, 0.1)", border: "1px solid rgba(5, 150, 105, 0.25)", padding: "0.8rem 1rem", borderRadius: "14px", fontSize: "0.85rem", color: "#6ee7b7" }}>
                ➕ إضافة اشتراك جديد أو حركة مالية للطالب مع تعيين صلاحية الحساب الأكاديمي
              </div>

              {/* Title & Amount */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", color: "#94a3b8", marginBottom: "0.3rem" }}>
                    عنوان وبيان الاشتراك / الدفعة:
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={addForm.title}
                    onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                    required
                    style={{ width: "100%", padding: "0.55rem 0.8rem", fontSize: "0.88rem" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", color: "#94a3b8", marginBottom: "0.3rem" }}>
                    المبلغ المدفوع (ج.م):
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={addForm.amount}
                    onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })}
                    min="0"
                    required
                    style={{ width: "100%", padding: "0.55rem 0.8rem", fontSize: "0.88rem" }}
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", color: "#94a3b8", marginBottom: "0.3rem" }}>
                  طريقة الدفع:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.5rem" }}>
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setAddForm({ ...addForm, paymentMethod: m.id })}
                      style={{
                        padding: "0.5rem 0.7rem",
                        borderRadius: "10px",
                        border: addForm.paymentMethod === m.id ? "1.5px solid #22c55e" : "1px solid rgba(255,255,255,0.1)",
                        background: addForm.paymentMethod === m.id ? "rgba(34, 197, 94, 0.2)" : "rgba(255,255,255,0.03)",
                        color: addForm.paymentMethod === m.id ? "#4ade80" : "#e2e8f0",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration Presets */}
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", color: "#94a3b8", marginBottom: "0.3rem" }}>
                  مدة وصلاحية الاشتراك:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "0.5rem" }}>
                  {DURATION_PRESETS.map((p) => (
                    <button
                      key={p.days}
                      type="button"
                      onClick={() => {
                        setAddForm({
                          ...addForm,
                          expiryDateMode: "preset",
                          presetDays: p.days,
                          amount: p.defaultAmount,
                          title: `تفعيل اشتراك ${p.label}`,
                        });
                      }}
                      style={{
                        padding: "0.5rem",
                        borderRadius: "10px",
                        border: addForm.expiryDateMode === "preset" && addForm.presetDays === p.days ? "1.5px solid #8b5cf6" : "1px solid rgba(255,255,255,0.1)",
                        background: addForm.expiryDateMode === "preset" && addForm.presetDays === p.days ? "rgba(139, 92, 246, 0.25)" : "rgba(255,255,255,0.03)",
                        color: addForm.expiryDateMode === "preset" && addForm.presetDays === p.days ? "#c4b5fd" : "#cbd5e1",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Specific Date Option */}
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.82rem", color: "#94a3b8" }}>أو حدد تاريخ انتهاء مخصص:</span>
                <input
                  type="date"
                  className="form-input"
                  value={addForm.specificExpiryDate}
                  onChange={(e) => {
                    setAddForm({
                      ...addForm,
                      expiryDateMode: "date",
                      specificExpiryDate: e.target.value,
                    });
                  }}
                  style={{ padding: "0.45rem 0.75rem", fontSize: "0.85rem" }}
                />
              </div>

              {/* Checkbox to update student account */}
              <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", fontSize: "0.85rem", color: "#4ade80" }}>
                <input
                  type="checkbox"
                  checked={addForm.updateStudentExpiry}
                  onChange={(e) => setAddForm({ ...addForm, updateStudentExpiry: e.target.checked })}
                  style={{ width: "18px", height: "18px" }}
                />
                <span>تحديث وتفعيل صلاحية حساب الطالب مباشرة في المنصة بناءً على هذا الاشتراك</span>
              </label>

              {/* Notes */}
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", color: "#94a3b8", marginBottom: "0.3rem" }}>
                  ملاحظات أو رقم الإيصال / الحوالة:
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="مثال: استلام نقدي بالحصة / رقم تحويل فودافون كاش..."
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  style={{ width: "100%", padding: "0.55rem 0.8rem", fontSize: "0.85rem" }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setActiveMode("view")}
                  className="button button-muted"
                  style={{ fontSize: "0.85rem" }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingAction}
                  className="button button-primary"
                  style={{ fontSize: "0.85rem", background: "linear-gradient(135deg, #059669, #10b981)" }}
                >
                  {savingAction ? "جاري الحفظ والتفعيل..." : "💾 حفظ المعاملة وتفعيل الاشتراك"}
                </button>
              </div>
            </form>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              MODE: EDIT TRANSACTION & SUBSCRIPTION
          ══════════════════════════════════════════════════════════════════ */}
          {activeMode === "edit" && editingTx && (
            <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.25)", padding: "0.8rem 1rem", borderRadius: "14px", fontSize: "0.85rem", color: "#7dd3fc" }}>
                ✏️ تعديل بيانات المعاملة المالية: <strong>{editingTx.title}</strong>
              </div>

              {/* Title & Amount */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", color: "#94a3b8", marginBottom: "0.3rem" }}>
                    بيان المعاملة:
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    required
                    style={{ width: "100%", padding: "0.55rem 0.8rem", fontSize: "0.88rem" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", color: "#94a3b8", marginBottom: "0.3rem" }}>
                    المبلغ (ج.م):
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={editForm.amount}
                    onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                    min="0"
                    required
                    style={{ width: "100%", padding: "0.55rem 0.8rem", fontSize: "0.88rem" }}
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", color: "#94a3b8", marginBottom: "0.3rem" }}>
                  طريقة الدفع:
                </label>
                <select
                  className="form-input"
                  value={editForm.paymentMethod}
                  onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                  style={{ width: "100%", padding: "0.55rem 0.8rem", fontSize: "0.88rem" }}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Adjust Expiry Date */}
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", color: "#94a3b8", marginBottom: "0.3rem" }}>
                  تعديل تاريخ انتهاء الاشتراك المرتبط:
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={editForm.newExpiryDate}
                  onChange={(e) => setEditForm({ ...editForm, newExpiryDate: e.target.value })}
                  style={{ width: "100%", padding: "0.55rem 0.8rem", fontSize: "0.88rem" }}
                />
              </div>

              {editForm.newExpiryDate && (
                <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", fontSize: "0.85rem", color: "#38bdf8" }}>
                  <input
                    type="checkbox"
                    checked={editForm.updateStudentExpiry}
                    onChange={(e) => setEditForm({ ...editForm, updateStudentExpiry: e.target.checked })}
                    style={{ width: "18px", height: "18px" }}
                  />
                  <span>تحديث تاريخ انتهاء اشتراك الطالب الفعلي في المنصة ليتطابق مع هذا التعديل</span>
                </label>
              )}

              {/* Notes */}
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", color: "#94a3b8", marginBottom: "0.3rem" }}>
                  ملاحظات المعاملة:
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  style={{ width: "100%", padding: "0.55rem 0.8rem", fontSize: "0.88rem" }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => { setActiveMode("view"); setEditingTx(null); }}
                  className="button button-muted"
                  style={{ fontSize: "0.85rem" }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingAction}
                  className="button button-primary"
                  style={{ fontSize: "0.85rem" }}
                >
                  {savingAction ? "جاري التحديث..." : "💾 حفظ التعديلات"}
                </button>
              </div>
            </form>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              MODE: DIRECT EXPIRY ADJUSTMENT
          ══════════════════════════════════════════════════════════════════ */}
          {activeMode === "direct_expiry" && (
            <form onSubmit={handleSaveDirectExpiry} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ background: "rgba(139, 92, 246, 0.1)", border: "1px solid rgba(139, 92, 246, 0.25)", padding: "0.8rem 1rem", borderRadius: "14px", fontSize: "0.85rem", color: "#c4b5fd" }}>
                🗓️ تعديل أو تمديد صلاحية اشتراك الطالب يدوياً بدون تسجيل حركة مالية (منحة، تمديد إداري، تعويض)
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#94a3b8", marginBottom: "0.4rem" }}>
                  تاريخ الانتهاء الجديد:
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={directDate}
                  onChange={(e) => setDirectDate(e.target.value)}
                  required
                  style={{ width: "100%", padding: "0.6rem 0.85rem", fontSize: "0.95rem" }}
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setActiveMode("view")}
                  className="button button-muted"
                  style={{ fontSize: "0.85rem" }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingAction}
                  className="button button-primary"
                  style={{ fontSize: "0.85rem", background: "linear-gradient(135deg, #7c3aed, #6366f1)" }}
                >
                  {savingAction ? "جاري التحديث..." : "💾 تحديث تاريخ الصلاحية مباشرة"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Pinned Footer */}
        <div
          style={{
            padding: "1rem 1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(15, 23, 42, 0.6)",
          }}
        >
          <div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
            إجمالي المدفوعات المسجلة: <strong style={{ color: "#4ade80" }}>{totalPaid.toLocaleString()} ج.م</strong>
          </div>
          <button
            onClick={onClose}
            className="button button-muted"
            style={{ fontSize: "0.85rem", padding: "0.45rem 1.1rem" }}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
