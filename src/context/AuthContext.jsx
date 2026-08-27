// src/context/AuthContext.jsx
// يدير حالة تسجيل الدخول للمستخدم، ويجيب دوره (معلم/طالب) من Firestore
import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null); // كائن المستخدم
  const [userProfile, setUserProfile] = useState(null); // مستند users/{uid} في Firestore
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setUserProfile(data);
          localStorage.setItem("math_app_user_uid", user.uid);
        }
        setLoading(false);
      } else {
        // Fallback: Check if there is an active custom passcode session in localStorage
        const savedUid = localStorage.getItem("math_app_user_uid");
        if (savedUid) {
          try {
            const snap = await getDoc(doc(db, "users", savedUid));
            if (snap.exists()) {
              const data = snap.data();
              const simulatedUser = { uid: savedUid, email: data.email, displayName: data.fullName, ...data };
              setUserProfile(data);
              setCurrentUser(simulatedUser);
            } else {
              localStorage.removeItem("math_app_user_uid");
              setCurrentUser(null);
              setUserProfile(null);
            }
          } catch (e) {
            console.error("Error restoring custom session:", e);
            setCurrentUser(null);
            setUserProfile(null);
          }
        } else {
          setCurrentUser(null);
          setUserProfile(null);
        }
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  async function registerStudent({ email, password, fullName, grade, phone, isSubscribed = false }) {
    // If a teacher is currently logged in, create student directly in Firestore so teacher session is not logged out!
    if (userProfile?.role === "teacher") {
      const newStudentRef = doc(collection(db, "users"));
      const newStudentData = {
        fullName: (fullName || "").trim(),
        email: (email || "").trim(),
        phone: (phone || "").trim(),
        passcode: (password || "").trim(),
        studentPasscode: (password || "").trim(),
        password: (password || "").trim(),
        grade,
        role: "student",
        isSubscribed: Boolean(isSubscribed),
        createdAt: serverTimestamp(),
      };
      await setDoc(newStudentRef, newStudentData);
      return { uid: newStudentRef.id, ...newStudentData };
    }

    // Otherwise, student is registering themselves
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    try {
      await setDoc(doc(db, "users", cred.user.uid), {
        fullName: (fullName || "").trim(),
        email: (email || "").trim(),
        phone: (phone || "").trim(),
        passcode: (password || "").trim(),
        studentPasscode: (password || "").trim(),
        password: (password || "").trim(),
        grade,
        role: "student",
        isSubscribed: Boolean(isSubscribed),
        createdAt: serverTimestamp(),
      });
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      setUserProfile(snap.data());
      localStorage.setItem("math_app_user_uid", cred.user.uid);
    } catch (e) {
      console.error('Failed to create student profile:', e);
      throw e;
    }
    return cred.user;
  }

  // تسجيل معلم جديد: يسمح بإنشاء حساب معلم واحد فقط (مدير المنصة)
  async function registerTeacher({ email, password, fullName, grade, phone }) {
    const teachersQuery = query(collection(db, "users"), where("role", "==", "teacher"));
    const existingTeachers = await getDocs(teachersQuery);
    if (!existingTeachers.empty) {
      const existing = existingTeachers.docs[0].data();
      if (existing.email !== email) {
        throw new Error('حساب معلم موجود بالفعل. لا يمكن إنشاء أكثر من معلم واحد.');
      }
    }
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    try {
      await setDoc(doc(db, "users", cred.user.uid), {
        fullName: (fullName || "").trim(),
        email: (email || "").trim(),
        phone: (phone || "").trim(),
        passcode: (password || "").trim(),
        teacherPasscode: (password || "").trim(),
        password: (password || "").trim(),
        grade,
        role: "teacher",
        isSubscribed: true,
        createdAt: serverTimestamp(),
      });
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      setUserProfile(snap.data());
      localStorage.setItem("math_app_user_uid", cred.user.uid);
    } catch (e) {
      console.error('Failed to create teacher profile:', e);
      throw e;
    }
    return cred.user;
  }

  async function login(emailOrPhone, passwordOrPasscode) {
    const input = (emailOrPhone || "").trim().toLowerCase();
    const secret = (passwordOrPasscode || "").trim();

    if (!input || !secret) {
      throw new Error("يرجى إدخال البريد الإلكتروني / رقم الهاتف وكود المرور");
    }

    // 1. Try Firebase Auth FIRST if input is an email
    if (input.includes("@")) {
      try {
        const cred = await signInWithEmailAndPassword(auth, input, secret);
        if (cred.user) {
          localStorage.setItem("math_app_user_uid", cred.user.uid);
          const userRef = doc(db, "users", cred.user.uid);
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const data = snap.data();
            setUserProfile(data);
            // Backfill passcode fields in Firestore if missing
            if (!data.passcode && !data.password) {
              updateDoc(userRef, {
                passcode: secret,
                password: secret,
                ...(data.role === "teacher" ? { teacherPasscode: secret } : { studentPasscode: secret }),
              }).catch((e) => console.log("Backfill passcode error:", e.message));
            }
          } else {
            const newProf = {
              email: cred.user.email,
              fullName: cred.user.displayName || "مستخدم",
              role: "student",
              passcode: secret,
              studentPasscode: secret,
              password: secret,
              createdAt: serverTimestamp(),
            };
            await setDoc(userRef, newProf);
            setUserProfile(newProf);
          }
          return cred.user;
        }
      } catch (authErr) {
        console.log("Firebase Auth signInWithEmailAndPassword failed, checking Firestore passcode...", authErr.message);
      }
    }

    // 2. Fallback: Targeted Firestore queries by email or phone (avoids full collection scan)
    let matchingDoc = null;
    const emailQuery = query(collection(db, "users"), where("email", "==", input));
    const emailSnap = await getDocs(emailQuery);
    if (!emailSnap.empty) {
      matchingDoc = emailSnap.docs[0];
    }
    if (!matchingDoc) {
      const phoneQuery = query(collection(db, "users"), where("phone", "==", input));
      const phoneSnap = await getDocs(phoneQuery);
      if (!phoneSnap.empty) {
        matchingDoc = phoneSnap.docs[0];
      }
    }

    if (matchingDoc) {
      const userData = matchingDoc.data();
      const storedPasscode = (
        userData.passcode ||
        userData.studentPasscode ||
        userData.teacherPasscode ||
        userData.password ||
        ""
      ).toString().trim();

      if (storedPasscode && storedPasscode === secret) {
        // Passcode matched in Firestore!
        const userId = matchingDoc.id;
        const fullUser = { uid: userId, email: userData.email, displayName: userData.fullName, ...userData };

        // Try signing in with Firebase Auth if possible to keep auth session synced
        if (userData.email && auth.currentUser?.email !== userData.email) {
          try {
            await signInWithEmailAndPassword(auth, userData.email, secret);
          } catch (e) {
            console.log("Firebase Auth secondary sync notice:", e.message);
          }
        }
        
        localStorage.setItem("math_app_user_uid", userId);
        setUserProfile(userData);
        setCurrentUser(fullUser);
        return fullUser;
      }
    }

    throw new Error("البريد الإلكتروني / رقم الهاتف أو الرقم السري غير صحيح");
  }

  // تسجيل الدخول/إنشاء حساب باستخدام Google مع تقييد معلم واحد فقط
  async function signInWithGoogle(selectedRole = "student", selectedGrade = null) {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    // إذا اختار المستخدم دور معلم، تأكد من عدم وجود معلم آخر غير هذا البريد
    if (selectedRole === "teacher") {
      const teachersQuery = query(collection(db, "users"), where("role", "==", "teacher"));
      const existingTeachers = await getDocs(teachersQuery);
      if (!existingTeachers.empty) {
        const existing = existingTeachers.docs[0].data();
        if (existing.email !== user.email) {
          throw new Error('حساب معلم موجود بالفعل. لا يمكن إنشاء أكثر من معلم واحد.');
        }
      }
    }

    if (!snap.exists()) {
      if (!selectedGrade && selectedRole === "student") {
        // Brand new student via Google who needs to pick their grade!
        return { needsGrade: true, user, isNew: true };
      }

      const newUserData = {
        fullName: user.displayName || "طالب جديد",
        email: user.email || "",
        phone: user.phoneNumber || "",
        grade: selectedGrade || "",
        role: selectedRole,
        isSubscribed: selectedRole === "teacher" ? true : false,
        authProvider: "google",
        createdAt: serverTimestamp(),
      };
      await setDoc(userRef, newUserData);
      setUserProfile(newUserData);
      localStorage.setItem("math_app_user_uid", user.uid);
      return { needsGrade: false, user, userProfile: newUserData };
    } else {
      const data = snap.data();
      setUserProfile(data);
      localStorage.setItem("math_app_user_uid", user.uid);

      if (data.role === "student" && !data.grade) {
        return { needsGrade: true, user, isNew: false, userProfile: data };
      }

      return { needsGrade: false, user, userProfile: data };
    }
  }

  async function completeGoogleStudentProfile(user, grade) {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    let updatedData;
    if (!snap.exists()) {
      updatedData = {
        fullName: user.displayName || "طالب جديد",
        email: user.email || "",
        phone: user.phoneNumber || "",
        grade: grade,
        role: "student",
        isSubscribed: false,
        authProvider: "google",
        createdAt: serverTimestamp(),
      };
      await setDoc(userRef, updatedData);
    } else {
      await updateDoc(userRef, {
        grade: grade,
        updatedAt: serverTimestamp(),
      });
      const updatedSnap = await getDoc(userRef);
      updatedData = updatedSnap.data();
    }
    setUserProfile(updatedData);
    localStorage.setItem("math_app_user_uid", user.uid);
    return updatedData;
  }

  async function logout() {
    localStorage.removeItem("math_app_user_uid");
    setCurrentUser(null);
    setUserProfile(null);
    return signOut(auth);
  }

  const value = {
    currentUser,
    userProfile,
    isTeacher: userProfile?.role === "teacher",
    isStudent: userProfile?.role === "student",
    registerStudent,
    registerTeacher,
    login,
    logout,
    loading,
    signInWithGoogle,
    completeGoogleStudentProfile,
  };

  if (loading) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "var(--color-background)",
        gap: "1.5rem"
      }}>
        <img
          src="/logo-circle.png"
          alt="Logo"
          className="logo-loading-sway"
          style={{
            width: "100px",
            height: "100px",
            objectFit: "cover",
          }}
        />
        <p style={{ color: "var(--color-primary)", fontSize: "1.2rem", fontFamily: "var(--font-body)" }}>
          جاري تحميل المنصة...
        </p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
