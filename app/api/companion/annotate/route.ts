import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { eventId, eventTitle, stress, note } = await req.json();

  if (!eventId) {
    return Response.json({ error: "eventId required" }, { status: 400 });
  }

  const userId = session.user.id;

  const existing = await prisma.companionProfile.findUnique({
    where: { userId },
  });

  const annotations =
    (existing?.eventAnnotations as Record<string, { stress?: number; note?: string; title?: string }>) ?? {};

  // Merge with existing annotation for this event
  annotations[eventId] = {
    ...annotations[eventId],
    ...(typeof stress === "number" ? { stress } : {}),
    ...(typeof note === "string" ? { note } : {}),
    ...(typeof eventTitle === "string" ? { title: eventTitle } : {}),
  };

  await prisma.companionProfile.upsert({
    where: { userId },
    create: {
      userId,
      eventAnnotations: annotations,
    },
    update: {
      eventAnnotations: annotations,
    },
  });

  return Response.json({ ok: true });
}
