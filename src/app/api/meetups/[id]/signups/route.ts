import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { recalculatePositions } from "@/lib/positions";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data, error } = await supabase
    .from("signups")
    .select("*")
    .eq("meetup_id", id)
    .neq("status", "cancelled")
    .order("position", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: meetupId } = await params;
  const body = await request.json();
  const name = (body.name || "").trim();
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null;

  // Validate name
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (name.length > 100) {
    return NextResponse.json({ error: "Name must be 100 characters or less" }, { status: 400 });
  }

  // Check meetup exists and is open for signups
  const { data: meetup, error: meetupError } = await supabase
    .from("meetups")
    .select("*")
    .eq("id", meetupId)
    .single();

  if (meetupError || !meetup) {
    return NextResponse.json({ error: "Meetup not found" }, { status: 404 });
  }
  if (meetup.status !== "upcoming") {
    return NextResponse.json({ error: "Meetup is no longer accepting signups" }, { status: 400 });
  }
  if (new Date() < new Date(meetup.signup_opens_at)) {
    return NextResponse.json({ error: "Signups are not open yet" }, { status: 400 });
  }

  // Check for duplicate (explicit check for good error message)
  const { data: existing } = await supabase
    .from("signups")
    .select("id")
    .eq("meetup_id", meetupId)
    .neq("status", "cancelled")
    .ilike("name", name);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "You have already signed up for this meetup" }, { status: 409 });
  }

  // Check priority: look at the most recent completed meetup
  let hasPriority = false;
  const { data: lastCompleted } = await supabase
    .from("meetups")
    .select("id")
    .eq("status", "completed")
    .order("meetup_date", { ascending: false })
    .limit(1);

  if (lastCompleted && lastCompleted.length > 0) {
    const { data: prioritySignup } = await supabase
      .from("signups")
      .select("id")
      .eq("meetup_id", lastCompleted[0].id)
      .eq("granted_priority", true)
      .ilike("name", name);

    if (prioritySignup && prioritySignup.length > 0) {
      hasPriority = true;
    }
  }

  // Get current max position
  const { data: lastSignup } = await supabase
    .from("signups")
    .select("position")
    .eq("meetup_id", meetupId)
    .neq("status", "cancelled")
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = lastSignup && lastSignup.length > 0 ? lastSignup[0].position + 1 : 1;

  // Insert the signup
  const { data: signup, error: insertError } = await supabase
    .from("signups")
    .insert({
      meetup_id: meetupId,
      name,
      note,
      position: nextPosition,
      has_priority: hasPriority,
    })
    .select()
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "You have already signed up for this meetup" }, { status: 409 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Recalculate positions (priority signups move to front)
  if (hasPriority) {
    await recalculatePositions(meetupId);
    // Re-fetch to get updated position
    const { data: updated } = await supabase
      .from("signups")
      .select("*")
      .eq("id", signup.id)
      .single();
    return NextResponse.json(updated, { status: 201 });
  }

  return NextResponse.json(signup, { status: 201 });
}
