"use client";

// ============================================================================
// Client-side push subscription: register the service worker, subscribe with
// the server's VAPID public key, and store the subscription for the daily
// reminder cron.
// ============================================================================

import { getSupabase } from "./supabase";

export type PushSetupResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "unconfigured" | "denied" | "signedOut" | "error"; message: string };

function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function enablePushReminders(): Promise<PushSetupResult> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    typeof Notification === "undefined"
  ) {
    return {
      ok: false,
      reason: "unsupported",
      message: "This browser doesn't support push notifications.",
    };
  }

  const configRes = await fetch("/api/notifications/config");
  if (!configRes.ok) {
    return {
      ok: false,
      reason: "unconfigured",
      message: "Reminders aren't set up on the server yet (VAPID keys missing).",
    };
  }
  const { publicKey } = (await configRes.json()) as { publicKey: string };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      ok: false,
      reason: "denied",
      message: "Notifications were blocked — allow them in your browser settings.",
    };
  }

  try {
    const supabase = getSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, reason: "signedOut", message: "Sign in first." };
    }

    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ToUint8Array(publicKey),
      }));

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      throw new Error("Browser returned an incomplete subscription");
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      { onConflict: "endpoint" }
    );
    if (error) throw new Error(error.message);

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      message: err instanceof Error ? err.message : "Could not enable reminders.",
    };
  }
}
