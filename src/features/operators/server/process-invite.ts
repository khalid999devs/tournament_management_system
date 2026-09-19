import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import { notifications, staffProfiles } from "@/db/schema";
import { buildOperationalEmail } from "@/features/notifications/domain/operational-email";
import { sendEmail } from "@/lib/email/resend";
import { getServerEnv } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function processOperatorInvite(
  notificationId: string,
  initialTokenHash?: string,
  initialTokenType: "invite" | "recovery" = "invite",
) {
  const db = getDatabase();
  const [claimed] = await db
    .update(notifications)
    .set({
      status: "SENDING",
      retryCount: sql`${notifications.retryCount} + 1`,
      errorText: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.type, "OPERATOR_INVITE"),
        inArray(notifications.status, ["QUEUED", "FAILED"]),
      ),
    )
    .returning({ id: notifications.id, retryCount: notifications.retryCount });

  if (!claimed) return { status: "SKIPPED" as const };

  try {
    const [context] = await db
      .select({
        recipientEmail: notifications.recipientEmail,
        idempotencyKey: notifications.idempotencyKey,
        displayName: staffProfiles.displayName,
        profileEmail: staffProfiles.email,
        role: staffProfiles.role,
        active: staffProfiles.active,
      })
      .from(notifications)
      .innerJoin(
        staffProfiles,
        eq(notifications.staffProfileId, staffProfiles.id),
      )
      .where(eq(notifications.id, notificationId))
      .limit(1);

    if (
      !context ||
      !context.active ||
      context.role !== "SCORE_OPERATOR" ||
      context.profileEmail?.toLowerCase() !==
        context.recipientEmail.toLowerCase()
    ) {
      throw new Error("Operator invitation is no longer valid.");
    }

    let tokenHash = initialTokenHash;
    let tokenType: "invite" | "recovery" = initialTokenType;

    if (!tokenHash) {
      const auth = createAdminClient().auth.admin;
      const invite = await auth.generateLink({
        type: "invite",
        email: context.recipientEmail,
      });
      const link = invite.error
        ? await auth.generateLink({
            type: "recovery",
            email: context.recipientEmail,
          })
        : invite;

      if (link.error || !link.data.properties.hashed_token) {
        throw new Error("Could not generate a staff sign-in link.");
      }

      tokenHash = link.data.properties.hashed_token;
      tokenType = invite.error ? "recovery" : "invite";
    }

    const actionUrl = new URL(
      "/auth/confirm",
      getServerEnv().NEXT_PUBLIC_APP_URL,
    );
    actionUrl.searchParams.set("token_hash", tokenHash);
    actionUrl.searchParams.set("type", tokenType);
    const email = await buildOperationalEmail({
      type: "OPERATOR_INVITE",
      recipientName: context.displayName,
      tournamentName: "NDCAK Indoor Games Championship",
      supportEmail: getServerEnv().EMAIL_REPLY_TO ?? "ndcakofficial@gmail.com",
      invitationUrl: actionUrl.toString(),
      expiresDescription: "is time-limited",
    });
    const result = await sendEmail({
      to: context.recipientEmail,
      ...email,
      idempotencyKey: `${context.idempotencyKey}:${claimed.retryCount}`,
    });

    await db
      .update(notifications)
      .set({
        status: "SENT",
        providerMessageId: result?.id ?? null,
        errorText: null,
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(notifications.id, notificationId));

    return { status: "SENT" as const };
  } catch (error) {
    await db
      .update(notifications)
      .set({
        status: "FAILED",
        errorText:
          error instanceof Error
            ? error.message.slice(0, 1500)
            : "Invite delivery failed.",
        updatedAt: new Date(),
      })
      .where(eq(notifications.id, notificationId));

    return { status: "FAILED" as const };
  }
}
