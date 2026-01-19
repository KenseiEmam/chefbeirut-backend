-- CreateEnum
CREATE TYPE "PlanRequestType" AS ENUM ('PLAN_CHANGE', 'CANCELLATION');

-- CreateEnum
CREATE TYPE "PlanRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DENIED', 'REFUNDED');

-- CreateTable
CREATE TABLE "PlanRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "type" "PlanRequestType" NOT NULL,
    "status" "PlanRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "requestedData" JSONB,
    "adminNotes" TEXT,
    "refundAmount" DOUBLE PRECISION,
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanRequest_userId_idx" ON "PlanRequest"("userId");

-- CreateIndex
CREATE INDEX "PlanRequest_planId_idx" ON "PlanRequest"("planId");

-- CreateIndex
CREATE INDEX "PlanRequest_status_idx" ON "PlanRequest"("status");

-- AddForeignKey
ALTER TABLE "PlanRequest" ADD CONSTRAINT "PlanRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanRequest" ADD CONSTRAINT "PlanRequest_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
