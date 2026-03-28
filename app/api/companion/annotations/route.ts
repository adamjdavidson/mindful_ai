import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const profile = await prisma.companionProfile.findUnique({
    where: { userId: session.user.id },
  });

  const annotations =
    (profile?.eventAnnotations as Record<string, { stress?: number; note?: string; title?: string }>) ?? {};

  return Response.json({ annotations });
}
