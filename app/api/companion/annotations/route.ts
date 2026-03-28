import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const profile = await prisma.companionProfile.findUnique({
    where: { userId },
  });

  const annotations =
    (profile?.eventAnnotations as Record<string, { stress?: number; note?: string; title?: string }>) ?? {};

  return Response.json({ annotations });
}
