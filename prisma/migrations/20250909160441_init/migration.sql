/*
  Warnings:

  - Added the required column `price` to the `Meal` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Meal" ADD COLUMN     "price" DOUBLE PRECISION NOT NULL,
ALTER COLUMN "name" DROP NOT NULL;
