-- CreateEnum
CREATE TYPE "RateUnit" AS ENUM ('PER_VEHICLE', 'PER_SEAT', 'PER_PERSON', 'PER_SERVICE', 'PER_TRIP');

-- CreateEnum
CREATE TYPE "TripType" AS ENUM ('ONE_WAY', 'ROUND_TRIP');

-- CreateEnum
CREATE TYPE "VisaProcessingType" AS ENUM ('NORMAL', 'EXPRESS', 'VIP');

-- AlterTable
ALTER TABLE "AdditionalServiceRequest" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'SAR',
ADD COLUMN     "priceOverridden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priceOverrideReason" TEXT,
ADD COLUMN     "rateCardId" TEXT,
ADD COLUMN     "subtotal" DECIMAL(14,2),
ADD COLUMN     "totalAmount" DECIMAL(14,2),
ADD COLUMN     "unitPrice" DECIMAL(14,2),
ADD COLUMN     "vatAmount" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "CateringBooking" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'SAR';

-- AlterTable
ALTER TABLE "HotelBooking" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'SAR';

-- AlterTable
ALTER TABLE "TransportBooking" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'SAR',
ADD COLUMN     "priceOverridden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priceOverrideReason" TEXT,
ADD COLUMN     "rateCardId" TEXT,
ADD COLUMN     "subtotal" DECIMAL(14,2),
ADD COLUMN     "unitPrice" DECIMAL(14,2),
ADD COLUMN     "vatAmount" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "VisaRequest" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'SAR',
ADD COLUMN     "priceOverridden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priceOverrideReason" TEXT,
ADD COLUMN     "rateCardId" TEXT,
ADD COLUMN     "subtotal" DECIMAL(14,2),
ADD COLUMN     "totalAmount" DECIMAL(14,2),
ADD COLUMN     "unitPrice" DECIMAL(14,2),
ADD COLUMN     "vatAmount" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "TransportRate" (
    "id" TEXT NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "route" TEXT,
    "tripType" "TripType" NOT NULL DEFAULT 'ONE_WAY',
    "unit" "RateUnit" NOT NULL DEFAULT 'PER_VEHICLE',
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "price" DECIMAL(14,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisaRate" (
    "id" TEXT NOT NULL,
    "visaType" "VisaType" NOT NULL DEFAULT 'UMRAH',
    "visaCategory" "MohCategory",
    "country" TEXT NOT NULL DEFAULT 'SA',
    "processingType" "VisaProcessingType" NOT NULL DEFAULT 'NORMAL',
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "price" DECIMAL(14,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisaRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdditionalServiceRate" (
    "id" TEXT NOT NULL,
    "serviceType" "AdditionalServiceType" NOT NULL,
    "unit" "RateUnit" NOT NULL DEFAULT 'PER_SERVICE',
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "price" DECIMAL(14,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdditionalServiceRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransportRate_vehicleType_active_effectiveFrom_idx" ON "TransportRate"("vehicleType", "active", "effectiveFrom");

-- CreateIndex
CREATE INDEX "VisaRate_country_active_effectiveFrom_idx" ON "VisaRate"("country", "active", "effectiveFrom");

-- CreateIndex
CREATE INDEX "VisaRate_visaType_visaCategory_active_idx" ON "VisaRate"("visaType", "visaCategory", "active");

-- CreateIndex
CREATE INDEX "AdditionalServiceRate_serviceType_active_effectiveFrom_idx" ON "AdditionalServiceRate"("serviceType", "active", "effectiveFrom");
