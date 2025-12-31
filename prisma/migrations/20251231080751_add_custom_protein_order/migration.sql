-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "nutritionContext" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "nutritionProfile" JSONB;
