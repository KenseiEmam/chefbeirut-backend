-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "avatar" TEXT,
    "email" TEXT NOT NULL,
    "gender" TEXT,
    "fullName" TEXT,
    "phone" TEXT,
    "dob" TIMESTAMP(3),
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");
