// ============================================================================
// /api/vision — vision-board image management with zero manual setup.
// Uses the service role so the 'motivation' bucket is created automatically
// on first use; files live under <user_id>/ and are publicly readable.
//   GET    -> list caller's images ({ images: [{path, url}] })
//   POST   -> multipart upload (field "files", multiple) -> updated list
//   DELETE -> { path } (must be inside the caller's folder)
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "motivation";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

async function authUser(req: NextRequest): Promise<User | null> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const {
    data: { user },
  } = await getSupabase().auth.getUser(token);
  return user;
}

async function ensureBucket(admin: SupabaseClient): Promise<void> {
  const { error } = await admin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_FILE_BYTES,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"],
  });
  // "The resource already exists" is the normal case after first use.
  if (error && !/already exists/i.test(error.message)) {
    throw new Error(`Could not create image bucket: ${error.message}`);
  }
}

async function listImages(admin: SupabaseClient, userId: string) {
  const { data: files, error } = await admin.storage
    .from(BUCKET)
    .list(userId, { limit: 100, sortBy: { column: "created_at", order: "asc" } });
  if (error) throw new Error(error.message);
  return (files ?? [])
    .filter((f) => f.name && !f.name.startsWith("."))
    .map((f) => {
      const path = `${userId}/${f.name}`;
      return {
        path,
        url: admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
      };
    });
}

export async function GET(req: NextRequest) {
  const user = await authUser(req);
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  try {
    const admin = getSupabaseAdmin();
    await ensureBucket(admin);
    return NextResponse.json({ images: await listImages(admin, user.id) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Listing failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await authUser(req);
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  try {
    const admin = getSupabaseAdmin();
    await ensureBucket(admin);

    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: "No files received" }, { status: 400 });
    }

    for (const file of files.slice(0, 20)) {
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: `"${file.name}" is over 10 MB — resize it and try again.` },
          { status: 413 }
        );
      }
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().slice(0, 5);
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error } = await admin.storage
        .from(BUCKET)
        .upload(`${user.id}/${crypto.randomUUID()}.${ext}`, buffer, {
          contentType: file.type || "image/jpeg",
        });
      if (error) throw new Error(error.message);
    }

    return NextResponse.json({ images: await listImages(admin, user.id) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const user = await authUser(req);
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  try {
    const { path } = (await req.json()) as { path?: string };
    if (!path || !path.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }
    const admin = getSupabaseAdmin();
    const { error } = await admin.storage.from(BUCKET).remove([path]);
    if (error) throw new Error(error.message);
    return NextResponse.json({ images: await listImages(admin, user.id) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
