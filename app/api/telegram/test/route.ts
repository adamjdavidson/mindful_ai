import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendTestCoachingMessage } from '@/lib/telegram';

export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramChatId: true },
  });

  if (!user?.telegramChatId) {
    return Response.json(
      { error: 'Telegram not connected' },
      { status: 400 },
    );
  }

  const result = await sendTestCoachingMessage(userId, user.telegramChatId);

  return Response.json({ ok: true, type: result.type });
}
