import Anthropic from "@anthropic-ai/sdk";
import { getEnhancedChatSystemPrompt } from "@/lib/prompts";

const client = new Anthropic();

export async function POST(req: Request) {
  const { messages, intention, promptModifiers } = await req.json();

  const stream = await client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 512,
    system: getEnhancedChatSystemPrompt(intention, promptModifiers || ""),
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
  });

  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
          );
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
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
