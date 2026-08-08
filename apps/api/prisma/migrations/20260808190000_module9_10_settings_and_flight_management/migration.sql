-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "bookingPrefix" TEXT,
ADD COLUMN     "brandColors" JSONB,
ADD COLUMN     "businessHours" JSONB,
ADD COLUMN     "groupPrefix" TEXT,
ADD COLUMN     "holidays" JSONB,
ADD COLUMN     "invoicePrefix" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "passengerPrefix" TEXT,
ADD COLUMN     "voucherPrefix" TEXT;

-- AlterTable
ALTER TABLE "DispatchOrder" ADD COLUMN     "operationalFlightId" TEXT;

-- AlterTable
ALTER TABLE "IntegrationConfig" ADD COLUMN     "smtpFrom" TEXT,
ADD COLUMN     "smtpHost" TEXT,
ADD COLUMN     "smtpPassEnc" TEXT,
ADD COLUMN     "smtpPort" INTEGER,
ADD COLUMN     "smtpSecure" BOOLEAN,
ADD COLUMN     "smtpUser" TEXT;

-- AlterTable
ALTER TABLE "MeetAssistTask" ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "exceptionAt" TIMESTAMP(3),
ADD COLUMN     "note" TEXT,
ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ADD COLUMN     "skippedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Season" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'General',
    "description" TEXT,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "restartRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Airline" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icao" TEXT,
    "country" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Airline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Airport" (
    "id" TEXT NOT NULL,
    "iata" TEXT NOT NULL,
    "icao" TEXT,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Riyadh',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Airport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Terminal" (
    "id" TEXT NOT NULL,
    "airportId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Terminal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightMaster" (
    "id" TEXT NOT NULL,
    "flightNumber" TEXT NOT NULL,
    "airlineId" TEXT NOT NULL,
    "originId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "defaultTerminalId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlightMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalFlight" (
    "id" TEXT NOT NULL,
    "flightMasterId" TEXT NOT NULL,
    "flightDate" DATE NOT NULL,
    "direction" "FlightDirection" NOT NULL,
    "scheduledTime" TIMESTAMP(3) NOT NULL,
    "estimatedTime" TIMESTAMP(3),
    "actualTime" TIMESTAMP(3),
    "terminalId" TEXT,
    "gate" TEXT,
    "status" "FlightStatus" NOT NULL DEFAULT 'SCHEDULED',
    "statusChangedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "isTestData" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalFlight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");

-- CreateIndex
CREATE INDEX "SystemConfig_category_idx" ON "SystemConfig"("category");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "FeatureFlag_category_idx" ON "FeatureFlag"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Airline_code_key" ON "Airline"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Airport_iata_key" ON "Airport"("iata");

-- CreateIndex
CREATE UNIQUE INDEX "Airport_icao_key" ON "Airport"("icao");

-- CreateIndex
CREATE INDEX "Terminal_airportId_idx" ON "Terminal"("airportId");

-- CreateIndex
CREATE UNIQUE INDEX "Terminal_airportId_name_key" ON "Terminal"("airportId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "FlightMaster_flightNumber_key" ON "FlightMaster"("flightNumber");

-- CreateIndex
CREATE INDEX "FlightMaster_airlineId_idx" ON "FlightMaster"("airlineId");

-- CreateIndex
CREATE INDEX "FlightMaster_originId_idx" ON "FlightMaster"("originId");

-- CreateIndex
CREATE INDEX "FlightMaster_destinationId_idx" ON "FlightMaster"("destinationId");

-- CreateIndex
CREATE INDEX "OperationalFlight_direction_status_scheduledTime_idx" ON "OperationalFlight"("direction", "status", "scheduledTime");

-- CreateIndex
CREATE INDEX "OperationalFlight_flightDate_direction_idx" ON "OperationalFlight"("flightDate", "direction");

-- CreateIndex
CREATE INDEX "OperationalFlight_flightMasterId_idx" ON "OperationalFlight"("flightMasterId");

-- CreateIndex
CREATE INDEX "OperationalFlight_terminalId_idx" ON "OperationalFlight"("terminalId");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalFlight_flightMasterId_flightDate_direction_key" ON "OperationalFlight"("flightMasterId", "flightDate", "direction");

-- CreateIndex
CREATE INDEX "DispatchOrder_operationalFlightId_idx" ON "DispatchOrder"("operationalFlightId");

-- CreateIndex
CREATE INDEX "MeetAssistTask_assignedToId_idx" ON "MeetAssistTask"("assignedToId");

-- CreateIndex
CREATE INDEX "MeetAssistTask_done_scheduledAt_idx" ON "MeetAssistTask"("done", "scheduledAt");

-- AddForeignKey
ALTER TABLE "MeetAssistTask" ADD CONSTRAINT "MeetAssistTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchOrder" ADD CONSTRAINT "DispatchOrder_operationalFlightId_fkey" FOREIGN KEY ("operationalFlightId") REFERENCES "OperationalFlight"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Terminal" ADD CONSTRAINT "Terminal_airportId_fkey" FOREIGN KEY ("airportId") REFERENCES "Airport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightMaster" ADD CONSTRAINT "FlightMaster_airlineId_fkey" FOREIGN KEY ("airlineId") REFERENCES "Airline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightMaster" ADD CONSTRAINT "FlightMaster_originId_fkey" FOREIGN KEY ("originId") REFERENCES "Airport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightMaster" ADD CONSTRAINT "FlightMaster_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Airport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightMaster" ADD CONSTRAINT "FlightMaster_defaultTerminalId_fkey" FOREIGN KEY ("defaultTerminalId") REFERENCES "Terminal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalFlight" ADD CONSTRAINT "OperationalFlight_flightMasterId_fkey" FOREIGN KEY ("flightMasterId") REFERENCES "FlightMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalFlight" ADD CONSTRAINT "OperationalFlight_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

