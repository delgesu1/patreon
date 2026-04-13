import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyAdmin } from "@/lib/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const unauthorized = verifyAdmin(request);
  if (unauthorized) return unauthorized;

  const { data, error } = await supabase
    .from("meetups")
    .update({ status: "completed" })
    .eq("id", id)
    .eq("status", "upcoming")
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Meetup not found or already completed" }, { status: 400 });
  return NextResponse.json(data);
}
