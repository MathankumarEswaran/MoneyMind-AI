/**
 * Product-level constants shared by the API and the web client.
 * Keep this file free of Node- or DOM-specific APIs.
 */

export const APP_NAME = "MoneyMind AI";
export const APP_VERSION = "0.1.0";
export const API_PREFIX = "/api/v1";
export const DEFAULT_CURRENCY = "INR";
export const DEFAULT_LOCALE = "en-IN";

export type PhaseStatus = "complete" | "active" | "next" | "planned";

export interface Phase {
  readonly id: number;
  readonly name: string;
  readonly summary: string;
  readonly status: PhaseStatus;
}

export const PHASES: readonly Phase[] = [
  {
    id: 1,
    name: "Foundation",
    summary: "Monorepo, design system, app shell, API baseline and documentation.",
    status: "complete",
  },
  {
    id: 2,
    name: "Authentication + Database",
    summary: "Prisma/PostgreSQL schema, JWT sessions, protected routes and onboarding.",
    status: "complete",
  },
  {
    id: 3,
    name: "Core Finance",
    summary: "Transactions, categories, budgets, goals, dashboard and analytics.",
    status: "complete",
  },
  {
    id: 4,
    name: "AI Assistant",
    summary: "Provider abstraction, streaming chat, tool calling and insights.",
    status: "active",
  },
  {
    id: 5,
    name: "RAG + Vector Search",
    summary: "Document ingestion, embeddings, Qdrant retrieval and citations.",
    status: "active",
  },
  {
    id: 6,
    name: "AI Copilot",
    summary: "Agentic workflows, proactive recommendations and financial planning.",
    status: "active",
  },
  {
    id: 7,
    name: "Premium Experience",
    summary: "Motion polish, 3D moments, accessibility and responsive refinement.",
    status: "active",
  },
  {
    id: 8,
    name: "Testing + Security",
    summary: "E2E coverage, AI evals, load tests, security hardening and audits.",
    status: "planned",
  },
  {
    id: 9,
    name: "Deployment",
    summary: "Docker images, CI/CD, observability, backups and production runbooks.",
    status: "planned",
  },
] as const;

export const PHASE_COUNT = PHASES.length;
