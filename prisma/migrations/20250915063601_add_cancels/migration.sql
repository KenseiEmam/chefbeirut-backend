/*
  Warnings:

  - The `address` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "cancelDate" TIMESTAMP(3),
ADD COLUMN     "cancelReason" TEXT;

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "address",
ADD COLUMN     "address" JSONB;
