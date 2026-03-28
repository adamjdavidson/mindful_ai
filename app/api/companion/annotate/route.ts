import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      console.error("[annotate] No user ID in session");
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { eventId, eventTitle, stress, note } = body;
    console.log("[annotate] POST", { userId, eventId, eventTitle, stress: typeof stress, note: typeof note });

    if (!eventId) {
      return Response.json({ error: "eventId required" }, { status: 400 });
    }

    const existing = await prisma.companionProfile.findUnique({
      where: { userId },
    });

    const annotations =
      (existing?.eventAnnotations as Record<string, { stress?: number; note?: string; title?: string }>) ?? {};

    annotations[eventId] = {
      ...annotations[eventId],
      ...(typeof stress === "number" ? { stress } : {}),
      ...(typeof note === "string" ? { note } : {}),
      ...(typeof eventTitle === "string" ? { title: eventTitle } : {}),
    };

    await prisma.companionProfile.upsert({
      where: { userId },
      create: { userId, eventAnnotations: annotations },
      update: { eventAnnotations: annotations },
    });

    console.log("[annotate] Saved annotation for", eventId);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[annotate] Error:", err);
    return Response.json({ error: "internal error", details: String(err) }, { status: 500 });
  }
}
