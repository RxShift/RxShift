"use server";

// Feedback / issues — one inbox for user-submitted feedback/bugs/features AND
// system-detected problems (the latter via lib/system-report.ts). The table has
// RLS enabled with NO policies, so all access is service-role: submitFeedback is
// gated by requireMember in code; triage is gated by requirePlatformAdmin.

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import type { FeedbackKind, FeedbackStatus } from "@/lib/types";
import {
  ActionError,
  requireMember,
  requirePlatformAdmin,
  runAction,
  type ActionResult,
} from "./helpers";

const PLATFORM_ADMIN_EMAIL =
  process.env.PLATFORM_ADMIN_EMAIL || "jamison@jamisonwest.com";

const KINDS: FeedbackKind[] = ["bug", "feature", "feedback"];
const STATUSES: FeedbackStatus[] = [
  "new",
  "triaged",
  "in_progress",
  "done",
  "wont_do",
];

/** Submit feedback / a bug / a feature request from inside the app. */
export async function submitFeedback(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requireMember();
    const kind = String(formData.get("kind") || "");
    const subject = String(formData.get("subject") || "").trim();
    const body = String(formData.get("body") || "").trim();
    const pageUrl = String(formData.get("page_url") || "").slice(0, 500) || null;

    if (!KINDS.includes(kind as FeedbackKind))
      throw new ActionError("Pick a type (bug, feature, or feedback).");
    if (!subject) throw new ActionError("Add a short subject.");
    if (subject.length > 200) throw new ActionError("Subject is too long.");
    if (body.length > 5000) throw new ActionError("Description is too long.");

    const service = createServiceClient();
    const { data: row, error } = await service
      .from("feedback")
      .insert({
        tenant_id: ctx.tenantId,
        actor_user_id: ctx.userId,
        staff_id: ctx.appUser.staff_id,
        source: "user",
        kind,
        subject,
        body: body || null,
        page_url: pageUrl,
        status: "new",
      })
      .select("id")
      .single();
    if (error) throw new ActionError(error.message);
    const id = row.id as string;

    // Optional screenshot → private 'feedback' bucket, named by the feedback id.
    const file = formData.get("screenshot");
    let hasScreenshot = false;
    if (file instanceof Blob && file.size > 0) {
      if (file.size > 5 * 1024 * 1024)
        throw new ActionError("Screenshot must be under 5 MB.");
      const ext =
        file.type === "image/png"
          ? "png"
          : file.type === "image/jpeg"
            ? "jpg"
            : file.type === "image/webp"
              ? "webp"
              : null;
      if (!ext)
        throw new ActionError("Screenshot must be a PNG, JPG, or WebP image.");
      const path = `${ctx.tenantId}/${id}.${ext}`;
      const buf = Buffer.from(await file.arrayBuffer());
      const { error: upErr } = await service.storage
        .from("feedback")
        .upload(path, buf, { contentType: file.type, upsert: true });
      if (upErr) throw new ActionError(upErr.message);
      await service.from("feedback").update({ screenshot_path: path }).eq("id", id);
      hasScreenshot = true;
    }

    // Notify platform admins (addressed to ourselves → bypass the tenant gate).
    await sendEmail({
      kind: "feedback",
      to: PLATFORM_ADMIN_EMAIL,
      bypassGate: true,
      subject: `[RxShift ${kind}] ${subject}`,
      lines: [
        `${kind.toUpperCase()} from a ${ctx.appUser.role} in ${ctx.tenant.name}.`,
        body || "(no description provided)",
        pageUrl ? `Page: ${pageUrl}` : "",
        hasScreenshot ? "A screenshot was attached." : "",
      ].filter(Boolean),
      cta: {
        label: "Open Feedback",
        url: "https://app.rxshift.io/app/admin/feedback",
      },
      related: { type: "feedback", id },
    });

    revalidatePath("/app/admin/feedback");
    return { id };
  });
}

/** Platform-admin: change a feedback item's triage status. */
export async function updateFeedbackStatus(
  id: string,
  status: string
): Promise<ActionResult> {
  return runAction(async () => {
    await requirePlatformAdmin();
    if (!STATUSES.includes(status as FeedbackStatus))
      throw new ActionError("Invalid status.");
    const service = createServiceClient();
    const { error } = await service
      .from("feedback")
      .update({ status })
      .eq("id", id);
    if (error) throw new ActionError(error.message);
    revalidatePath("/app/admin/feedback");
    return undefined;
  });
}

/** Platform-admin: set the internal triage note on a feedback item. */
export async function setFeedbackNote(
  id: string,
  note: string
): Promise<ActionResult> {
  return runAction(async () => {
    await requirePlatformAdmin();
    if (note.length > 4000) throw new ActionError("Note is too long.");
    const service = createServiceClient();
    const { error } = await service
      .from("feedback")
      .update({ internal_note: note.trim() || null })
      .eq("id", id);
    if (error) throw new ActionError(error.message);
    revalidatePath("/app/admin/feedback");
    return undefined;
  });
}
