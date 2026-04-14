export interface Meetup {
  id: string;
  title: string;
  meetup_date: string;
  signup_opens_at: string;
  max_spots: number;
  status: "upcoming" | "completed";
  created_at: string;
}

export interface Idea {
  id: string;
  text: string;
  votes: number;
  is_done: boolean;
  created_at: string;
}

export interface Signup {
  id: string;
  meetup_id: string;
  name: string;
  position: number;
  status: "active" | "played" | "not_reached" | "no_show" | "cancelled";
  note: string | null;
  has_priority: boolean;
  granted_priority: boolean;
  created_at: string;
}
