/*
  Warnings:

  - You are about to drop the `S3_FILES` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "public"."S3_FILES";

-- CreateTable
CREATE TABLE "public"."S3File" (
    "id" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "S3File_pkey" PRIMARY KEY ("id")
);
