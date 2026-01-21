import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  CheckSquare,
  CalendarDays,
  GraduationCap,
  Settings as SettingsIcon,
  Plus,
  Search,
  Sun,
  Moon,
  Tag,
  Timer,
  BookOpen,
  Trash2,
  Pencil,
  Eye,
  Trophy,
} from "lucide-react";

import { Card, Button, Input, Select, TextArea, Badge } from "./components/ui";
import { Modal } from "./components/Modal";
import { Toast, ToastType } from "./components/Toast";
import { CalendarMonth } from "./components/CalendarMonth";
import { addDays, formatShortDate, startOfDay, toDatetimeLocalFromISO, toISOFromDatetimeLocal, clamp } from "./lib/date";
import { saveOfflineCache, loadOfflineCache, clearOfflineCache } from "./lib/storage";

type ID = string;
type Priority = "low" | "medium" | "high";
type Tab = "dashboard" | "tasks" | "calendar" | "grades" | "settings";

type Course = {
  id: ID;
  name: string;
  color: string;
  credits?: number;
};

type Task = {
  id: ID;
  title: string;
  courseId?: ID;
  dueISO?: string;
  priority: Priority;
  notes?: string;
  done: boolean;
  createdISO: string;
  tags?: string[];
  estimateMinutes?: number;

  // NEW
  pointsPossible?: number;
  pointsEarned?: number;
  completedISO?: string;
};

type GradeItem = {
  id: ID;
  courseId?: ID;
  name: string;
  scoreEarned: number;
  scoreTotal: number;
  weight?: number;
  dueISO?: string;

  // NEW
  taskId?: ID;
  createdISO?: string;
};

type Settings = {
  semesterName: string;
  weekStartsOn: 0 | 1;
  theme?: "light" | "dark";
  defaultView?: Tab;
};

type AppState = {
  version: number;
  courses: Course[];
  tasks: Task[];
  grades: GradeItem[];
  settings: Settings;
};

const DEFAULT_STATE: AppState = {
  version: 2,
  courses: [],
  tasks: [],
  grades: [],
  settings: {
    semesterName: "Semester",
    weekStartsOn: 1,
    theme: "light",
    defaultView: "dashboard",
  },
};

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function courseName(courses: Course[], id?: string) {
  if (!id) return "No course";
  return courses.find((c) => c.id === id)?.name ?? "Unknown course";
}

function parseTags(raw: string): string[] | undefined {
  const cleaned = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);
  return cleaned.length ? cleaned : undefined;
}

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

