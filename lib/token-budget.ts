import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encryption';

// Cached server-key singleton (reused for all non-BYOK requests)
const serverClient = new Anthropic();

export interface TokenBudgetStatus {
  tokensUsed: number;
  tokenBudget: number;
  hasOwnKey: boolean;
  preferredModel: string;
  warningReached: boolean;
  budgetExceeded: boolean;
}

export class BudgetExceededError extends Error {
  tokensUsed: number;
  tokenBudget: number;

  constructor(tokensUsed: number, tokenBudget: number) {
    super('Token budget exceeded');
    this.name = 'BudgetExceededError';
    this.tokensUsed = tokensUsed;
    this.tokenBudget = tokenBudget;
  }
}

/**
 * Get the token budget status for a user.
 */
export async function getTokenBudgetStatus(
  userId: string,
): Promise<TokenBudgetStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      tokensUsed: true,
      tokenBudget: true,
      anthropicApiKey: true,
      preferredModel: true,
    },
  });

  if (!user) {
    return {
      tokensUsed: 0,
      tokenBudget: 50000,
      hasOwnKey: false,
      preferredModel: 'claude-sonnet-4-6-20250627',
      warningReached: false,
      budgetExceeded: false,
    };
  }

  const hasOwnKey = !!user.anthropicApiKey;
  return {
    tokensUsed: user.tokensUsed,
    tokenBudget: user.tokenBudget,
    hasOwnKey,
    preferredModel: user.preferredModel,
    warningReached: !hasOwnKey && user.tokensUsed >= user.tokenBudget * 0.8,
    budgetExceeded: !hasOwnKey && user.tokensUsed >= user.tokenBudget,
  };
}

/**
 * Check budget and throw BudgetExceededError if over limit with no own key.
 * Returns the status if OK.
 */
export async function assertTokenBudget(
  userId: string,
): Promise<TokenBudgetStatus> {
  const status = await getTokenBudgetStatus(userId);
  if (status.budgetExceeded && !status.hasOwnKey) {
    throw new BudgetExceededError(status.tokensUsed, status.tokenBudget);
  }
  return status;
}

/**
 * Record token usage (atomic increment).
 */
export async function recordTokenUsage(
  userId: string,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { tokensUsed: { increment: inputTokens + outputTokens } },
  });
}

/**
 * Get the appropriate Anthropic client and model for a user.
 * BYOK users get a fresh client with their decrypted key.
 * Server-key users get the cached singleton.
 */
export async function getAnthropicClient(
  userId: string,
  defaultModel: string = 'claude-opus-4-6',
): Promise<{ client: Anthropic; model: string; usingOwnKey: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { anthropicApiKey: true, preferredModel: true },
  });

  if (user?.anthropicApiKey) {
    const apiKey = decrypt(user.anthropicApiKey);
    return {
      client: new Anthropic({ apiKey }),
      model: user.preferredModel,
      usingOwnKey: true,
    };
  }

  return {
    client: serverClient,
    model: defaultModel,
    usingOwnKey: false,
  };
}
