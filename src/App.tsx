import React, { useEffect, useMemo, useRef, useState } from "react";

type ID = string;
type Priority = "low" | "medium" | "high";

type Course = {
  id: ID;
  name: string;
  color: string;
};

type Task = {
  id: ID;
  title: string;
  courseId?: ID;
  dueISO?: string; // ISO datetime
  priority: Priority;
  notes?: string;
  done: boolean;
  createdISO: string;
};

type Settings = {
  semesterName: string;
  weekStartsOn: 0 | 1;
};

type AppState = {
  version: number;
  courses: Course[];
  tasks: Task[];
  grades: any[];
  settings: Settings;
};

const DEFAULT_STATE: AppState = {
  version: 1,
  courses: [],
  tasks: [],
  grades: [],
  settings: { semesterName: "Semester", weekStartsOn: 1 },
};

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function priorityTone(p: Priority) {
  if (p === "high") return "bg-rose-100 text-rose-800 border-rose-200";
  if (p === "medium") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function dueTone(dueISO?: string, done?: boolean) {
  if (done) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (!dueISO) return "bg-slate-100 text-slate-700 border-slate-200";
  const now = startOfDay(new Date());
  const due = startOfDay(new Date(dueISO));
  if (due < now) return "bg-rose-100 text-rose-800 border-rose-200";
  if (isSameDay(due, now)) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-sky-100 text-sky-800 border-sky-200";
}

function Badge({ children, cls }: { children: React.ReactNode; cls: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}>{children}</span>;
}

function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-slate-400/30 disabled:opacity-50";
  const styles: Record<string, string> = {
    primary: "bg-slate-900 text-white hover:bg-slate-800",
    outline: "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
    ghost: "bg-transparent text-slate-800 hover:bg-slate-100",
    danger: "bg-rose-600 text-white hover:bg-rose-500",
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`${base} ${styles[variant]} ${className ?? ""}`}>
      {children}
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      {label ? <div className="mb-1 text-xs font-medium text-slate-600">{label}</div> : null}
      <input
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400/20"
        value={value}
        type={type}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      {label ? <div className="mb-1 text-xs font-medium text-slate-600">{label}</div> : null}
      <select
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400/20"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      {label ? <div className="mb-1 text-xs font-medium text-slate-600">{label}</div> : null}
      <textarea
        className="min-h-[96px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400/20"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="flex items-center gap-2">{right}</div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type Tab = "dashboard" | "tasks" | "courses" | "settings";

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Task editor state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskCourse, setTaskCourse] = useState<string>("none");
  const [taskDue, setTaskDue] = useState<string>("");
  const [taskPriority, setTaskPriority] = useState<Priority>("medium");
  const [taskNotes, setTaskNotes] = useState("");

  // Course editor state
  const [courseName, setCourseName] = useState("");
  const [courseColor, setCourseColor] = useState("#3b82f6");

  const debounced = useRef<number | null>(null);

  // Load from backend
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/state");
        if (!res.ok) throw new Error("Failed to load");
        const data = (await res.json()) as AppState;
        setState({
          ...DEFAULT_STATE,
          ...data,
          settings: { ...DEFAULT_STATE.settings, ...(data.settings ?? {}) },
        });
      } catch {
        // fallback to default
        setState(DEFAULT_STATE);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Save to backend (debounced)
  useEffect(() => {
    if (loading) return;
    if (debounced.current) window.clearTimeout(debounced.current);
    setSaveStatus("saving");
    debounced.current = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(state),
        });
        if (!res.ok) throw new Error("save failed");
        setSaveStatus("saved");
        window.setTimeout(() => setSaveStatus("idle"), 1200);
      } catch {
        setSaveStatus("error");
      }
    }, 450);
    return () => {
      if (debounced.current) window.clearTimeout(debounced.current);
    };
  }, [state, loading]);

  const now = new Date();
  const today = startOfDay(now);

  const courseOptions = useMemo(() => {
    return [{ value: "none", label: "No course" }, ...state.courses.map((c) => ({ value: c.id, label: c.name }))];
  }, [state.courses]);

  const overdue = useMemo(() => {
    return state.tasks.filter((t) => !t.done && t.dueISO && startOfDay(new Date(t.dueISO)) < today);
  }, [state.tasks, today]);

  const dueSoon = useMemo(() => {
    const in3 = startOfDay(new Date(today.getTime() + 3 * 86400000));
    return state.tasks.filter((t) => !t.done && t.dueISO && startOfDay(new Date(t.dueISO)) >= today && startOfDay(new Date(t.dueISO)) <= in3);
  }, [state.tasks, today]);

  function addTask() {
    const dueISO = taskDue ? new Date(taskDue).toISOString() : undefined;
    const newTask: Task = {
      id: uid("task"),
      title: taskTitle.trim() || "Untitled task",
      courseId: taskCourse === "none" ? undefined : taskCourse,
      dueISO,
      priority: taskPriority,
      notes: taskNotes.trim() || undefined,
      done: false,
      createdISO: new Date().toISOString(),
    };
    setState((s) => ({ ...s, tasks: [newTask, ...s.tasks] }));
    setTaskTitle("");
    setTaskCourse("none");
    setTaskDue("");
    setTaskPriority("medium");
    setTaskNotes("");
    setTab("tasks");
  }

  function toggleTask(id: ID) {
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    }));
  }

  function deleteTask(id: ID) {
    setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
  }

  function addCourse() {
    const c: Course = {
      id: uid("course"),
      name: courseName.trim() || "New course",
      color: courseColor,
    };
    setState((s) => ({ ...s, courses: [c, ...s.courses] }));
    setCourseName("");
    setCourseColor("#3b82f6");
    setTab("courses");
  }

  function deleteCourse(id: ID) {
    setState((s) => ({
      ...s,
      courses: s.courses.filter((c) => c.id !== id),
      tasks: s.tasks.map((t) => (t.courseId === id ? { ...t, courseId: undefined } : t)),
    }));
  }

  function exportJSON() {
    downloadText(`school-planner-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state, null, 2));
  }

  function importJSON(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result ?? "")) as AppState;
        if (!data || typeof data !== "object") throw new Error("bad");
        setState({
          ...DEFAULT_STATE,
          ...data,
          settings: { ...DEFAULT_STATE.settings, ...(data.settings ?? {}) },
        });
      } catch {
        alert("Import failed: invalid JSON.");
      }
    };
    reader.readAsText(file);
  }

  const saveBadge = (() => {
    if (saveStatus === "saving") return <Badge cls="bg-slate-100 text-slate-700 border-slate-200">Saving…</Badge>;
    if (saveStatus === "saved") return <Badge cls="bg-emerald-100 text-emerald-800 border-emerald-200">Saved</Badge>;
    if (saveStatus === "error") return <Badge cls="bg-rose-100 text-rose-800 border-rose-200">Save error</Badge>;
    return <Badge cls="bg-slate-100 text-slate-700 border-slate-200">Synced</Badge>;
  })();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <header className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:mb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">SCHOOL PLANNER</div>
            <div className="text-xl font-semibold">{state.settings.semesterName}</div>
            <div className="mt-1 text-sm text-slate-600">Today: {formatDate(new Date())}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {saveBadge}
            <Button variant={tab === "dashboard" ? "primary" : "outline"} onClick={() => setTab("dashboard")}>
              Dashboard
            </Button>
            <Button variant={tab === "tasks" ? "primary" : "outline"} onClick={() => setTab("tasks")}>
              Tasks
            </Button>
            <Button variant={tab === "courses" ? "primary" : "outline"} onClick={() => setTab("courses")}>
              Courses
            </Button>
            <Button variant={tab === "settings" ? "primary" : "outline"} onClick={() => setTab("settings")}>
              Settings
            </Button>
          </div>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">Loading…</div>
        ) : null}

        {!loading && tab === "dashboard" ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Card title="At a glance" right={<Badge cls="bg-slate-100 text-slate-700 border-slate-200">{state.tasks.filter(t => !t.done).length} open</Badge>}>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-xs text-slate-600">Overdue</div>
                  <div className="mt-1 text-2xl font-semibold">{overdue.length}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-xs text-slate-600">Due soon</div>
                  <div className="mt-1 text-2xl font-semibold">{dueSoon.length}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-xs text-slate-600">Courses</div>
                  <div className="mt-1 text-2xl font-semibold">{state.courses.length}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-xs text-slate-600">Done</div>
                  <div className="mt-1 text-2xl font-semibold">{state.tasks.filter(t => t.done).length}</div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold">Quick add task</div>
                <div className="mt-3 grid gap-3">
                  <Input label="Title" value={taskTitle} onChange={setTaskTitle} placeholder="e.g., Homework 3" />
                  <div className="grid gap-3 md:grid-cols-3">
                    <Select label="Course" value={taskCourse} onChange={setTaskCourse} options={courseOptions} />
                    <Input label="Due (date/time)" type="datetime-local" value={taskDue} onChange={setTaskDue} />
                    <Select
                      label="Priority"
                      value={taskPriority}
                      onChange={(v) => setTaskPriority(v as Priority)}
                      options={[
                        { value: "low", label: "Low" },
                        { value: "medium", label: "Medium" },
                        { value: "high", label: "High" },
                      ]}
                    />
                  </div>
                  <TextArea label="Notes" value={taskNotes} onChange={setTaskNotes} placeholder="Optional notes…" />
                  <div className="flex gap-2">
                    <Button onClick={addTask} disabled={!taskTitle.trim() && !taskNotes.trim()}>
                      Add task
                    </Button>
                    <Button variant="outline" onClick={() => setTab("tasks")}>
                      View tasks
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Overdue">
              {overdue.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
                  Nothing overdue 🎉
                </div>
              ) : (
                <div className="space-y-3">
                  {overdue.slice(0, 6).map((t) => (
                    <TaskRow key={t.id} task={t} course={state.courses.find((c) => c.id === t.courseId)} onToggle={() => toggleTask(t.id)} onDelete={() => deleteTask(t.id)} />
                  ))}
                </div>
              )}
            </Card>

            <Card title="Due soon (3 days)">
              {dueSoon.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
                  No due dates coming up.
                </div>
              ) : (
                <div className="space-y-3">
                  {dueSoon.slice(0, 6).map((t) => (
                    <TaskRow key={t.id} task={t} course={state.courses.find((c) => c.id === t.courseId)} onToggle={() => toggleTask(t.id)} onDelete={() => deleteTask(t.id)} />
                  ))}
                </div>
              )}
            </Card>
          </div>
        ) : null}

        {!loading && tab === "tasks" ? (
          <Card title="Tasks" right={<Badge cls="bg-slate-100 text-slate-700 border-slate-200">{state.tasks.length} total</Badge>}>
            {state.tasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
                Add a task from Dashboard.
              </div>
            ) : (
              <div className="space-y-3">
                {state.tasks
                  .slice()
                  .sort((a, b) => {
                    const da = a.dueISO ? new Date(a.dueISO).getTime() : Infinity;
                    const db = b.dueISO ? new Date(b.dueISO).getTime() : Infinity;
                    return da - db;
                  })
                  .map((t) => (
                    <TaskRow key={t.id} task={t} course={state.courses.find((c) => c.id === t.courseId)} onToggle={() => toggleTask(t.id)} onDelete={() => deleteTask(t.id)} />
                  ))}
              </div>
            )}
          </Card>
        ) : null}

        {!loading && tab === "courses" ? (
          <Card title="Courses">
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold">Add course</div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Input label="Name" value={courseName} onChange={setCourseName} placeholder="e.g., Calculus II" />
                <label className="block">
                  <div className="mb-1 text-xs font-medium text-slate-600">Color</div>
                  <input
                    className="h-10 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-2"
                    type="color"
                    value={courseColor}
                    onChange={(e) => setCourseColor(e.target.value)}
                  />
                </label>
                <div className="flex items-end">
                  <Button onClick={addCourse} className="w-full">
                    Add course
                  </Button>
                </div>
              </div>
            </div>

            {state.courses.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
                No courses yet.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {state.courses.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
                      <div>
                        <div className="text-sm font-semibold">{c.name}</div>
                        <div className="text-xs text-slate-500">
                          {state.tasks.filter((t) => t.courseId === c.id && !t.done).length} open tasks
                        </div>
                      </div>
                    </div>
                    <Button variant="danger" onClick={() => deleteCourse(c.id)}>
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ) : null}

        {!loading && tab === "settings" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Settings">
              <div className="space-y-3">
                <Input
                  label="Semester name"
                  value={state.settings.semesterName}
                  onChange={(v) => setState((s) => ({ ...s, settings: { ...s.settings, semesterName: v } }))}
                />
                <Select
                  label="Week starts on"
                  value={String(state.settings.weekStartsOn)}
                  onChange={(v) => setState((s) => ({ ...s, settings: { ...s.settings, weekStartsOn: (Number(v) as 0 | 1) } }))}
                  options={[
                    { value: "1", label: "Monday" },
                    { value: "0", label: "Sunday" },
                  ]}
                />
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button variant="outline" onClick={exportJSON}>Export JSON</Button>
                  <label className="inline-flex items-center">
                    <input
                      type="file"
                      accept="application/json"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) importJSON(f);
                        e.currentTarget.value = "";
                      }}
                    />
                    <span className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">
                      Import JSON
                    </span>
                  </label>
                </div>
                <div className="pt-2 text-xs text-slate-500">
                  Data is stored in SQLite on the Go server via <code className="rounded bg-slate-100 px-1">/api/state</code>.
                </div>
              </div>
            </Card>

            <Card title="About">
              <div className="space-y-2 text-sm text-slate-700">
                <div><span className="font-semibold">Backend:</span> Go (Chi) + SQLite</div>
                <div><span className="font-semibold">Frontend:</span> React + Vite + Tailwind</div>
                <div className="pt-2 text-xs text-slate-500">
                  Want calendar export, recurring tasks, multi-user login, or a real schedule grid? Tell me what you need and I’ll extend it.
                </div>
              </div>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  course,
  onToggle,
  onDelete,
}: {
  task: Task;
  course?: { id: ID; name: string; color: string };
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {course ? <span className="h-2.5 w-2.5 rounded-full" style={{ background: course.color }} /> : null}
          <div className={`text-sm font-semibold ${task.done ? "line-through text-slate-400" : ""}`}>{task.title}</div>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Badge cls={priorityTone(task.priority)}>{task.priority}</Badge>
          <Badge cls={dueTone(task.dueISO, task.done)}>{task.dueISO ? new Date(task.dueISO).toLocaleString() : "No due date"}</Badge>
          {course ? <span className="text-xs text-slate-500">{course.name}</span> : null}
        </div>
        {task.notes ? <div className="mt-2 text-sm text-slate-600">{task.notes}</div> : null}
      </div>
      <div className="flex shrink-0 flex-col gap-2">
        <Button variant="outline" onClick={onToggle}>{task.done ? "Undo" : "Done"}</Button>
        <Button variant="danger" onClick={onDelete}>Delete</Button>
      </div>
    </div>
  );
}
