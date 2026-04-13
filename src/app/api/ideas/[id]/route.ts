import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyAdmin } from "@/lib/admin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  // Upvote (public)
  if (body.action === "upvote") {
    const { data: current } = await supabase
      .from("ideas")
      .select("votes")
      .eq("id", id)
      .single();
    if (!current) return NextResponse.json({ error: "Idea not found" }, { status: 404 });

    const { data, error } = await supabase
      .from("ideas")
      .update({ votes: current.votes + 1 })
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Mark done (admin only)
  if ("is_done" in body) {
    const unauthorized = verifyAdmin(request);
    if (unauthorized) return unauthorized;

    const { data, error } = await supabase
      .from("ideas")
      .update({ is_done: body.is_done })
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const unauthorized = verifyAdmin(request);
  if (unauthorized) return unauthorized;

  const { error } = await supabase.from("ideas").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
