-- Case-Centric Architecture Migration
-- Run this SQL in your Supabase SQL Editor to create the new tables

-- Create enum types
DO $$ BEGIN
    CREATE TYPE "CaseType" AS ENUM ('GENERAL', 'CRIMINAL', 'CIVIL', 'FAMILY', 'PROPERTY', 'CONSUMER', 'LABOUR', 'TAX', 'CORPORATE', 'WRIT', 'ARBITRATION', 'CHEQUE_BOUNCE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "CaseStatus" AS ENUM ('OPEN', 'PENDING', 'HEARING', 'RESERVED', 'DISPOSED', 'ARCHIVED', 'CLOSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "CaseStage" AS ENUM ('FILING', 'NOTICE', 'APPEARANCE', 'FRAMING_ISSUES', 'EVIDENCE', 'ARGUMENTS', 'RESERVED', 'JUDGMENT', 'APPEAL', 'EXECUTION');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ClientRole" AS ENUM ('PETITIONER', 'RESPONDENT', 'COMPLAINANT', 'ACCUSED', 'PLAINTIFF', 'DEFENDANT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ActivityType" AS ENUM ('AI_CHAT', 'DRAFT_CREATED', 'SUMMARY_CREATED', 'DOCUMENT_UPLOADED', 'HEARING_ADDED', 'HEARING_UPDATED', 'STATUS_CHANGED', 'NOTE_ADDED', 'RESEARCH_DONE', 'NOTICE_CREATED', 'CLIENT_LINKED', 'CASE_CREATED', 'CASE_UPDATED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "HearingStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'ADJOURNED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "DocumentType" AS ENUM ('PETITION', 'REPLY', 'REJOINDER', 'AFFIDAVIT', 'EVIDENCE', 'ORDER', 'JUDGMENT', 'NOTICE', 'DRAFT', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create clients table
CREATE TABLE IF NOT EXISTS "clients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "total_billed" DECIMAL(10,2),
    "total_paid" DECIMAL(10,2),
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- Create cases table
CREATE TABLE IF NOT EXISTS "cases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "cnr_number" TEXT,
    "case_number" TEXT,
    "case_type" "CaseType" NOT NULL DEFAULT 'GENERAL',
    "court" TEXT,
    "judge" TEXT,
    "court_room" TEXT,
    "petitioner" TEXT,
    "respondent" TEXT,
    "client_id" UUID,
    "client_role" "ClientRole",
    "status" "CaseStatus" NOT NULL DEFAULT 'OPEN',
    "stage" "CaseStage" NOT NULL DEFAULT 'FILING',
    "filing_date" TIMESTAMP(3),
    "next_hearing" TIMESTAMP(3),
    "disposed_date" TIMESTAMP(3),
    "ai_summary" TEXT,
    "ai_prediction" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- Create case_activities table (Timeline)
CREATE TABLE IF NOT EXISTS "case_activities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "case_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "ActivityType" NOT NULL,
    "feature" "FeatureType",
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "reference_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "case_activities_pkey" PRIMARY KEY ("id")
);

-- Create hearings table
CREATE TABLE IF NOT EXISTS "hearings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "case_id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT,
    "purpose" TEXT,
    "court_room" TEXT,
    "judge" TEXT,
    "status" "HearingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "outcome" TEXT,
    "next_steps" TEXT,
    "order_summary" TEXT,
    "reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hearings_pkey" PRIMARY KEY ("id")
);

-- Create case_documents table
CREATE TABLE IF NOT EXISTS "case_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "case_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "file_url" TEXT,
    "content" TEXT,
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "case_documents_pkey" PRIMARY KEY ("id")
);

-- Add case_id column to existing tables if not exists
ALTER TABLE "research" ADD COLUMN IF NOT EXISTS "case_id" UUID;
ALTER TABLE "drafts" ADD COLUMN IF NOT EXISTS "case_id" UUID;
ALTER TABLE "summaries" ADD COLUMN IF NOT EXISTS "case_id" UUID;
ALTER TABLE "notices" ADD COLUMN IF NOT EXISTS "case_id" UUID;
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "case_id" UUID;
ALTER TABLE "uploaded_files" ADD COLUMN IF NOT EXISTS "case_id" UUID;

