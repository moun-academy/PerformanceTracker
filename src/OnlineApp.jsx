import { useState, useEffect, useCallback, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from "recharts";
import {
  coachLogin, coachSignup, anonymousLogin, logout, onAuthChange, isCoach,
  createStudent, getCoachStudents, updateStudentData, deleteStudent,
  getStudentByShareCode, subscribeToStudent,
} from "./onlineService.js";
import { isFirebaseConfigured } from "./firebase.js";

// ─── SHARED CONFIGURATION ───────────────────────────────────
const BRAND = {
  name: "Performance Tracker",
  accent: "#E8A838",
  accentLight: "#F5C96A",
  accentDim: "rgba(232,168,56,0.15)",
};

const CATEGORIES = {
  vocal: {
    label: "Vocal Review", icon: "🎙️", color: "#E8A838",
    metrics: ["Volume", "Pitch", "Pace", "Tone", "Pauses"],
    questions: [
      "How does my voice make me feel when I listen to it back?",
      "What happens to my pitch at the end of my sentences?",
      "Does my vocal delivery match the message I'm trying to get across?",
      "When do I sound most believable and most disconnected?",
      "Do I pause strategically, or do I fill every moment of silence with noise?",
    ],
  },
  body: {
    label: "Visual Review", icon: "🧍", color: "#4ECDC4",
    metrics: ["Eye Contact", "Hand Gestures", "Posture", "Facial Expression", "Stillness & Control"],
    questions: [
      "Where do I look when I'm thinking about what to say next?",
      "What are my default hand gestures?",
      "Do I look confident or apologetic with my body language?",
      "Do I use my face to express emotions?",
      "What are my visual tics that are distracting?",
    ],
  },
  structure: {
    label: "Verbal Review", icon: "💬", color: "#FF6B6B",
    metrics: ["Clarity", "Word Choice", "Filler Words", "Repetition", "Structure", "Logical Flow"],
    questions: [
      "Does each paragraph make one clear point?",
      "Do I use short, clear words or long complicated ones?",
      "What are my non-words and filler words?",
      "Are there any words I repeat too often?",
      "How clear is the structure?",
      "Can someone follow along logically and easily?",
    ],
  },
};

const WEEKS = [1, 2, 3, 4, 5, 6];

const calcScore = (arr) => {
  const total = arr.reduce((s, v) => s + v, 0);
  const maxScore = arr.length * 5;
  return Math.round((total / maxScore) * 100);
};

const calcOverall = (week) => {
  const v = calcScore(week.vocal);
  const b = calcScore(week.body);
  const s = calcScore(week.structure);
  return Math.round((v + b + s) / 3);
};

// ─── THEME ──────────────────────────────────────────────────
const useTheme = (darkMode) => ({
  bg: darkMode ? "#0C0C14" : "#F5F3EE",
  textPrimary: darkMode ? "#FFFFFF" : "#1a1a2e",
  textSecondary: darkMode ? "#888888" : "#666666",
  cardBg: darkMode ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.03)",
  cardBorder: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)",
  inputBg: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
  inputBorder: darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)",
});

// ─── SMALL COMPONENTS ───────────────────────────────────────
const Card = ({ children, style = {}, theme }) => (
  <div style={{
    background: theme.cardBg, border: `1px solid ${theme.cardBorder}`,
    borderRadius: 16, padding: 24, ...style,
  }}>{children}</div>
);

const ScoreRing = ({ score, color, size = 100, label, icon }) => {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div style={{ textAlign: "center" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }} />
        <text x={size / 2} y={size / 2 - 4} textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize={size * 0.22} fontWeight={800}
          style={{ transform: "rotate(90deg)", transformOrigin: "center" }}>
          {score}%
        </text>
        {icon && (
          <text x={size / 2} y={size / 2 + size * 0.18} textAnchor="middle" dominantBaseline="middle"
            fontSize={size * 0.12} style={{ transform: "rotate(90deg)", transformOrigin: "center" }}>
            {icon}
          </text>
        )}
      </svg>
      {label && <div style={{ fontSize: 11, color: "#888", marginTop: 4, fontWeight: 600 }}>{label}</div>}
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(12,12,20,0.95)", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 10, padding: "10px 14px", fontSize: 12,
    }}>
      <div style={{ color: "#fff", fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{p.value}%</strong>
        </div>
      ))}
    </div>
  );
};

