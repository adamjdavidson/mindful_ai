import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTokenBudgetStatus } from '@/lib/token-budget';

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const status = await getTokenBudgetStatus(userId);
  return Response.json(status);
}
