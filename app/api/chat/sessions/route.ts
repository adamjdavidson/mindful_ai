import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createChatSession } from "@/lib/chat-persistence";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { intention } = await req.json();
  const chatSession = await createChatSession(userId, intention);

  return Response.json({ id: chatSession.id });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = await prisma.chatSession.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    take: 20,
    select: {
      id: true,
      intention: true,
      summary: true,
      pillarScores: true,
      startedAt: true,
      endedAt: true,
      _count: { select: { messages: true } },
    },
  });

  return Response.json({ sessions });
}
