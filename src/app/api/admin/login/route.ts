import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";

export async function POST(request: NextRequest) {
  const unauthorized = verifyAdmin(request);
  if (unauthorized) return unauthorized;
  return NextResponse.json({ ok: true });
}
