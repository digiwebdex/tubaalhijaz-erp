-- CreateTable
CREATE TABLE "IntegrationConfig" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "apiUrl" TEXT,
    "deviceId" TEXT,
    "defaultCountry" TEXT,
    "apiKeyEnc" TEXT,
    "connectionStatus" TEXT,
    "lastTestAt" TIMESTAMP(3),
    "lastResponse" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConfig_provider_key" ON "IntegrationConfig"("provider");
