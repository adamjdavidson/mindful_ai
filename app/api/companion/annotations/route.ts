import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      console.error("[annotations] No user ID in session");
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    console.log("[annotations] GET for user", userId);

    const profile = await prisma.companionProfile.findUnique({
      where: { userId },
    });

    const annotations =
      (profile?.eventAnnotations as Record<string, { stress?: number; note?: string; title?: string }>) ?? {};

    console.log("[annotations] Found", Object.keys(annotations).length, "annotations");
    return Response.json({ annotations });
  } catch (err) {
    console.error("[annotations] Error:", err);
    return Response.json({ error: "internal error", details: String(err) }, { status: 500 });
  }
}
