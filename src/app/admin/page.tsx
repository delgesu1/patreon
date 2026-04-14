"use client";

import { useCallback, useEffect, useState } from "react";
import { EasternDateTimeField } from "@/components/eastern-datetime-field";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  adminLogin,
  adminCreateMeetup,
  adminUpdateMeetup,
  adminDeleteMeetup,
  adminCompleteMeetup,
  adminUpdateSignup,
  adminDeleteSignup,
  adminMarkIdeaDone,
  adminDeleteIdea,
  getMeetups,
  getSignups,
  getIdeas,
} from "@/lib/api";
import {
  formatEasternDateTimeShort,
  fromEasternDateTimeLocalValue,
  shiftEasternDateTimeLocalValue,
  toEasternDateTimeLocalValue,
} from "@/lib/eastern-time";
import { Meetup, Signup, Idea } from "@/lib/types";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [meetups, setMeetups] = useState<Meetup[]>([]);
  const [signupsByMeetup, setSignupsByMeetup] = useState<Record<string, Signup[]>>({});
  const [expandedMeetup, setExpandedMeetup] = useState<string | null>(null);

  // Create meetup form
  const [newTitle, setNewTitle] = useState("Violin Meetup");
  const [newDate, setNewDate] = useState("");
  const [newOpensAt, setNewOpensAt] = useState("");
  const [newMaxSpots, setNewMaxSpots] = useState(4);
  const [createError, setCreateError] = useState("");

  const loadMeetups = useCallback(async () => {
    try {
      const data = await getMeetups();
      setMeetups(data);
      // Load signup counts for all meetups (for collapsed card display)
      const signupResults = await Promise.all(
        data.map(async (m: Meetup) => {
          try {
            const sigs = await getSignups(m.id);
            return [m.id, sigs] as const;
          } catch {
            return [m.id, []] as const;
          }
        })
      );
      setSignupsByMeetup((prev) => {
        const updated = { ...prev };
        for (const [id, sigs] of signupResults) {
          updated[id] = sigs;
        }
        return updated;
      });
    } catch {
      // silent
    }
  }, []);

  const loadSignups = useCallback(async (meetupId: string) => {
    try {
      const data = await getSignups(meetupId);
      setSignupsByMeetup((prev) => ({ ...prev, [meetupId]: data }));
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (sessionStorage.getItem("admin_password")) {
        setAuthed(true);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (authed) {
      const run = () => {
        void loadMeetups();
      };
      const timeout = window.setTimeout(run, 0);
      const interval = window.setInterval(run, 10000);
      return () => {
        window.clearTimeout(timeout);
        window.clearInterval(interval);
      };
    }
  }, [authed, loadMeetups]);

  useEffect(() => {
    if (expandedMeetup) {
      const run = () => {
        void loadSignups(expandedMeetup);
      };
      const timeout = window.setTimeout(run, 0);
      const interval = window.setInterval(run, 5000);
      return () => {
        window.clearTimeout(timeout);
        window.clearInterval(interval);
      };
    }
  }, [expandedMeetup, loadSignups]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    try {
      await adminLogin(password);
      sessionStorage.setItem("admin_password", password);
      setAuthed(true);
    } catch {
      setAuthError("Invalid password");
    }
  }

  async function handleCreateMeetup(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    try {
      await adminCreateMeetup({
        title: newTitle,
        meetup_date: fromEasternDateTimeLocalValue(newDate),
        signup_opens_at: fromEasternDateTimeLocalValue(newOpensAt),
        max_spots: newMaxSpots,
      });
      setNewDate("");
      setNewOpensAt("");
      await loadMeetups();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Failed to create meetup");
    }
  }

  async function handleUpdateMeetup(id: string, data: Record<string, unknown>) {
    try {
      await adminUpdateMeetup(id, data);
      await loadMeetups();
    } catch {
      alert("Failed to update meetup");
    }
  }

  async function handleDeleteMeetup(id: string) {
    try {
      setMeetups((prev) => prev.filter((meetup) => meetup.id !== id));
      setSignupsByMeetup((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (expandedMeetup === id) setExpandedMeetup(null);
      await adminDeleteMeetup(id);
      if (expandedMeetup === id) setExpandedMeetup(null);
      await loadMeetups();
    } catch {
      alert("Failed to delete meetup");
    }
  }

  async function handleComplete(meetupId: string) {
    try {
      setMeetups((prev) =>
        prev.map((meetup) =>
          meetup.id === meetupId ? { ...meetup, status: "completed" } : meetup
        )
      );
      await adminCompleteMeetup(meetupId);
      await loadMeetups();
    } catch {
      alert("Failed to complete meetup");
      await loadMeetups();
    }
  }

  async function handleStatusChange(
    meetupId: string,
    signupId: string,
    status: Signup["status"]
  ) {
    try {
      setSignupsByMeetup((prev) => ({
        ...prev,
        [meetupId]: (prev[meetupId] || []).map((signup) =>
          signup.id === signupId ? { ...signup, status } : signup
        ),
      }));
      await adminUpdateSignup(meetupId, signupId, { status });
      await loadSignups(meetupId);
    } catch {
      alert("Failed to update");
      await loadSignups(meetupId);
    }
  }

  async function handleTogglePriority(meetupId: string, signup: Signup) {
    try {
      setSignupsByMeetup((prev) => ({
        ...prev,
        [meetupId]: (prev[meetupId] || []).map((row) =>
          row.id === signup.id
            ? { ...row, granted_priority: !signup.granted_priority }
            : row
        ),
      }));
      await adminUpdateSignup(meetupId, signup.id, {
        granted_priority: !signup.granted_priority,
      });
      await loadSignups(meetupId);
    } catch {
      alert("Failed to update");
      await loadSignups(meetupId);
    }
  }

  async function handleRenameSignup(meetupId: string, signupId: string, newName: string) {
    try {
      setSignupsByMeetup((prev) => ({
        ...prev,
        [meetupId]: (prev[meetupId] || []).map((signup) =>
          signup.id === signupId ? { ...signup, name: newName } : signup
        ),
      }));
      await adminUpdateSignup(meetupId, signupId, { name: newName });
      await loadSignups(meetupId);
    } catch {
      alert("Failed to rename");
      await loadSignups(meetupId);
    }
  }

  async function handleRemoveSignup(meetupId: string, signupId: string) {
    try {
      setSignupsByMeetup((prev) => ({
        ...prev,
        [meetupId]: (prev[meetupId] || []).filter((signup) => signup.id !== signupId),
      }));
      await adminDeleteSignup(meetupId, signupId);
      await loadSignups(meetupId);
    } catch {
      alert("Failed to remove");
      await loadSignups(meetupId);
    }
  }

  if (!authed) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="w-full max-w-sm">
          <header className="text-center mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">Daniel Kurganov</h1>
            <p className="mt-1 text-sm text-stone-500">Admin Access</p>
          </header>
          <div className="bg-white border border-stone-200 rounded-2xl shadow-lg p-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full border border-stone-200 rounded-xl px-4 py-2.5 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500 hover:text-stone-700 px-1 font-medium"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <button
                type="submit"
                className="w-full bg-stone-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-stone-800 transition-colors"
              >
                Log In
              </button>
              {authError && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
                  <p className="text-rose-700 text-sm">{authError}</p>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    );
  }

  const upcomingMeetups = meetups.filter((m) => m.status === "upcoming");
  const completedMeetups = meetups.filter((m) => m.status === "completed");

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Dashboard header */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-stone-500">Daniel Kurganov Patreon Meetups</p>
        </div>
        <button
          onClick={() => {
            sessionStorage.removeItem("admin_password");
            setAuthed(false);
          }}
          className="text-sm text-stone-500 hover:text-stone-700 hover:bg-stone-100 px-3 py-1.5 rounded-lg transition-colors font-medium"
        >
          Log out
        </button>
      </div>

      {/* Create Meetup */}
      <section className="mb-10">
        <h2 className="text-xs uppercase tracking-[0.25em] font-semibold text-stone-500 mb-4">
          Create Meetup
        </h2>
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-6">
          <form onSubmit={handleCreateMeetup} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1.5">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1.5">Max Spots</label>
                <input
                  type="number"
                  min={1}
                  value={newMaxSpots}
                  onChange={(e) => setNewMaxSpots(parseInt(e.target.value) || 4)}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
                />
              </div>
            </div>
            <div className="grid gap-4">
              <EasternDateTimeField
                label="Meetup Date & Time"
                value={newDate}
                required
                onChange={(val) => {
                  setNewDate(val);
                  if (val) {
                    setNewOpensAt(shiftEasternDateTimeLocalValue(val, -7));
                  }
                }}
              />
              <EasternDateTimeField
                label="Signups Open At"
                value={newOpensAt}
                required
                onChange={setNewOpensAt}
              />
            </div>
            <button
              type="submit"
              className="bg-amber-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-amber-700 transition-colors shadow-sm"
            >
              Create Meetup
            </button>
            {createError && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
                <p className="text-rose-700 text-sm">{createError}</p>
              </div>
            )}
          </form>
        </div>
      </section>

      {/* Upcoming Meetups */}
      <section className="mb-10">
        <h2 className="text-xs uppercase tracking-[0.25em] font-semibold text-stone-500 mb-4">
          Upcoming Meetups ({upcomingMeetups.length})
        </h2>
        {upcomingMeetups.length === 0 && (
          <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-6 text-center">
            <p className="text-stone-400 text-sm">None</p>
          </div>
        )}
        {upcomingMeetups.map((m) => (
          <MeetupCard
            key={m.id}
            meetup={m}
            signups={signupsByMeetup[m.id] || []}
            expanded={expandedMeetup === m.id}
            onToggleExpand={() =>
              setExpandedMeetup(expandedMeetup === m.id ? null : m.id)
            }
            onUpdateMeetup={(data) => handleUpdateMeetup(m.id, data)}
            onDeleteMeetup={() => handleDeleteMeetup(m.id)}
            onComplete={() => handleComplete(m.id)}
            onStatusChange={(signupId, status) =>
              handleStatusChange(m.id, signupId, status)
            }
            onTogglePriority={(signup) => handleTogglePriority(m.id, signup)}
            onRenameSignup={(signupId, name) =>
              handleRenameSignup(m.id, signupId, name)
            }
            onRemove={(signupId) => handleRemoveSignup(m.id, signupId)}
          />
        ))}
      </section>

      {/* Completed Meetups */}
      <section className="mb-10">
        <h2 className="text-xs uppercase tracking-[0.25em] font-semibold text-stone-500 mb-4">
          Past Meetups ({completedMeetups.length})
        </h2>
        {completedMeetups.length === 0 && (
          <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-6 text-center">
            <p className="text-stone-400 text-sm">None</p>
          </div>
        )}
        {completedMeetups.map((m) => (
          <MeetupCard
            key={m.id}
            meetup={m}
            signups={signupsByMeetup[m.id] || []}
            expanded={expandedMeetup === m.id}
            onToggleExpand={() =>
              setExpandedMeetup(expandedMeetup === m.id ? null : m.id)
            }
            onDeleteMeetup={() => handleDeleteMeetup(m.id)}
            onStatusChange={(signupId, status) =>
              handleStatusChange(m.id, signupId, status)
            }
            onTogglePriority={(signup) => handleTogglePriority(m.id, signup)}
            onRenameSignup={(signupId, name) =>
              handleRenameSignup(m.id, signupId, name)
            }
            onRemove={(signupId) => handleRemoveSignup(m.id, signupId)}
          />
        ))}
      </section>

      <AdminIdeasSection />
    </div>
  );
}

