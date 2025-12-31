/*
  Warnings:

  - You are about to drop the column `nutritionProfile` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "nutritionProfile" JSONB,
ADD COLUMN     "planType" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "nutritionProfile";