-- Create indexes
CREATE INDEX IF NOT EXISTS "clients_user_id_idx" ON "clients"("user_id");
CREATE INDEX IF NOT EXISTS "cases_user_id_status_idx" ON "cases"("user_id", "status");
CREATE INDEX IF NOT EXISTS "cases_user_id_next_hearing_idx" ON "cases"("user_id", "next_hearing");
CREATE UNIQUE INDEX IF NOT EXISTS "cases_user_id_cnr_number_key" ON "cases"("user_id", "cnr_number") WHERE "cnr_number" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "case_activities_case_id_created_at_idx" ON "case_activities"("case_id", "created_at");
CREATE INDEX IF NOT EXISTS "case_activities_case_id_type_idx" ON "case_activities"("case_id", "type");
CREATE INDEX IF NOT EXISTS "hearings_case_id_date_idx" ON "hearings"("case_id", "date");
CREATE INDEX IF NOT EXISTS "case_documents_case_id_idx" ON "case_documents"("case_id");
CREATE INDEX IF NOT EXISTS "research_case_id_idx" ON "research"("case_id");
CREATE INDEX IF NOT EXISTS "drafts_case_id_idx" ON "drafts"("case_id");
CREATE INDEX IF NOT EXISTS "summaries_case_id_idx" ON "summaries"("case_id");
CREATE INDEX IF NOT EXISTS "notices_case_id_idx" ON "notices"("case_id");
CREATE INDEX IF NOT EXISTS "chat_sessions_case_id_idx" ON "chat_sessions"("case_id");
CREATE INDEX IF NOT EXISTS "uploaded_files_case_id_idx" ON "uploaded_files"("case_id");

-- Add foreign key constraints
ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_user_id_fkey";
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users_app"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cases" DROP CONSTRAINT IF EXISTS "cases_user_id_fkey";
ALTER TABLE "cases" ADD CONSTRAINT "cases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users_app"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cases" DROP CONSTRAINT IF EXISTS "cases_client_id_fkey";
ALTER TABLE "cases" ADD CONSTRAINT "cases_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "case_activities" DROP CONSTRAINT IF EXISTS "case_activities_case_id_fkey";
ALTER TABLE "case_activities" ADD CONSTRAINT "case_activities_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hearings" DROP CONSTRAINT IF EXISTS "hearings_case_id_fkey";
ALTER TABLE "hearings" ADD CONSTRAINT "hearings_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "case_documents" DROP CONSTRAINT IF EXISTS "case_documents_case_id_fkey";
ALTER TABLE "case_documents" ADD CONSTRAINT "case_documents_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS on new tables
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hearings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_documents" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY IF NOT EXISTS "Users can manage their own clients" ON "clients" FOR ALL USING (user_id = auth.uid());
CREATE POLICY IF NOT EXISTS "Users can manage their own cases" ON "cases" FOR ALL USING (user_id = auth.uid());
CREATE POLICY IF NOT EXISTS "Users can view activities for their cases" ON "case_activities" FOR ALL USING (user_id = auth.uid());
CREATE POLICY IF NOT EXISTS "Users can manage hearings for their cases" ON "hearings" FOR ALL USING (case_id IN (SELECT id FROM cases WHERE user_id = auth.uid()));
CREATE POLICY IF NOT EXISTS "Users can manage documents for their cases" ON "case_documents" FOR ALL USING (case_id IN (SELECT id FROM cases WHERE user_id = auth.uid()));

-- Grant permissions
GRANT ALL ON "clients" TO authenticated;
GRANT ALL ON "cases" TO authenticated;
GRANT ALL ON "case_activities" TO authenticated;
GRANT ALL ON "hearings" TO authenticated;
GRANT ALL ON "case_documents" TO authenticated;
