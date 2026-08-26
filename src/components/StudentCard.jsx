// src/components/StudentCard.jsx
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Card from "./Card";
import Avatar from "./Avatar";
import { db } from "../firebase";
import { doc, updateDoc, getDoc, Timestamp, serverTimestamp, addDoc, collection, query, where, getDocs, deleteDoc } from "firebase/firestore";

const GRADES = [
  "الصف الأول الابتدائي", "الصف الثاني الابتدائي", "الصف الثالث الابتدائي",
  "الصف الرابع الابتدائي", "الصف الخامس الابتدائي", "الصف السادس الابتدائي",
  "الصف الأول الإعدادي", "الصف الثاني الإعدادي", "الصف الثالث الإعدادي",
  "الصف الأول الثانوي", "الصف الثاني الثانوي", "الصف الثالث الثانوي",
];

const generateAcademicYears = () => {
  const startYear = new Date().getFullYear();
  const years = [];
  for (let i = 0; i < 12; i++) { // generate 12 years (current + next 11)
    const start = startYear + i;
    const end = start + 1;
    years.push(`${start}-${end}`);
  }
  return years;
};

const ACADEMIC_YEARS = generateAcademicYears();

const GROUPS = [
  "المجموعة A", "المجموعة B", "المجموعة C", "المجموعة D",
  "مجموعة الصباح", "مجموعة المساء",
  "مجموعة خاصة 1", "مجموعة خاصة 2",
];

const DURATION_PRESETS = [
  { label: "شهر واحد (30 يوم)", days: 30 },
  { label: "3 أشهر (90 يوم)", days: 90 },
  { label: "6 أشهر (180 يوم)", days: 180 },
  { label: "سنة دراسية (365 يوم)", days: 365 },
];

export function getSubscriptionInfo(student) {
  if (!student?.isSubscribed) {
    return { status: "inactive", badgeClass: "inactive", label: "🔴 غير مفعل", daysLeft: 0 };
  }

  let endDate = null;
  if (student.subscribedUntil) {
    if (typeof student.subscribedUntil.toDate === "function") {
      endDate = student.subscribedUntil.toDate();
    } else {
      endDate = new Date(student.subscribedUntil);
    }
  }

  if (!endDate || isNaN(endDate.getTime())) {
    return { status: "active", badgeClass: "active", label: "🟢 مفعل (دائم)", daysLeft: Infinity };
  }

  const now = new Date();
  const diffMs = endDate.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const formattedDate = endDate.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  if (daysLeft <= 0) {
    return {
      status: "expired",
      badgeClass: "inactive",
      label: `🔴 منتهي الاشتراك (${formattedDate})`,
      daysLeft,
      formattedDate,
    };
  } else if (daysLeft <= 7) {
    return {
      status: "expiring_soon",
      badgeClass: "warning",
      label: `⚠️ ينتهي قريباً (متبقي ${daysLeft} أيام)`,
      daysLeft,
      formattedDate,
    };
  } else {
    return {
      status: "active",
      badgeClass: "active",
      label: `🟢 مفعل (متبقي ${daysLeft} يوم)`,
      daysLeft,
      formattedDate,
    };
  }
}

export function hasActiveSubscription(student) {
  if (!student) return false;
  if (student.role === "teacher") return true; // Teacher always active
  const info = getSubscriptionInfo(student);
  return info.status === "active" || info.status === "expiring_soon";
}

