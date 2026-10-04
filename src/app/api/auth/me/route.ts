import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/jwt";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ user: null });
    }

    // Exclude passwordHash
    const { passwordHash, ...safeUser } = user;
    return NextResponse.json({ user: safeUser });
  } catch (err: any) {
    return NextResponse.json({ user: null });
  }
}
