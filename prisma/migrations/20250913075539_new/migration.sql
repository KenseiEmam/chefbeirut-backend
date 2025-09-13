-- CreateTable
CREATE TABLE "public"."S3_FILES" (
    "id" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "S3_FILES_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "S3_FILES_objectKey_key" ON "public"."S3_FILES"("objectKey");
