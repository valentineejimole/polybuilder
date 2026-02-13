-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "builderApiKey" TEXT,
    "walletAddress" TEXT NOT NULL,
    "market" TEXT,
    "assetId" TEXT,
    "side" TEXT,
    "sizeUsdc" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "matchTime" TIMESTAMP(3),
    "transactionHash" TEXT,
    "rawJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastSyncedMatchTime" TIMESTAMP(3),
    "lastSyncedCursor" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
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
