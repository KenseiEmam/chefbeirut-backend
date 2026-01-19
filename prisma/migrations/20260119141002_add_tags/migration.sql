-- AlterTable
ALTER TABLE "Meal" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
