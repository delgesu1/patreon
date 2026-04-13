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
  return <span className="text-amber-600 font-medium">{timeLeft}</span>;
}

export default function Home() {
  const [meetup, setMeetup] = useState<Meetup | null>(null);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [name, setName] = useState("");
  const [mySignup, setMySignup] = useState<Signup | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const loadData = useCallback(async () => {
    try {
      const meetups: Meetup[] = await getMeetups();
      setError("");
      const upcoming = meetups.find((m) => m.status === "upcoming");
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
      const signup = await createSignup(meetup.id, name.trim());
      localStorage.setItem("signup_name", name.trim());
      setMySignup(signup);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sign up");
    }
    setSubmitting(false);
  }

  async function handleCancel() {
    if (!meetup || !mySignup) return;
    if (!confirm("Cancel your signup? You'll lose your spot.")) return;
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
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!meetup) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center py-8">
          <h1 className="text-2xl font-bold mb-4">Violin Meetup</h1>
          <p className="text-gray-500">No upcoming meetups scheduled. Check back later!</p>
        </div>
        <IdeasBoard />
      </div>
    );
  }

  const signupsOpen = now >= new Date(meetup.signup_opens_at).getTime();
  const spotsConfirmed = signups.filter((s) => s.position <= meetup.max_spots).length;
  const spotsRemaining = Math.max(0, meetup.max_spots - spotsConfirmed);

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">{meetup.title}</h1>
      <p className="text-gray-600 mb-1">{formatEasternDateTime(meetup.meetup_date)}</p>
      <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-6">
        Eastern Time
      </p>

      {!signupsOpen && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-amber-800">
            Signups open in <Countdown target={meetup.signup_opens_at} />
          </p>
          <p className="text-xs text-amber-600 mt-1">
            Opens {formatEasternDateTime(meetup.signup_opens_at)}
          </p>
        </div>
      )}

      {signupsOpen && (
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-4">
            <span className="font-semibold text-gray-900">{spotsRemaining}</span> of{" "}
            {meetup.max_spots} spots remaining
          </p>

          {mySignup ? (
            <div className="bg-white border rounded-lg p-4">
              <div className="mb-3">
                {mySignup.position <= meetup.max_spots ? (
                  <p className="text-green-700 font-semibold">
                    You&apos;re confirmed! (Spot #{mySignup.position})
                  </p>
                ) : (
                  <p className="text-amber-700 font-semibold">
                    You&apos;re on the waitlist (Position #{mySignup.position})
                  </p>
                )}
                {mySignup.has_priority && (
                  <span className="inline-block mt-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                    Moved to front — didn&apos;t get to play last time
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleCancel}
                disabled={submitting}
                className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
              >
                {submitting ? "Cancelling..." : "Cancel my signup"}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSignup} className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                aria-label="Your name"
                maxLength={100}
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={submitting || !name.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Signing up..." : spotsRemaining > 0 ? "Sign Up to Play" : "Join Waitlist"}
              </button>
            </form>
          )}

          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        </div>
      )}

      {/* Signup list */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Signup Queue ({signups.length})
        </h2>
        {signups.length === 0 ? (
          <p className="text-gray-400 text-sm">No signups yet. Be the first!</p>
        ) : (
          <ol className="space-y-1">
            {signups.map((s) => (
              <li
                key={s.id}
                className={`flex items-center gap-2 text-sm px-3 py-2 rounded ${
                  s.position <= meetup.max_spots
                    ? "bg-green-50 text-green-800"
                    : "bg-gray-50 text-gray-600"
                } ${
                  mySignup?.id === s.id ? "ring-2 ring-blue-300" : ""
                }`}
              >
                <span className="font-mono text-xs w-6 text-right text-gray-400">
                  {s.position}.
                </span>
                <span className="font-medium">{s.name}</span>
                {s.has_priority && (
                  <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded" title="Didn't get to play last time">
                    priority
                  </span>
                )}
                {s.position <= meetup.max_spots ? (
                  <span className="ml-auto text-xs text-green-600">confirmed</span>
                ) : (
                  <span className="ml-auto text-xs text-gray-400">waitlist</span>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      <IdeasBoard />
    </div>
  );
}

function IdeasBoard() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [newIdea, setNewIdea] = useState("");
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
      await createIdea(newIdea.trim());
      setNewIdea("");
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
    <div className="mt-10 border-t pt-8">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">
        Topic Ideas
      </h2>
      <p className="text-xs text-gray-400 mb-4">
        Suggest topics for upcoming meetups. Vote on what interests you!
      </p>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          type="text"
          value={newIdea}
          onChange={(e) => setNewIdea(e.target.value)}
          placeholder="Suggest a topic or question..."
          aria-label="Suggest a topic or question"
          maxLength={500}
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={submittingIdea || !newIdea.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {submittingIdea ? "..." : "Submit"}
        </button>
      </form>

      {active.length === 0 && done.length === 0 && (
        <p className="text-gray-400 text-sm">No ideas yet. Be the first to suggest one!</p>
      )}

      {active.length > 0 && (
        <ul className="space-y-1.5">
          {active.map((idea) => (
            <li key={idea.id} className="flex items-start gap-2 text-sm px-3 py-2 rounded bg-gray-50">
              <button
                type="button"
                onClick={() => handleVote(idea.id)}
                disabled={pendingVoteIds.has(idea.id)}
                aria-pressed={votedIds.has(idea.id)}
                className={`flex flex-col items-center min-w-[2rem] pt-0.5 ${
                  votedIds.has(idea.id)
                    ? "text-blue-600"
                    : "text-gray-400 hover:text-blue-500"
                } ${pendingVoteIds.has(idea.id) ? "opacity-60" : ""}`}
                title={votedIds.has(idea.id) ? "Undo vote" : "Upvote"}
              >
                <span className="text-xs leading-none">&#9650;</span>
                <span className="text-xs font-medium">{idea.votes}</span>
              </button>
              <span className="text-gray-700">{idea.text}</span>
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-gray-400 mb-1.5">Covered</p>
          <ul className="space-y-1">
            {done.map((idea) => (
              <li key={idea.id} className="flex items-start gap-2 text-sm px-3 py-1.5 rounded">
                <span className="min-w-[2rem] text-center text-xs text-gray-300 pt-0.5">{idea.votes}</span>
                <span className="text-gray-400 line-through">{idea.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
