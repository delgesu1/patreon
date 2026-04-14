"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getMeetups,
  getSignups,
  createSignup,
  cancelSignup,
  getIdeas,
  createIdea,
  upvoteIdea,
  unvoteIdea,
} from "@/lib/api";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatEasternDateTime } from "@/lib/eastern-time";
import { Meetup, Signup, Idea } from "@/lib/types";

function Countdown({ target }: { target: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    function update() {
      const diff = new Date(target).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("");
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const parts = [];
      if (d > 0) parts.push(`${d}d`);
      if (h > 0) parts.push(`${h}h`);
      parts.push(`${m}m`);
      parts.push(`${s}s`);
      setTimeLeft(parts.join(" "));
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [target]);

  if (!timeLeft) return null;
  return <span className="text-amber-600 font-semibold tabular-nums">{timeLeft}</span>;
}

export default function Home() {
  const [meetup, setMeetup] = useState<Meetup | null>(null);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [name, setName] = useState("");
  const [mySignup, setMySignup] = useState<Signup | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const loadData = useCallback(async () => {
    try {
      const meetups: Meetup[] = await getMeetups();
      setError("");
      const upcoming = meetups
        .filter((m) => m.status === "upcoming")
        .sort((a, b) => new Date(a.meetup_date).getTime() - new Date(b.meetup_date).getTime())[0];
      if (!upcoming) {
        setMeetup(null);
        setLoading(false);
        return;
      }
      setMeetup(upcoming);
      const sigs: Signup[] = await getSignups(upcoming.id);
      setSignups(sigs);

      // Check if our saved name matches any signup
      const savedName = localStorage.getItem("signup_name");
      if (savedName) {
        const mine = sigs.find(
          (s) => s.name.toLowerCase() === savedName.toLowerCase()
        );
        if (mine) {
          setMySignup(mine);
          setName(savedName);
        } else {
          setMySignup(null);
        }
      }
    } catch {
      setError("Couldn't load meetup data. Check your connection and try again.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const saved = localStorage.getItem("signup_name");
      if (saved) setName(saved);
      void loadData();
    }, 0);
    const interval = setInterval(loadData, 10000);
    const nowInterval = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
      clearInterval(nowInterval);
    };
  }, [loadData]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!meetup || !name.trim()) return;
    setError("");
    setSubmitting(true);
    try {
      const signup = await createSignup(meetup.id, name.trim(), note.trim() || undefined);
      localStorage.setItem("signup_name", name.trim());
      setMySignup(signup);
      setNote("");
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sign up");
    }
    setSubmitting(false);
  }

  async function handleCancelConfirmed() {
    if (!meetup || !mySignup) return;
    setCancelConfirmOpen(false);
    setSubmitting(true);
    try {
      const cancelledId = mySignup.id;
      await cancelSignup(meetup.id, mySignup.id);
      localStorage.removeItem("signup_name");
      setSignups((current) => current.filter((signup) => signup.id !== cancelledId));
      setMySignup(null);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to cancel");
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-amber-600" />
          <p className="mt-3 text-sm text-stone-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!meetup) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <header className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">Daniel Kurganov</h1>
          <p className="mt-1 text-sm text-stone-500 tracking-wide">Patreon Violin Meetups</p>
        </header>
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-8 text-center">
          <p className="text-stone-500">No upcoming meetups scheduled. Check back later!</p>
        </div>
        <IdeasBoard />
      </div>
    );
  }

  const signupsOpen = now >= new Date(meetup.signup_opens_at).getTime();
  const spotsConfirmed = signups.filter((s) => s.position <= meetup.max_spots).length;
  const spotsRemaining = Math.max(0, meetup.max_spots - spotsConfirmed);

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      {/* Branded header */}
      <header className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">Daniel Kurganov</h1>
        <p className="mt-1 text-sm text-stone-500 tracking-wide">Patreon Violin Meetups</p>
      </header>

      {/* Meetup info card */}
      <div className="bg-gradient-to-br from-amber-50 to-stone-50 border border-stone-200 rounded-2xl shadow-sm p-6 mb-8">
        <h2 className="text-xl font-bold tracking-tight text-stone-900 mb-1">{meetup.title}</h2>
        <p className="text-stone-700 font-medium">{formatEasternDateTime(meetup.meetup_date)}</p>
        <p className="text-xs uppercase tracking-[0.25em] font-semibold text-stone-400 mt-1">
          Eastern Time
        </p>
      </div>

      {!signupsOpen && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-8 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-amber-800">
              Signups open in <Countdown target={meetup.signup_opens_at} />
            </p>
            <p className="text-xs text-amber-600 mt-1">
              Opens {formatEasternDateTime(meetup.signup_opens_at)}
            </p>
          </div>
        </div>
      )}

      {signupsOpen && (
        <div className="mb-8">
          {/* Spots remaining */}
          <div className="flex items-baseline gap-2 mb-5">
            <span className="text-2xl font-bold text-amber-600 tabular-nums">{spotsRemaining}</span>
            <span className="text-sm text-stone-500">
              of {meetup.max_spots} spots remaining
            </span>
          </div>

          {mySignup ? (
            <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-5">
              <div className="flex items-start gap-3 mb-3">
                {mySignup.position <= meetup.max_spots ? (
                  <>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-emerald-700 font-semibold">
                        You&apos;re confirmed! (Spot #{mySignup.position})
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-amber-700 font-semibold">
                        You&apos;re on the waitlist (Position #{mySignup.position})
                      </p>
                    </div>
                  </>
                )}
              </div>
              {mySignup.has_priority && (
                <span className="inline-block mb-3 text-xs bg-violet-100 text-violet-700 px-2.5 py-1 rounded-lg font-medium">
                  Moved to front — didn&apos;t get to play last time
                </span>
              )}
              {mySignup.note && (
                <p className="text-sm text-stone-500 italic mb-3">
                  &ldquo;{mySignup.note}&rdquo;
                </p>
              )}
              <button
                type="button"
                onClick={() => setCancelConfirmOpen(true)}
                disabled={submitting}
                className="text-sm text-rose-600 hover:text-rose-700 font-medium disabled:opacity-50 transition-colors"
              >
                {submitting ? "Cancelling..." : "Cancel my signup"}
              </button>
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-5">
              <form onSubmit={handleSignup} className="space-y-3">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    aria-label="Your name"
                    maxLength={100}
                    className="flex-1 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={submitting || !name.trim()}
                    className="bg-amber-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {submitting ? "Signing up..." : spotsRemaining > 0 ? "Sign Up to Play" : "Join Waitlist"}
                  </button>
                </div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note (optional) — e.g. piece you'd like to play"
                  aria-label="Signup note"
                  maxLength={500}
                  rows={2}
                  className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors resize-none"
                />
              </form>
            </div>
          )}

          {error && (
            <div className="mt-3 bg-rose-50 border border-rose-200 rounded-xl p-3">
              <p className="text-rose-700 text-sm">{error}</p>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={cancelConfirmOpen}
        title="Cancel your signup?"
        description="You'll lose your spot and may need to sign up again later."
        confirmLabel="Cancel signup"
        cancelLabel="Keep signup"
        tone="danger"
        busy={submitting}
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={handleCancelConfirmed}
      />

      {/* Signup queue */}
      <div className="mb-12">
        <h2 className="text-xs uppercase tracking-[0.25em] font-semibold text-stone-500 mb-4">
          Signup Queue ({signups.length})
        </h2>
        {signups.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-6 text-center">
            <p className="text-stone-400 text-sm">No signups yet. Be the first!</p>
          </div>
        ) : (
          <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
            <ol className="divide-y divide-stone-100">
              {signups.map((s) => (
                <li
                  key={s.id}
                  className={`flex items-start gap-3 text-sm px-4 py-3 ${
                    mySignup?.id === s.id ? "ring-2 ring-inset ring-amber-400/50 bg-amber-50/30" : ""
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold mt-0.5 ${
                      s.position <= meetup.max_spots
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-stone-100 text-stone-500"
                    }`}
                  >
                    {s.position}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-stone-900">{s.name}</span>
                      {s.has_priority && (
                        <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-md font-medium" title="Didn't get to play last time">
                          priority
                        </span>
                      )}
                    </div>
                    {s.note && (
                      <p className="text-xs text-stone-400 mt-0.5 leading-relaxed">{s.note}</p>
                    )}
                  </div>
                  {s.position <= meetup.max_spots ? (
                    <span className="shrink-0 text-xs font-medium text-emerald-600 mt-1">confirmed</span>
                  ) : (
                    <span className="shrink-0 text-xs text-stone-400 mt-1">waitlist</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <IdeasBoard />
    </div>
  );
}

function IdeasBoard() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [newIdea, setNewIdea] = useState("");
  const [ideaName, setIdeaName] = useState("");
  const [submittingIdea, setSubmittingIdea] = useState(false);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [pendingVoteIds, setPendingVoteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const saved = localStorage.getItem("voted_ideas");
    if (saved) {
      try { setVotedIds(new Set(JSON.parse(saved))); } catch { /* ignore */ }
    }
    loadIdeas();
    const interval = setInterval(loadIdeas, 15000);
    return () => clearInterval(interval);
  }, []);

  async function loadIdeas() {
    try {
      const data = await getIdeas();
      setIdeas(data);
    } catch { /* silent */ }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newIdea.trim()) return;
    setSubmittingIdea(true);
    try {
      await createIdea(newIdea.trim(), ideaName.trim() || undefined);
      setNewIdea("");
      setIdeaName("");
      await loadIdeas();
    } catch { /* silent */ }
    setSubmittingIdea(false);
  }

  async function handleVote(id: string) {
    if (pendingVoteIds.has(id)) return;
    const hasVoted = votedIds.has(id);
    setPendingVoteIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    try {
      const updated = new Set(votedIds);
      if (hasVoted) {
        await unvoteIdea(id);
        updated.delete(id);
      } else {
        await upvoteIdea(id);
        updated.add(id);
      }
      setVotedIds(updated);
      localStorage.setItem("voted_ideas", JSON.stringify([...updated]));
      await loadIdeas();
    } catch { /* silent */ }
    finally {
      setPendingVoteIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  const active = ideas.filter((i) => !i.is_done);
  const done = ideas.filter((i) => i.is_done);

  return (
    <div className="pt-8 border-t border-stone-200">
      <h2 className="text-xs uppercase tracking-[0.25em] font-semibold text-stone-500 mb-1">
        Questions & Ideas
      </h2>
      <p className="text-xs text-stone-400 mb-5 leading-relaxed">
        Ask a question, suggest a topic, or share an idea. Vote on what interests you!
      </p>

      <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-5 mb-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-3">
            <input
              type="text"
              value={newIdea}
              onChange={(e) => setNewIdea(e.target.value)}
              placeholder="Ask a question or suggest a topic..."
              aria-label="Ask a question or suggest a topic"
              maxLength={500}
              className="flex-1 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
            />
            <button
              type="submit"
              disabled={submittingIdea || !newIdea.trim()}
              className="bg-amber-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {submittingIdea ? "..." : "Submit"}
            </button>
          </div>
          <input
            type="text"
            value={ideaName}
            onChange={(e) => setIdeaName(e.target.value)}
            placeholder="Your name (optional)"
            aria-label="Your name (optional)"
            maxLength={100}
            className="w-full border border-stone-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
          />
        </form>
      </div>

      {active.length === 0 && done.length === 0 && (
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-6 text-center">
          <p className="text-stone-400 text-sm">No ideas yet. Be the first to suggest one!</p>
        </div>
      )}

      {active.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
          <ul className="divide-y divide-stone-100">
            {active.map((idea) => (
              <li key={idea.id} className="flex items-start gap-3 text-sm px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleVote(idea.id)}
                  disabled={pendingVoteIds.has(idea.id)}
                  aria-pressed={votedIds.has(idea.id)}
                  className={`flex flex-col items-center min-w-[2rem] pt-0.5 transition-colors ${
                    votedIds.has(idea.id)
                      ? "text-amber-600"
                      : "text-stone-400 hover:text-amber-500"
                  } ${pendingVoteIds.has(idea.id) ? "opacity-60" : ""}`}
                  title={votedIds.has(idea.id) ? "Undo vote" : "Upvote"}
                >
                  <span className="text-xs leading-none">&#9650;</span>
                  <span className="text-xs font-semibold tabular-nums">{idea.votes}</span>
                </button>
                <span className="text-stone-700 leading-relaxed">
                  {idea.text}
                  {idea.submitted_by && (
                    <span className="text-stone-400 text-xs ml-1.5">— {idea.submitted_by}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-5">
          <p className="text-xs uppercase tracking-[0.25em] font-semibold text-stone-400 mb-2">Covered</p>
          <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
            <ul className="divide-y divide-stone-100">
              {done.map((idea) => (
                <li key={idea.id} className="flex items-start gap-3 text-sm px-4 py-3">
                  <span className="min-w-[2rem] text-center text-xs text-stone-300 pt-0.5 tabular-nums">{idea.votes}</span>
                  <span className="text-stone-400 line-through">
                    {idea.text}
                    {idea.submitted_by && (
                      <span className="text-stone-300 text-xs ml-1.5">— {idea.submitted_by}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
