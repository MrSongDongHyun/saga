-- CreateTable
CREATE TABLE "StoryMedia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "situation" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoryMedia_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StoryMedia_storyId_idx" ON "StoryMedia"("storyId");

-- CreateIndex
CREATE INDEX "StoryMedia_storyId_category_situation_idx" ON "StoryMedia"("storyId", "category", "situation");
