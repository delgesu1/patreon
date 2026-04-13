const BASE = "";

function adminHeaders(): HeadersInit {
  const password = sessionStorage.getItem("admin_password") || "";
  return { "Content-Type": "application/json", Authorization: `Bearer ${password}` };
}

function publicHeaders(): HeadersInit {
  return { "Content-Type": "application/json" };
}

async function handleResponse(res: Response) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// Public
export async function getMeetups() {
  const res = await fetch(`${BASE}/api/meetups`, { headers: publicHeaders() });
  return handleResponse(res);
}

export async function getMeetup(id: string) {
  const res = await fetch(`${BASE}/api/meetups/${id}`, { headers: publicHeaders() });
  return handleResponse(res);
}

export async function getSignups(meetupId: string) {
  const res = await fetch(`${BASE}/api/meetups/${meetupId}/signups`, { headers: publicHeaders() });
  return handleResponse(res);
}

export async function createSignup(meetupId: string, name: string) {
  const res = await fetch(`${BASE}/api/meetups/${meetupId}/signups`, {
    method: "POST",
    headers: publicHeaders(),
    body: JSON.stringify({ name }),
  });
  return handleResponse(res);
}

export async function cancelSignup(meetupId: string, signupId: string) {
  const res = await fetch(`${BASE}/api/meetups/${meetupId}/signups/${signupId}`, {
    method: "DELETE",
    headers: publicHeaders(),
  });
  return handleResponse(res);
}

// Ideas
export async function getIdeas() {
  const res = await fetch(`${BASE}/api/ideas`, { headers: publicHeaders() });
  return handleResponse(res);
}

export async function createIdea(text: string) {
  const res = await fetch(`${BASE}/api/ideas`, {
    method: "POST",
    headers: publicHeaders(),
    body: JSON.stringify({ text }),
  });
  return handleResponse(res);
}

export async function upvoteIdea(id: string) {
  const res = await fetch(`${BASE}/api/ideas/${id}`, {
    method: "PATCH",
    headers: publicHeaders(),
    body: JSON.stringify({ action: "upvote" }),
  });
  return handleResponse(res);
}

export async function unvoteIdea(id: string) {
  const res = await fetch(`${BASE}/api/ideas/${id}`, {
    method: "PATCH",
    headers: publicHeaders(),
    body: JSON.stringify({ action: "unvote" }),
  });
  return handleResponse(res);
}

export async function adminMarkIdeaDone(id: string, is_done: boolean) {
  const res = await fetch(`${BASE}/api/ideas/${id}`, {
    method: "PATCH",
    headers: adminHeaders(),
    body: JSON.stringify({ is_done }),
  });
  return handleResponse(res);
}

export async function adminDeleteIdea(id: string) {
  const res = await fetch(`${BASE}/api/ideas/${id}`, {
    method: "DELETE",
    headers: adminHeaders(),
  });
  return handleResponse(res);
}

// Admin
export async function adminLogin(password: string) {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${password}` },
  });
  return handleResponse(res);
}

export async function adminCreateMeetup(data: {
  title: string;
  meetup_date: string;
  signup_opens_at: string;
  max_spots: number;
}) {
  const res = await fetch(`${BASE}/api/meetups`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function adminUpdateMeetup(id: string, data: Record<string, unknown>) {
  const res = await fetch(`${BASE}/api/meetups/${id}`, {
    method: "PATCH",
    headers: adminHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function adminCompleteMeetup(id: string) {
  const res = await fetch(`${BASE}/api/meetups/${id}/complete`, {
    method: "POST",
    headers: adminHeaders(),
  });
  return handleResponse(res);
}

export async function adminUpdateSignup(
  meetupId: string,
  signupId: string,
  data: Record<string, unknown>
) {
  const res = await fetch(`${BASE}/api/meetups/${meetupId}/signups/${signupId}`, {
    method: "PATCH",
    headers: adminHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function adminDeleteMeetup(id: string) {
  const res = await fetch(`${BASE}/api/meetups/${id}`, {
    method: "DELETE",
    headers: adminHeaders(),
  });
  return handleResponse(res);
}

export async function adminDeleteSignup(meetupId: string, signupId: string) {
  const res = await fetch(`${BASE}/api/meetups/${meetupId}/signups/${signupId}`, {
    method: "DELETE",
    headers: adminHeaders(),
  });
  return handleResponse(res);
}
