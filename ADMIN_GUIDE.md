# Patreon Violin Meetups — Admin Guide

## What is this?

This is a signup app for Daniel Kurganov's bi-weekly Patreon violin meetups. Subscribers visit the site to sign up for upcoming meetups, suggest ideas/questions/topics for the sessions, and vote on what interests them. An admin manages the meetups and ideas from a dashboard.

The app lives at **kurganov.org/patreon**.

There are two pages:

- **Subscriber page** (`kurganov.org/patreon`) — public, no login required
- **Admin dashboard** (`kurganov.org/patreon/admin`) — password-protected

---

## How subscribers use it

When a subscriber visits the site, they see the next upcoming meetup with its date and time (always shown in Eastern Time).

- **Before signups open:** A countdown timer shows when signups will become available.
- **After signups open:** Subscribers type their name and click "Sign Up to Play." They can also leave an optional note (e.g. the piece they'd like to play). Their name is saved in their browser so they don't have to re-type it next time.
- **Confirmed vs. waitlisted:** The meetup has a set number of spots (e.g. 4). Signups within that limit are "confirmed." Everyone else is on the waitlist.
- **Cancelling:** A subscriber can cancel their own signup. If they do, the next person on the waitlist automatically moves up into a confirmed spot.
- **Questions & Ideas:** At the bottom of the page, subscribers can ask questions, suggest topics, or share ideas for meetups — and optionally include their name. They can also vote on each other's submissions.

Subscribers identify by name only — there are no accounts or logins.

---

## Admin dashboard

### Logging in

Go to `kurganov.org/patreon/admin` and enter the admin password. Your session lasts until you close the browser tab or click "Log out."

### Creating a meetup

1. Fill in the **Title** (defaults to "Violin Meetup").
2. Pick the **Meetup Date & Time** using the calendar/hour picker. All times are Eastern Time.
3. The **Signups Open At** date auto-fills to 7 days before the meetup. You can change it.
4. Set **Max Spots** (how many confirmed players, e.g. 4).
5. Click **Create Meetup**.

Only the next upcoming meetup is shown to subscribers. If you create multiple, the earliest one appears on the subscriber page.

### Managing a meetup

Click on any meetup card to expand it. From there you can:

- **Edit** — Change the title, date, signup open time, or max spots.
- **Delete** — Permanently removes the meetup and all its signups.

### Managing signups

Inside an expanded meetup, you'll see the signup list. If a subscriber left a note, it appears in italic below their name. For each person:

- **Played** — Mark them as having played in the meetup.
- **Skip** — They were signed up but didn't get reached (ran out of time).
- **No-show** — They didn't show up.
- **Undo** — Reset back to "active" if you made a mistake.
- **Click their name** to rename a signup (e.g. fixing a typo).
- **x button** — Remove a signup entirely (with confirmation).

### Priority system

If someone signed up but didn't get to play ("Skip"), you can grant them priority for the next meetup:

1. Click the **"Priority"** button next to their name. It will show a filled star.
2. The next time that person signs up (matched by name, case-insensitive), they'll automatically be moved to the front of the queue.
3. Priority is one-time use — it's consumed when they sign up for the next meetup.

### Completing a meetup

After the meetup is over and you've marked everyone's status:

1. Click **Complete Meetup** at the bottom of the expanded card.
2. The meetup moves to the "Past Meetups" section.

A warning shows if any signups are still unmarked ("active").

### Managing questions & ideas

At the bottom of the admin dashboard, you'll see all questions and ideas submitted by subscribers. If a subscriber included their name, it appears next to the text.

- **Done** — Mark a topic as covered. It moves to the "Covered" section.
- **Undo** — Move it back to active.
- **x** — Delete an idea permanently.

Vote counts are shown next to each idea so you can see what's popular.

---

## Key things to know

- **All times are Eastern Time.** Dates are stored internally as UTC but always displayed in ET.
- **The page auto-refreshes.** Subscribers see updated data every 10 seconds. You don't need to tell them to refresh.
- **No accounts.** Subscribers just type their name. The name is saved in their browser's local storage. If they use a different browser or clear their data, they'll need to type it again.
- **One signup per name per meetup.** The system prevents duplicate signups (case-insensitive).
- **Waitlist auto-promotes.** When someone cancels or is removed, positions recalculate automatically and the next waitlisted person moves into a confirmed spot.
