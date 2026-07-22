// GET /api/notifications/config — exposes the VAPID public key so the
// browser can subscribe. 503 until keys are configured.

import { NextResponse } from "next/server";

export function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return NextResponse.json(
      { error: "Push not configured: set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY." },
      { status: 503 }
    );
  }
  return NextResponse.json({ publicKey });
}
