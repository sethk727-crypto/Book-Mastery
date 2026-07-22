// ============================================================================
// GET /api/notifications/cron — daily reminder digest, fired by Vercel Cron
// (see vercel.json). For every user with a push subscription, counts:
//   - doctrine rules due for review
//   - active habits not yet logged today
//   - open 5-hour reconsolidation windows
// and sends one digest push. Dead subscriptions (404/410) are pruned.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

interface SubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function GET(req: NextRequest) {
  // Vercel sends "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 503 });
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:reminders@neuroabsorption.app",
    publicKey,
    privateKey
  );

  const admin = getSupabaseAdmin();
  const { data: subs, error: subsError } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth");
  if (subsError) {
    return NextResponse.json({ error: subsError.message }, { status: 500 });
  }

  const byUser = new Map<string, SubscriptionRow[]>();
  for (const sub of (subs ?? []) as SubscriptionRow[]) {
    const list = byUser.get(sub.user_id) ?? [];
    list.push(sub);
    byUser.set(sub.user_id, list);
  }

  const nowIso = new Date().toISOString();
  const todayIso = nowIso.slice(0, 10);
  let sent = 0;
  let pruned = 0;

  for (const [userId, userSubs] of byUser) {
    // Due reviews
    const { count: dueReviews } = await admin
      .from("review_schedules")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .lte("next_review_at", nowIso);

    // Active habits without a log for today
    const { data: habits } = await admin
      .from("habits")
      .select("id")
      .eq("user_id", userId)
      .is("completed_at", null)
      .is("abandoned_at", null);
    let uncheckedHabits = 0;
    if (habits && habits.length > 0) {
      const { data: todayLogs } = await admin
        .from("habit_logs")
        .select("habit_id")
        .eq("user_id", userId)
        .eq("log_date", todayIso);
      const logged = new Set((todayLogs ?? []).map((l) => l.habit_id));
      uncheckedHabits = habits.filter((h) => !logged.has(h.id)).length;
    }

    // Open reconsolidation windows
    const { count: openWindows } = await admin
      .from("schema_rewrites")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "window_open")
      .gt("window_closes_at", nowIso);

    const parts: string[] = [];
    if (dueReviews) parts.push(`${dueReviews} rule${dueReviews > 1 ? "s" : ""} due for recall`);
    if (uncheckedHabits) parts.push(`${uncheckedHabits} habit${uncheckedHabits > 1 ? "s" : ""} unchecked`);
    if (openWindows) parts.push(`${openWindows} reconsolidation window${openWindows > 1 ? "s" : ""} still open`);
    if (parts.length === 0) continue; // nothing to nag about

    const payload = JSON.stringify({
      title: "Daily Liturgy",
      body: parts.join(" · "),
      tag: "daily-liturgy",
      url: "/",
    });

    for (const sub of userSubs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
          pruned++;
        }
      }
    }
  }

  return NextResponse.json({ users: byUser.size, sent, pruned });
}
