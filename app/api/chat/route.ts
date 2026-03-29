import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEnhancedChatSystemPrompt } from "@/lib/prompts";
import { getRecentSummaries, saveMessages } from "@/lib/chat-persistence";
import { prisma } from "@/lib/db";
import {
  assertTokenBudget,
  getAnthropicClient,
  recordTokenUsage,
  BudgetExceededError,
} from "@/lib/token-budget";

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

  // Budget gate
  if (userId) {
    try {
      await assertTokenBudget(userId);
    } catch (err) {
      if (err instanceof BudgetExceededError) {
        return Response.json(
          {
            error: "budget_exceeded",
            tokensUsed: err.tokensUsed,
            tokenBudget: err.tokenBudget,
          },
          { status: 403 },
        );
      }
      throw err;
    }
  }

  // Get the appropriate client (server singleton or BYOK)
  const {
    client: anthropic,
    model,
    usingOwnKey,
  } = await getAnthropicClient(userId ?? "", "claude-opus-4-6");

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

  const stream = await anthropic.messages.stream({
    model,
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

      // Record token usage (server key only)
      if (userId && !usingOwnKey) {
        try {
          const finalMessage = await stream.finalMessage();
          await recordTokenUsage(
            userId,
            finalMessage.usage.input_tokens,
            finalMessage.usage.output_tokens,
          );
        } catch {
          console.error("Failed to record token usage");
        }
      }

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
