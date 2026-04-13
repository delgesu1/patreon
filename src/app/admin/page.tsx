"use client";

import { useCallback, useEffect, useState } from "react";
import { EasternDateTimeField } from "@/components/eastern-datetime-field";
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
    if (!confirm("Delete this meetup and all its signups? This cannot be undone.")) return;
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
    if (!confirm("Mark this meetup as completed?")) return;
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
    if (!confirm("Remove this signup?")) return;
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
      <div className="max-w-sm mx-auto px-4 py-16">
        <h1 className="text-xl font-bold mb-4">Admin Login</h1>
        <form onSubmit={handleLogin} className="space-y-3">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full border rounded-lg px-3 py-2 pr-16 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700 px-1"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <button
            type="submit"
            className="w-full bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800"
          >
            Log In
          </button>
          {authError && <p className="text-red-600 text-sm">{authError}</p>}
        </form>
      </div>
    );
  }

  const upcomingMeetups = meetups.filter((m) => m.status === "upcoming");
  const completedMeetups = meetups.filter((m) => m.status === "completed");

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-bold">Admin Dashboard</h1>
        <button
          onClick={() => {
            sessionStorage.removeItem("admin_password");
            setAuthed(false);
          }}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Log out
        </button>
      </div>

      {/* Create Meetup */}
      <section className="mb-8 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-sm font-semibold uppercase text-gray-500 mb-3">
          Create Meetup
        </h2>
        <form onSubmit={handleCreateMeetup} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Max Spots</label>
              <input
                type="number"
                min={1}
                value={newMaxSpots}
                onChange={(e) => setNewMaxSpots(parseInt(e.target.value) || 4)}
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="grid gap-3">
            <EasternDateTimeField
              key={newDate}
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
              key={newOpensAt}
              label="Signups Open At"
              value={newOpensAt}
              required
              onChange={setNewOpensAt}
            />
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700"
          >
            Create Meetup
          </button>
          {createError && <p className="text-red-600 text-sm">{createError}</p>}
        </form>
      </section>

      {/* Upcoming Meetups */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase text-gray-500 mb-3">
          Upcoming Meetups ({upcomingMeetups.length})
        </h2>
        {upcomingMeetups.length === 0 && (
          <p className="text-gray-400 text-sm">None</p>
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
      <section>
        <h2 className="text-sm font-semibold uppercase text-gray-500 mb-3">
          Past Meetups ({completedMeetups.length})
        </h2>
        {completedMeetups.length === 0 && (
          <p className="text-gray-400 text-sm">None</p>
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

  async function handleDelete(id: string) {
    if (!confirm("Delete this idea?")) return;
    try {
      setIdeas((prev) => prev.filter((idea) => idea.id !== id));
      await adminDeleteIdea(id);
      await loadIdeas();
    } catch {
      alert("Failed to delete idea");
      await loadIdeas();
    }
  }

  const active = ideas.filter((i) => !i.is_done);
  const done = ideas.filter((i) => i.is_done);

  return (
    <section className="mt-8 pt-6 border-t">
      <h2 className="text-sm font-semibold uppercase text-gray-500 mb-3">
        Topic Ideas ({active.length})
      </h2>
      {active.length === 0 && <p className="text-gray-400 text-sm">None</p>}
      <div className="space-y-1.5">
        {active.map((idea) => (
          <div key={idea.id} className="flex items-center gap-2 text-sm p-2 rounded bg-gray-50">
            <span className="text-xs font-medium text-gray-500 min-w-[1.5rem] text-center">
              {idea.votes}
            </span>
            <span className="flex-1 text-gray-700">{idea.text}</span>
            <button
              type="button"
              onClick={() => handleToggleDone(idea.id, idea.is_done)}
              className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200"
            >
              Done
            </button>
            <button
              type="button"
              onClick={() => handleDelete(idea.id)}
              className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-600"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
      {done.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-gray-400 mb-1.5">Covered ({done.length})</p>
          <div className="space-y-1">
            {done.map((idea) => (
              <div key={idea.id} className="flex items-center gap-2 text-sm p-2 rounded">
                <span className="text-xs text-gray-300 min-w-[1.5rem] text-center">{idea.votes}</span>
                <span className="flex-1 text-gray-400 line-through">{idea.text}</span>
                <button
                  type="button"
                  onClick={() => handleToggleDone(idea.id, idea.is_done)}
                  className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500 hover:bg-gray-200"
                >
                  Undo
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(idea.id)}
                  className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-600"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
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

  return (
    <div className="border rounded-lg mb-3">
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50"
      >
        <div>
          <span className="font-medium text-sm">{meetup.title}</span>
          <span className="text-xs text-gray-500 ml-2">
            {formatEasternDateTimeShort(meetup.meetup_date)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {signups.length} signup{signups.length !== 1 ? "s" : ""}
          </span>
          {meetup.status === "completed" && (
            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
              completed
            </span>
          )}
          <span className="text-gray-400 text-xs">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t p-3">
          {/* Meetup details / edit form */}
          {editing ? (
            <div className="mb-4 p-3 bg-gray-50 rounded space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full border rounded px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Max Spots</label>
                  <input
                    type="number"
                    min={1}
                    value={editMaxSpots}
                    onChange={(e) => setEditMaxSpots(parseInt(e.target.value) || 4)}
                    className="w-full border rounded px-2 py-1 text-sm"
                  />
                </div>
              </div>
              <div className="grid gap-3">
                <EasternDateTimeField
                  key={editDate}
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
                  key={editOpensAt}
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
                  className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="text-xs px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-gray-500">
                Signups open: {formatEasternDateTimeShort(meetup.signup_opens_at)} | Max spots:{" "}
                {meetup.max_spots}
              </div>
              <div className="flex gap-1">
                {onUpdateMeetup && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
                  >
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  onClick={onDeleteMeetup}
                  className="text-xs px-2 py-0.5 rounded bg-gray-100 text-red-500 hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </div>
          )}

          {/* Signups list */}
          {signups.length === 0 ? (
            <p className="text-gray-400 text-sm">No signups</p>
          ) : (
            <div className="space-y-2">
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
                <p className="mt-3 text-xs text-amber-600">
                  {signups.filter((s) => s.status === "active").length} of{" "}
                  {signups.length} signups still unmarked
                </p>
              )}
              <button
                onClick={onComplete}
                className="mt-2 bg-gray-900 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-gray-800"
              >
                Complete Meetup
              </button>
            </>
          )}
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

  function handleSaveName() {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== s.name) {
      onRename(s.id, trimmed);
    }
    setEditingName(false);
  }

  return (
    <div
      className={`flex items-center gap-2 text-sm p-2 rounded ${
        s.position <= maxSpots ? "bg-green-50" : "bg-gray-50"
      }`}
    >
      <span className="font-mono text-xs w-5 text-right text-gray-400">
        {s.position}.
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
            className="border rounded px-1.5 py-0.5 text-sm w-32"
            autoFocus
          />
          <button
            onClick={handleSaveName}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Save
          </button>
          <button
            onClick={() => { setNameValue(s.name); setEditingName(false); }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Cancel
          </button>
        </span>
      ) : (
        <span
          className="font-medium min-w-0 cursor-pointer hover:underline"
          onClick={() => setEditingName(true)}
          title="Click to edit name"
        >
          {s.name}
        </span>
      )}

      {s.has_priority && (
        <span className="text-xs bg-purple-100 text-purple-700 px-1 rounded shrink-0">
          P
        </span>
      )}
      {s.status !== "active" && (
        <span
          className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
            s.status === "played"
              ? "bg-green-200 text-green-800"
              : s.status === "not_reached"
              ? "bg-amber-200 text-amber-800"
              : "bg-red-200 text-red-800"
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
              className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200"
            >
              Played
            </button>
            <button
              type="button"
              onClick={() => onStatusChange(s.id, "not_reached")}
              className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 hover:bg-amber-200"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => onStatusChange(s.id, "no_show")}
              className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200"
            >
              No-show
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onStatusChange(s.id, "active")}
            className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 hover:bg-gray-300"
          >
            Undo
          </button>
        )}
        <button
          type="button"
          onClick={() => onTogglePriority(s)}
          className={`text-xs px-1.5 py-0.5 rounded ${
            s.granted_priority
              ? "bg-purple-200 text-purple-800"
              : "bg-gray-100 text-gray-500 hover:bg-purple-100"
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
          onClick={() => onRemove(s.id)}
          className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-600"
          title="Remove signup"
        >
          ×
        </button>
      </div>
    </div>
  );
}
