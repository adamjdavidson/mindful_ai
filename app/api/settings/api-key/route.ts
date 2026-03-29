import Anthropic from '@anthropic-ai/sdk';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encryption';

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { anthropicApiKey: true, preferredModel: true },
  });

  return Response.json({
    hasKey: !!user?.anthropicApiKey,
    preferredModel: user?.preferredModel ?? 'claude-sonnet-4-6-20250627',
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { apiKey, preferredModel } = await req.json();

  // Model-only update (no new API key)
  if (!apiKey && preferredModel) {
    await prisma.user.update({
      where: { id: userId },
      data: { preferredModel },
    });
    return Response.json({ ok: true });
  }

  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
    return Response.json({ error: 'Invalid API key' }, { status: 400 });
  }

  // Validate the key with a tiny test call
  try {
    const testClient = new Anthropic({ apiKey: apiKey.trim() });
    await testClient.messages.create({
      model: 'claude-sonnet-4-6-20250627',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    });
  } catch {
    return Response.json(
      { error: 'Invalid API key — could not authenticate with Anthropic' },
      { status: 400 },
    );
  }

  const encrypted = encrypt(apiKey.trim());

  await prisma.user.update({
    where: { id: userId },
    data: {
      anthropicApiKey: encrypted,
      ...(preferredModel && { preferredModel }),
    },
  });

  return Response.json({ ok: true });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });

  await prisma.user.update({
    where: { id: userId },
    data: {
      anthropicApiKey: null,
      preferredModel: 'claude-sonnet-4-6-20250627',
    },
  });

  return Response.json({ ok: true });
}
