import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyAdmin } from "@/lib/admin";

export async function GET() {
  const { data, error } = await supabase
    .from("meetups")
    .select("*")
    .order("meetup_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const unauthorized = verifyAdmin(request);
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const { title, meetup_date, signup_opens_at, max_spots } = body;

  if (!meetup_date || !signup_opens_at) {
    return NextResponse.json({ error: "meetup_date and signup_opens_at are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("meetups")
    .insert({
      title: title || "Violin Meetup",
      meetup_date,
      signup_opens_at,
      max_spots: max_spots || 4,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
