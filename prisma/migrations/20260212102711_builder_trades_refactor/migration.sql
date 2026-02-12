/*
  Warnings:

  - You are about to drop the `TradeParticipant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `feeRateBps` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `ownerApiKey` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `size` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `transactionTime` on the `Trade` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "TradeParticipant_tradeId_address_role_key";

-- DropIndex
DROP INDEX "TradeParticipant_address_idx";

-- AlterTable
ALTER TABLE "SyncState" ADD COLUMN "lastSyncedCursor" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "TradeParticipant";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Trade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "builderApiKey" TEXT,
    "walletAddress" TEXT NOT NULL,
    "market" TEXT,
    "assetId" TEXT,
    "side" TEXT,
    "sizeUsdc" DECIMAL NOT NULL DEFAULT 0,
    "matchTime" DATETIME,
    "transactionHash" TEXT,
    "rawJson" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Trade" ("assetId", "createdAt", "id", "market", "matchTime", "rawJson", "side", "transactionHash", "updatedAt", "walletAddress") SELECT "assetId", "createdAt", "id", "market", "matchTime", "rawJson", "side", "transactionHash", "updatedAt", "walletAddress" FROM "Trade";
DROP TABLE "Trade";
ALTER TABLE "new_Trade" RENAME TO "Trade";
CREATE INDEX "Trade_matchTime_idx" ON "Trade"("matchTime");
CREATE INDEX "Trade_walletAddress_idx" ON "Trade"("walletAddress");
CREATE INDEX "Trade_market_idx" ON "Trade"("market");
CREATE INDEX "Trade_assetId_idx" ON "Trade"("assetId");
CREATE INDEX "Trade_side_idx" ON "Trade"("side");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
