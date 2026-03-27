import Anthropic from "@anthropic-ai/sdk";
import { getMeditationPrompt, getReflectionPrompt } from "@/lib/prompts";

const client = new Anthropic();

export async function POST(req: Request) {
  const { intention, context, durationMinutes, type, messages, pillar } = await req.json();

  let prompt: string;
  if (type === "reflection") {
    prompt = getReflectionPrompt(intention, messages || []);
  } else {
    prompt = getMeditationPrompt(intention, context || "", durationMinutes || 1, pillar);
  }

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  return Response.json({ meditation: text });
}