function safeNum(v: string) {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [state, setState] = useState<AppState>(() => loadOfflineCache<AppState>() ?? DEFAULT_STATE);

  const [loading, setLoading] = useState(true);
  const [sync, setSync] = useState<"idle" | "saving" | "saved" | "error" | "offline">("idle");

  const [toast, setToast] = useState<{ open: boolean; type: ToastType; message: string }>({
    open: false,
    type: "info",
    message: "",
  });

  const [search, setSearch] = useState("");
  const [filterCourse, setFilterCourse] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "done">("all");
  const [filterPriority, setFilterPriority] = useState<"all" | Priority>("all");
  const [sortMode, setSortMode] = useState<"due" | "created" | "priority">("due");

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [gradeModalOpen, setGradeModalOpen] = useState(false);

  // NEW: details modal
  const [taskDetailsOpen, setTaskDetailsOpen] = useState(false);
  const [taskDetailsId, setTaskDetailsId] = useState<ID | null>(null);

  // NEW: completion modal (asks grade)
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeTaskId, setCompleteTaskId] = useState<ID | null>(null);
  const [completeEarned, setCompleteEarned] = useState("0");

  // Task form
  const [editingTaskId, setEditingTaskId] = useState<ID | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskCourse, setTaskCourse] = useState<string>("none");
  const [taskDue, setTaskDue] = useState<string>("");
  const [taskPriority, setTaskPriority] = useState<Priority>("medium");
  const [taskNotes, setTaskNotes] = useState("");
  const [taskTags, setTaskTags] = useState("");
  const [taskEstimate, setTaskEstimate] = useState("");
  const [taskPoints, setTaskPoints] = useState("");

  // Course form
  const [courseNameInput, setCourseNameInput] = useState("");
  const [courseColor, setCourseColor] = useState("#3b82f6");
  const [courseCredits, setCourseCredits] = useState("3");

  // Grade form
  const [gradeName, setGradeName] = useState("");
  const [gradeCourse, setGradeCourse] = useState<string>("none");
  const [gradeEarned, setGradeEarned] = useState("0");
  const [gradeTotal, setGradeTotal] = useState("100");
  const [gradeWeight, setGradeWeight] = useState("");
  const [gradeDue, setGradeDue] = useState("");

  // Calendar
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(startOfDay(now));

  const debounced = useRef<number | null>(null);

  // Theme
  const theme = state.settings.theme ?? "light";
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName ?? "";
      const inField =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target as HTMLElement | null)?.getAttribute?.("contenteditable") === "true";

      if (e.key === "/" && !inField) {
        e.preventDefault();
        (document.getElementById("globalSearch") as HTMLInputElement | null)?.focus();
      }
      if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey && !e.altKey && !inField) {
        e.preventDefault();
        openNewTask();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Load from backend
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/state");
        if (!res.ok) throw new Error("Failed to load");
        const data = (await res.json()) as Partial<AppState>;

        const merged: AppState = {
          ...DEFAULT_STATE,
          ...data,
          version: typeof data.version === "number" ? data.version : DEFAULT_STATE.version,
          settings: { ...DEFAULT_STATE.settings, ...(data.settings ?? {}) } as Settings,
          courses: Array.isArray((data as any).courses) ? ((data as any).courses as Course[]) : [],
          tasks: Array.isArray((data as any).tasks) ? ((data as any).tasks as Task[]) : [],
          grades: Array.isArray((data as any).grades) ? ((data as any).grades as GradeItem[]) : [],
        };

        setState(merged);
        saveOfflineCache(merged);
        clearOfflineCache();
        setSync("idle");
      } catch {
        setSync("offline");
        setToast({ open: true, type: "error", message: "Offline: using cached data" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Save to backend (debounced)
  useEffect(() => {
    if (loading) return;
    saveOfflineCache(state);

    if (debounced.current) window.clearTimeout(debounced.current);
    setSync("saving");

    debounced.current = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(state),
        });
        if (!res.ok) throw new Error("save failed");

        setSync("saved");
        setToast({ open: true, type: "success", message: "Saved" });
        window.setTimeout(() => setSync("idle"), 900);
      } catch {
        setSync("error");
        setToast({ open: true, type: "error", message: "Save failed (check /api/state)" });
      }
    }, 450);

    return () => {
      if (debounced.current) window.clearTimeout(debounced.current);
    };
  }, [state, loading]);

  // Default view
  useEffect(() => {
    if (loading) return;
    const dv = state.settings.defaultView;
    if (dv && dv !== tab) setTab(dv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const courseOptions = useMemo(() => {
    return [
      { value: "all", label: "All courses" },
      { value: "none", label: "No course" },
      ...state.courses.map((c) => ({ value: c.id, label: c.name })),
    ];
  }, [state.courses]);

  const nowDay = startOfDay(new Date());
  const overdue = useMemo(
    () => state.tasks.filter((t) => !t.done && t.dueISO && startOfDay(new Date(t.dueISO)) < nowDay),
    [state.tasks, nowDay]
  );
  const dueToday = useMemo(
    () =>
      state.tasks.filter(
        (t) => !t.done && t.dueISO && startOfDay(new Date(t.dueISO)).getTime() === nowDay.getTime()
      ),
    [state.tasks, nowDay]
  );
  const dueSoon = useMemo(() => {
    const in7 = startOfDay(addDays(nowDay, 7));
    return state.tasks.filter(
      (t) =>
        !t.done &&
        t.dueISO &&
        startOfDay(new Date(t.dueISO)) > nowDay &&
        startOfDay(new Date(t.dueISO)) <= in7
    );
  }, [state.tasks, nowDay]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.tasks
      .filter((t) => {
        if (filterStatus === "open" && t.done) return false;
        if (filterStatus === "done" && !t.done) return false;
        if (filterCourse === "none" && t.courseId) return false;
        if (filterCourse !== "all" && filterCourse !== "none" && t.courseId !== filterCourse) return false;
        if (filterPriority !== "all" && t.priority !== filterPriority) return false;

        if (!q) return true;
        const hay = [t.title, t.notes ?? "", (t.tags ?? []).join(" "), courseName(state.courses, t.courseId)]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .slice()
      .sort((a, b) => {
        if (sortMode === "created") return new Date(b.createdISO).getTime() - new Date(a.createdISO).getTime();
        if (sortMode === "priority") {
          const rank = (p: Priority) => (p === "high" ? 3 : p === "medium" ? 2 : 1);
          return rank(b.priority) - rank(a.priority);
        }
        const da = a.dueISO ? new Date(a.dueISO).getTime() : Number.POSITIVE_INFINITY;
        const db = b.dueISO ? new Date(b.dueISO).getTime() : Number.POSITIVE_INFINITY;
        return da - db;
      });
  }, [state.tasks, state.courses, search, filterCourse, filterStatus, filterPriority, sortMode]);

  const selectedTask = useMemo(() => {
    if (!taskDetailsId) return null;
    return state.tasks.find((t) => t.id === taskDetailsId) ?? null;
  }, [taskDetailsId, state.tasks]);

  const dayTasks = useMemo(() => {
    const d0 = startOfDay(selectedDay).getTime();
    return state.tasks
      .filter((t) => t.dueISO && startOfDay(new Date(t.dueISO)).getTime() === d0)
      .slice()
      .sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));
  }, [state.tasks, selectedDay]);

  const dayMeta = (d: Date) => {
    const t = startOfDay(d).getTime();
    const count = state.tasks.filter(
      (x) => x.dueISO && startOfDay(new Date(x.dueISO)).getTime() === t && !x.done
    ).length;
    return { count };
  };

  const gradeStats = useMemo(() => {
    const byCourse: Record<string, { earned: number; total: number; weightedEarned: number; weightedTotal: number }> = {};
    for (const g of state.grades) {
      const cid = g.courseId ?? "none";
      byCourse[cid] ??= { earned: 0, total: 0, weightedEarned: 0, weightedTotal: 0 };
      const earned = Number(g.scoreEarned) || 0;
      const total = Number(g.scoreTotal) || 0;
      byCourse[cid].earned += earned;
      byCourse[cid].total += total;

      const w = typeof g.weight === "number" ? g.weight : undefined;
      if (w !== undefined) {
        byCourse[cid].weightedEarned += (earned / Math.max(1, total)) * w;
        byCourse[cid].weightedTotal += w;
      }
    }
    const overallEarned = sum(Object.values(byCourse).map((x) => x.earned));
    const overallTotal = sum(Object.values(byCourse).map((x) => x.total));
    return { byCourse, overallEarned, overallTotal };
  }, [state.grades]);

  function openNewTask(prefill?: { dueISO?: string }) {
    setEditingTaskId(null);
    setTaskTitle("");
    setTaskCourse("none");
    setTaskDue(prefill?.dueISO ? toDatetimeLocalFromISO(prefill.dueISO) : "");
    setTaskPriority("medium");
    setTaskNotes("");
    setTaskTags("");
    setTaskEstimate("");
    setTaskPoints("");
    setTaskModalOpen(true);
  }

  function openEditTask(t: Task) {
    setEditingTaskId(t.id);
    setTaskTitle(t.title);
    setTaskCourse(t.courseId ?? "none");
    setTaskDue(toDatetimeLocalFromISO(t.dueISO));
    setTaskPriority(t.priority);
    setTaskNotes(t.notes ?? "");
    setTaskTags((t.tags ?? []).join(", "));
    setTaskEstimate(t.estimateMinutes ? String(t.estimateMinutes) : "");
    setTaskPoints(typeof t.pointsPossible === "number" ? String(t.pointsPossible) : "");
    setTaskModalOpen(true);
  }

  function openTaskDetails(id: ID) {
    setTaskDetailsId(id);
    setTaskDetailsOpen(true);
  }

  function saveTask() {
    const dueISO = toISOFromDatetimeLocal(taskDue);
    const tags = parseTags(taskTags);
    const est = taskEstimate.trim() ? clamp(parseInt(taskEstimate.trim(), 10) || 0, 0, 9999) : undefined;
    const pts = taskPoints.trim() ? clamp(parseInt(taskPoints.trim(), 10) || 0, 0, 999999) : undefined;

    if (!taskTitle.trim()) {
      setToast({ open: true, type: "error", message: "Task title is required" });
      return;
    }

if (editingTaskId) {
  setState((s) => {
    let updated: Task | null = null;

    const nextTasks = s.tasks.map((t) => {
      if (t.id !== editingTaskId) return t;

      const nextEarned =
        typeof t.pointsEarned === "number" && typeof pts === "number" ? clamp(t.pointsEarned, 0, pts) : t.pointsEarned;

      updated = {
        ...t,
        title: taskTitle.trim(),
        courseId: taskCourse === "none" ? undefined : taskCourse,
        dueISO,
        priority: taskPriority,
        notes: taskNotes.trim() || undefined,
        tags,
        estimateMinutes: est,
        pointsPossible: pts,
        pointsEarned: nextEarned,
      };

      return updated;
    });

    let nextGrades = s.grades.slice();

    // Keep auto-grade items in sync when editing a completed task.
    if (updated?.done) {
      if (
        typeof updated.pointsPossible === "number" &&
        updated.pointsPossible > 0 &&
        typeof updated.pointsEarned === "number"
      ) {
        const existing = nextGrades.find((g) => g.taskId === updated!.id);
        const item: GradeItem = {
          id: existing?.id ?? uid("grade"),
          taskId: updated.id,
          courseId: updated.courseId,
          name: updated.title,
          scoreEarned: clamp(updated.pointsEarned, 0, updated.pointsPossible),
          scoreTotal: updated.pointsPossible,
          dueISO: updated.dueISO,
          createdISO: existing?.createdISO ?? new Date().toISOString(),
        };
        nextGrades = existing ? nextGrades.map((g) => (g.taskId === updated!.id ? item : g)) : [item, ...nextGrades];
      } else {
        nextGrades = nextGrades.filter((g) => g.taskId !== updated!.id);
      }
    }

    return { ...s, tasks: nextTasks, grades: nextGrades };
  });

    } else {
      const newTask: Task = {
        id: uid("task"),
        title: taskTitle.trim(),
        courseId: taskCourse === "none" ? undefined : taskCourse,
        dueISO,
        priority: taskPriority,
        notes: taskNotes.trim() || undefined,
        done: false,
        createdISO: new Date().toISOString(),
        tags,
        estimateMinutes: est,
        pointsPossible: pts,
      };
      setState((s) => ({ ...s, tasks: [newTask, ...s.tasks] }));
    }

    setTaskModalOpen(false);
  }

  function beginCompleteTask(id: ID) {
    const t = state.tasks.find((x) => x.id === id);
    if (!t) return;

    if (typeof t.pointsPossible !== "number" || t.pointsPossible <= 0) {
      applyTaskDone(id, true, undefined);
      return;
    }

    setCompleteTaskId(id);
    setCompleteEarned(typeof t.pointsEarned === "number" ? String(t.pointsEarned) : String(t.pointsPossible));
    setCompleteOpen(true);
  }

  function applyTaskDone(id: ID, done: boolean, earned?: number) {
    setState((s) => {
      const t = s.tasks.find((x) => x.id === id);
      if (!t) return s;

      if (!done) {
        return {
          ...s,
          tasks: s.tasks.map((x) =>
            x.id === id ? { ...x, done: false, pointsEarned: undefined, completedISO: undefined } : x
          ),
          grades: s.grades.filter((g) => g.taskId !== id),
        };
      }

      const ptsPossible = t.pointsPossible;
      const ptsEarned =
        typeof earned === "number"
          ? earned
          : typeof t.pointsEarned === "number"
          ? t.pointsEarned
          : typeof ptsPossible === "number"
          ? clamp(ptsPossible, 0, 999999)
          : undefined;

      const nextTasks = s.tasks.map((x) =>
        x.id === id
          ? { ...x, done: true, pointsEarned: ptsEarned, completedISO: new Date().toISOString() }
          : x
      );

      let nextGrades = s.grades.slice();
      if (typeof ptsPossible === "number" && ptsPossible > 0 && typeof ptsEarned === "number") {
        const existing = nextGrades.find((g) => g.taskId === id);
        const item: GradeItem = {
          id: existing?.id ?? uid("grade"),
          taskId: id,
          courseId: t.courseId,
          name: t.title,
          scoreEarned: clamp(ptsEarned, 0, ptsPossible),
          scoreTotal: ptsPossible,
          dueISO: t.dueISO,
          createdISO: existing?.createdISO ?? new Date().toISOString(),
        };

        nextGrades = existing ? nextGrades.map((g) => (g.taskId === id ? item : g)) : [item, ...nextGrades];
      }

      return { ...s, tasks: nextTasks, grades: nextGrades };
    });
  }

  function confirmComplete() {
    if (!completeTaskId) return;
    const t = state.tasks.find((x) => x.id === completeTaskId);
    if (!t) return;

    const total = typeof t.pointsPossible === "number" ? t.pointsPossible : 0;
    const earned = clamp(Math.round(safeNum(completeEarned) * 10) / 10, 0, total);

    applyTaskDone(completeTaskId, true, earned);
    setCompleteOpen(false);
    setCompleteTaskId(null);
  }

  function toggleTask(id: ID) {
    const t = state.tasks.find((x) => x.id === id);
    if (!t) return;
    if (t.done) applyTaskDone(id, false);
    else beginCompleteTask(id);
  }

  function deleteTask(id: ID) {
    setState((s) => ({
      ...s,
      tasks: s.tasks.filter((t) => t.id !== id),
      grades: s.grades.filter((g) => g.taskId !== id),
    }));
    if (taskDetailsId === id) setTaskDetailsOpen(false);
  }

  function addCourse() {
    if (!courseNameInput.trim()) {
      setToast({ open: true, type: "error", message: "Course name is required" });
      return;
    }
    const credits = courseCredits.trim() ? clamp(parseInt(courseCredits.trim(), 10) || 0, 0, 30) : undefined;

    const c: Course = {
      id: uid("course"),
      name: courseNameInput.trim(),
      color: courseColor,
      credits,
    };
    setState((s) => ({ ...s, courses: [c, ...s.courses] }));
    setCourseModalOpen(false);
  }

  function deleteCourse(id: ID) {
    setState((s) => ({
      ...s,
      courses: s.courses.filter((c) => c.id !== id),
      tasks: s.tasks.map((t) => (t.courseId === id ? { ...t, courseId: undefined } : t)),
      grades: s.grades.map((g) => (g.courseId === id ? { ...g, courseId: undefined } : g)),
    }));
  }

  function addGrade() {
    if (!gradeName.trim()) {
      setToast({ open: true, type: "error", message: "Assignment name is required" });
      return;
    }
    const earned = Number(gradeEarned);
    const total = Number(gradeTotal);
    if (!isFinite(earned) || !isFinite(total) || total <= 0) {
      setToast({ open: true, type: "error", message: "Scores must be valid (total > 0)" });
      return;
    }
    const w = gradeWeight.trim() ? clamp(Number(gradeWeight), 0, 100) : undefined;

    const g: GradeItem = {
      id: uid("grade"),
      courseId: gradeCourse === "none" ? undefined : gradeCourse,
      name: gradeName.trim(),
      scoreEarned: earned,
      scoreTotal: total,
      weight: w,
      dueISO: toISOFromDatetimeLocal(gradeDue),
      createdISO: new Date().toISOString(),
    };

    setState((s) => ({ ...s, grades: [g, ...s.grades] }));
    setGradeModalOpen(false);
  }

  function deleteGrade(id: ID) {
    setState((s) => ({ ...s, grades: s.grades.filter((g) => g.id !== id) }));
  }

  function setTheme(next: "light" | "dark") {
    setState((s) => ({ ...s, settings: { ...s.settings, theme: next } }));
  }

  function setDefaultView(next: Tab) {
    setState((s) => ({ ...s, settings: { ...s.settings, defaultView: next } }));
  }

  const syncBadge = (() => {
    if (sync === "saving") return <Badge tone="info">Syncing…</Badge>;
    if (sync === "saved") return <Badge tone="good">Synced</Badge>;
    if (sync === "error") return <Badge tone="bad">Save error</Badge>;
    if (sync === "offline") return <Badge tone="warn">Offline</Badge>;
    return <Badge tone="neutral">Ready</Badge>;
  })();

  const shellBg = "bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-950";
  const pageText = "text-slate-900 dark:text-slate-100";

  const navItem = (key: Tab, label: string, Icon: any) => (
    <button
      key={key}
      onClick={() => setTab(key)}
      className={[
        "flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition",
        tab === key
          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950"
          : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900",
      ].join(" ")}
    >
      <Icon size={18} />
      <span className="truncate">{label}</span>
    </button>
  );

  return (
    <div className={`min-h-screen ${shellBg} ${pageText}`}>
      <Toast
        open={toast.open}
        type={toast.type}
        message={toast.message}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 p-4 md:grid-cols-[260px_1fr] md:p-6">
        <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 md:sticky md:top-6 md:h-[calc(100vh-3rem)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">SCHOOL PLANNER</div>
              <div className="text-lg font-semibold">{state.settings.semesterName}</div>
            </div>
            <button
              className="rounded-xl p-2 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>

          <div className="space-y-2">
            {navItem("dashboard", "Dashboard", LayoutDashboard)}
            {navItem("tasks", "Tasks", CheckSquare)}
            {navItem("calendar", "Calendar", CalendarDays)}
            {navItem("grades", "Grades", GraduationCap)}
            {navItem("settings", "Settings", SettingsIcon)}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/30">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-slate-600 dark:text-slate-300">Status</div>
              {syncBadge}
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Shortcuts: <span className="font-semibold">N</span> new task,{" "}
              <span className="font-semibold">/</span> search
            </div>
          </div>

          <div className="mt-4">
            <Button onClick={() => openNewTask()} className="w-full">
              <Plus size={16} /> New Task
            </Button>
          </div>
        </aside>

        <main className="space-y-4">
          <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/30">
                <BookOpen size={18} />
              </div>
              <div>
                <div className="text-sm font-semibold">{tabLabel(tab)}</div>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  Today: {formatShortDate(new Date())}
                </div>
              </div>
            </div>

            <div className="flex flex-1 items-center gap-2 md:max-w-xl">
              <Input
                id="globalSearch"
                value={search}
                onChange={setSearch}
                placeholder="Search tasks, notes, tags, courses…"
                right={<Search className="text-slate-500" size={16} />}
              />
              <Button variant="outline" onClick={() => openNewTask()}>
                <Plus size={16} /> Add
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              Loading…
            </div>
          ) : null}

          {!loading && tab === "dashboard" ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <Card
                title="At a glance"
                right={<Badge tone="neutral">{state.tasks.filter((t) => !t.done).length} open</Badge>}
                className="lg:col-span-2"
              >
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <KPI label="Overdue" value={overdue.length} tone={overdue.length ? "bad" : "good"} />
                  <KPI label="Due today" value={dueToday.length} tone={dueToday.length ? "warn" : "good"} />
                  <KPI label="Due soon" value={dueSoon.length} tone={dueSoon.length ? "info" : "good"} />
                  <KPI label="Courses" value={state.courses.length} tone="neutral" />
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/30">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">Quick add</div>
                      <Badge tone="neutral">Modal</Badge>
                    </div>
                    <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      Create tasks faster with <span className="font-semibold">N</span>.
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button onClick={() => openNewTask()}>
                        <Plus size={16} /> New task
                      </Button>
                      <Button variant="outline" onClick={() => setTab("calendar")}>
                        <CalendarDays size={16} /> Calendar
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/30">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">Focus timer</div>
                      <Timer size={16} className="text-slate-500" />
                    </div>
                    <FocusTimer />
                  </div>
                </div>
              </Card>

              <Card title="Next up">
                <div className="space-y-3">
                  {nextUp(state.tasks)
                    .slice(0, 6)
                    .map((t) => (
                      <TaskTile
                        key={t.id}
                        task={t}
                        course={state.courses.find((c) => c.id === t.courseId)}
                        onToggle={() => toggleTask(t.id)}
                        onEdit={() => openEditTask(t)}
                        onDelete={() => deleteTask(t.id)}
                        onView={() => openTaskDetails(t.id)}
                      />
                    ))}
                  {nextUp(state.tasks).length === 0 ? (
                    <EmptyState
                      title="Nothing queued"
                      subtitle="Add a task to get started."
                      actionLabel="New task"
                      onAction={() => openNewTask()}
                    />
                  ) : null}
                </div>
              </Card>
            </div>
          ) : null}

          {!loading && tab === "tasks" ? (
            <div className="space-y-4">
              <Card
                title="Filters"
                right={
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">{filteredTasks.length} shown</Badge>
                    <Button variant="outline" onClick={() => setTab("calendar")}>
                      <CalendarDays size={16} /> View calendar
                    </Button>
                  </div>
                }
              >
                <div className="grid gap-3 md:grid-cols-4">
                  <Select label="Course" value={filterCourse} onChange={setFilterCourse} options={courseOptions} />
                  <Select
                    label="Status"
                    value={filterStatus}
                    onChange={(v) => setFilterStatus(v as any)}
                    options={[
                      { value: "all", label: "All" },
                      { value: "open", label: "Open" },
                      { value: "done", label: "Done" },
                    ]}
                  />
                  <Select
                    label="Priority"
                    value={filterPriority}
                    onChange={(v) => setFilterPriority(v as any)}
                    options={[
                      { value: "all", label: "All" },
                      { value: "high", label: "High" },
                      { value: "medium", label: "Medium" },
                      { value: "low", label: "Low" },
                    ]}
                  />
                  <Select
                    label="Sort"
                    value={sortMode}
                    onChange={(v) => setSortMode(v as any)}
                    options={[
                      { value: "due", label: "Due date" },
                      { value: "priority", label: "Priority" },
                      { value: "created", label: "Recently created" },
                    ]}
                  />
                </div>
              </Card>

              <Card title="Tasks" right={<Button onClick={() => openNewTask()}><Plus size={16} /> New</Button>}>
                {filteredTasks.length === 0 ? (
                  <EmptyState
                    title="No matching tasks"
                    subtitle="Try clearing filters, or add a new task."
                    actionLabel="New task"
                    onAction={() => openNewTask()}
                  />
                ) : (
                  <div className="space-y-3">
                    {filteredTasks.map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        course={state.courses.find((c) => c.id === t.courseId)}
                        onToggle={() => toggleTask(t.id)}
                        onEdit={() => openEditTask(t)}
                        onDelete={() => deleteTask(t.id)}
                        onView={() => openTaskDetails(t.id)}
                      />
                    ))}
                  </div>
                )}
              </Card>
            </div>
          ) : null}

          {!loading && tab === "calendar" ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <Card
                title="Calendar"
                right={
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        const d = new Date(calYear, calMonth - 1, 1);
                        setCalYear(d.getFullYear());
                        setCalMonth(d.getMonth());
                      }}
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const d = new Date(calYear, calMonth + 1, 1);
                        setCalYear(d.getFullYear());
                        setCalMonth(d.getMonth());
                      }}
                    >
                      Next
                    </Button>
                  </div>
                }
                className="lg:col-span-2"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold">
                    {new Date(calYear, calMonth, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const t = new Date();
                      setCalYear(t.getFullYear());
                      setCalMonth(t.getMonth());
                      setSelectedDay(startOfDay(t));
                    }}
                  >
                    Today
                  </Button>
                </div>

                <CalendarMonth
                  year={calYear}
                  monthIndex={calMonth}
                  weekStartsOn={state.settings.weekStartsOn}
                  selected={selectedDay}
                  onSelect={(d) => {
                    setSelectedDay(startOfDay(d));
                    if (d.getMonth() !== calMonth) {
                      setCalMonth(d.getMonth());
                      setCalYear(d.getFullYear());
                    }
                  }}
                  dayMeta={dayMeta}
                />
              </Card>

              <Card
                title={`Due on ${selectedDay.toLocaleDateString()}`}
                right={
                  <Button
                    onClick={() =>
                      openNewTask({ dueISO: new Date(selectedDay.getTime() + 12 * 3600000).toISOString() })
                    }
                  >
                    <Plus size={16} /> Add
                  </Button>
                }
              >
                {dayTasks.length === 0 ? (
                  <EmptyState
                    title="No tasks due"
                    subtitle="Click Add to schedule something for this day."
                    actionLabel="Add task"
                    onAction={() =>
                      openNewTask({ dueISO: new Date(selectedDay.getTime() + 12 * 3600000).toISOString() })
                    }
                  />
                ) : (
                  <div className="space-y-2">
                    {dayTasks.map((t) => (
                      <CalendarTaskItem
                        key={t.id}
                        task={t}
                        course={state.courses.find((c) => c.id === t.courseId)}
                        onOpen={() => openTaskDetails(t.id)}
                        onToggle={() => toggleTask(t.id)}
                      />
                    ))}
                  </div>
                )}
              </Card>
            </div>
          ) : null}

          {!loading && tab === "grades" ? (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-3">
                <Card title="Overall" right={<Badge tone="neutral">{state.grades.length} items</Badge>} className="lg:col-span-1">
                  <div className="text-3xl font-semibold">
                    {gradeStats.overallTotal > 0
                      ? `${Math.round((gradeStats.overallEarned / gradeStats.overallTotal) * 1000) / 10}%`
                      : "—"}
                  </div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {gradeStats.overallTotal > 0
                      ? `${gradeStats.overallEarned.toFixed(1)} / ${gradeStats.overallTotal.toFixed(1)} points`
                      : "Add graded items to compute totals."}
                  </div>
                  <div className="mt-4">
                    <Button
                      onClick={() => {
                        resetGradeForm();
                        setGradeModalOpen(true);
                      }}
                    >
                      <Plus size={16} /> Add grade
                    </Button>
                  </div>
                </Card>

                <Card title="By course" className="lg:col-span-2">
                  {Object.keys(gradeStats.byCourse).length === 0 ? (
                    <EmptyState
                      title="No grades yet"
                      subtitle="Add an assignment/quiz/exam and track your progress."
                      actionLabel="Add grade"
                      onAction={() => {
                        resetGradeForm();
                        setGradeModalOpen(true);
                      }}
                    />
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {Object.entries(gradeStats.byCourse).map(([cid, s]) => {
                        const pct = s.total > 0 ? (s.earned / s.total) * 100 : 0;
                        return (
                          <div
                            key={cid}
                            className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/30"
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold">
                                {cid === "none" ? "Unassigned" : courseName(state.courses, cid)}
                              </div>
                              <Badge tone="neutral">{Math.round(pct * 10) / 10}%</Badge>
                            </div>
                            <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-900">
                              <div
                                className="h-2 rounded-full bg-slate-300 dark:bg-slate-700"
                                style={{ width: `${clamp(pct, 0, 100)}%` }}
                              />
                            </div>
                            <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                              {s.earned.toFixed(1)} / {s.total.toFixed(1)} points
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </div>

              <Card title="Grade items" right={<Button onClick={() => { resetGradeForm(); setGradeModalOpen(true); }}><Plus size={16} /> Add</Button>}>
                {state.grades.length === 0 ? (
                  <EmptyState title="Nothing here" subtitle="Add an assignment/quiz/exam to track grades." actionLabel="Add grade" onAction={() => { resetGradeForm(); setGradeModalOpen(true); }} />
                ) : (
                  <div className="space-y-3">
                    {state.grades.map((g) => {
                      const pct = (g.scoreEarned / Math.max(1, g.scoreTotal)) * 100;
                      const fromTask = Boolean(g.taskId);
                      return (
                        <div key={g.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold">{g.name}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <Badge tone="neutral">{cidLabel(g.courseId, state.courses)}</Badge>
                              <Badge tone="info">{Math.round(pct * 10) / 10}%</Badge>
                              {fromTask ? <Badge tone="neutral"><Trophy size={14} /> From task</Badge> : null}
                              {typeof g.weight === "number" ? <Badge tone="neutral">Weight {g.weight}%</Badge> : null}
                              {g.dueISO ? <Badge tone="neutral">{new Date(g.dueISO).toLocaleString()}</Badge> : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {fromTask ? (
                              <Button
                                variant="outline"
                                onClick={() => {
                                  if (g.taskId) openTaskDetails(g.taskId);
                                }}
                              >
                                <Eye size={16} /> View task
                              </Button>
                            ) : null}
                            <Button variant="danger" onClick={() => deleteGrade(g.id)}><Trash2 size={16} /> Delete</Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          ) : null}

          {!loading && tab === "settings" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Preferences">
                <div className="space-y-3">
                  <Input
                    label="Semester name"
                    value={state.settings.semesterName}
                    onChange={(v) => setState((s) => ({ ...s, settings: { ...s.settings, semesterName: v } }))}
                  />
                  <Select
                    label="Week starts on"
                    value={String(state.settings.weekStartsOn)}
                    onChange={(v) =>
                      setState((s) => ({ ...s, settings: { ...s.settings, weekStartsOn: Number(v) as 0 | 1 } }))
                    }
                    options={[
                      { value: "1", label: "Monday" },
                      { value: "0", label: "Sunday" },
                    ]}
                  />
                  <Select
                    label="Default view"
                    value={state.settings.defaultView ?? "dashboard"}
                    onChange={(v) => setDefaultView(v as Tab)}
                    options={[
                      { value: "dashboard", label: "Dashboard" },
                      { value: "tasks", label: "Tasks" },
                      { value: "calendar", label: "Calendar" },
                      { value: "grades", label: "Grades" },
                      { value: "settings", label: "Settings" },
                    ]}
                  />
                  <div className="flex items-center gap-2 pt-2">
                    <Button variant="outline" onClick={() => setTheme("light")}><Sun size={16} /> Light</Button>
                    <Button variant="outline" onClick={() => setTheme("dark")}><Moon size={16} /> Dark</Button>
                  </div>
                </div>
              </Card>

              <Card title="Courses" right={<Button onClick={() => { resetCourseForm(); setCourseModalOpen(true); }}><Plus size={16} /> Add</Button>}>
                {state.courses.length === 0 ? (
                  <EmptyState title="No courses" subtitle="Add courses to filter tasks and track grades." actionLabel="Add course" onAction={() => { resetCourseForm(); setCourseModalOpen(true); }} />
                ) : (
                  <div className="space-y-3">
                    {state.courses.map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex items-center gap-3">
                          <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{c.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {state.tasks.filter((t) => t.courseId === c.id && !t.done).length} open tasks
                              {typeof c.credits === "number" ? ` • ${c.credits} credits` : ""}
                            </div>
                          </div>
                        </div>
                        <Button variant="danger" onClick={() => deleteCourse(c.id)}><Trash2 size={16} /> Delete</Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          ) : null}
        </main>
      </div>

      {/* Task Details Modal */}
      <Modal
        open={taskDetailsOpen}
        title="Task details"
        onClose={() => setTaskDetailsOpen(false)}
        footer={
          selectedTask ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Marking done will ask for your score if points are set.
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (selectedTask) {
                      setTaskDetailsOpen(false);
                      openEditTask(selectedTask);
                    }
                  }}
                >
                  <Pencil size={16} /> Edit
                </Button>
                <Button variant="outline" onClick={() => { if (selectedTask) toggleTask(selectedTask.id); }}>
                  {selectedTask.done ? "Undo" : "Done"}
                </Button>
                <Button variant="danger" onClick={() => { if (selectedTask) deleteTask(selectedTask.id); }}>
                  <Trash2 size={16} /> Delete
                </Button>
              </div>
            </div>
          ) : null
        }
      >
        {!selectedTask ? (
          <div className="text-sm text-slate-600 dark:text-slate-300">Task not found.</div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-lg font-semibold">{selectedTask.title}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone="neutral">{cidLabel(selectedTask.courseId, state.courses)}</Badge>
                <Badge tone={selectedTask.priority === "high" ? "bad" : selectedTask.priority === "medium" ? "warn" : "neutral"}>{selectedTask.priority}</Badge>
                <Badge tone={toneForDue(selectedTask.dueISO, selectedTask.done)}>
                  {selectedTask.dueISO ? new Date(selectedTask.dueISO).toLocaleString() : "No due date"}
                </Badge>
                {typeof selectedTask.estimateMinutes === "number" ? <Badge tone="neutral"><Timer size={14} /> {selectedTask.estimateMinutes} min</Badge> : null}
                {typeof selectedTask.pointsPossible === "number" ? <Badge tone="neutral"><Trophy size={14} /> {selectedTask.pointsPossible} pts</Badge> : null}
                {selectedTask.done ? <Badge tone="good">Done</Badge> : <Badge tone="warn">Open</Badge>}
              </div>
            </div>

            {selectedTask.tags?.length ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tags</div>
                {selectedTask.tags.map((t) => (
                  <Badge key={t} tone="neutral"><Tag size={14} /> {t}</Badge>
                ))}
              </div>
            ) : null}

            {typeof selectedTask.pointsPossible === "number" ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/30">
                <div className="text-sm font-semibold">Score</div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {selectedTask.done && typeof selectedTask.pointsEarned === "number"
                    ? `${selectedTask.pointsEarned} / ${selectedTask.pointsPossible} points`
                    : `Points possible: ${selectedTask.pointsPossible}. Mark done to record your grade.`}
                </div>
              </div>
            ) : null}

            {selectedTask.notes ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="text-sm font-semibold">Notes</div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{selectedTask.notes}</div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-300">
                No notes yet.
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Complete Task Modal */}
      <Modal
        open={completeOpen}
        title="Complete task"
        onClose={() => { setCompleteOpen(false); setCompleteTaskId(null); }}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setCompleteOpen(false); setCompleteTaskId(null); }}>Cancel</Button>
            <Button onClick={confirmComplete}>Save grade + close</Button>
          </div>
        }
      >
        {(() => {
          const t = completeTaskId ? state.tasks.find((x) => x.id === completeTaskId) : null;
          if (!t) return <div className="text-sm text-slate-600 dark:text-slate-300">Task not found.</div>;
          const total = typeof t.pointsPossible === "number" ? t.pointsPossible : 0;
          return (
            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold">{t.title}</div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Enter the score you earned (out of {total}).
                </div>
              </div>

              <Input
                label="Points earned"
                value={completeEarned}
                onChange={setCompleteEarned}
                placeholder={`0 - ${total}`}
                right={<Trophy size={16} className="text-slate-500" />}
              />

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-300">
                This will automatically create/update an entry in <span className="font-semibold">Grades</span>.
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Task Modal */}
      <Modal
        open={taskModalOpen}
        title={editingTaskId ? "Edit task" : "New task"}
        onClose={() => setTaskModalOpen(false)}
        footer={
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Tip: set points to auto-track your grade when you complete the task.
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setTaskModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveTask}>{editingTaskId ? "Save" : "Create"}</Button>
            </div>
          </div>
        }
      >
        <div className="grid gap-3">
          <Input label="Title" value={taskTitle} onChange={setTaskTitle} placeholder="e.g., Homework 3" />
          <div className="grid gap-3 md:grid-cols-3">
            <Select
              label="Course"
              value={taskCourse}
              onChange={setTaskCourse}
              options={[{ value: "none", label: "No course" }, ...state.courses.map((c) => ({ value: c.id, label: c.name }))]}
            />
            <Input label="Due (date/time)" type="datetime-local" value={taskDue} onChange={setTaskDue} />
            <Select
              label="Priority"
              value={taskPriority}
              onChange={(v) => setTaskPriority(v as Priority)}
              options={[
                { value: "high", label: "High" },
                { value: "medium", label: "Medium" },
                { value: "low", label: "Low" },
              ]}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Input
              label="Tags (comma separated)"
              value={taskTags}
              onChange={setTaskTags}
              placeholder="lab, reading, exam"
              right={<Tag size={16} className="text-slate-500" />}
            />
            <Input
              label="Estimate (minutes)"
              value={taskEstimate}
              onChange={setTaskEstimate}
              placeholder="e.g., 60"
              right={<Timer size={16} className="text-slate-500" />}
            />
            <Input
              label="Points (optional)"
              value={taskPoints}
              onChange={setTaskPoints}
              placeholder="e.g., 20"
              right={<Trophy size={16} className="text-slate-500" />}
            />
          </div>

          <TextArea label="Notes" value={taskNotes} onChange={setTaskNotes} placeholder="Optional notes…" />
        </div>
      </Modal>

      {/* Course Modal */}
      <Modal
        open={courseModalOpen}
        title="Add course"
        onClose={() => setCourseModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCourseModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addCourse}>Add course</Button>
          </div>
        }
      >
        <div className="grid gap-3">
          <Input
            label="Course name"
            value={courseNameInput}
            onChange={setCourseNameInput}
            placeholder="e.g., Calculus II"
          />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">Color</div>
              <input
                className="h-10 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-2 dark:border-slate-800 dark:bg-slate-950"
                type="color"
                value={courseColor}
                onChange={(e) => setCourseColor(e.target.value)}
              />
            </label>
            <Input label="Credits (optional)" value={courseCredits} onChange={setCourseCredits} placeholder="e.g., 3" />
          </div>
        </div>
      </Modal>

      {/* Grade Modal */}
      <Modal
        open={gradeModalOpen}
        title="Add grade item"
        onClose={() => setGradeModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setGradeModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addGrade}>Add</Button>
          </div>
        }
      >
        <div className="grid gap-3">
          <Input label="Name" value={gradeName} onChange={setGradeName} placeholder="e.g., Quiz 1" />
          <div className="grid gap-3 md:grid-cols-3">
            <Select
              label="Course"
              value={gradeCourse}
              onChange={setGradeCourse}
              options={[{ value: "none", label: "Unassigned" }, ...state.courses.map((c) => ({ value: c.id, label: c.name }))]}
            />
            <Input label="Earned" value={gradeEarned} onChange={setGradeEarned} placeholder="e.g., 18" />
            <Input label="Total" value={gradeTotal} onChange={setGradeTotal} placeholder="e.g., 20" />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Weight % (optional)" value={gradeWeight} onChange={setGradeWeight} placeholder="e.g., 10" />
            <Input label="Due (optional)" type="datetime-local" value={gradeDue} onChange={setGradeDue} />
          </div>
        </div>
      </Modal>
    </div>
  );

  function resetCourseForm() {
    setCourseNameInput("");
    setCourseColor("#3b82f6");
    setCourseCredits("3");
  }

  function resetGradeForm() {
    setGradeName("");
    setGradeCourse("none");
    setGradeEarned("0");
    setGradeTotal("100");
    setGradeWeight("");
    setGradeDue("");
  }
}

function tabLabel(tab: string) {
  if (tab === "dashboard") return "Dashboard";
  if (tab === "tasks") return "Tasks";
  if (tab === "calendar") return "Calendar";
  if (tab === "grades") return "Grades";
  if (tab === "settings") return "Settings";
  return "School Planner";
}

function KPI({ label, value, tone }: { label: string; value: number; tone: "neutral" | "good" | "warn" | "bad" | "info" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
      <div className="text-xs text-slate-600 dark:text-slate-300">{label}</div>
      <div className="mt-1 flex items-center justify-between">
        <div className="text-2xl font-semibold">{value}</div>
        <Badge tone={tone}>{tone}</Badge>
      </div>
    </div>
  );
}

function EmptyState({ title, subtitle, actionLabel, onAction }: { title: string; subtitle: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center dark:border-slate-700 dark:bg-slate-900/30">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{subtitle}</div>
      <div className="mt-4 flex justify-center">
        <Button onClick={onAction}>{actionLabel}</Button>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  course,
  onToggle,
  onEdit,
  onDelete,
  onView,
}: {
  task: any;
  course?: { id: string; name: string; color: string };
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onView: () => void;
}) {
  const dueTone = toneForDue(task.dueISO, task.done);
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <button className="min-w-0 flex-1 text-left" onClick={onView} title="View details">
        <div className="flex flex-wrap items-center gap-2">
          {course ? <span className="h-2.5 w-2.5 rounded-full" style={{ background: course.color }} /> : null}
          <div className={`text-sm font-semibold ${task.done ? "line-through text-slate-400" : ""}`}>{task.title}</div>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Badge tone={task.priority === "high" ? "bad" : task.priority === "medium" ? "warn" : "neutral"}>{task.priority}</Badge>
          <Badge tone={dueTone}>{task.dueISO ? new Date(task.dueISO).toLocaleString() : "No due date"}</Badge>
          {course ? <span className="text-xs text-slate-500 dark:text-slate-400">{course.name}</span> : null}
          {Array.isArray(task.tags) && task.tags.length ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">• {task.tags.join(", ")}</span>
          ) : null}
          {typeof task.estimateMinutes === "number" ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">• {task.estimateMinutes} min</span>
          ) : null}
          {typeof task.pointsPossible === "number" ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">• {task.pointsPossible} pts</span>
          ) : null}
          {task.done && typeof task.pointsEarned === "number" && typeof task.pointsPossible === "number" ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">• scored {task.pointsEarned}/{task.pointsPossible}</span>
          ) : null}
        </div>
        {task.notes ? <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{task.notes}</div> : null}
      </button>
      <div className="flex shrink-0 flex-col gap-2">
        <Button variant="outline" onClick={onToggle}>{task.done ? "Undo" : "Done"}</Button>
        <Button variant="ghost" onClick={onEdit}><Pencil size={16} /> Edit</Button>
        <Button variant="danger" onClick={onDelete}><Trash2 size={16} /> Delete</Button>
      </div>
    </div>
  );
}

function TaskTile({
  task,
  course,
  onToggle,
  onEdit,
  onDelete,
  onView,
}: {
  task: any;
  course?: { id: string; name: string; color: string };
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onView: () => void;
}) {
  const dueTone = toneForDue(task.dueISO, task.done);
  return (
    <button
      className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
      onClick={onView}
      title="View details"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {course ? <span className="h-2.5 w-2.5 rounded-full" style={{ background: course.color }} /> : null}
            <div className={`text-sm font-semibold ${task.done ? "line-through text-slate-400" : ""}`}>{task.title}</div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={dueTone}>{task.dueISO ? new Date(task.dueISO).toLocaleString() : "No due date"}</Badge>
            <Badge tone={task.priority === "high" ? "bad" : task.priority === "medium" ? "warn" : "neutral"}>{task.priority}</Badge>
            {typeof task.pointsPossible === "number" ? <Badge tone="neutral"><Trophy size={14} /> {task.pointsPossible}</Badge> : null}
          </div>
        </div>

        <div className="flex gap-2">
          <span
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            <Button variant="outline">{task.done ? "Undo" : "Done"}</Button>
          </span>
          <span
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Button variant="ghost"><Pencil size={16} /></Button>
          </span>
          <span
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Button variant="danger"><Trash2 size={16} /></Button>
          </span>
        </div>
      </div>
    </button>
  );
}

function CalendarTaskItem({
  task,
  course,
  onOpen,
  onToggle,
}: {
  task: any;
  course?: { id: string; name: string; color: string };
  onOpen: () => void;
  onToggle: () => void;
}) {
  const dueTone = toneForDue(task.dueISO, task.done);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="min-w-0 flex-1 text-left" title="View details">
          <div className="flex items-center gap-2">
            {course ? <span className="h-2.5 w-2.5 rounded-full" style={{ background: course.color }} /> : null}
            <div className={`truncate text-sm font-semibold ${task.done ? "line-through text-slate-400" : ""}`}>{task.title}</div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge tone={dueTone}>{task.dueISO ? new Date(task.dueISO).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "No time"}</Badge>
            <Badge tone={task.priority === "high" ? "bad" : task.priority === "medium" ? "warn" : "neutral"}>{task.priority}</Badge>
            {typeof task.pointsPossible === "number" ? <Badge tone="neutral"><Trophy size={14} /> {task.pointsPossible}</Badge> : null}
          </div>
        </button>
        <div className="shrink-0">
          <Button variant="outline" onClick={onToggle}>{task.done ? "Undo" : "Done"}</Button>
        </div>
      </div>
    </div>
  );
}

function nextUp(tasks: any[]) {
  const open = tasks.filter((t) => !t.done);
  return open.slice().sort((a, b) => {
    const da = a.dueISO ? new Date(a.dueISO).getTime() : Number.POSITIVE_INFINITY;
    const db = b.dueISO ? new Date(b.dueISO).getTime() : Number.POSITIVE_INFINITY;
    return da - db;
  });
}

function FocusTimer() {
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    if (seconds === 0) setRunning(false);
  }, [seconds, running]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="mt-3">
      <div className="text-3xl font-semibold tabular-nums">
        {mm}:{ss}
      </div>
      <div className="mt-3 flex gap-2">
        <Button onClick={() => setRunning((r) => !r)}>{running ? "Pause" : "Start"}</Button>
        <Button
          variant="outline"
          onClick={() => {
            setRunning(false);
            setSeconds(25 * 60);
          }}
        >
          Reset
        </Button>
        <Button variant="ghost" onClick={() => setSeconds((s) => Math.min(60 * 60, s + 5 * 60))}>
          +5m
        </Button>
      </div>
      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Simple pomodoro timer (no notifications).</div>
    </div>
  );
}

function cidLabel(courseId: string | undefined, courses: any[]) {
  if (!courseId) return "Unassigned";
  return courses.find((c: any) => c.id === courseId)?.name ?? "Unknown";
}

function toneForDue(dueISO?: string, done?: boolean): "neutral" | "bad" | "warn" | "info" {
  if (done) return "neutral";
  if (!dueISO) return "neutral";
  const now = startOfDay(new Date());
  const due = startOfDay(new Date(dueISO));
  if (due < now) return "bad";
  if (due.getTime() === now.getTime()) return "warn";
  return "info";
}
