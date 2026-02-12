-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerApiKey" TEXT,
    "walletAddress" TEXT NOT NULL,
    "transactionHash" TEXT,
    "matchTime" DATETIME,
    "transactionTime" DATETIME,
    "market" TEXT,
    "assetId" TEXT,
    "side" TEXT,
    "size" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "feeRateBps" TEXT,
    "status" TEXT,
    "rawJson" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TradeParticipant" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tradeId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TradeParticipant_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "lastSyncedMatchTime" DATETIME,
    "lastRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Trade_matchTime_idx" ON "Trade"("matchTime");

-- CreateIndex
CREATE INDEX "Trade_walletAddress_idx" ON "Trade"("walletAddress");

-- CreateIndex
CREATE INDEX "Trade_market_idx" ON "Trade"("market");

-- CreateIndex
CREATE INDEX "Trade_assetId_idx" ON "Trade"("assetId");

-- CreateIndex
CREATE INDEX "Trade_side_idx" ON "Trade"("side");

-- CreateIndex
CREATE INDEX "TradeParticipant_address_idx" ON "TradeParticipant"("address");

-- CreateIndex
CREATE UNIQUE INDEX "TradeParticipant_tradeId_address_role_key" ON "TradeParticipant"("tradeId", "address", "role");