export default function StudentCard({ student, onUpdateSuccess, onDeleteSuccess, viewMode = "card" }) {
  const { id, fullName, email, phone, grade, photoURL, isSubscribed } = student;
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [fetchingEdit, setFetchingEdit] = useState(false);

  // Permanent Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [confirmDeleteCheck, setConfirmDeleteCheck] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: student.fullName || "",
    email: student.email || "",
    phone: student.phone || "",
    passcode: student.passcode || student.studentPasscode || "",
    newPasscode: "",
    confirmPasscode: "",
    grade: student.grade || "",
    academicYear: ACADEMIC_YEARS.includes(student.academicYear) ? student.academicYear : "",
    customAcademicYear: student.academicYear && !ACADEMIC_YEARS.includes(student.academicYear) ? student.academicYear : "",
    group: student.group || "",
    customGroup: student.group && !GROUPS.includes(student.group) ? student.group : "",
  });
  const [isCustomYear, setIsCustomYear] = useState(
    student.academicYear ? !ACADEMIC_YEARS.includes(student.academicYear) : false
  );
  const [isCustomGroup, setIsCustomGroup] = useState(
    student.group ? !GROUPS.includes(student.group) : false
  );
  
  // Selection mode: 'preset' | 'date' | 'custom'
  const [mode, setMode] = useState("preset");
  const [selectedDays, setSelectedDays] = useState(30);
  const [customDays, setCustomDays] = useState("");
  const [specificDate, setSpecificDate] = useState("");

  // Financial info state for activation
  const [paidAmount, setPaidAmount] = useState(150);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Student Ledger Modal State
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [ledgerTransactions, setLedgerTransactions] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const subInfo = getSubscriptionInfo(student);

  // Auto set preset price recommendation based on selected days
  useEffect(() => {
    if (mode === "preset") {
      if (selectedDays === 30) setPaidAmount(150);
      else if (selectedDays === 90) setPaidAmount(400);
      else if (selectedDays === 180) setPaidAmount(700);
      else if (selectedDays === 365) setPaidAmount(1200);
    }
  }, [selectedDays, mode]);

  // Compute calculated target expiry date
  let targetExpiryDate = new Date();
  if (mode === "preset") {
    targetExpiryDate = new Date(Date.now() + selectedDays * 24 * 60 * 60 * 1000);
  } else if (mode === "custom") {
    const daysNum = Number(customDays) || 0;
    targetExpiryDate = new Date(Date.now() + daysNum * 24 * 60 * 60 * 1000);
  } else if (mode === "date") {
    if (specificDate) {
      targetExpiryDate = new Date(`${specificDate}T23:59:59`);
    }
  }

  const isValidDate = !isNaN(targetExpiryDate.getTime()) && targetExpiryDate.getTime() > Date.now();

  const formattedTargetDate = isValidDate
    ? targetExpiryDate.toLocaleDateString("ar-EG", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  const handleActivateWithDuration = async () => {
    if (!isValidDate) {
      alert("يرجى اختيار تاريخ أو مدة صالحة تزيد عن الوقت الحالي.");
      return;
    }

    const amountNum = Number(paidAmount) || 0;

    setLoading(true);
    try {
      const expiryTimestamp = Timestamp.fromDate(targetExpiryDate);
      await updateDoc(doc(db, "users", id), {
        isSubscribed: true,
        subscribedUntil: expiryTimestamp,
        subscriptionActivatedAt: serverTimestamp(),
      });

      // Record Financial Transaction in Firestore
      if (amountNum > 0) {
        const methodLabels = {
          cash: "💵 نقدي (كاش)",
          vodafone_cash: "📱 فودافون كاش",
          bank_transfer: "🏦 تحويل بنكي",
        };

        await addDoc(collection(db, "financial_transactions"), {
          title: `رسوم تفعيل اشتراك - ${student.fullName}`,
          amount: amountNum,
          type: "subscription",
          category: "income",
          paymentMethod: paymentMethod,
          paymentMethodLabel: methodLabels[paymentMethod] || "نقدي",
          studentId: id,
          studentName: student.fullName,
          studentGrade: student.grade || "",
          notes: paymentNotes.trim() || `تفعيل اشتراك حتى ${formattedTargetDate}`,
          createdAt: serverTimestamp(),
        });
      }

      setShowModal(false);
      if (onUpdateSuccess) onUpdateSuccess(id, true);
    } catch (err) {
      console.error("Error activating subscription:", err);
      alert("حدث خطأ أثناء تفعيل الاشتراك والعملية المالية");
    } finally {
      setLoading(false);
    }
  };

  const openStudentLedger = async () => {
    setShowLedgerModal(true);
    setLoadingLedger(true);
    try {
      const q = query(collection(db, "financial_transactions"), where("studentId", "==", id));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const tA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const tB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return tB - tA;
      });
      setLedgerTransactions(list);
    } catch (e) {
      console.error("Error fetching student ledger:", e);
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleDeactivate = async () => {
    if (!window.confirm(`هل أنت تأكد من إلغاء تفعيل اشتراك الطالب "${fullName}"؟`)) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "users", id), {
        isSubscribed: false,
        subscribedUntil: null,
        subscriptionDeactivatedAt: serverTimestamp(),
      });
      if (onUpdateSuccess) onUpdateSuccess(id, false);
    } catch (err) {
      console.error("Error deactivating subscription:", err);
      alert("حدث خطأ أثناء إلغاء الاشتراك");
    } finally {
      setLoading(false);
    }
  };

  const handlePermanentDeleteStudent = async () => {
    if (!confirmDeleteCheck) {
      alert("يرجى التأكيد عبر تحديد مربع الإقرار بالموافقة على الحذف النهائي.");
      return;
    }

    setDeleteLoading(true);
    try {
      const studentId = id;

      // 1. Fetch related quiz submissions
      const qSubs1 = query(collection(db, "quiz_submissions"), where("studentUid", "==", studentId));
      const qSubs2 = query(collection(db, "quiz_submissions"), where("studentId", "==", studentId));

      // 2. Fetch related student activities
      const qAct1 = query(collection(db, "student_activities"), where("studentUid", "==", studentId));
      const qAct2 = query(collection(db, "student_activities"), where("studentId", "==", studentId));

      // 3. Fetch financial transactions
      const qFin = query(collection(db, "financial_transactions"), where("studentId", "==", studentId));

      // 4. Fetch support tickets
      const qTix1 = query(collection(db, "support_tickets"), where("studentId", "==", studentId));
      const qTix2 = query(collection(db, "support_tickets"), where("userId", "==", studentId));

      const [
        snapSubs1,
        snapSubs2,
        snapAct1,
        snapAct2,
        snapFin,
        snapTix1,
        snapTix2,
      ] = await Promise.all([
        getDocs(qSubs1).catch(() => ({ docs: [] })),
        getDocs(qSubs2).catch(() => ({ docs: [] })),
        getDocs(qAct1).catch(() => ({ docs: [] })),
        getDocs(qAct2).catch(() => ({ docs: [] })),
        getDocs(qFin).catch(() => ({ docs: [] })),
        getDocs(qTix1).catch(() => ({ docs: [] })),
        getDocs(qTix2).catch(() => ({ docs: [] })),
      ]);

      const subDocIds = new Set([...snapSubs1.docs.map((d) => d.id), ...snapSubs2.docs.map((d) => d.id)]);
      const actDocIds = new Set([...snapAct1.docs.map((d) => d.id), ...snapAct2.docs.map((d) => d.id)]);
      const tixDocIds = new Set([...snapTix1.docs.map((d) => d.id), ...snapTix2.docs.map((d) => d.id)]);

      const deleteTasks = [];

      // Delete sub-collections & related records
      subDocIds.forEach((docId) => {
        deleteTasks.push(deleteDoc(doc(db, "quiz_submissions", docId)));
      });
      actDocIds.forEach((docId) => {
        deleteTasks.push(deleteDoc(doc(db, "student_activities", docId)));
      });
      snapFin.docs.forEach((d) => {
        deleteTasks.push(deleteDoc(doc(db, "financial_transactions", d.id)));
      });
      tixDocIds.forEach((docId) => {
        deleteTasks.push(deleteDoc(doc(db, "support_tickets", docId)));
      });

      // Delete main user profile document from users collection
      deleteTasks.push(deleteDoc(doc(db, "users", studentId)));

      await Promise.all(deleteTasks);

      setShowDeleteModal(false);
      setConfirmDeleteCheck(false);
      if (onDeleteSuccess) {
        onDeleteSuccess(studentId);
      }
    } catch (err) {
      console.error("Error permanently deleting student:", err);
      alert("حدث خطأ أثناء محاولة حذف الطالب وقاعدة بياناته: " + (err.message || err));
    } finally {
      setDeleteLoading(false);
    }
  };

  const openEditModal = async () => {
    setFetchingEdit(true);
    setShowEditModal(true);
    try {
      // Always fetch fresh data from Firestore to get up-to-date passcode
      const freshDoc = await getDoc(doc(db, "users", id));
      const freshData = freshDoc.exists() ? freshDoc.data() : {};
      const freshPasscode = freshData.passcode || freshData.studentPasscode || freshData.password || student.passcode || student.studentPasscode || student.password || "";

      const academicYear = freshData.academicYear || student.academicYear || "";
      const group = freshData.group || student.group || "";
      const yearIsCustom = academicYear ? !ACADEMIC_YEARS.includes(academicYear) : false;
      const groupIsCustom = group ? !GROUPS.includes(group) : false;

      setEditForm({
        fullName: freshData.fullName || student.fullName || "",
        email: freshData.email || student.email || "",
        phone: freshData.phone || student.phone || "",
        passcode: freshPasscode,
        newPasscode: "",
        confirmPasscode: "",
        grade: freshData.grade || student.grade || "",
        academicYear: !yearIsCustom ? (academicYear || "") : "",
        customAcademicYear: yearIsCustom ? academicYear : "",
        group: !groupIsCustom ? (group || "") : "",
        customGroup: groupIsCustom ? group : "",
      });
      setIsCustomYear(yearIsCustom);
      setIsCustomGroup(groupIsCustom);
    } catch (err) {
      console.error("Error fetching fresh student data:", err);
    } finally {
      setFetchingEdit(false);
    }
  };

  const handleSaveStudentInfo = async () => {
    const finalYear = isCustomYear ? editForm.customAcademicYear.trim() : editForm.academicYear;
    const finalGroup = isCustomGroup ? editForm.customGroup.trim() : editForm.group;
    if (!editForm.fullName?.trim()) {
      alert("يرجى كتابة اسم الطالب.");
      return;
    }
    if (!editForm.grade) {
      alert("يرجى اختيار الصف الدراسي.");
      return;
    }

    const finalPasscode = editForm.passcode.trim();

    setEditSaving(true);
    try {
      await updateDoc(doc(db, "users", id), {
        fullName: editForm.fullName.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
        passcode: finalPasscode,
        studentPasscode: finalPasscode,
        password: finalPasscode,
        grade: editForm.grade,
        academicYear: finalYear || null,
        group: finalGroup || null,
        updatedAt: serverTimestamp(),
      });
      alert("تم حفظ وتحديث بيانات الطالب والرقم السري بنجاح! 💾✨");
      setShowEditModal(false);
      if (onUpdateSuccess) onUpdateSuccess(id, student.isSubscribed);
    } catch (err) {
      console.error("Error updating student info:", err);
      alert("حدث خطأ أثناء حفظ البيانات");
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <>
      {viewMode === "table-row" ? (
        <tr style={{ borderBottom: "1px solid rgba(226, 232, 240, 0.7)", background: "#ffffff" }}>
          <td style={{ padding: "0.75rem 1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Avatar src={photoURL || "/logo-circle.png"} alt={fullName} size={40} />
              <div>
                <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "0.95rem" }}>{fullName}</div>
                <div style={{ fontSize: "0.78rem", color: "#64748b", display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.15rem" }}>
                  <span>✉️ {email}</span>
                  {phone && <span>📱 {phone}</span>}
                  {(student.passcode || student.studentPasscode || student.password) && (
                    <span style={{ color: "#d97706", fontWeight: "700" }}>🔑 {student.passcode || student.studentPasscode || student.password}</span>
                  )}
                </div>
              </div>
            </div>
          </td>
          <td style={{ padding: "0.75rem 1rem" }}>
            <div style={{ fontWeight: "800", color: "#0284c7", fontSize: "0.88rem" }}>{grade || "غير محدد"}</div>
            <div style={{ fontSize: "0.78rem", color: "#64748b", display: "flex", gap: "0.4rem", marginTop: "0.15rem" }}>
              {student.academicYear && <span>📅 {student.academicYear}</span>}
              {student.group && <span>👥 {student.group}</span>}
            </div>
          </td>
          <td style={{ padding: "0.75rem 1rem" }}>
            <span className={`subscription-badge ${subInfo.badgeClass}`}>
              {subInfo.label}
            </span>
            {subInfo.formattedDate && subInfo.status !== "expired" && (
              <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>
                🗓️ {subInfo.formattedDate}
              </div>
            )}
          </td>
          <td style={{ padding: "0.75rem 1rem" }}>
            <div style={{ display: "flex", gap: "0.35rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                onClick={() => setShowModal(true)}
                disabled={loading}
                className="button button-sm button-primary"
                style={{ fontSize: "0.8rem", padding: "0.35rem 0.65rem" }}
              >
                {subInfo.status === "active" || subInfo.status === "expiring_soon" ? "⚙️ تمديد" : "⚡ تفعيل"}
              </button>
              <button
                onClick={openEditModal}
                disabled={loading}
                className="button button-sm button-muted"
                style={{ fontSize: "0.8rem", padding: "0.35rem 0.65rem" }}
              >
                ✏️ تعديل
              </button>
              {isSubscribed && (
                <button
                  onClick={handleDeactivate}
                  disabled={loading}
                  className="button button-sm button-muted"
                  style={{ fontSize: "0.78rem", color: "var(--color-error)", padding: "0.35rem 0.5rem" }}
                >
                  🚫 إلغاء
                </button>
              )}
              <button
                onClick={openStudentLedger}
                className="button button-sm button-muted"
                style={{ fontSize: "0.78rem", padding: "0.35rem 0.5rem", color: "#059669" }}
              >
                📜 سجل مالي
              </button>
              <button
                onClick={() => { setConfirmDeleteCheck(false); setShowDeleteModal(true); }}
                disabled={loading || deleteLoading}
                className="button button-sm button-muted"
                style={{
                  fontSize: "0.78rem",
                  padding: "0.35rem 0.55rem",
                  color: "#ef4444",
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  transition: "all 0.2s ease",
                }}
                title="حذف الطالب نهائياً من قاعدة البيانات"
              >
                🗑️ حذف نهائي
              </button>
            </div>
          </td>
        </tr>
      ) : (
        <Card className="student-card-modern glass">
          <div className="student-card-header">
            <Avatar src={photoURL || "/logo-circle.png"} alt={fullName} size={48} />
            <div className="student-info">
              <h3 className="student-name">{fullName}</h3>
              <p className="student-grade">🎓 {student.grade || "الصف غير محدد"}</p>
              <p className="student-contact">✉️ {email}</p>
              {phone && <p className="student-contact">📱 {phone}</p>}
            </div>
          </div>

          {/* Academic Info Tags */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.5rem" }}>
            {(student.passcode || student.studentPasscode || student.password) && (
              <span style={{
                background: "rgba(245, 158, 11, 0.15)",
                color: "#d97706",
                fontSize: "0.75rem",
                padding: "0.18rem 0.55rem",
                borderRadius: "20px",
                fontWeight: "700",
                border: "1px solid rgba(245,158,11,0.3)"
              }}>🔑 الرقم السري: {student.passcode || student.studentPasscode || student.password}</span>
            )}
            {student.academicYear && (
              <span style={{
                background: "rgba(99, 102, 241, 0.15)",
                color: "#6366f1",
                fontSize: "0.75rem",
                padding: "0.18rem 0.55rem",
                borderRadius: "20px",
                fontWeight: "600",
                border: "1px solid rgba(99,102,241,0.25)"
              }}>📅 {student.academicYear}</span>
            )}
            {student.group && (
              <span style={{
                background: "rgba(16, 185, 129, 0.15)",
                color: "#059669",
                fontSize: "0.75rem",
                padding: "0.18rem 0.55rem",
                borderRadius: "20px",
                fontWeight: "600",
                border: "1px solid rgba(16,185,129,0.25)"
              }}>👥 {student.group}</span>
            )}
          </div>

          {/* Subscription Info Badge */}
          <div style={{ marginTop: "0.5rem" }}>
            <div className={`subscription-badge ${subInfo.badgeClass}`}>
              {subInfo.label}
            </div>
            {subInfo.formattedDate && subInfo.status !== "expired" && (
              <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.78rem", color: "var(--color-muted)" }}>
                🗓️ ينتهي في: {subInfo.formattedDate}
              </p>
            )}
          </div>

          {/* Footer Actions */}
          <div className="student-card-footer" style={{ flexWrap: "wrap", gap: "0.35rem" }}>
            <button
              onClick={() => setShowModal(true)}
              disabled={loading}
              className="button button-sm button-primary"
              style={{ fontSize: "0.8rem", padding: "0.35rem 0.65rem" }}
            >
              {subInfo.status === "active" || subInfo.status === "expiring_soon"
                ? "⚙️ تمديد"
                : "⚡ تفعيل"}
            </button>

            <button
              onClick={openEditModal}
              disabled={loading}
              className="button button-sm button-muted"
              style={{ fontSize: "0.8rem", padding: "0.35rem 0.65rem", color: "#6366f1" }}
            >
              ✏️ تعديل
            </button>

            <button
              onClick={openStudentLedger}
              className="button button-sm button-muted"
              style={{ fontSize: "0.78rem", padding: "0.35rem 0.5rem", color: "#059669" }}
            >
              📜 السجل المالي
            </button>

            {isSubscribed && (
              <button
                onClick={handleDeactivate}
                disabled={loading}
                className="button button-sm button-muted"
                style={{ fontSize: "0.78rem", color: "var(--color-error)", padding: "0.35rem 0.5rem" }}
              >
                🚫 إلغاء
              </button>
            )}

            <button
              onClick={() => { setConfirmDeleteCheck(false); setShowDeleteModal(true); }}
              disabled={loading || deleteLoading}
              className="button button-sm button-muted"
              style={{
                fontSize: "0.78rem",
                padding: "0.35rem 0.55rem",
                color: "#ef4444",
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                transition: "all 0.2s ease",
              }}
              title="حذف الطالب نهائياً من قاعدة البيانات"
            >
              🗑️ حذف نهائي
            </button>
          </div>
        </Card>
      )}

      {/* Expiry Date Selection Modal (Extension / Activation) */}
      {showModal && createPortal(
        <div
          className="modal-overlay-fix fade-in"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div
            className="modal-card-fix"
            style={{
              background: "linear-gradient(135deg, #1e1b4b 0%, #1e293b 100%)",
              maxWidth: "540px",
              border: "1px solid rgba(14, 165, 233, 0.45)",
              color: "#e2e8f0"
            }}
          >
            {/* Pinned Header */}
            <div className="modal-header-pinned" style={{ background: "linear-gradient(90deg, #0284c7, #0369a1)" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#fff" }}>
                  ⚡ تمديد وتفعيل اشتراك الطالب
                </h3>
                <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.82rem", color: "rgba(255,255,255,0.85)" }}>
                  {fullName} ({grade || "الصف غير محدد"})
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                title="إغلاق النافذة"
                style={{
                  background: "rgba(255,255,255,0.2)",
                  border: "none",
                  color: "#fff",
                  width: 34, height: 34,
                  borderRadius: "50%",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.2s"
                }}
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="modal-body-scroll">
              <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1.2rem" }}>
                <button
                  type="button"
                  onClick={() => setMode("preset")}
                  className={`button button-sm ${mode === "preset" ? "button-primary" : "button-muted"}`}
                  style={{ flex: 1, fontSize: "0.82rem", padding: "0.5rem" }}
                >
                  مدد تجهيزية
                </button>
                <button
                  type="button"
                  onClick={() => setMode("date")}
                  className={`button button-sm ${mode === "date" ? "button-primary" : "button-muted"}`}
                  style={{ flex: 1, fontSize: "0.82rem", padding: "0.5rem" }}
                >
                  📆 تاريخ محدد
                </button>
                <button
                  type="button"
                  onClick={() => setMode("custom")}
                  className={`button button-sm ${mode === "custom" ? "button-primary" : "button-muted"}`}
                  style={{ flex: 1, fontSize: "0.82rem", padding: "0.5rem" }}
                >
                  ✏️ أيام مخصصة
                </button>
              </div>

              {mode === "preset" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "1.25rem" }}>
                  {DURATION_PRESETS.map((preset) => (
                    <button
                      key={preset.days}
                      type="button"
                      onClick={() => setSelectedDays(preset.days)}
                      className={`button button-sm ${selectedDays === preset.days ? "button-primary" : "button-muted"}`}
                      style={{ fontSize: "0.85rem", padding: "0.65rem" }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}

              {mode === "date" && (
                <div style={{ marginBottom: "1.25rem" }}>
                  <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.85rem", fontWeight: "700", color: "#c4b5fd" }}>
                    اختر تاريخ انتهاء التفعيل من التقويم:
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    min={new Date().toISOString().split("T")[0]}
                    value={specificDate}
                    onChange={(e) => setSpecificDate(e.target.value)}
                    style={{ width: "100%", padding: "0.6rem 0.8rem", fontSize: "0.95rem", background: "#0f172a", color: "#ffffff" }}
                  />
                </div>
              )}

              {mode === "custom" && (
                <div style={{ marginBottom: "1.25rem" }}>
                  <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.85rem", fontWeight: "700", color: "#c4b5fd" }}>
                    أدخل عدد أيام الاشتراك المطلوبة:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    className="form-input"
                    placeholder="مثال: 45 يوم..."
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                    style={{ width: "100%", padding: "0.6rem 0.8rem", fontSize: "0.95rem", background: "#0f172a", color: "#ffffff" }}
                    autoFocus
                  />
                </div>
              )}

              <div style={{
                background: "rgba(14, 165, 233, 0.12)",
                border: "1px solid rgba(14, 165, 233, 0.3)",
                padding: "0.85rem 1rem",
                borderRadius: "14px",
                marginBottom: "1.25rem"
              }}>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#94a3b8" }}>
                  🗓️ <strong>تاريخ انتهاء الاشتراك الجديد المحدد:</strong>
                </p>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "1rem", fontWeight: "800", color: "#38bdf8" }}>
                  {isValidDate ? formattedTargetDate : "⚠️ يرجى تحديد تاريخ صالحة للااشتراك"}
                </p>
              </div>

              <div style={{
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                padding: "1rem",
                borderRadius: "16px",
                marginBottom: "1rem"
              }}>
                <p style={{ margin: "0 0 0.75rem 0", fontWeight: "800", color: "#4ade80", fontSize: "0.9rem" }}>💰 تفاصيل الدفع والتحصيل المالي</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "700", marginBottom: "0.3rem", color: "#c4b5fd" }}>المبلغ المدفوع (ج.م)</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      style={{ padding: "0.5rem 0.65rem", fontSize: "0.9rem", width: "100%", background: "#0f172a", color: "#ffffff" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "700", marginBottom: "0.3rem", color: "#c4b5fd" }}>طريقة الدفع</label>
                    <select
                      className="form-input"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      style={{ padding: "0.5rem 0.65rem", fontSize: "0.85rem", width: "100%", background: "#0f172a", color: "#ffffff" }}
                    >
                      <option value="cash" style={{ background: "#0f172a", color: "#fff" }}>💵 نقدي (كاش)</option>
                      <option value="vodafone_cash" style={{ background: "#0f172a", color: "#fff" }}>📱 فودافون كاش</option>
                      <option value="bank_transfer" style={{ background: "#0f172a", color: "#fff" }}>🏦 تحويل بنكي</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginTop: "0.6rem" }}>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "700", marginBottom: "0.3rem", color: "#c4b5fd" }}>ملاحظات إضافية (اختياري)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="رقم المحفظة، اسم المحوّل..."
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    style={{ padding: "0.5rem 0.65rem", fontSize: "0.85rem", width: "100%", background: "#0f172a", color: "#ffffff" }}
                  />
                </div>
                <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.78rem", color: "#94a3b8" }}>سيتم تسجيل هذه الحركة المالية تلقائياً في سجل مدفوعات الطالب والحسابات المالية.</p>
              </div>
            </div>

            {/* Pinned Footer - ALWAYS VISIBLE */}
            <div className="modal-footer-pinned">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                disabled={loading}
                style={{
                  padding: "0.65rem 1.25rem",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  borderRadius: "30px",
                  background: "rgba(255, 255, 255, 0.1)",
                  color: "#f1f5f9",
                  border: "1.5px solid rgba(255, 255, 255, 0.2)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem"
                }}
              >
                ↩️ إلغاء والعودة
              </button>
              <button
                type="button"
                onClick={handleActivateWithDuration}
                className="button button-primary"
                disabled={loading || !isValidDate}
                style={{
                  padding: "0.65rem 1.5rem",
                  fontSize: "0.9rem",
                  fontWeight: 800,
                  borderRadius: "30px",
                  background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                  color: "#ffffff",
                  border: "none",
                  boxShadow: "0 4px 18px rgba(2, 132, 199, 0.45)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem"
                }}
              >
                {loading ? "⏳ جاري التفعيل..." : "⚡ تأكيد تفعيل/تمديد الاشتراك"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Student Info Modal */}
      {showEditModal && createPortal(
        <div
          className="modal-overlay-fix fade-in"
          onClick={(e) => e.target === e.currentTarget && setShowEditModal(false)}
        >
          <div
            className="modal-card-fix"
            style={{
              background: "linear-gradient(135deg, #1e1b4b 0%, #1e293b 100%)",
              maxWidth: "560px",
              border: "1px solid rgba(99, 102, 241, 0.45)",
              color: "#e2e8f0"
            }}
          >
            {/* Pinned Header */}
            <div className="modal-header-pinned" style={{ background: "linear-gradient(90deg, #6366f1, #4f46e5)" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#fff" }}>
                  ✏️ تعديل بيانات الحساب والأكاديميا للطالب
                </h3>
                <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.82rem", color: "rgba(255,255,255,0.85)" }}>
                  {fullName}
                </p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                title="إغلاق النافذة"
                style={{
                  background: "rgba(255,255,255,0.2)",
                  border: "none",
                  color: "#fff",
                  width: 34, height: 34,
                  borderRadius: "50%",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.2s"
                }}
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="modal-body-scroll">
              {fetchingEdit && (
                <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
                  <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>⏳</div>
                  <p style={{ fontSize: "0.9rem", fontWeight: 700, color: "#c4b5fd" }}>جاري تحميل بيانات الطالب من قاعدة البيانات...</p>
                </div>
              )}

              {!fetchingEdit && (
              <>
              <div style={{ marginBottom: "1.1rem" }}>
                <label style={{ display: "block", fontWeight: "700", marginBottom: "0.4rem", fontSize: "0.875rem", color: "#c4b5fd" }}>
                  👤 اسم الطالب الكامل *
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.fullName}
                  onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))}
                  style={{ width: "100%", padding: "0.6rem 0.8rem", fontSize: "0.9rem", background: "#0f172a", color: "#ffffff" }}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem", marginBottom: "1.1rem" }}>
                <div>
                  <label style={{ display: "block", fontWeight: "700", marginBottom: "0.4rem", fontSize: "0.85rem", color: "#c4b5fd" }}>
                    ✉️ البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    className="form-input"
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                    style={{ width: "100%", padding: "0.55rem 0.75rem", fontSize: "0.85rem", background: "#0f172a", color: "#ffffff" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: "700", marginBottom: "0.4rem", fontSize: "0.85rem", color: "#c4b5fd" }}>
                    📱 رقم الهاتف
                  </label>
                  <input
                    type="tel"
                    className="form-input"
                    value={editForm.phone}
                    onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                    style={{ width: "100%", padding: "0.55rem 0.75rem", fontSize: "0.85rem", background: "#0f172a", color: "#ffffff" }}
                  />
                </div>
              </div>

              <div
                style={{
                  marginBottom: "1.1rem",
                  background: "rgba(245,158,11,0.08)",
                  border: "1.5px solid rgba(245,158,11,0.35)",
                  padding: "1rem",
                  borderRadius: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.8rem",
                }}
              >
                <div style={{ fontWeight: "800", fontSize: "0.9rem", color: "#fbbf24", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>🔑 الرقم السري / كلمة المرور للطالب</span>
                  <span style={{ fontSize: "0.72rem", color: "#4ade80", fontWeight: 700, background: "rgba(74,222,128,0.15)", padding: "0.15rem 0.55rem", borderRadius: "10px" }}>✅ مقروء من قاعدة البيانات</span>
                </div>

                <div>
                  <label style={{ display: "block", fontWeight: "700", marginBottom: "0.35rem", fontSize: "0.85rem", color: "#fde68a" }}>
                    الرقم السري الحالي (يظهر الرقم القديم ويمكنك تعديله مباشرة هنا):
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.passcode}
                    onChange={(e) => setEditForm((f) => ({ ...f, passcode: e.target.value }))}
                    placeholder="أدخل الرقم السري للطالب..."
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.85rem",
                      fontSize: "1rem",
                      fontWeight: 700,
                      background: "#0f172a",
                      border: "1.5px solid rgba(245, 158, 11, 0.45)",
                      borderRadius: "10px",
                      color: "#fde68a",
                      letterSpacing: "1px",
                      direction: "ltr",
                    }}
                  />
                </div>

                <div style={{ fontSize: "0.78rem", color: "#38bdf8", fontWeight: 700 }}>
                  🌐 التغيير على الرقم السري أو البيانات يُحفظ فورياً في Firestore وتعتبر كلمة المرور المحفوظة هي المعتمدة لتسجيل دخول الطالب.
                </div>
              </div>

              <div style={{ marginBottom: "1.1rem" }}>
                <label style={{ display: "block", fontWeight: "700", marginBottom: "0.4rem", fontSize: "0.875rem", color: "#c4b5fd" }}>
                  🎓 الصف الدراسي *
                </label>
                <select
                  className="form-input"
                  value={editForm.grade}
                  onChange={(e) => setEditForm((f) => ({ ...f, grade: e.target.value }))}
                  style={{ width: "100%", padding: "0.6rem 0.8rem", fontSize: "0.9rem", background: "#0f172a", color: "#fff" }}
                >
                  <option value="" style={{ background: "#0f172a", color: "#fff" }}>-- اختر الصف --</option>
                  {GRADES.map((g) => (
                    <option key={g} value={g} style={{ background: "#0f172a", color: "#fff" }}>{g}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: "1.1rem" }}>
                <label style={{ display: "block", fontWeight: "700", marginBottom: "0.4rem", fontSize: "0.875rem", color: "#c4b5fd" }}>
                  📅 العام الدراسي
                </label>
                {!isCustomYear ? (
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <select
                      className="form-input"
                      value={editForm.academicYear}
                      onChange={(e) => setEditForm((f) => ({ ...f, academicYear: e.target.value }))}
                      style={{ flex: 1, padding: "0.6rem 0.8rem", fontSize: "0.9rem", background: "#0f172a", color: "#fff" }}
                    >
                      <option value="" style={{ background: "#0f172a", color: "#fff" }}>-- اختر العام الدراسي --</option>
                      {ACADEMIC_YEARS.map((y) => (
                        <option key={y} value={y} style={{ background: "#0f172a", color: "#fff" }}>{y}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsCustomYear(true)}
                      className="button button-sm button-muted"
                      style={{ whiteSpace: "nowrap", fontSize: "0.78rem" }}
                      title="تخصيص عام دراسي جديد"
                    >
                      + مخصص
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="اكتب العام الدراسي (مثال: 2028-2029)..."
                      value={editForm.customAcademicYear}
                      onChange={(e) => setEditForm((f) => ({ ...f, customAcademicYear: e.target.value }))}
                      style={{ flex: 1, padding: "0.6rem 0.8rem", fontSize: "0.9rem", background: "#0f172a", color: "#ffffff" }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => { setIsCustomYear(false); setEditForm((f) => ({ ...f, customAcademicYear: "" })); }}
                      className="button button-sm button-muted"
                      style={{ whiteSpace: "nowrap", fontSize: "0.78rem" }}
                    >
                      من القائمة
                    </button>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", fontWeight: "700", marginBottom: "0.4rem", fontSize: "0.875rem", color: "#c4b5fd" }}>
                  👥 المجموعة
                </label>
                {!isCustomGroup ? (
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <select
                      className="form-input"
                      value={editForm.group}
                      onChange={(e) => setEditForm((f) => ({ ...f, group: e.target.value }))}
                      style={{ flex: 1, padding: "0.6rem 0.8rem", fontSize: "0.9rem", background: "#0f172a", color: "#fff" }}
                    >
                      <option value="" style={{ background: "#0f172a", color: "#fff" }}>-- بدون مجموعة --</option>
                      {GROUPS.map((g) => (
                        <option key={g} value={g} style={{ background: "#0f172a", color: "#fff" }}>{g}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsCustomGroup(true)}
                      className="button button-sm button-muted"
                      style={{ whiteSpace: "nowrap", fontSize: "0.78rem" }}
                      title="إضافة مجموعة مخصصة"
                    >
                      + مخصص
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="اكتب اسم المجموعة..."
                      value={editForm.customGroup}
                      onChange={(e) => setEditForm((f) => ({ ...f, customGroup: e.target.value }))}
                      style={{ flex: 1, padding: "0.6rem 0.8rem", fontSize: "0.9rem", background: "#0f172a", color: "#ffffff" }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => { setIsCustomGroup(false); setEditForm((f) => ({ ...f, customGroup: "" })); }}
                      className="button button-sm button-muted"
                      style={{ whiteSpace: "nowrap", fontSize: "0.78rem" }}
                    >
                      من القائمة
                    </button>
                  </div>
                )}
              </div>

              <div style={{
                background: "rgba(99,102,241,0.12)",
                border: "1px solid rgba(99,102,241,0.3)",
                borderRadius: "14px",
                padding: "0.85rem 1rem",
                marginBottom: "1rem",
                fontSize: "0.85rem",
                lineHeight: "1.8",
                color: "#e2e8f0"
              }}>
                <strong style={{ color: "#a5b4fc" }}>📋 ملخص التعديلات:</strong><br />
                🎓 الصف: <strong>{editForm.grade || "لم يُحدد"}</strong><br />
                📅 العام: <strong>{isCustomYear ? (editForm.customAcademicYear || "لم يُحدد") : (editForm.academicYear || "لم يُحدد")}</strong><br />
                👥 المجموعة: <strong>{isCustomGroup ? (editForm.customGroup || "لم يُحدد") : (editForm.group || "بدون مجموعة")}</strong>
              </div>
              </> )} {/* end !fetchingEdit */}
            </div>

            {/* Pinned Footer - ALWAYS VISIBLE */}
            <div className="modal-footer-pinned">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                disabled={editSaving}
                style={{
                  padding: "0.65rem 1.25rem",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  borderRadius: "30px",
                  background: "rgba(255, 255, 255, 0.1)",
                  color: "#f1f5f9",
                  border: "1.5px solid rgba(255, 255, 255, 0.2)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem"
                }}
              >
                ↩️ إلغاء والعودة
              </button>
              <button
                type="button"
                onClick={handleSaveStudentInfo}
                disabled={editSaving || !editForm.grade}
                style={{
                  padding: "0.65rem 1.5rem",
                  fontSize: "0.9rem",
                  fontWeight: 800,
                  borderRadius: "30px",
                  background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                  color: "#ffffff",
                  border: "none",
                  boxShadow: "0 4px 18px rgba(99, 102, 241, 0.45)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem"
                }}
              >
                {editSaving ? "⏳ جاري الحفظ..." : "💾 حفظ التعديلات"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 📜 Student Payment Ledger Modal */}
      {showLedgerModal && createPortal(
        <div
          className="modal-overlay-fix fade-in"
          onClick={(e) => e.target === e.currentTarget && setShowLedgerModal(false)}
        >
          <div
            className="modal-card-fix"
            style={{
              background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
              maxWidth: "600px",
              border: "1px solid rgba(16, 185, 129, 0.45)",
              color: "#e2e8f0"
            }}
          >
            {/* Pinned Header */}
            <div className="modal-header-pinned" style={{ background: "linear-gradient(90deg, #059669, #047857)" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#fff" }}>
                  📜 سجل مدفوعات واشتراكات الطالب
                </h3>
                <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.82rem", color: "rgba(255,255,255,0.85)" }}>
                  {fullName} — {grade || "الصف غير محدد"}
                </p>
              </div>
              <button
                onClick={() => setShowLedgerModal(false)}
                title="إغلاق النافذة"
                style={{
                  background: "rgba(255,255,255,0.2)",
                  border: "none",
                  color: "#fff",
                  width: 34, height: 34,
                  borderRadius: "50%",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.2s"
                }}
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="modal-body-scroll">
              {loadingLedger ? (
                <p style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>جاري تحميل سجل المدفوعات...</p>
              ) : ledgerTransactions.length === 0 ? (
                <div style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
                  <p style={{ fontSize: "3rem", margin: "0 0 0.5rem" }}>💬</p>
                  <p style={{ color: "#94a3b8", fontSize: "0.95rem" }}>لا توجد حركات مالية مسجلة لهذا الطالب حتى الآن.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {ledgerTransactions.map((tx) => {
                    let txDate = tx.createdAt?.toDate ? tx.createdAt.toDate() : new Date(tx.createdAt || Date.now());
                    const dateStr = txDate.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
                    return (
                      <div key={tx.id} style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.85rem 1rem",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "14px",
                        flexWrap: "wrap",
                        gap: "0.5rem"
                      }}>
                        <div>
                          <div style={{ fontWeight: "800", color: "#e2e8f0", fontSize: "0.9rem" }}>{tx.title}</div>
                          <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: "0.2rem" }}>
                            {tx.paymentMethodLabel || "نقدي"} • {dateStr}
                            {tx.notes && <span> • {tx.notes}</span>}
                          </div>
                        </div>
                        <span style={{
                          fontWeight: "900",
                          fontSize: "0.95rem",
                          color: "#4ade80",
                          background: "rgba(74, 222, 128, 0.12)",
                          padding: "0.3rem 0.8rem",
                          borderRadius: "20px",
                          border: "1px solid rgba(74, 222, 128, 0.25)"
                        }}>
                          + {Number(tx.amount).toLocaleString()} ج.م
                        </span>
                      </div>
                    );
                  })}
                  <div style={{
                    background: "rgba(16, 185, 129, 0.12)",
                    border: "1.5px solid rgba(16, 185, 129, 0.3)",
                    borderRadius: "16px",
                    padding: "0.9rem 1.2rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "0.5rem"
                  }}>
                    <span style={{ fontWeight: "800", color: "#4ade80" }}>💰 إجمالي مدفوعات الطالب:</span>
                    <span style={{ fontWeight: "900", fontSize: "1.2rem", color: "#4ade80" }}>
                      {ledgerTransactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0).toLocaleString()} ج.م
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Pinned Footer */}
            <div className="modal-footer-pinned">
              <button
                type="button"
                onClick={() => setShowLedgerModal(false)}
                style={{
                  padding: "0.65rem 1.25rem",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  borderRadius: "30px",
                  background: "rgba(255, 255, 255, 0.1)",
                  color: "#f1f5f9",
                  border: "1.5px solid rgba(255, 255, 255, 0.2)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem"
                }}
              >
                ↩️ إلغاء والعودة
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 🗑️ Permanent Student Deletion Confirmation Modal */}
      {showDeleteModal && createPortal(
        <div
          className="modal-overlay-fix fade-in"
          onClick={(e) => e.target === e.currentTarget && !deleteLoading && setShowDeleteModal(false)}
        >
          <div
            className="modal-card-fix"
            style={{
              background: "linear-gradient(135deg, #1e1b4b 0%, #1e293b 100%)",
              maxWidth: "560px",
              border: "1.5px solid rgba(239, 68, 68, 0.45)",
              boxShadow: "0 10px 45px rgba(239, 68, 68, 0.25)",
              color: "#e2e8f0",
            }}
          >
            {/* Pinned Danger Header */}
            <div className="modal-header-pinned" style={{ background: "linear-gradient(90deg, #dc2626, #991b1b)" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span>🚨</span> تأكيد الحذف النهائي لحساب الطالب
                </h3>
                <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.82rem", color: "rgba(255,255,255,0.88)" }}>
                  عملية حساسة وغير قابلة للتراجع
                </p>
              </div>
              <button
                onClick={() => !deleteLoading && setShowDeleteModal(false)}
                title="إغلاق النافذة"
                disabled={deleteLoading}
                style={{
                  background: "rgba(255,255,255,0.2)",
                  border: "none",
                  color: "#fff",
                  width: 34, height: 34,
                  borderRadius: "50%",
                  cursor: deleteLoading ? "not-allowed" : "pointer",
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.2s"
                }}
              >
                ✕
              </button>
            </div>

            {/* Scrollable Modal Body */}
            <div className="modal-body-scroll">
              {/* Student Summary Card */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.9rem",
                  padding: "1rem",
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "16px",
                  marginBottom: "1.2rem",
                }}
              >
                <Avatar src={photoURL || "/logo-circle.png"} alt={fullName} size={48} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#ffffff" }}>{fullName}</div>
                  <div style={{ fontSize: "0.82rem", color: "#94a3b8", display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                    <span>🎓 {grade || "غير محدد"}</span>
                    {student.group && <span>👥 {student.group}</span>}
                    <span>✉️ {email}</span>
                    {phone && <span>📱 {phone}</span>}
                  </div>
                </div>
              </div>

              {/* Danger Warning Alert Box */}
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1.5px solid rgba(239, 68, 68, 0.35)",
                  borderRadius: "16px",
                  padding: "1.1rem",
                  marginBottom: "1.2rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 800, color: "#f87171", fontSize: "0.95rem", marginBottom: "0.5rem" }}>
                  <span>⚠️</span>
                  <span>تنبيه هام ومباشر:</span>
                </div>
                <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.85rem", color: "#fca5a5", lineHeight: "1.6" }}>
                  أنت على وشك حذف حساب الطالب <strong>"{fullName}"</strong> بشكل نهائي من المنصة. هذا الإجراء دائم وسيؤدي إلى مسح العناصر التالية بالكامل من قاعدة بيانات Firestore:
                </p>
                <ul style={{ margin: 0, paddingRight: "1.2rem", fontSize: "0.82rem", color: "#cbd5e1", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <li>👤 <strong>بيانات المستخدم وبيانات الدخول:</strong> مسح الحساب ولن يتمكن الطالب من الدخول نهائياً.</li>
                  <li>📝 <strong>سجلات الاختبارات والتطبيقات:</strong> مسح كافة درجات وإجابات ونتائج الطالب.</li>
                  <li>📈 <strong>سجل الأنشطة والمشاهدات:</strong> حذف كافة تفاعلات وحصص الطالب.</li>
                  <li>💰 <strong>السجل المالي والاشتراكات:</strong> حذف كافة القيود المالية الخاصة باشتراكاته.</li>
                  <li>💬 <strong>تذاكر واستفسارات الدعم:</strong> مسح التذاكر والمراسلات الخاصة بالطالب.</li>
                </ul>
              </div>

              {/* Safety Checkbox Confirmation */}
              <div
                style={{
                  background: "rgba(0, 0, 0, 0.25)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "14px",
                  padding: "0.9rem 1rem",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  cursor: "pointer",
                }}
                onClick={() => setConfirmDeleteCheck(!confirmDeleteCheck)}
              >
                <input
                  type="checkbox"
                  id={`confirm-delete-${id}`}
                  checked={confirmDeleteCheck}
                  onChange={(e) => setConfirmDeleteCheck(e.target.checked)}
                  style={{
                    width: "18px",
                    height: "18px",
                    marginTop: "0.2rem",
                    cursor: "pointer",
                    accentColor: "#ef4444",
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <label
                  htmlFor={`confirm-delete-${id}`}
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: confirmDeleteCheck ? "#fca5a5" : "#94a3b8",
                    cursor: "pointer",
                    lineHeight: "1.5",
                  }}
                >
                  أقرّ وأوافق بأنني أريد حذف الطالب <strong>"{fullName}"</strong> ومسح كافة بياناته وسجلاته نهائياً من الموقع وقاعدة البيانات دون إمكانية الاسترجاع.
                </label>
              </div>
            </div>

            {/* Pinned Footer */}
            <div className="modal-footer-pinned">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
                style={{
                  padding: "0.65rem 1.25rem",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  borderRadius: "30px",
                  background: "rgba(255, 255, 255, 0.1)",
                  color: "#f1f5f9",
                  border: "1.5px solid rgba(255, 255, 255, 0.2)",
                  cursor: deleteLoading ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                ↩️ إلغاء وتراجع
              </button>
              <button
                type="button"
                onClick={handlePermanentDeleteStudent}
                disabled={deleteLoading || !confirmDeleteCheck}
                style={{
                  padding: "0.65rem 1.5rem",
                  fontSize: "0.9rem",
                  fontWeight: 800,
                  borderRadius: "30px",
                  background: confirmDeleteCheck
                    ? "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)"
                    : "rgba(239, 68, 68, 0.3)",
                  color: confirmDeleteCheck ? "#ffffff" : "#94a3b8",
                  border: "none",
                  boxShadow: confirmDeleteCheck ? "0 4px 18px rgba(220, 38, 38, 0.45)" : "none",
                  cursor: deleteLoading || !confirmDeleteCheck ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  transition: "all 0.2s ease",
                }}
              >
                {deleteLoading ? "⏳ جاري مسح كافة البيانات..." : "🗑️ تأكيد الحذف النهائي الشامل"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
