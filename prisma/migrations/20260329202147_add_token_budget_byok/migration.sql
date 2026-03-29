-- AlterTable
ALTER TABLE "User" ADD COLUMN     "anthropicApiKey" TEXT,
ADD COLUMN     "preferredModel" TEXT NOT NULL DEFAULT 'claude-sonnet-4-6-20250627',
ADD COLUMN     "tokenBudget" INTEGER NOT NULL DEFAULT 50000,
ADD COLUMN     "tokensUsed" INTEGER NOT NULL DEFAULT 0;
