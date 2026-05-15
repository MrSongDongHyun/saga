-- CreateTable
CREATE TABLE "PlaySession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "branchId" TEXT,
    "playerSetup" TEXT NOT NULL,
    "charStatus" TEXT NOT NULL,
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlaySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlaySession_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "choices" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PlaySession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PlaySession_userId_updatedAt_idx" ON "PlaySession"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "PlaySession_storyId_idx" ON "PlaySession"("storyId");

-- CreateIndex
CREATE INDEX "PlayMessage_sessionId_createdAt_idx" ON "PlayMessage"("sessionId", "createdAt");
