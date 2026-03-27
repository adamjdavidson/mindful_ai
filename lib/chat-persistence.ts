import { prisma } from "@/lib/db";

export async function createChatSession(userId: string, intention?: string) {
  return prisma.chatSession.create({
    data: {
      userId,
      intention: intention || null,
    },
  });
}

export async function saveMessages(
  chatSessionId: string,
  messages: { role: string; content: string; pillar?: string }[]
) {
  return prisma.message.createMany({
    data: messages.map((m) => ({
      chatSessionId,
      role: m.role,
      content: m.content,
      pillar: m.pillar || null,
    })),
  });
}

export async function endChatSession(
  chatSessionId: string,
  summary: string,
  pillarScores: Record<string, number>
) {
  return prisma.chatSession.update({
    where: { id: chatSessionId },
    data: {
      endedAt: new Date(),
      summary,
      pillarScores,
    },
  });
}

export async function getRecentSummaries(userId: string, count: number = 5) {
  return prisma.chatSession.findMany({
    where: {
      userId,
      summary: { not: null },
    },
    orderBy: { startedAt: "desc" },
    take: count,
    select: {
      id: true,
      intention: true,
      summary: true,
      pillarScores: true,
      startedAt: true,
      endedAt: true,
    },
  });
}

export async function saveSelfReport(chatSessionId: string, score: number) {
  return prisma.selfReport.create({
    data: {
      chatSessionId,
      score,
    },
  });
}

export async function getChatSessionMessages(chatSessionId: string) {
  return prisma.message.findMany({
    where: { chatSessionId },
    orderBy: { createdAt: "asc" },
  });
}