// ─── AUTH SCREEN ────────────────────────────────────────────
function AuthScreen({ onAuth, darkMode }) {
  const theme = useTheme(darkMode);
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await coachLogin(email, password);
      } else {
        await coachSignup(email, password);
      }
    } catch (err) {
      setError(err.message?.replace("Firebase: ", "") || "Authentication failed");
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: theme.bg, fontFamily: "'DM Sans', sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700;800;900&display=swap" rel="stylesheet" />
      <div style={{
        width: "100%", maxWidth: 400, padding: 32,
        background: theme.cardBg, border: `1px solid ${theme.cardBorder}`,
        borderRadius: 20,
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: BRAND.accent, fontFamily: "'Playfair Display', serif" }}>
            {BRAND.name}
          </div>
          <div style={{ fontSize: 14, color: theme.textSecondary, marginTop: 8 }}>
            Coach Portal
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: theme.textSecondary, display: "block", marginBottom: 6 }}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10,
                border: `1px solid ${theme.inputBorder}`, background: theme.inputBg,
                color: theme.textPrimary, fontSize: 14, fontFamily: "'DM Sans', sans-serif",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: theme.textSecondary, display: "block", marginBottom: 6 }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10,
                border: `1px solid ${theme.inputBorder}`, background: theme.inputBg,
                color: theme.textPrimary, fontSize: 14, fontFamily: "'DM Sans', sans-serif",
                boxSizing: "border-box",
              }}
            />
          </div>
          {error && (
            <div style={{ color: "#FF6B6B", fontSize: 13, marginBottom: 12, textAlign: "center" }}>{error}</div>
          )}
          <button type="submit" disabled={loading} style={{
            width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
            background: BRAND.accent, color: "#fff", fontSize: 15, fontWeight: 700,
            cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            {loading ? "..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
            style={{
              background: "none", border: "none", color: BRAND.accent,
              fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            }}>
            {mode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── COACH DASHBOARD ────────────────────────────────────────
function CoachDashboard({ user, onLogout, darkMode, setDarkMode }) {
  const theme = useTheme(darkMode);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [activeWeek, setActiveWeek] = useState(0);
  const [newStudentName, setNewStudentName] = useState("");
  const [newCohortDate, setNewCohortDate] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    const unsub = getCoachStudents(user.uid, setStudents);
    return () => unsub();
  }, [user.uid]);

  const handleAddStudent = async () => {
    if (!newStudentName.trim()) return;
    await createStudent(user.uid, newStudentName.trim(), newCohortDate);
    setNewStudentName("");
    setNewCohortDate("");
    setShowAddForm(false);
  };

  const handleDeleteStudent = async (id) => {
    await deleteStudent(id);
    if (selectedStudent?.id === id) setSelectedStudent(null);
    setConfirmDelete(null);
  };

  const updateMetric = (cat, idx, val) => {
    if (!selectedStudent) return;
    const updated = [...selectedStudent.weeks];
    updated[activeWeek] = { ...updated[activeWeek], [cat]: [...updated[activeWeek][cat]] };
    updated[activeWeek][cat][idx] = val;
    setSelectedStudent({ ...selectedStudent, weeks: updated });
    updateStudentData(selectedStudent.id, { weeks: updated });
  };

  const updateExtra = (key, val) => {
    if (!selectedStudent) return;
    const updated = [...selectedStudent.weeks];
    updated[activeWeek] = { ...updated[activeWeek], [key]: val };
    setSelectedStudent({ ...selectedStudent, weeks: updated });
    updateStudentData(selectedStudent.id, { weeks: updated });
  };

  const updateNote = (key, val) => {
    if (!selectedStudent) return;
    const updated = [...selectedStudent.weeks];
    updated[activeWeek] = {
      ...updated[activeWeek],
      notes: { ...updated[activeWeek].notes, [key]: val },
    };
    setSelectedStudent({ ...selectedStudent, weeks: updated });
    updateStudentData(selectedStudent.id, { weeks: updated });
  };

  const copyShareLink = (student) => {
    const url = `${window.location.origin}${window.location.pathname}?student=${student.shareCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(student.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const currentWeek = selectedStudent?.weeks?.[activeWeek];

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, color: theme.textPrimary, fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700;800;900&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 24px", borderBottom: `1px solid ${theme.cardBorder}`,
        flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: BRAND.accent, fontFamily: "'Playfair Display', serif" }}>
            {BRAND.name}
          </span>
          <span style={{
            fontSize: 10, padding: "3px 8px", borderRadius: 6,
            background: "rgba(78,205,196,0.15)", color: "#4ECDC4", fontWeight: 700,
          }}>COACH</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: theme.textSecondary }}>{user.email}</span>
          <button onClick={() => setDarkMode(!darkMode)} style={{
            background: theme.cardBg, border: `1px solid ${theme.cardBorder}`,
            borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 14,
          }}>{darkMode ? "☀️" : "🌙"}</button>
          <button onClick={onLogout} style={{
            background: "none", border: `1px solid ${theme.cardBorder}`,
            borderRadius: 8, padding: "6px 14px", cursor: "pointer",
            color: theme.textSecondary, fontSize: 12, fontFamily: "'DM Sans', sans-serif",
          }}>Sign Out</button>
        </div>
      </div>

      <div style={{ display: "flex", minHeight: "calc(100vh - 60px)" }}>
        {/* Sidebar - Student List */}
        <div style={{
          width: 280, borderRight: `1px solid ${theme.cardBorder}`,
          padding: 16, overflowY: "auto", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Students ({students.length})</span>
            <button onClick={() => setShowAddForm(!showAddForm)} style={{
              background: BRAND.accent, color: "#fff", border: "none",
              borderRadius: 8, padding: "6px 12px", cursor: "pointer",
              fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
            }}>+ Add</button>
          </div>

          {showAddForm && (
            <div style={{
              padding: 12, background: theme.cardBg, border: `1px solid ${theme.cardBorder}`,
              borderRadius: 12, marginBottom: 12,
            }}>
              <input placeholder="Student Name" value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                style={{
                  width: "100%", padding: "8px 10px", borderRadius: 8,
                  border: `1px solid ${theme.inputBorder}`, background: theme.inputBg,
                  color: theme.textPrimary, fontSize: 13, marginBottom: 8,
                  fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box",
                }}
              />
              <input placeholder="Cohort Date" value={newCohortDate}
                onChange={(e) => setNewCohortDate(e.target.value)}
                style={{
                  width: "100%", padding: "8px 10px", borderRadius: 8,
                  border: `1px solid ${theme.inputBorder}`, background: theme.inputBg,
                  color: theme.textPrimary, fontSize: 13, marginBottom: 8,
                  fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleAddStudent} style={{
                  flex: 1, padding: "8px 0", borderRadius: 8, border: "none",
                  background: BRAND.accent, color: "#fff", fontSize: 12, fontWeight: 700,
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                }}>Create</button>
                <button onClick={() => setShowAddForm(false)} style={{
                  flex: 1, padding: "8px 0", borderRadius: 8,
                  border: `1px solid ${theme.cardBorder}`, background: "none",
                  color: theme.textSecondary, fontSize: 12, cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}>Cancel</button>
              </div>
            </div>
          )}

          {students.map((s) => (
            <div key={s.id} style={{
              padding: "10px 12px", borderRadius: 10, marginBottom: 6, cursor: "pointer",
              background: selectedStudent?.id === s.id ? BRAND.accentDim : "transparent",
              border: selectedStudent?.id === s.id ? `1px solid ${BRAND.accent}44` : `1px solid transparent`,
              transition: "all 0.2s",
            }} onClick={() => { setSelectedStudent(s); setActiveWeek(0); }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary }}>{s.studentName}</div>
              <div style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
                {s.cohortDate || "No cohort date"}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button onClick={(e) => { e.stopPropagation(); copyShareLink(s); }}
                  style={{
                    background: theme.cardBg, border: `1px solid ${theme.cardBorder}`,
                    borderRadius: 6, padding: "3px 8px", cursor: "pointer",
                    fontSize: 10, color: copiedId === s.id ? "#4ECDC4" : theme.textSecondary,
                    fontFamily: "'DM Sans', sans-serif",
                  }}>
                  {copiedId === s.id ? "Copied!" : "Share Link"}
                </button>
                {confirmDelete === s.id ? (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteStudent(s.id); }}
                      style={{
                        background: "#FF6B6B", border: "none", borderRadius: 6,
                        padding: "3px 8px", cursor: "pointer", fontSize: 10, color: "#fff",
                        fontFamily: "'DM Sans', sans-serif",
                      }}>Confirm</button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}
                      style={{
                        background: "none", border: `1px solid ${theme.cardBorder}`,
                        borderRadius: 6, padding: "3px 8px", cursor: "pointer",
                        fontSize: 10, color: theme.textSecondary, fontFamily: "'DM Sans', sans-serif",
                      }}>No</button>
                  </>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(s.id); }}
                    style={{
                      background: "none", border: `1px solid ${theme.cardBorder}`,
                      borderRadius: 6, padding: "3px 8px", cursor: "pointer",
                      fontSize: 10, color: theme.textSecondary, fontFamily: "'DM Sans', sans-serif",
                    }}>Remove</button>
                )}
              </div>
            </div>
          ))}

          {students.length === 0 && !showAddForm && (
            <div style={{ textAlign: "center", padding: 24, color: theme.textSecondary, fontSize: 13 }}>
              No students yet. Click "+ Add" to create your first student.
            </div>
          )}
        </div>

        {/* Main Content - Scoring Area */}
        <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
          {!selectedStudent ? (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              height: "100%", color: theme.textSecondary, fontSize: 16,
            }}>
              Select a student from the sidebar to begin scoring
            </div>
          ) : (
            <>
              {/* Student Header */}
              <div style={{ marginBottom: 24 }}>
                <div style={{
                  fontSize: 24, fontWeight: 800, color: BRAND.accent,
                  fontFamily: "'Playfair Display', serif",
                }}>
                  {selectedStudent.studentName}
                </div>
                <div style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>
                  {selectedStudent.cohortDate || "No cohort date set"}
                </div>
              </div>

              {/* Week Tabs */}
              <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
                {WEEKS.map((w, i) => {
                  const hasData = selectedStudent.weeks[i]?.vocal?.some(v => v > 0);
                  return (
                    <button key={i} onClick={() => setActiveWeek(i)} style={{
                      padding: "8px 18px", borderRadius: 10, cursor: "pointer",
                      border: activeWeek === i ? `2px solid ${BRAND.accent}` : `1px solid ${theme.cardBorder}`,
                      background: activeWeek === i ? BRAND.accentDim : theme.cardBg,
                      color: activeWeek === i ? BRAND.accent : theme.textSecondary,
                      fontWeight: 700, fontSize: 13, position: "relative",
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                      Week {w}
                      {hasData && (
                        <span style={{
                          position: "absolute", top: -3, right: -3,
                          width: 8, height: 8, borderRadius: "50%", background: "#4ECDC4",
                        }} />
                      )}
                    </button>
                  );
                })}
              </div>

              {currentWeek && (
                <>
                  {/* Score Summary */}
                  <div style={{
                    display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 16, marginBottom: 24,
                  }}>
                    <Card theme={theme} style={{ textAlign: "center" }}>
                      <ScoreRing score={calcOverall(currentWeek)} color={BRAND.accent} label="Overall" size={90} />
                    </Card>
                    {Object.entries(CATEGORIES).map(([key, cat]) => (
                      <Card key={key} theme={theme} style={{ textAlign: "center" }}>
                        <ScoreRing score={calcScore(currentWeek[key])} color={cat.color} label={cat.label} icon={cat.icon} size={90} />
                      </Card>
                    ))}
                  </div>

                  {/* Metric Scoring Cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
                    {Object.entries(CATEGORIES).map(([catKey, cat]) => (
                      <Card key={catKey} theme={theme}>
                        <div style={{
                          fontSize: 15, fontWeight: 700, marginBottom: 16,
                          display: "flex", alignItems: "center", gap: 8,
                        }}>
                          <span>{cat.icon}</span>
                          <span style={{ color: cat.color }}>{cat.label}</span>
                          <span style={{
                            marginLeft: "auto", fontSize: 18, fontWeight: 800, color: cat.color,
                          }}>{calcScore(currentWeek[catKey])}%</span>
                        </div>
                        {cat.metrics.map((metric, idx) => (
                          <div key={idx} style={{ marginBottom: 12 }}>
                            <div style={{
                              display: "flex", justifyContent: "space-between",
                              fontSize: 12, marginBottom: 4,
                            }}>
                              <span style={{ color: theme.textSecondary }}>{metric}</span>
                              <span style={{ color: cat.color, fontWeight: 700 }}>{currentWeek[catKey][idx]}/5</span>
                            </div>
                            <input type="range" min={0} max={5} step={1}
                              value={currentWeek[catKey][idx]}
                              onChange={(e) => updateMetric(catKey, idx, parseInt(e.target.value))}
                              style={{ width: "100%", accentColor: cat.color }}
                            />
                          </div>
                        ))}
                      </Card>
                    ))}
                  </div>

                  {/* Mental State */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                    <Card theme={theme}>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                        Anxiety Level: <span style={{ color: "#FF6B6B" }}>{currentWeek.anxiety}/10</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: theme.textSecondary }}>
                        <span>Calm</span>
                        <input type="range" min={1} max={10} value={currentWeek.anxiety}
                          onChange={(e) => updateExtra("anxiety", parseInt(e.target.value))}
                          style={{ flex: 1, accentColor: "#FF6B6B" }} />
                        <span>High</span>
                      </div>
                    </Card>
                    <Card theme={theme}>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                        Confidence Level: <span style={{ color: "#4ECDC4" }}>{currentWeek.confidence}/10</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: theme.textSecondary }}>
                        <span>Low</span>
                        <input type="range" min={1} max={10} value={currentWeek.confidence}
                          onChange={(e) => updateExtra("confidence", parseInt(e.target.value))}
                          style={{ flex: 1, accentColor: "#4ECDC4" }} />
                        <span>High</span>
                      </div>
                    </Card>
                  </div>

                  {/* Coaching Notes */}
                  <Card theme={theme} style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
                      Coaching Notes — Week {activeWeek + 1}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                      {[
                        { key: "well", label: "What They Did Well", color: "#4ECDC4", icon: "✅" },
                        { key: "improve", label: "What to Improve", color: "#FF6B6B", icon: "🔧" },
                        { key: "focus", label: "Focus Next Week", color: BRAND.accent, icon: "🎯" },
                      ].map(({ key, label, color, icon }) => (
                        <div key={key}>
                          <div style={{ fontSize: 12, fontWeight: 600, color, marginBottom: 8 }}>
                            {icon} {label}
                          </div>
                          <textarea
                            value={currentWeek.notes[key]}
                            onChange={(e) => updateNote(key, e.target.value)}
                            placeholder={`Coach notes: ${label.toLowerCase()}...`}
                            rows={4}
                            style={{
                              width: "100%", padding: "10px 12px", borderRadius: 10,
                              border: `1px solid ${theme.inputBorder}`, background: theme.inputBg,
                              color: theme.textPrimary, fontSize: 13, resize: "vertical",
                              fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box",
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </Card>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── STUDENT VIEW (Read-Only) ───────────────────────────────
function StudentView({ shareCode, darkMode, setDarkMode }) {
  const theme = useTheme(darkMode);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeWeek, setActiveWeek] = useState(0);
  const [view, setView] = useState("scores"); // scores | progress

  useEffect(() => {
    let unsub;
    const load = async () => {
      try {
        const data = await getStudentByShareCode(shareCode);
        if (!data) {
          setError("Student tracker not found. Please check your link.");
          setLoading(false);
          return;
        }
        setStudent(data);
        setLoading(false);
        // Subscribe to real-time updates
        unsub = subscribeToStudent(data.id, (updated) => {
          setStudent(updated);
        });
      } catch (err) {
        setError("Failed to load tracker. Please try again.");
        setLoading(false);
      }
    };
    load();
    return () => unsub?.();
  }, [shareCode]);

  const chartData = useMemo(() => {
    if (!student?.weeks) return [];
    return student.weeks.map((w, i) => {
      const vs = calcScore(w.vocal);
      const bs = calcScore(w.body);
      const ss = calcScore(w.structure);
      const hasData = w.vocal.some(v => v > 0) || w.body.some(v => v > 0) || w.structure.some(v => v > 0);
      if (!hasData) return null;
      return {
        name: `Week ${i + 1}`,
        "Vocal Review": vs, "Visual Review": bs, "Verbal Review": ss,
        Overall: Math.round((vs + bs + ss) / 3),
        Anxiety: w.anxiety, Confidence: w.confidence,
      };
    }).filter(Boolean);
  }, [student?.weeks]);

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: theme.bg, color: BRAND.accent, fontFamily: "'DM Sans', sans-serif",
        fontSize: 18, fontWeight: 600,
      }}>Loading your performance tracker...</div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: theme.bg, color: "#FF6B6B", fontFamily: "'DM Sans', sans-serif",
        fontSize: 16, padding: 32, textAlign: "center",
      }}>{error}</div>
    );
  }

  const currentWeek = student?.weeks?.[activeWeek];
  const hasAnyData = student?.weeks?.some(w => w.vocal.some(v => v > 0));

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, color: theme.textPrimary, fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700;800;900&display=swap" rel="stylesheet" />
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          button { display: none !important; }
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.4s ease-out; }
        @media (max-width: 768px) {
          .student-score-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .student-metric-grid { grid-template-columns: 1fr !important; }
          .student-notes-grid { grid-template-columns: 1fr !important; }
          .student-chart-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 24px", borderBottom: `1px solid ${theme.cardBorder}`,
        flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: BRAND.accent, fontFamily: "'Playfair Display', serif" }}>
            {student.studentName}'s Performance Tracker
          </div>
          <div style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
            {student.cohortDate || "Speaker's Gym"} — Scored by your coach
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setView(view === "scores" ? "progress" : "scores")} style={{
            padding: "8px 16px", borderRadius: 10, cursor: "pointer",
            border: `1px solid ${theme.cardBorder}`,
            background: theme.cardBg, color: theme.textPrimary,
            fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
          }}>
            {view === "scores" ? "View Progress" : "View Scores"}
          </button>
          <button onClick={() => setDarkMode(!darkMode)} style={{
            background: theme.cardBg, border: `1px solid ${theme.cardBorder}`,
            borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 14,
          }}>{darkMode ? "☀️" : "🌙"}</button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px" }}>
        {view === "scores" ? (
          <>
            {/* Week Tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
              {WEEKS.map((w, i) => {
                const hasData = student.weeks[i]?.vocal?.some(v => v > 0);
                return (
                  <button key={i} onClick={() => setActiveWeek(i)} style={{
                    padding: "8px 18px", borderRadius: 10, cursor: "pointer",
                    border: activeWeek === i ? `2px solid ${BRAND.accent}` : `1px solid ${theme.cardBorder}`,
                    background: activeWeek === i ? BRAND.accentDim : theme.cardBg,
                    color: activeWeek === i ? BRAND.accent : theme.textSecondary,
                    fontWeight: 700, fontSize: 13, position: "relative",
                    fontFamily: "'DM Sans', sans-serif",
                  }}>
                    Week {w}
                    {hasData && (
                      <span style={{
                        position: "absolute", top: -3, right: -3,
                        width: 8, height: 8, borderRadius: "50%", background: "#4ECDC4",
                      }} />
                    )}
                  </button>
                );
              })}
            </div>

            {currentWeek && (
              <div className="fade-in">
                {/* Score Rings */}
                <div className="student-score-grid" style={{
                  display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 16, marginBottom: 24,
                }}>
                  <Card theme={theme} style={{ textAlign: "center" }}>
                    <ScoreRing score={calcOverall(currentWeek)} color={BRAND.accent} label="Overall" size={100} />
                  </Card>
                  {Object.entries(CATEGORIES).map(([key, cat]) => (
                    <Card key={key} theme={theme} style={{ textAlign: "center" }}>
                      <ScoreRing score={calcScore(currentWeek[key])} color={cat.color} label={cat.label} icon={cat.icon} size={100} />
                    </Card>
                  ))}
                </div>

                {/* Metric Breakdowns (read-only) */}
                <div className="student-metric-grid" style={{
                  display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24,
                }}>
                  {Object.entries(CATEGORIES).map(([catKey, cat]) => (
                    <Card key={catKey} theme={theme}>
                      <div style={{
                        fontSize: 15, fontWeight: 700, marginBottom: 16,
                        display: "flex", alignItems: "center", gap: 8,
                      }}>
                        <span>{cat.icon}</span>
                        <span style={{ color: cat.color }}>{cat.label}</span>
                        <span style={{ marginLeft: "auto", fontSize: 18, fontWeight: 800, color: cat.color }}>
                          {calcScore(currentWeek[catKey])}%
                        </span>
                      </div>
                      {cat.metrics.map((metric, idx) => (
                        <div key={idx} style={{ marginBottom: 10 }}>
                          <div style={{
                            display: "flex", justifyContent: "space-between",
                            fontSize: 12, marginBottom: 4,
                          }}>
                            <span style={{ color: theme.textSecondary }}>{metric}</span>
                            <span style={{ color: cat.color, fontWeight: 700 }}>{currentWeek[catKey][idx]}/5</span>
                          </div>
                          {/* Progress bar instead of slider */}
                          <div style={{
                            height: 6, borderRadius: 3,
                            background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                          }}>
                            <div style={{
                              height: "100%", borderRadius: 3,
                              width: `${(currentWeek[catKey][idx] / 5) * 100}%`,
                              background: cat.color, transition: "width 0.4s ease",
                            }} />
                          </div>
                          {/* Show coaching question as hint */}
                          <div style={{ fontSize: 10, color: theme.textSecondary, marginTop: 3, fontStyle: "italic" }}>
                            {cat.questions[idx]}
                          </div>
                        </div>
                      ))}
                    </Card>
                  ))}
                </div>

                {/* Mental State */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                  <Card theme={theme}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
                      Anxiety Level
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "#FF6B6B" }}>
                      {currentWeek.anxiety}<span style={{ fontSize: 14, color: theme.textSecondary }}>/10</span>
                    </div>
                    <div style={{
                      height: 6, borderRadius: 3, marginTop: 8,
                      background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                    }}>
                      <div style={{
                        height: "100%", borderRadius: 3,
                        width: `${(currentWeek.anxiety / 10) * 100}%`,
                        background: "#FF6B6B", transition: "width 0.4s ease",
                      }} />
                    </div>
                  </Card>
                  <Card theme={theme}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
                      Confidence Level
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "#4ECDC4" }}>
                      {currentWeek.confidence}<span style={{ fontSize: 14, color: theme.textSecondary }}>/10</span>
                    </div>
                    <div style={{
                      height: 6, borderRadius: 3, marginTop: 8,
                      background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                    }}>
                      <div style={{
                        height: "100%", borderRadius: 3,
                        width: `${(currentWeek.confidence / 10) * 100}%`,
                        background: "#4ECDC4", transition: "width 0.4s ease",
                      }} />
                    </div>
                  </Card>
                </div>

                {/* Coach Notes */}
                {(currentWeek.notes.well || currentWeek.notes.improve || currentWeek.notes.focus) && (
                  <Card theme={theme}>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
                      Coach's Notes — Week {activeWeek + 1}
                    </div>
                    <div className="student-notes-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                      {[
                        { key: "well", label: "What You Did Well", color: "#4ECDC4", icon: "✅" },
                        { key: "improve", label: "What to Improve", color: "#FF6B6B", icon: "🔧" },
                        { key: "focus", label: "Focus Next Week", color: BRAND.accent, icon: "🎯" },
                      ].map(({ key, label, color, icon }) => currentWeek.notes[key] ? (
                        <div key={key}>
                          <div style={{ fontSize: 12, fontWeight: 600, color, marginBottom: 8 }}>
                            {icon} {label}
                          </div>
                          <div style={{
                            fontSize: 13, color: theme.textPrimary, lineHeight: 1.6,
                            whiteSpace: "pre-wrap",
                          }}>
                            {currentWeek.notes[key]}
                          </div>
                        </div>
                      ) : null)}
                    </div>
                  </Card>
                )}
              </div>
            )}
          </>
        ) : (
          /* Progress View with Charts */
          <div className="fade-in">
            {hasAnyData ? (
              <>
                {/* Overall Progress */}
                <Card theme={theme} style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Overall Progress</div>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="name" stroke={theme.textSecondary} fontSize={12} />
                      <YAxis domain={[0, 100]} stroke={theme.textSecondary} fontSize={12} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="Overall" stroke={BRAND.accent} fill={BRAND.accentDim} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>

                {/* Category Charts */}
                <div className="student-chart-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                  {Object.entries(CATEGORIES).map(([key, cat]) => (
                    <Card key={key} theme={theme}>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: cat.color }}>
                        {cat.icon} {cat.label}
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="name" stroke={theme.textSecondary} fontSize={11} />
                          <YAxis domain={[0, 100]} stroke={theme.textSecondary} fontSize={11} />
                          <Tooltip content={<CustomTooltip />} />
                          <Area type="monotone" dataKey={cat.label} stroke={cat.color} fill={`${cat.color}22`} strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </Card>
                  ))}

                  {/* Mental State Chart */}
                  <Card theme={theme}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Mental State Trends</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="name" stroke={theme.textSecondary} fontSize={11} />
                        <YAxis domain={[1, 10]} stroke={theme.textSecondary} fontSize={11} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line type="monotone" dataKey="Anxiety" stroke="#FF6B6B" strokeWidth={2} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="Confidence" stroke="#4ECDC4" strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>
                </div>

                {/* All Coaching Notes */}
                <Card theme={theme}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>All Coaching Notes</div>
                  {student.weeks.map((w, i) => {
                    const hasNotes = w.notes.well || w.notes.improve || w.notes.focus;
                    if (!hasNotes) return null;
                    return (
                      <div key={i} style={{
                        padding: 16, marginBottom: 12, borderRadius: 12,
                        border: `1px solid ${theme.cardBorder}`, background: theme.cardBg,
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.accent, marginBottom: 10 }}>
                          Week {i + 1}
                        </div>
                        <div className="student-notes-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                          {[
                            { key: "well", label: "Did Well", color: "#4ECDC4" },
                            { key: "improve", label: "Improve", color: "#FF6B6B" },
                            { key: "focus", label: "Focus", color: BRAND.accent },
                          ].map(({ key, label, color }) => w.notes[key] ? (
                            <div key={key}>
                              <div style={{ fontSize: 10, fontWeight: 600, color, marginBottom: 4 }}>{label}</div>
                              <div style={{ fontSize: 12, color: theme.textPrimary, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                                {w.notes[key]}
                              </div>
                            </div>
                          ) : null)}
                        </div>
                      </div>
                    );
                  })}
                </Card>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: 60, color: theme.textSecondary }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>No scores yet</div>
                <div style={{ fontSize: 13, marginTop: 8 }}>Your coach hasn't scored any weeks yet. Check back soon!</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN ONLINE APP ────────────────────────────────────────
export default function OnlineApp() {
  const [user, setUser] = useState(null);
  const [isCoachUser, setIsCoachUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  // Check for student share code in URL
  const params = new URLSearchParams(window.location.search);
  const studentShareCode = params.get("student");

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoading(false);
      return;
    }

    // If student view, do anonymous auth
    if (studentShareCode) {
      anonymousLogin().then(() => setLoading(false)).catch(() => setLoading(false));
      return;
    }

    // Coach auth listener
    const unsub = onAuthChange(async (authUser) => {
      if (authUser && !authUser.isAnonymous) {
        const coach = await isCoach(authUser.uid);
        setIsCoachUser(coach);
        setUser(authUser);
      } else {
        setUser(null);
        setIsCoachUser(false);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [studentShareCode]);

  if (!isFirebaseConfigured()) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#0C0C14", fontFamily: "'DM Sans', sans-serif", padding: 32,
      }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700;800;900&display=swap" rel="stylesheet" />
        <div style={{ maxWidth: 500, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: BRAND.accent, fontFamily: "'Playfair Display', serif", marginBottom: 16 }}>
            Firebase Setup Required
          </div>
          <div style={{ color: "#888", fontSize: 14, lineHeight: 1.8 }}>
            To use the online performance tracker, you need to set up Firebase:
          </div>
          <div style={{
            textAlign: "left", marginTop: 20, padding: 20, borderRadius: 12,
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
            color: "#ccc", fontSize: 13, lineHeight: 2,
          }}>
            1. Go to console.firebase.google.com<br />
            2. Create a new project<br />
            3. Add a web app and copy the config<br />
            4. Paste it in <code style={{ color: BRAND.accent }}>src/firebase.js</code><br />
            5. Enable Firestore Database<br />
            6. Enable Email/Password + Anonymous Auth<br />
            7. Deploy Firestore rules from <code style={{ color: BRAND.accent }}>firestore.rules</code>
          </div>
          <div style={{ marginTop: 20, color: "#666", fontSize: 12 }}>
            The offline tracker at <code style={{ color: BRAND.accent }}>/</code> still works without Firebase.
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#0C0C14", color: BRAND.accent, fontFamily: "'DM Sans', sans-serif",
        fontSize: 16,
      }}>Loading...</div>
    );
  }

  // Student share link view
  if (studentShareCode) {
    return <StudentView shareCode={studentShareCode} darkMode={darkMode} setDarkMode={setDarkMode} />;
  }

  // Coach auth flow
  if (!user || !isCoachUser) {
    return <AuthScreen onAuth={setUser} darkMode={darkMode} />;
  }

  return <CoachDashboard user={user} onLogout={logout} darkMode={darkMode} setDarkMode={setDarkMode} />;
}
