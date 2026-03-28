import Anthropic from "@anthropic-ai/sdk";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEnhancedChatSystemPrompt } from "@/lib/prompts";
import { getRecentSummaries, saveMessages } from "@/lib/chat-persistence";
import { prisma } from "@/lib/db";

const client = new Anthropic();

export async function POST(req: Request) {
  const { messages, intention, promptModifiers, chatSessionId } =
    await req.json();

  // Get authenticated user (non-blocking if unauthenticated)
  let userId: string | undefined;
  let summaries: Awaited<ReturnType<typeof getRecentSummaries>> = [];
  try {
    const session = await getServerSession(authOptions);
    userId = (session?.user as { id?: string })?.id;
    if (userId) {
      summaries = await getRecentSummaries(userId);
    }
  } catch {
    // Continue without cross-session context if auth fails
  }

  // Pre-verify session ownership before streaming (so we don't save to wrong session)
  let verifiedSessionId: string | null = null;
  if (chatSessionId && userId) {
    try {
      const chatSession = await prisma.chatSession.findFirst({
        where: { id: chatSessionId, userId },
      });
      if (chatSession) {
        verifiedSessionId = chatSession.id;
      }
    } catch {
      // Continue without persistence
    }
  }

  const stream = await client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 512,
    system: getEnhancedChatSystemPrompt(
      intention,
      promptModifiers || "",
      summaries
    ),
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
  });

  // Collect the full response text for persistence
  let fullAssistantText = "";

  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          fullAssistantText += event.delta.text;
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ text: event.delta.text })}\n\n`
            )
          );
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();

      // After streaming completes, persist messages only if ownership verified
      if (verifiedSessionId) {
        try {
          const lastUserMessage = messages[messages.length - 1];
          await saveMessages(verifiedSessionId, [
            { role: lastUserMessage.role, content: lastUserMessage.content },
            { role: "assistant", content: fullAssistantText },
          ]);
        } catch {
          console.error("Failed to persist chat messages");
        }
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
