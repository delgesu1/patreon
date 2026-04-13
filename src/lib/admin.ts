import { NextRequest, NextResponse } from "next/server";

export function verifyAdmin(request: NextRequest): NextResponse | null {
  const auth = request.headers.get("Authorization");
  if (!auth || auth !== `Bearer ${process.env.ADMIN_PASSWORD}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
