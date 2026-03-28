import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getActiveSession } from "@/lib/chat-persistence";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return Response.json({ session: null });
  }

  const activeSession = await getActiveSession(userId);

  if (!activeSession) {
    return Response.json({ session: null });
  }

  return Response.json({
    session: {
      id: activeSession.id,
      intention: activeSession.intention,
      startedAt: activeSession.startedAt,
      messages: activeSession.messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.createdAt.getTime(),
      })),
    },
  });
}
