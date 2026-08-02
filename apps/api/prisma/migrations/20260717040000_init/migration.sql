-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CompanyType" AS ENUM ('AGENT', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SupplierType" AS ENUM ('HOTEL', 'TRANSPORT', 'CATERING');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "Destination" AS ENUM ('MAKKAH', 'MADINAH', 'MAKKAH_MADINAH');

-- CreateEnum
CREATE TYPE "VisaType" AS ENUM ('UMRAH', 'LONG_STAY');

-- CreateEnum
CREATE TYPE "PackageType" AS ENUM ('ECONOMY', 'STANDARD', 'PREMIUM');

-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'VERIFIED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OpsStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'DELAYED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "VisaStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ConfirmStatus" AS ENUM ('PENDING', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "MohStatus" AS ENUM ('PENDING', 'CLEARED');

-- CreateEnum
CREATE TYPE "FlightDirection" AS ENUM ('ARRIVAL', 'DEPARTURE');

-- CreateEnum
CREATE TYPE "FlightStatus" AS ENUM ('SCHEDULED', 'DELAYED', 'LANDING', 'AT_GATE', 'IMMIGRATION', 'BAGGAGE', 'EN_ROUTE', 'DELIVERED', 'STANDBY', 'CHECK_IN', 'BOARDING', 'DEPARTED');

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('REQUESTED', 'ASSIGNED', 'CONFIRMED', 'VOUCHER_ISSUED', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MohCategory" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "MealPlan" AS ENUM ('ROOM_ONLY', 'BREAKFAST_ONLY', 'BED_BREAKFAST', 'HALF_BOARD', 'FULL_BOARD', 'PREMIUM');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('SEDAN', 'VAN', 'HIACE', 'COASTER', 'BUS');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'RETIRED');

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('AVAILABLE', 'ON_DUTY', 'EN_ROUTE', 'STANDBY', 'OFF_DUTY');

-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('ASSIGNED', 'EN_ROUTE', 'COMPLETED', 'DELAYED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AdditionalServiceType" AS ENUM ('WHEELCHAIR', 'VIP_LOUNGE', 'SIM_CARD', 'INSURANCE', 'PHOTOGRAPHY', 'INTERPRETER', 'CURRENCY_EXCHANGE', 'OTHER');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "VoucherType" AS ENUM ('HOTEL', 'TRANSPORT', 'CATERING', 'ZIYARAH', 'MEET_ASSIST');

-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('DRAFT', 'ISSUED', 'SENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'OUTSTANDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReceiptMethod" AS ENUM ('BANK_TRANSFER', 'SARIE', 'CHEQUE', 'CASH', 'SADAD', 'WIRE', 'ONLINE');

-- CreateEnum
CREATE TYPE "PaymentSlipType" AS ENUM ('BANK_TRANSFER', 'CHEQUE', 'SADAD', 'WIRE', 'ONLINE_BANKING');

-- CreateEnum
CREATE TYPE "PaymentSlipPurpose" AS ENUM ('WALLET_TOPUP', 'INVOICE_PAYMENT', 'SECURITY_DEPOSIT', 'OTHER');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('AGENT', 'SUPPLIER', 'GENERAL');

-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "TxnDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "CurrencyCode" AS ENUM ('SAR', 'USD', 'BDT', 'EUR', 'GBP', 'TRY');

-- CreateEnum
CREATE TYPE "BrnStatus" AS ENUM ('OPEN', 'PROCESSING', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ZiyarahStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('PREVENTIVE', 'REPAIR', 'INSPECTION');

-- CreateEnum
CREATE TYPE "InsuranceStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OcrDocumentType" AS ENUM ('PASSPORT', 'VISA', 'FLIGHT_TICKET', 'TRADE_LICENSE', 'NATIONAL_ID', 'BANK_CHEQUE', 'PAYMENT_SLIP', 'INVOICE', 'HOTEL_VOUCHER', 'TRANSPORT_VOUCHER', 'CATERING_VOUCHER', 'VEHICLE_REGISTRATION', 'DRIVER_LICENSE', 'CONTRACT', 'STATEMENT');

-- CreateEnum
CREATE TYPE "OcrReviewStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('OK', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "EnquiryType" AS ENUM ('AGENT', 'SUPPLIER', 'PILGRIM', 'OTHER');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'EXPORT', 'RUN', 'VIEW', 'PROCESS', 'TOGGLE', 'REVIEW', 'LOGIN');

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "hijriYear" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStage" (
    "id" INTEGER NOT NULL,
    "phase" INTEGER NOT NULL,
    "labelEn" TEXT NOT NULL,
    "labelBn" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "slaText" TEXT,
    "route" TEXT,

    CONSTRAINT "WorkflowStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "phone" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "roleId" TEXT NOT NULL,
    "companyId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "CompanyType" NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Saudi Arabia',
    "email" TEXT,
    "phone" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "crNumber" TEXT,
    "crIssueHijri" TEXT,
    "crExpiryHijri" TEXT,
    "crExpiryDate" TIMESTAMP(3),
    "businessActivity" TEXT,
    "ownerName" TEXT,
    "ownerIdNumber" TEXT,
    "ownerNationality" TEXT,
    "ownerDobHijri" TEXT,
    "ownerPosition" TEXT,
    "ownerMobile" TEXT,
    "ownerWhatsapp" TEXT,
    "ownerAddress" TEXT,
    "businessEmail" TEXT,
    "opsEmail" TEXT,
    "website" TEXT,
    "officePhone" TEXT,
    "chequeAmount" DECIMAL(14,2),
    "chequeNumber" TEXT,
    "chequeBank" TEXT,
    "depositAmount" DECIMAL(14,2),
    "depositRef" TEXT,
    "depositDate" TIMESTAMP(3),
    "depositStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "referenceAgencyName" TEXT,
    "referenceAgentCode" TEXT,
    "referenceContact" TEXT,
    "referencePhone" TEXT,
    "platformRating" DECIMAL(3,2),

    CONSTRAINT "AgentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guarantor" (
    "id" TEXT NOT NULL,
    "agentProfileId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nationalId" TEXT NOT NULL,
    "phone" TEXT,
    "relationship" TEXT,

    CONSTRAINT "Guarantor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentSeasonQuota" (
    "id" TEXT NOT NULL,
    "agentProfileId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "groupsQuota" INTEGER NOT NULL DEFAULT 0,
    "paxQuota" INTEGER NOT NULL DEFAULT 0,
    "visaQuota" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AgentSeasonQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "SupplierType" NOT NULL,
    "contractedSince" TIMESTAMP(3),
    "crNumber" TEXT,
    "starRating" INTEGER,
    "district" TEXT,
    "fleetSize" INTEGER,
    "primaryVehicleType" TEXT,
    "dailyMealCapacity" INTEGER,
    "halalCertBody" TEXT,
    "qualityScore" DECIMAL(3,2),
    "responseTimeHrs" DECIMAL(6,2),

    CONSTRAINT "SupplierProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "beneficiary" TEXT,
    "accountNumber" TEXT NOT NULL,
    "iban" TEXT,
    "swift" TEXT,
    "currency" "CurrencyCode" NOT NULL DEFAULT 'SAR',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enquiry" (
    "id" TEXT NOT NULL,
    "type" "EnquiryType" NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "handled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "destination" "Destination" NOT NULL,
    "visaType" "VisaType" NOT NULL,
    "packageType" "PackageType" NOT NULL DEFAULT 'STANDARD',
    "maxCapacity" INTEGER NOT NULL DEFAULT 40,
    "paxCount" INTEGER NOT NULL DEFAULT 0,
    "departDate" TIMESTAMP(3),
    "returnDate" TIMESTAMP(3),
    "notes" TEXT,
    "status" "GroupStatus" NOT NULL DEFAULT 'PENDING',
    "opsStatus" "OpsStatus" NOT NULL DEFAULT 'UPCOMING',
    "currentStage" INTEGER NOT NULL DEFAULT 1,
    "stageNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Passenger" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "passportNo" TEXT NOT NULL,
    "passportExpiry" TIMESTAMP(3),
    "nationality" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "dob" TIMESTAMP(3),
    "phone" TEXT,
    "seat" TEXT,
    "visaStatus" "VisaStatus" NOT NULL DEFAULT 'PENDING',
    "hotelStatus" "ConfirmStatus" NOT NULL DEFAULT 'PENDING',
    "transportStatus" "ConfirmStatus" NOT NULL DEFAULT 'PENDING',
    "mohStatus" "MohStatus" NOT NULL DEFAULT 'PENDING',
    "ocrDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Passenger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightInfo" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "direction" "FlightDirection" NOT NULL,
    "airline" TEXT NOT NULL,
    "flightNo" TEXT NOT NULL,
    "originAirport" TEXT NOT NULL,
    "destAirport" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "terminal" TEXT,
    "gate" TEXT,
    "paxCount" INTEGER NOT NULL DEFAULT 0,
    "status" "FlightStatus" NOT NULL DEFAULT 'SCHEDULED',

    CONSTRAINT "FlightInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "flightInfoId" TEXT,
    "passengerId" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetAssistTask" (
    "id" TEXT NOT NULL,
    "flightInfoId" TEXT NOT NULL,
    "stepNo" INTEGER NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MeetAssistTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisaRequest" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "seasonId" TEXT,
    "visaType" "VisaType" NOT NULL,
    "applicationYearHijri" TEXT,
    "nusukRef" TEXT,
    "muallimNo" TEXT,
    "mahramWaiverNo" TEXT,
    "mohCategory" "MohCategory",
    "embassy" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "submittedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisaRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hotel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "city" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "distanceFromHaramM" INTEGER,
    "pricePerNight" DECIMAL(14,2),
    "available" BOOLEAN NOT NULL DEFAULT true,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "supplierId" TEXT,

    CONSTRAINT "Hotel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelBooking" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "hotelId" TEXT,
    "supplierId" TEXT,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3) NOT NULL,
    "nights" INTEGER NOT NULL,
    "doubleRooms" INTEGER NOT NULL DEFAULT 0,
    "tripleRooms" INTEGER NOT NULL DEFAULT 0,
    "singleRooms" INTEGER NOT NULL DEFAULT 0,
    "mealPlan" "MealPlan" NOT NULL DEFAULT 'FULL_BOARD',
    "ratePerRoom" DECIMAL(14,2),
    "subtotal" DECIMAL(14,2),
    "vatAmount" DECIMAL(14,2),
    "totalAmount" DECIMAL(14,2),
    "specialRequests" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportBooking" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "supplierId" TEXT,
    "vehicleType" "VehicleType" NOT NULL,
    "vehicleCount" INTEGER NOT NULL DEFAULT 1,
    "departurePoint" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "stopPoints" TEXT,
    "departAt" TIMESTAMP(3) NOT NULL,
    "returnAt" TIMESTAMP(3),
    "totalAmount" DECIMAL(14,2),
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CateringBooking" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "supplierId" TEXT,
    "mealPlan" "MealPlan" NOT NULL,
    "pricePerPaxDay" DECIMAL(14,2),
    "halalCount" INTEGER NOT NULL DEFAULT 0,
    "vegetarianCount" INTEGER NOT NULL DEFAULT 0,
    "diabeticCount" INTEGER NOT NULL DEFAULT 0,
    "specialInstructions" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "totalAmount" DECIMAL(14,2),
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CateringBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdditionalServiceRequest" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "serviceType" "AdditionalServiceType" NOT NULL,
    "beneficiaries" INTEGER NOT NULL DEFAULT 1,
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "description" TEXT,
    "requestedFor" TIMESTAMP(3),
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdditionalServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BRN" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "hotelBookingId" TEXT,
    "serviceScope" TEXT NOT NULL,
    "detail" TEXT,
    "dateRequired" TIMESTAMP(3),
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "status" "BrnStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BRN_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "VoucherType" NOT NULL,
    "tenantId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "payload" JSONB,
    "status" "VoucherStatus" NOT NULL DEFAULT 'DRAFT',
    "sentWhatsappAt" TIMESTAMP(3),
    "sentEmailAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZiyarahTrip" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "sites" TEXT NOT NULL,
    "sitesBn" TEXT,
    "guideName" TEXT,
    "vehicleId" TEXT,
    "pax" INTEGER NOT NULL DEFAULT 0,
    "status" "ZiyarahStatus" NOT NULL DEFAULT 'SCHEDULED',

    CONSTRAINT "ZiyarahTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "VehicleType" NOT NULL,
    "plateNo" TEXT,
    "seats" INTEGER NOT NULL DEFAULT 0,
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "supplierId" TEXT,
    "notes" TEXT,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "phone" TEXT,
    "licenseNo" TEXT,
    "licenseExpiry" TIMESTAMP(3),
    "status" "DriverStatus" NOT NULL DEFAULT 'AVAILABLE',
    "rating" DECIMAL(3,2),
    "supplierId" TEXT,
    "userId" TEXT,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchOrder" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tenantId" TEXT,
    "groupId" TEXT NOT NULL,
    "flightInfoId" TEXT,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "routeFrom" TEXT NOT NULL,
    "routeTo" TEXT NOT NULL,
    "pax" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "DispatchStatus" NOT NULL DEFAULT 'ASSIGNED',
    "progressPct" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DispatchOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelLog" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "liters" DECIMAL(8,2) NOT NULL,
    "cost" DECIMAL(14,2) NOT NULL,
    "odometerKm" INTEGER,
    "notes" TEXT,

    CONSTRAINT "FuelLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRecord" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" "MaintenanceType" NOT NULL,
    "description" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "cost" DECIMAL(14,2),
    "odometerKm" INTEGER,
    "nextDueDate" TIMESTAMP(3),
    "workshop" TEXT,

    CONSTRAINT "MaintenanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsurancePolicy" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "policyNo" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "premium" DECIMAL(14,2),
    "status" "InsuranceStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "InsurancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" "CurrencyCode" NOT NULL DEFAULT 'SAR',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "direction" "TxnDirection" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "balanceAfter" DECIMAL(14,2),
    "description" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSlip" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "purpose" "PaymentSlipPurpose" NOT NULL DEFAULT 'WALLET_TOPUP',
    "type" "PaymentSlipType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "bank" TEXT,
    "transferRef" TEXT,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "groupId" TEXT,
    "notes" TEXT,
    "fileUrl" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentSlip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChartAccount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "kind" "AccountKind" NOT NULL,

    CONSTRAINT "ChartAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "ledgerType" "LedgerType" NOT NULL,
    "companyId" TEXT,
    "accountId" TEXT,
    "groupId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "ref" TEXT,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "groupId" TEXT,
    "seasonId" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "currency" "CurrencyCode" NOT NULL DEFAULT 'SAR',
    "subtotal" DECIMAL(14,2) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "vatAmount" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'OUTSTANDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "descriptionBn" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "ReceiptMethod" NOT NULL,
    "bankRef" TEXT,
    "notes" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptAllocation" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "ReceiptAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Statement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalCredits" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalDebits" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "closingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Statement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrencyRate" (
    "id" TEXT NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "rateToSar" DECIMAL(12,4) NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurrencyRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcrDocument" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "documentType" "OcrDocumentType" NOT NULL,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "tenantId" TEXT,
    "groupId" TEXT,
    "uploadedById" TEXT,
    "extractedFields" JSONB,
    "confidenceScore" DOUBLE PRECISION,
    "mrzDiscrepancy" BOOLEAN NOT NULL DEFAULT false,
    "duplicateOfId" TEXT,
    "reviewStatus" "OcrReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OcrDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "category" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "conditionExpr" TEXT,
    "actions" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cronExpr" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRunLog" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER,
    "status" "RunStatus" NOT NULL DEFAULT 'OK',
    "message" TEXT,

    CONSTRAINT "AutomationRunLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationEvent" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "labelBn" TEXT NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "whatsapp" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT true,
    "inApp" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "lang" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "eventId" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "tenantId" TEXT,
    "recipientUserId" TEXT,
    "recipientAddress" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorLabel" TEXT,
    "action" "AuditAction" NOT NULL,
    "module" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Season_code_key" ON "Season"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "User_code_key" ON "User"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

-- CreateIndex
CREATE INDEX "Company_type_verificationStatus_idx" ON "Company"("type", "verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "AgentProfile_companyId_key" ON "AgentProfile"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Guarantor_agentProfileId_position_key" ON "Guarantor"("agentProfileId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "AgentSeasonQuota_agentProfileId_seasonId_key" ON "AgentSeasonQuota"("agentProfileId", "seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierProfile_companyId_key" ON "SupplierProfile"("companyId");

-- CreateIndex
CREATE INDEX "BankAccount_companyId_idx" ON "BankAccount"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_code_key" ON "Group"("code");

-- CreateIndex
CREATE INDEX "Group_tenantId_status_idx" ON "Group"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Group_opsStatus_idx" ON "Group"("opsStatus");

-- CreateIndex
CREATE INDEX "Group_seasonId_idx" ON "Group"("seasonId");

-- CreateIndex
CREATE INDEX "Group_currentStage_idx" ON "Group"("currentStage");

-- CreateIndex
CREATE INDEX "Passenger_tenantId_idx" ON "Passenger"("tenantId");

-- CreateIndex
CREATE INDEX "Passenger_passportNo_idx" ON "Passenger"("passportNo");

-- CreateIndex
CREATE INDEX "Passenger_groupId_visaStatus_idx" ON "Passenger"("groupId", "visaStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Passenger_groupId_code_key" ON "Passenger"("groupId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "FlightInfo_code_key" ON "FlightInfo"("code");

-- CreateIndex
CREATE INDEX "FlightInfo_direction_status_scheduledAt_idx" ON "FlightInfo"("direction", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "FlightInfo_groupId_idx" ON "FlightInfo"("groupId");

-- CreateIndex
CREATE INDEX "FlightInfo_tenantId_idx" ON "FlightInfo"("tenantId");

-- CreateIndex
CREATE INDEX "Ticket_groupId_idx" ON "Ticket"("groupId");

-- CreateIndex
CREATE INDEX "Ticket_flightInfoId_idx" ON "Ticket"("flightInfoId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetAssistTask_flightInfoId_stepNo_key" ON "MeetAssistTask"("flightInfoId", "stepNo");

-- CreateIndex
CREATE UNIQUE INDEX "VisaRequest_code_key" ON "VisaRequest"("code");

-- CreateIndex
CREATE INDEX "VisaRequest_tenantId_status_idx" ON "VisaRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "VisaRequest_groupId_idx" ON "VisaRequest"("groupId");

-- CreateIndex
CREATE INDEX "VisaRequest_status_idx" ON "VisaRequest"("status");

-- CreateIndex
CREATE INDEX "Hotel_city_available_idx" ON "Hotel"("city", "available");

-- CreateIndex
CREATE UNIQUE INDEX "HotelBooking_code_key" ON "HotelBooking"("code");

-- CreateIndex
CREATE INDEX "HotelBooking_tenantId_status_idx" ON "HotelBooking"("tenantId", "status");

-- CreateIndex
CREATE INDEX "HotelBooking_supplierId_status_idx" ON "HotelBooking"("supplierId", "status");

-- CreateIndex
CREATE INDEX "HotelBooking_groupId_idx" ON "HotelBooking"("groupId");

-- CreateIndex
CREATE INDEX "HotelBooking_status_idx" ON "HotelBooking"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TransportBooking_code_key" ON "TransportBooking"("code");

-- CreateIndex
CREATE INDEX "TransportBooking_tenantId_status_idx" ON "TransportBooking"("tenantId", "status");

-- CreateIndex
CREATE INDEX "TransportBooking_supplierId_status_idx" ON "TransportBooking"("supplierId", "status");

-- CreateIndex
CREATE INDEX "TransportBooking_groupId_idx" ON "TransportBooking"("groupId");

-- CreateIndex
CREATE INDEX "TransportBooking_status_idx" ON "TransportBooking"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CateringBooking_code_key" ON "CateringBooking"("code");

-- CreateIndex
CREATE INDEX "CateringBooking_tenantId_status_idx" ON "CateringBooking"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CateringBooking_supplierId_status_idx" ON "CateringBooking"("supplierId", "status");

-- CreateIndex
CREATE INDEX "CateringBooking_groupId_idx" ON "CateringBooking"("groupId");

-- CreateIndex
CREATE INDEX "CateringBooking_status_idx" ON "CateringBooking"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AdditionalServiceRequest_code_key" ON "AdditionalServiceRequest"("code");

-- CreateIndex
CREATE INDEX "AdditionalServiceRequest_tenantId_status_idx" ON "AdditionalServiceRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AdditionalServiceRequest_groupId_idx" ON "AdditionalServiceRequest"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "BRN_code_key" ON "BRN"("code");

-- CreateIndex
CREATE INDEX "BRN_tenantId_status_idx" ON "BRN"("tenantId", "status");

-- CreateIndex
CREATE INDEX "BRN_groupId_idx" ON "BRN"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_code_key" ON "Voucher"("code");

-- CreateIndex
CREATE INDEX "Voucher_tenantId_type_idx" ON "Voucher"("tenantId", "type");

-- CreateIndex
CREATE INDEX "Voucher_groupId_idx" ON "Voucher"("groupId");

-- CreateIndex
CREATE INDEX "Voucher_refType_refId_idx" ON "Voucher"("refType", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "ZiyarahTrip_code_key" ON "ZiyarahTrip"("code");

-- CreateIndex
CREATE INDEX "ZiyarahTrip_tenantId_status_idx" ON "ZiyarahTrip"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ZiyarahTrip_date_idx" ON "ZiyarahTrip"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_code_key" ON "Vehicle"("code");

-- CreateIndex
CREATE INDEX "Vehicle_status_type_idx" ON "Vehicle"("status", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_userId_key" ON "Driver"("userId");

-- CreateIndex
CREATE INDEX "Driver_status_idx" ON "Driver"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DispatchOrder_code_key" ON "DispatchOrder"("code");

-- CreateIndex
CREATE INDEX "DispatchOrder_status_scheduledAt_idx" ON "DispatchOrder"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "DispatchOrder_driverId_status_idx" ON "DispatchOrder"("driverId", "status");

-- CreateIndex
CREATE INDEX "DispatchOrder_vehicleId_idx" ON "DispatchOrder"("vehicleId");

-- CreateIndex
CREATE INDEX "DispatchOrder_groupId_idx" ON "DispatchOrder"("groupId");

-- CreateIndex
CREATE INDEX "FuelLog_vehicleId_date_idx" ON "FuelLog"("vehicleId", "date");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_vehicleId_date_idx" ON "MaintenanceRecord"("vehicleId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "InsurancePolicy_policyNo_key" ON "InsurancePolicy"("policyNo");

-- CreateIndex
CREATE INDEX "InsurancePolicy_vehicleId_status_idx" ON "InsurancePolicy"("vehicleId", "status");

-- CreateIndex
CREATE INDEX "InsurancePolicy_endDate_idx" ON "InsurancePolicy"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_companyId_key" ON "Wallet"("companyId");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_createdAt_idx" ON "WalletTransaction"("walletId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSlip_code_key" ON "PaymentSlip"("code");

-- CreateIndex
CREATE INDEX "PaymentSlip_companyId_status_idx" ON "PaymentSlip"("companyId", "status");

-- CreateIndex
CREATE INDEX "PaymentSlip_status_idx" ON "PaymentSlip"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ChartAccount_code_key" ON "ChartAccount"("code");

-- CreateIndex
CREATE INDEX "LedgerEntry_ledgerType_companyId_date_idx" ON "LedgerEntry"("ledgerType", "companyId", "date");

-- CreateIndex
CREATE INDEX "LedgerEntry_accountId_date_idx" ON "LedgerEntry"("accountId", "date");

-- CreateIndex
CREATE INDEX "LedgerEntry_groupId_idx" ON "LedgerEntry"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_code_key" ON "Invoice"("code");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_status_idx" ON "Invoice"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Invoice_status_dueDate_idx" ON "Invoice"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Invoice_groupId_idx" ON "Invoice"("groupId");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_code_key" ON "Receipt"("code");

-- CreateIndex
CREATE INDEX "Receipt_companyId_date_idx" ON "Receipt"("companyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptAllocation_receiptId_invoiceId_key" ON "ReceiptAllocation"("receiptId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Statement_code_key" ON "Statement"("code");

-- CreateIndex
CREATE INDEX "Statement_companyId_periodStart_idx" ON "Statement"("companyId", "periodStart");

-- CreateIndex
CREATE INDEX "CurrencyRate_currency_asOf_idx" ON "CurrencyRate"("currency", "asOf" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "CurrencyRate_currency_asOf_key" ON "CurrencyRate"("currency", "asOf");

-- CreateIndex
CREATE UNIQUE INDEX "OcrDocument_code_key" ON "OcrDocument"("code");

-- CreateIndex
CREATE INDEX "OcrDocument_reviewStatus_documentType_idx" ON "OcrDocument"("reviewStatus", "documentType");

-- CreateIndex
CREATE INDEX "OcrDocument_tenantId_idx" ON "OcrDocument"("tenantId");

-- CreateIndex
CREATE INDEX "OcrDocument_groupId_idx" ON "OcrDocument"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationRule_code_key" ON "AutomationRule"("code");

-- CreateIndex
CREATE INDEX "AutomationRule_enabled_idx" ON "AutomationRule"("enabled");

-- CreateIndex
CREATE INDEX "AutomationRunLog_ruleId_startedAt_idx" ON "AutomationRunLog"("ruleId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationEvent_key_key" ON "NotificationEvent"("key");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_eventId_channel_lang_key" ON "MessageTemplate"("eventId", "channel", "lang");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_code_key" ON "NotificationLog"("code");

-- CreateIndex
CREATE INDEX "NotificationLog_recipientUserId_status_idx" ON "NotificationLog"("recipientUserId", "status");

-- CreateIndex
CREATE INDEX "NotificationLog_tenantId_channel_idx" ON "NotificationLog"("tenantId", "channel");

-- CreateIndex
CREATE INDEX "NotificationLog_status_createdAt_idx" ON "NotificationLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guarantor" ADD CONSTRAINT "Guarantor_agentProfileId_fkey" FOREIGN KEY ("agentProfileId") REFERENCES "AgentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSeasonQuota" ADD CONSTRAINT "AgentSeasonQuota_agentProfileId_fkey" FOREIGN KEY ("agentProfileId") REFERENCES "AgentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSeasonQuota" ADD CONSTRAINT "AgentSeasonQuota_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProfile" ADD CONSTRAINT "SupplierProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_currentStage_fkey" FOREIGN KEY ("currentStage") REFERENCES "WorkflowStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passenger" ADD CONSTRAINT "Passenger_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passenger" ADD CONSTRAINT "Passenger_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passenger" ADD CONSTRAINT "Passenger_ocrDocumentId_fkey" FOREIGN KEY ("ocrDocumentId") REFERENCES "OcrDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightInfo" ADD CONSTRAINT "FlightInfo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightInfo" ADD CONSTRAINT "FlightInfo_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_flightInfoId_fkey" FOREIGN KEY ("flightInfoId") REFERENCES "FlightInfo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "Passenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetAssistTask" ADD CONSTRAINT "MeetAssistTask_flightInfoId_fkey" FOREIGN KEY ("flightInfoId") REFERENCES "FlightInfo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisaRequest" ADD CONSTRAINT "VisaRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisaRequest" ADD CONSTRAINT "VisaRequest_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisaRequest" ADD CONSTRAINT "VisaRequest_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hotel" ADD CONSTRAINT "Hotel_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelBooking" ADD CONSTRAINT "HotelBooking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelBooking" ADD CONSTRAINT "HotelBooking_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelBooking" ADD CONSTRAINT "HotelBooking_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelBooking" ADD CONSTRAINT "HotelBooking_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportBooking" ADD CONSTRAINT "TransportBooking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportBooking" ADD CONSTRAINT "TransportBooking_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportBooking" ADD CONSTRAINT "TransportBooking_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CateringBooking" ADD CONSTRAINT "CateringBooking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CateringBooking" ADD CONSTRAINT "CateringBooking_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CateringBooking" ADD CONSTRAINT "CateringBooking_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdditionalServiceRequest" ADD CONSTRAINT "AdditionalServiceRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdditionalServiceRequest" ADD CONSTRAINT "AdditionalServiceRequest_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BRN" ADD CONSTRAINT "BRN_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BRN" ADD CONSTRAINT "BRN_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BRN" ADD CONSTRAINT "BRN_hotelBookingId_fkey" FOREIGN KEY ("hotelBookingId") REFERENCES "HotelBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZiyarahTrip" ADD CONSTRAINT "ZiyarahTrip_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZiyarahTrip" ADD CONSTRAINT "ZiyarahTrip_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZiyarahTrip" ADD CONSTRAINT "ZiyarahTrip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchOrder" ADD CONSTRAINT "DispatchOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchOrder" ADD CONSTRAINT "DispatchOrder_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchOrder" ADD CONSTRAINT "DispatchOrder_flightInfoId_fkey" FOREIGN KEY ("flightInfoId") REFERENCES "FlightInfo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchOrder" ADD CONSTRAINT "DispatchOrder_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchOrder" ADD CONSTRAINT "DispatchOrder_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelLog" ADD CONSTRAINT "FuelLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelLog" ADD CONSTRAINT "FuelLog_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsurancePolicy" ADD CONSTRAINT "InsurancePolicy_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSlip" ADD CONSTRAINT "PaymentSlip_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSlip" ADD CONSTRAINT "PaymentSlip_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSlip" ADD CONSTRAINT "PaymentSlip_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ChartAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptAllocation" ADD CONSTRAINT "ReceiptAllocation_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptAllocation" ADD CONSTRAINT "ReceiptAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrDocument" ADD CONSTRAINT "OcrDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrDocument" ADD CONSTRAINT "OcrDocument_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrDocument" ADD CONSTRAINT "OcrDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrDocument" ADD CONSTRAINT "OcrDocument_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "OcrDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrDocument" ADD CONSTRAINT "OcrDocument_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRunLog" ADD CONSTRAINT "AutomationRunLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "NotificationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "NotificationEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

