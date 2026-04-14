import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyAdmin } from "@/lib/admin";
import { recalculatePositions } from "@/lib/positions";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; signupId: string }> }
) {
  const { id: meetupId, signupId } = await params;
  const unauthorized = verifyAdmin(request);
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  // Allow setting status
  if (body.status) {
    const allowed = ["active", "played", "not_reached", "no_show"];
    if (!allowed.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = body.status;
  }

  // Allow editing name
  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    if (trimmed.length > 100) {
      return NextResponse.json({ error: "Name must be 100 characters or less" }, { status: 400 });
    }
    updates.name = trimmed;
  }

  // Allow editing note
  if (typeof body.note === "string") {
    const trimmed = body.note.trim();
    updates.note = trimmed.slice(0, 500) || null;
  }

  // Allow toggling granted_priority
  if (typeof body.granted_priority === "boolean") {
    updates.granted_priority = body.granted_priority;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("signups")
    .update(updates)
    .eq("id", signupId)
    .eq("meetup_id", meetupId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; signupId: string }> }
) {
  const { id: meetupId, signupId } = await params;

  // Mark as cancelled
  const { error } = await supabase
    .from("signups")
    .update({ status: "cancelled" })
    .eq("id", signupId)
    .eq("meetup_id", meetupId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Recalculate positions to close the gap
  await recalculatePositions(meetupId);

  return NextResponse.json({ ok: true });
}
