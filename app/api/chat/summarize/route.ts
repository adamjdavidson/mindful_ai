import Anthropic from "@anthropic-ai/sdk";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getChatSessionMessages, endChatSession } from "@/lib/chat-persistence";
import { prisma } from "@/lib/db";

const client = new Anthropic();

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { chatSessionId } = await req.json();

  if (!chatSessionId) {
    return Response.json({ error: "chatSessionId required" }, { status: 400 });
  }

  // Verify the session belongs to this user
  const chatSession = await prisma.chatSession.findFirst({
    where: { id: chatSessionId, userId },
  });

  if (!chatSession) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  // Load all messages for the session
  const messages = await getChatSessionMessages(chatSessionId);

  if (messages.length === 0) {
    return Response.json({ error: "No messages to summarize" }, { status: 400 });
  }

  const conversationText = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n");

  const intentionContext = chatSession.intention
    ? `The user's stated intention was: "${chatSession.intention}"`
    : "No explicit intention was stated.";

  // Call Claude for ACIP-structured summary
  const response = await client.messages.create({
    model: "claude-sonnet-4-6-20250627",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `${intentionContext}

Here is the full conversation:

${conversationText}

Summarize this conversation in 3-4 sentences. Structure it as:
- What the user's intention was
- Which of the four pillars (awareness, connection, insight, purpose) showed up, with one specific example for each that activated
- How the user's presence/groundedness shifted during the session
- Any commitments, realizations, or shifts in perspective the user expressed

Also provide a JSON object with pillar activation scores (0-10) for each pillar based on how much it showed up in the conversation. Return the scores as a JSON block on its own line, formatted like:
PILLAR_SCORES: {"awareness": N, "connection": N, "insight": N, "purpose": N}

Put the summary text first, then the PILLAR_SCORES line last.`,
      },
    ],
  });

  const fullResponse =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Parse pillar scores from the response
  let pillarScores: Record<string, number> = {
    awareness: 0,
    connection: 0,
    insight: 0,
    purpose: 0,
  };
  let summary = fullResponse;

  const scoresMatch = fullResponse.match(
    /PILLAR_SCORES:\s*(\{[^}]+\})/
  );
  if (scoresMatch) {
    try {
      pillarScores = JSON.parse(scoresMatch[1]);
      // Remove the scores line from the summary text
      summary = fullResponse.replace(/\n*PILLAR_SCORES:\s*\{[^}]+\}/, "").trim();
    } catch {
      // Keep defaults if parsing fails
    }
  }

  // Persist the summary and scores
  await endChatSession(chatSessionId, summary, pillarScores);

  return Response.json({ summary, pillarScores });
}
