import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { saveSelfReport } from "@/lib/chat-persistence";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { chatSessionId, score } = await req.json();

  if (!chatSessionId || typeof score !== "number") {
    return Response.json(
      { error: "chatSessionId and score required" },
      { status: 400 }
    );
  }

  // Verify the session belongs to this user
  const chatSession = await prisma.chatSession.findFirst({
    where: { id: chatSessionId, userId },
  });
  if (!chatSession) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  const report = await saveSelfReport(chatSessionId, score);
  return Response.json({ id: report.id });
}
