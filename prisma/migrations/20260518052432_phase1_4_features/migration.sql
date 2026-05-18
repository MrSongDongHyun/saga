-- CreateTable
CREATE TABLE "StoryStatDef" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'circle',
    "color" TEXT NOT NULL DEFAULT 'yellow',
    "unit" TEXT,
    "minVal" INTEGER NOT NULL DEFAULT 0,
    "maxVal" INTEGER NOT NULL DEFAULT 100,
    "defaultVal" INTEGER NOT NULL DEFAULT 50,
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoryStatDef_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StatLevel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "statDefId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minVal" INTEGER NOT NULL,
    "maxVal" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "StatLevel_statDefId_fkey" FOREIGN KEY ("statDefId") REFERENCES "StoryStatDef" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayStatValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "statDefId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlayStatValue_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PlaySession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoryEnding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "grade" TEXT NOT NULL DEFAULT 'N',
    "name" TEXT NOT NULL,
    "image" TEXT,
    "prompt" TEXT NOT NULL DEFAULT '',
    "epilogue" TEXT,
    "hint" TEXT,
    "minTurn" INTEGER NOT NULL DEFAULT 10,
    "startTurn" INTEGER NOT NULL DEFAULT 10,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoryEnding_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EndingCondition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endingId" TEXT NOT NULL,
    "statDefId" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "EndingCondition_endingId_fkey" FOREIGN KEY ("endingId") REFERENCES "StoryEnding" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Story" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "genre" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ONGOING',
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "coverImage" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "promptTemplate" TEXT NOT NULL DEFAULT 'basic',
    "storyInfo" TEXT,
    "exampleDialogs" TEXT NOT NULL DEFAULT '[]',
    "prologue" TEXT,
    "startContext" TEXT,
    "playGuide" TEXT,
    "tagline" TEXT,
    "hashtags" TEXT NOT NULL DEFAULT '[]',
    "maxOutput" INTEGER NOT NULL DEFAULT 1024,
    "isAdult" BOOLEAN NOT NULL DEFAULT false,
    "target" TEXT,
    "conversationFormat" TEXT,
    CONSTRAINT "Story_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Story" ("authorId", "coverImage", "createdAt", "description", "genre", "id", "status", "tags", "title", "updatedAt", "viewCount", "visibility") SELECT "authorId", "coverImage", "createdAt", "description", "genre", "id", "status", "tags", "title", "updatedAt", "viewCount", "visibility" FROM "Story";
DROP TABLE "Story";
ALTER TABLE "new_Story" RENAME TO "Story";
CREATE INDEX "Story_authorId_idx" ON "Story"("authorId");
CREATE INDEX "Story_visibility_createdAt_idx" ON "Story"("visibility", "createdAt");
CREATE INDEX "Story_status_idx" ON "Story"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "StoryStatDef_storyId_idx" ON "StoryStatDef"("storyId");

-- CreateIndex
CREATE INDEX "StatLevel_statDefId_idx" ON "StatLevel"("statDefId");

-- CreateIndex
CREATE INDEX "PlayStatValue_sessionId_idx" ON "PlayStatValue"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayStatValue_sessionId_statDefId_key" ON "PlayStatValue"("sessionId", "statDefId");

-- CreateIndex
CREATE INDEX "StoryEnding_storyId_idx" ON "StoryEnding"("storyId");

-- CreateIndex
CREATE INDEX "EndingCondition_endingId_idx" ON "EndingCondition"("endingId");
