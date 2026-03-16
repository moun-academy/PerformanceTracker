// ─── ONLINE DATA SERVICE ─────────────────────────────────────
// Handles all Firestore operations for the online performance tracker.
// Coach creates students, scores them, and students view via share links.
// ──────────────────────────────────────────────────────────────

import {
  db, auth,
  collection, doc, setDoc, getDoc, getDocs, onSnapshot, query, where, deleteDoc, serverTimestamp,
  signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut,
} from "./firebase.js";

// ─── COACH AUTH ──────────────────────────────────────────────

export const coachLogin = async (email, password) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const coachSignup = async (email, password) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  // Mark user as coach in Firestore
  await setDoc(doc(db, "coaches", cred.user.uid), {
    email,
    createdAt: serverTimestamp(),
  });
  return cred;
};

export const anonymousLogin = async () => {
  return signInAnonymously(auth);
};

export const logout = async () => {
  return signOut(auth);
};

export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

// ─── STUDENT MANAGEMENT ─────────────────────────────────────

// Generate a short share code for student links
const generateShareCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const createStudent = async (coachId, studentName, cohortDate) => {
  const shareCode = generateShareCode();
  const studentRef = doc(collection(db, "students"));
  const studentData = {
    coachId,
    studentName,
    cohortDate,
    shareCode,
    weeks: Array.from({ length: 6 }, () => ({
      vocal: [0, 0, 0, 0, 0],
      body: [0, 0, 0, 0, 0],
      structure: [0, 0, 0, 0, 0, 0],
      anxiety: 5,
      confidence: 5,
      notes: { well: "", improve: "", focus: "" },
    })),
    createdAt: serverTimestamp(),
  };
  await setDoc(studentRef, studentData);
  return { id: studentRef.id, ...studentData };
};

export const getCoachStudents = (coachId, callback) => {
  const q = query(collection(db, "students"), where("coachId", "==", coachId));
  return onSnapshot(q, (snapshot) => {
    const students = [];
    snapshot.forEach((docSnap) => {
      students.push({ id: docSnap.id, ...docSnap.data() });
    });
    students.sort((a, b) => (a.studentName || "").localeCompare(b.studentName || ""));
    callback(students);
  });
};

export const updateStudentData = async (studentId, data) => {
  const studentRef = doc(db, "students", studentId);
  await setDoc(studentRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
};

export const deleteStudent = async (studentId) => {
  await deleteDoc(doc(db, "students", studentId));
};

// ─── STUDENT VIEW (via share code) ─────────────────────────

export const getStudentByShareCode = async (shareCode) => {
  const q = query(collection(db, "students"), where("shareCode", "==", shareCode));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
};

export const subscribeToStudent = (studentId, callback) => {
  return onSnapshot(doc(db, "students", studentId), (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() });
    }
  });
};

// ─── CHECK COACH STATUS ─────────────────────────────────────

export const isCoach = async (uid) => {
  const coachDoc = await getDoc(doc(db, "coaches", uid));
  return coachDoc.exists();
};
