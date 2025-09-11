/*
  Warnings:

  - You are about to drop the column `planId` on the `CartItem` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."CartItem" DROP CONSTRAINT "CartItem_planId_fkey";

-- AlterTable
ALTER TABLE "public"."CartItem" DROP COLUMN "planId",
ADD COLUMN     "plan" JSONB;

-- AlterTable
ALTER TABLE "public"."Meal" ALTER COLUMN "price" DROP NOT NULL,
ALTER COLUMN "price" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."OrderItem" ALTER COLUMN "name" DROP NOT NULL;
