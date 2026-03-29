import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMeditationPrompt, getReflectionPrompt } from "@/lib/prompts";
import {
  assertTokenBudget,
  getAnthropicClient,
  recordTokenUsage,
  BudgetExceededError,
} from "@/lib/token-budget";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Budget gate
  try {
    await assertTokenBudget(userId);
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      return Response.json(
        { error: "budget_exceeded", tokensUsed: err.tokensUsed, tokenBudget: err.tokenBudget },
        { status: 403 },
      );
    }
    throw err;
  }

  const { intention, context, durationMinutes, type, messages, pillar } = await req.json();

  let prompt: string;
  if (type === "reflection") {
    prompt = getReflectionPrompt(intention, messages || []);
  } else {
    prompt = getMeditationPrompt(intention, context || "", durationMinutes || 1, pillar);
  }

  const { client, model, usingOwnKey } = await getAnthropicClient(userId, "claude-opus-4-6");

  const response = await client.messages.create({
    model,
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  // Record token usage (server key only)
  if (!usingOwnKey) {
    try {
      await recordTokenUsage(userId, response.usage.input_tokens, response.usage.output_tokens);
    } catch {
      console.error("Failed to record token usage");
    }
  }

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  return Response.json({ meditation: text });
}
