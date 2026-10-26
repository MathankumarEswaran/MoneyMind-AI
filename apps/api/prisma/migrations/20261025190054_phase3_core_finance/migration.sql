-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "kind" "CategoryKind" NOT NULL,
    "color" VARCHAR(7),
    "icon" VARCHAR(40),
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "categoryId" UUID,
    "createdById" UUID,
    "type" "CategoryKind" NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "description" VARCHAR(160) NOT NULL,
    "merchant" VARCHAR(120),
    "notes" VARCHAR(1000),
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "month" CHAR(7) NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "targetAmountMinor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "targetDate" DATE,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_contributions" (
    "id" UUID NOT NULL,
    "goalId" UUID NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "occurredAt" DATE NOT NULL,
    "note" VARCHAR(300),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "categories_workspaceId_kind_idx" ON "categories"("workspaceId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "categories_workspaceId_kind_name_key" ON "categories"("workspaceId", "kind", "name");

-- CreateIndex
CREATE INDEX "transactions_workspaceId_occurredAt_idx" ON "transactions"("workspaceId", "occurredAt");

-- CreateIndex
CREATE INDEX "transactions_workspaceId_type_occurredAt_idx" ON "transactions"("workspaceId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX "transactions_workspaceId_categoryId_occurredAt_idx" ON "transactions"("workspaceId", "categoryId", "occurredAt");

-- CreateIndex
CREATE INDEX "transactions_categoryId_idx" ON "transactions"("categoryId");

-- CreateIndex
CREATE INDEX "budgets_workspaceId_month_idx" ON "budgets"("workspaceId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_workspaceId_categoryId_month_key" ON "budgets"("workspaceId", "categoryId", "month");

-- CreateIndex
CREATE INDEX "goals_workspaceId_status_idx" ON "goals"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "goal_contributions_goalId_occurredAt_idx" ON "goal_contributions"("goalId", "occurredAt");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Domain checks: money is always positive and identified by a real ISO 4217 code.
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_positive" CHECK ("amountMinor" > 0);
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_amount_positive" CHECK ("amountMinor" > 0);
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_month_format" CHECK ("month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "goals" ADD CONSTRAINT "goals_target_positive" CHECK ("targetAmountMinor" > 0);
ALTER TABLE "goals" ADD CONSTRAINT "goals_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_amount_positive" CHECK ("amountMinor" > 0);