function AdminIdeasSection() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [deleteIdea, setDeleteIdea] = useState<Idea | null>(null);

  const loadIdeas = useCallback(async () => {
    try {
      setIdeas(await getIdeas());
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    const run = () => {
      void loadIdeas();
    };
    const timeout = window.setTimeout(run, 0);
    const interval = window.setInterval(run, 10000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [loadIdeas]);

  async function handleToggleDone(id: string, currentDone: boolean) {
    try {
      setIdeas((prev) =>
        prev.map((idea) =>
          idea.id === id ? { ...idea, is_done: !currentDone } : idea
        )
      );
      await adminMarkIdeaDone(id, !currentDone);
      await loadIdeas();
    } catch {
      alert("Failed to update idea");
      await loadIdeas();
    }
  }

  function handleDelete(id: string) {
    const idea = ideas.find((item) => item.id === id);
    if (!idea) return;
    setDeleteIdea(idea);
  }

  async function handleDeleteConfirmed() {
    if (!deleteIdea) return;
    const idea = deleteIdea;
    setDeleteIdea(null);
    try {
      setIdeas((prev) => prev.filter((item) => item.id !== idea.id));
      await adminDeleteIdea(idea.id);
      await loadIdeas();
    } catch {
      alert("Failed to delete idea");
      await loadIdeas();
    }
  }

  const active = ideas.filter((i) => !i.is_done);
  const done = ideas.filter((i) => i.is_done);

  return (
    <section className="pt-8 border-t border-stone-200">
      <h2 className="text-xs uppercase tracking-[0.25em] font-semibold text-stone-500 mb-4">
        Topic Ideas ({active.length})
      </h2>
      {active.length === 0 && (
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-6 text-center">
          <p className="text-stone-400 text-sm">None</p>
        </div>
      )}
      {active.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="divide-y divide-stone-100">
            {active.map((idea) => (
              <div key={idea.id} className="flex items-center gap-3 text-sm px-4 py-3">
                <span className="text-xs font-semibold text-stone-500 min-w-[1.5rem] text-center tabular-nums">
                  {idea.votes}
                </span>
                <span className="flex-1 text-stone-700">{idea.text}</span>
                <button
                  type="button"
                  onClick={() => handleToggleDone(idea.id, idea.is_done)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-medium transition-colors"
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(idea.id)}
                  className="text-xs px-2 py-1 rounded-lg bg-stone-100 text-stone-400 hover:bg-rose-100 hover:text-rose-600 transition-colors"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {done.length > 0 && (
        <div className="mt-5">
          <p className="text-xs uppercase tracking-[0.25em] font-semibold text-stone-400 mb-2">Covered ({done.length})</p>
          <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="divide-y divide-stone-100">
              {done.map((idea) => (
                <div key={idea.id} className="flex items-center gap-3 text-sm px-4 py-3">
                  <span className="text-xs text-stone-300 min-w-[1.5rem] text-center tabular-nums">{idea.votes}</span>
                  <span className="flex-1 text-stone-400 line-through">{idea.text}</span>
                  <button
                    type="button"
                    onClick={() => handleToggleDone(idea.id, idea.is_done)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-stone-100 text-stone-500 hover:bg-stone-200 font-medium transition-colors"
                  >
                    Undo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(idea.id)}
                    className="text-xs px-2 py-1 rounded-lg bg-stone-100 text-stone-400 hover:bg-rose-100 hover:text-rose-600 transition-colors"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteIdea !== null}
        title="Delete this idea?"
        description={deleteIdea?.text ?? ""}
        confirmLabel="Delete idea"
        cancelLabel="Keep idea"
        tone="danger"
        onClose={() => setDeleteIdea(null)}
        onConfirm={handleDeleteConfirmed}
      />
    </section>
  );
}

function MeetupCard({
  meetup,
  signups,
  expanded,
  onToggleExpand,
  onUpdateMeetup,
  onDeleteMeetup,
  onComplete,
  onStatusChange,
  onTogglePriority,
  onRenameSignup,
  onRemove,
}: {
  meetup: Meetup;
  signups: Signup[];
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdateMeetup?: (data: Record<string, unknown>) => void;
  onDeleteMeetup: () => void;
  onComplete?: () => void;
  onStatusChange: (signupId: string, status: Signup["status"]) => void;
  onTogglePriority: (signup: Signup) => void;
  onRenameSignup: (signupId: string, name: string) => void;
  onRemove: (signupId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(meetup.title);
  const [editDate, setEditDate] = useState(toEasternDateTimeLocalValue(meetup.meetup_date));
  const [editOpensAt, setEditOpensAt] = useState(toEasternDateTimeLocalValue(meetup.signup_opens_at));
  const [editMaxSpots, setEditMaxSpots] = useState(meetup.max_spots);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  function handleSaveEdit() {
    if (!onUpdateMeetup) return;
    onUpdateMeetup({
      title: editTitle,
      meetup_date: fromEasternDateTimeLocalValue(editDate),
      signup_opens_at: fromEasternDateTimeLocalValue(editOpensAt),
      max_spots: editMaxSpots,
    });
    setEditing(false);
  }

  async function handleDeleteConfirmed() {
    setDeleteOpen(false);
    await onDeleteMeetup();
  }

  async function handleCompleteConfirmed() {
    if (!onComplete) return;
    setCompleteOpen(false);
    await onComplete();
  }

  return (
    <div className="bg-white border border-stone-200 rounded-2xl shadow-sm mb-3 overflow-hidden transition-shadow hover:shadow-md">
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-stone-50/50 transition-colors"
      >
        <div>
          <span className="font-semibold text-sm text-stone-900">{meetup.title}</span>
          <span className="text-xs text-stone-500 ml-2">
            {formatEasternDateTimeShort(meetup.meetup_date)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-500">
            {signups.length} signup{signups.length !== 1 ? "s" : ""}
          </span>
          {meetup.status === "completed" && (
            <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-lg font-medium">
              completed
            </span>
          )}
          <span className="text-stone-400 text-xs">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-stone-100 p-4">
          {/* Meetup details / edit form */}
          {editing ? (
            <div className="mb-4 p-4 bg-stone-50 rounded-xl space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full border border-stone-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Max Spots</label>
                  <input
                    type="number"
                    min={1}
                    value={editMaxSpots}
                    onChange={(e) => setEditMaxSpots(parseInt(e.target.value) || 4)}
                    className="w-full border border-stone-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>
              <div className="grid gap-3">
                <EasternDateTimeField
                  label="Meetup Date & Time"
                  value={editDate}
                  compact
                  required
                  onChange={(val) => {
                    setEditDate(val);
                    if (val) {
                      setEditOpensAt(shiftEasternDateTimeLocalValue(val, -7));
                    }
                  }}
                />
                <EasternDateTimeField
                  label="Signups Open At"
                  value={editOpensAt}
                  compact
                  required
                  onChange={setEditOpensAt}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  className="text-xs px-4 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 font-semibold transition-colors"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="text-xs px-4 py-1.5 rounded-lg bg-stone-200 text-stone-700 hover:bg-stone-300 font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs text-stone-500">
                Signups open: {formatEasternDateTimeShort(meetup.signup_opens_at)} | Max spots:{" "}
                {meetup.max_spots}
              </div>
              <div className="flex gap-1.5">
                {onUpdateMeetup && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 font-medium transition-colors"
                  >
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDeleteOpen(true)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-stone-100 text-rose-500 hover:bg-rose-100 font-medium transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          )}

          {/* Signups list */}
          {signups.length === 0 ? (
            <p className="text-stone-400 text-sm text-center py-3">No signups</p>
          ) : (
            <div className="space-y-1.5">
              {signups.map((s) => (
                <SignupRow
                  key={s.id}
                  signup={s}
                  maxSpots={meetup.max_spots}
                  onStatusChange={onStatusChange}
                  onTogglePriority={onTogglePriority}
                  onRename={onRenameSignup}
                  onRemove={onRemove}
                />
              ))}
            </div>
          )}

          {onComplete && meetup.status === "upcoming" && (
            <>
              {signups.length > 0 && signups.some((s) => s.status === "active") && (
                <p className="mt-3 text-xs text-amber-600 font-medium">
                  {signups.filter((s) => s.status === "active").length} of{" "}
                  {signups.length} signups still unmarked
                </p>
              )}
              <button
                type="button"
                onClick={() => setCompleteOpen(true)}
                className="mt-3 bg-stone-900 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-stone-800 transition-colors"
              >
                Complete Meetup
              </button>
            </>
          )}

          <ConfirmDialog
            open={deleteOpen}
            title="Delete this meetup?"
            description="This removes the meetup and all of its signups."
            confirmLabel="Delete meetup"
            cancelLabel="Keep meetup"
            tone="danger"
            onClose={() => setDeleteOpen(false)}
            onConfirm={handleDeleteConfirmed}
          />

          <ConfirmDialog
            open={completeOpen}
            title="Mark this meetup as completed?"
            description="This moves the meetup into the past section."
            confirmLabel="Mark complete"
            cancelLabel="Not yet"
            tone="neutral"
            onClose={() => setCompleteOpen(false)}
            onConfirm={handleCompleteConfirmed}
          />
        </div>
      )}
    </div>
  );
}

function SignupRow({
  signup: s,
  maxSpots,
  onStatusChange,
  onTogglePriority,
  onRename,
  onRemove,
}: {
  signup: Signup;
  maxSpots: number;
  onStatusChange: (signupId: string, status: Signup["status"]) => void;
  onTogglePriority: (signup: Signup) => void;
  onRename: (signupId: string, name: string) => void;
  onRemove: (signupId: string) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(s.name);
  const [removeOpen, setRemoveOpen] = useState(false);

  function handleSaveName() {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== s.name) {
      onRename(s.id, trimmed);
    }
    setEditingName(false);
  }

  async function handleRemoveConfirmed() {
    setRemoveOpen(false);
    await onRemove(s.id);
  }

  return (
    <div
      className={`flex items-center gap-2 text-sm p-3 rounded-xl ${
        s.position <= maxSpots ? "bg-emerald-50" : "bg-stone-50"
      }`}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
          s.position <= maxSpots
            ? "bg-emerald-100 text-emerald-700"
            : "bg-stone-200 text-stone-500"
        }`}
      >
        {s.position}
      </span>

      {editingName ? (
        <span className="flex items-center gap-1 min-w-0">
          <input
            type="text"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveName();
              if (e.key === "Escape") setEditingName(false);
            }}
            className="border border-stone-200 rounded-lg px-2 py-0.5 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            autoFocus
          />
          <button
            onClick={handleSaveName}
            className="text-xs text-amber-600 hover:text-amber-700 font-medium"
          >
            Save
          </button>
          <button
            onClick={() => { setNameValue(s.name); setEditingName(false); }}
            className="text-xs text-stone-400 hover:text-stone-600"
          >
            Cancel
          </button>
        </span>
      ) : (
        <span
          className="font-medium min-w-0 cursor-pointer hover:underline text-stone-900"
          onClick={() => setEditingName(true)}
          title="Click to edit name"
        >
          {s.name}
        </span>
      )}

      {s.has_priority && (
        <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-md shrink-0 font-medium">
          P
        </span>
      )}
      {s.status !== "active" && (
        <span
          className={`text-xs px-1.5 py-0.5 rounded-md shrink-0 font-medium ${
            s.status === "played"
              ? "bg-emerald-100 text-emerald-700"
              : s.status === "not_reached"
              ? "bg-amber-100 text-amber-700"
              : "bg-rose-100 text-rose-700"
          }`}
        >
          {s.status.replace("_", " ")}
        </span>
      )}

      <div className="ml-auto flex items-center gap-1 shrink-0">
        {s.status === "active" ? (
          <>
            <button
              type="button"
              onClick={() => onStatusChange(s.id, "played")}
              className="text-xs px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-medium transition-colors"
            >
              Played
            </button>
            <button
              type="button"
              onClick={() => onStatusChange(s.id, "not_reached")}
              className="text-xs px-2 py-1 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 font-medium transition-colors"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => onStatusChange(s.id, "no_show")}
              className="text-xs px-2 py-1 rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-200 font-medium transition-colors"
            >
              No-show
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onStatusChange(s.id, "active")}
            className="text-xs px-2 py-1 rounded-lg bg-stone-200 text-stone-600 hover:bg-stone-300 font-medium transition-colors"
          >
            Undo
          </button>
        )}
        <button
          type="button"
          onClick={() => onTogglePriority(s)}
          className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${
            s.granted_priority
              ? "bg-violet-200 text-violet-800"
              : "bg-stone-100 text-stone-500 hover:bg-violet-100 hover:text-violet-700"
          }`}
          title={
            s.granted_priority
              ? "Remove priority for next meetup"
              : "Grant priority for next meetup"
          }
        >
          {s.granted_priority ? "★ Priority" : "☆ Priority"}
        </button>
        <button
          type="button"
          onClick={() => setRemoveOpen(true)}
          className="text-xs px-2 py-1 rounded-lg bg-stone-100 text-stone-400 hover:bg-rose-100 hover:text-rose-600 transition-colors"
          title="Remove signup"
        >
          ×
        </button>
      </div>

      <ConfirmDialog
        open={removeOpen}
        title="Remove this signup?"
        description={`Remove ${s.name} from this meetup? This will cancel the signup.`}
        confirmLabel="Remove signup"
        cancelLabel="Keep signup"
        tone="danger"
        onClose={() => setRemoveOpen(false)}
        onConfirm={handleRemoveConfirmed}
      />
    </div>
  );
}
