-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FlightStatus" ADD VALUE 'IN_TRANSIT';
ALTER TYPE "FlightStatus" ADD VALUE 'ARRIVED';
ALTER TYPE "FlightStatus" ADD VALUE 'CANCELLED';
ALTER TYPE "FlightStatus" ADD VALUE 'RESCHEDULED';

-- AlterTable
ALTER TABLE "FlightInfo" ADD COLUMN     "aircraft" TEXT,
ADD COLUMN     "arrivalAt" TIMESTAMP(3),
ADD COLUMN     "availableSeats" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "boardingAt" TIMESTAMP(3),
ADD COLUMN     "capacity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "departureAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "pnr" TEXT,
ADD COLUMN     "seatNumber" TEXT,
ADD COLUMN     "ticketNumber" TEXT;

-- CreateTable
CREATE TABLE "FlightAssignment" (
    "id" TEXT NOT NULL,
    "flightInfoId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "seatsAllocated" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlightAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FlightAssignment_groupId_idx" ON "FlightAssignment"("groupId");

-- CreateIndex
CREATE INDEX "FlightAssignment_flightInfoId_idx" ON "FlightAssignment"("flightInfoId");

-- CreateIndex
CREATE UNIQUE INDEX "FlightAssignment_flightInfoId_groupId_key" ON "FlightAssignment"("flightInfoId", "groupId");

-- AddForeignKey
ALTER TABLE "FlightAssignment" ADD CONSTRAINT "FlightAssignment_flightInfoId_fkey" FOREIGN KEY ("flightInfoId") REFERENCES "FlightInfo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightAssignment" ADD CONSTRAINT "FlightAssignment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
