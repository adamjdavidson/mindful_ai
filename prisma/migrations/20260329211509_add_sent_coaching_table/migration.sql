-- CreateTable
CREATE TABLE "SentCoaching" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventTitle" TEXT NOT NULL,
    "pillar" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" TEXT NOT NULL DEFAULT 'telegram',
    "responseScore" INTEGER,
    "responseText" TEXT,
    "reflectionSentAt" TIMESTAMP(3),

    CONSTRAINT "SentCoaching_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SentCoaching_eventId_key" ON "SentCoaching"("eventId");
