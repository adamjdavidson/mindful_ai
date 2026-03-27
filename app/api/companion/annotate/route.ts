import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { eventId, stress } = await req.json();

  if (!eventId || typeof stress !== "number" || stress < 1 || stress > 5) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  // Upsert the annotation in the companion profile
  const userId = session.user.id;

  const existing = await prisma.companionProfile.findUnique({
    where: { userId },
  });

  const annotations = (existing?.eventAnnotations as Record<string, { stress: number }>) ?? {};
  annotations[eventId] = { stress };

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
