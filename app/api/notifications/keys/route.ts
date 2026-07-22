// ============================================================================
// GET /api/notifications/keys — one-time VAPID keypair generator for
// non-technical setup: visit this URL once, copy the two values into your
// deployment's environment variables, and redeploy.
//
// Locked once keys are configured, so it can't be used to view or replace
// the live keypair.
// ============================================================================

import { NextResponse } from "next/server";
import webpush from "web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // fresh keypair per visit; env checked at request time

export function GET() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json(
      { error: "Push keys are already configured. This generator is disabled." },
      { status: 403 }
    );
  }

  const keys = webpush.generateVAPIDKeys();
  return NextResponse.json({
    instructions:
      "Copy these into your hosting provider's environment variables, then redeploy. Keep the private key secret. Visiting this page again generates a DIFFERENT pair — only the pair you actually save matters.",
    VAPID_PUBLIC_KEY: keys.publicKey,
    VAPID_PRIVATE_KEY: keys.privateKey,
  });
}
