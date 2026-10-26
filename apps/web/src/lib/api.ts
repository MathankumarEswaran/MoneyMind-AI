import { z } from "zod";
import {
  AnalyticsResponseSchema,
  ApiErrorSchema,
  AuthResponseSchema,
  BudgetResponseSchema,
  BudgetsResponseSchema,
  CategoriesResponseSchema,
  CategoryResponseSchema,
  DashboardResponseSchema,
  GoalContributionResponseSchema,
  GoalContributionsResponseSchema,
  GoalResponseSchema,
  GoalsResponseSchema,
  HealthResponseSchema,
  MeResponseSchema,
  MessageResponseSchema,
  MetaResponseSchema,
  MonthlySummaryResponseSchema,
  SessionsResponseSchema,
  TransactionResponseSchema,
  TransactionsResponseSchema,
  UpdateProfileResponseSchema,
  type AiChatRequest,
  type AiChatResponse,
  type AiThreadDetail,
  type AiThreadsList,
  type AnalyticsResponse,
  type ApiError,
  type AuthSession,
  type Budget,
  type BudgetsResponse,
  type Category,
  type CreateBudgetInput,
  type CreateCategoryInput,
  type CreateGoalContributionInput,
  type CreateGoalInput,
  type CreateTransactionInput,
  type DashboardResponse,
  type Goal,
  type GoalContribution,
  type GoalStatus,
  type HealthResponse,
  type LoginInput,
  type MeResponse,
  type MetaResponse,
  type MonthlySummaryResponse,
  type RegisterInput,
  type SessionSummary,
  type Transaction,
  type TransactionsResponse,
  type UpdateBudgetInput,
  type UpdateCategoryInput,
  type UpdateGoalInput,
  type UpdateProfileInput,
  type UpdateProfileResponse,
  type UpdateTransactionInput,
} from "@moneymind/shared";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 10_000;
const REFRESH_LOCK_NAME = "moneymind:auth-refresh";

/**
 * The access token deliberately lives in module memory only. Persisting it to
 * localStorage would expose it to any injected script; the HttpOnly refresh
 * cookie is the only credential the browser keeps.
 */
let accessToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;
let refreshPromise: Promise<AuthSession> | null = null;

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(
    message: string,
    options: {
      status: number;
      code: string;
      requestId?: string;
      details?: unknown;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = "ApiClientError";
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.details = options.details;
  }
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function clearAccessToken(): void {
  accessToken = null;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Registered by the auth provider so a failed silent refresh can flip the whole
 * app back to the signed-out state instead of leaving stale protected views.
 */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

interface ApiRequestInit extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Attach the in-memory bearer token and retry once after a silent refresh. */
  auth?: boolean;
  retryOnUnauthorized?: boolean;
}

interface ZodLike<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: unknown };
}

async function send(
  path: string,
  init: ApiRequestInit = {},
  token: string | null,
): Promise<Response> {
  const { auth: _auth, retryOnUnauthorized: _retry, headers, body, ...rest } = init;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiClientError("The API took too long to respond.", {
        status: 0,
        code: "TIMEOUT",
        cause: error,
      });
    }

    throw new ApiClientError("Could not reach the MoneyMind API.", {
      status: 0,
      code: "NETWORK_ERROR",
      cause: error,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function toApiError(response: Response, body: unknown): ApiClientError {
  const parsed = ApiErrorSchema.safeParse(body);
  const error: ApiError["error"] | undefined = parsed.success ? parsed.data.error : undefined;

  return new ApiClientError(error?.message ?? `The API responded with status ${response.status}.`, {
    status: response.status,
    code: error?.code ?? "HTTP_ERROR",
    requestId: error?.requestId,
    details: error?.details,
  });
}

function parseWith<T>(response: Response, body: unknown, schema: ZodLike<T>): T {
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    throw new ApiClientError("The API returned an unexpected response.", {
      status: response.status,
      code: "INVALID_RESPONSE",
      details: parsed.error,
    });
  }

  return parsed.data;
}

async function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  // Web Locks serializes refreshes across tabs, which prevents a rotated cookie
  // from being replayed by a second tab and tripping reuse detection.
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request(REFRESH_LOCK_NAME, task);
  }

  return task();
}

async function performRefresh(): Promise<AuthSession> {
  const response = await send("/v1/auth/refresh", { method: "POST" }, null);
  const body = await readBody(response);

  if (!response.ok) {
    clearAccessToken();
    throw toApiError(response, body);
  }

  const payload = parseWith(response, body, AuthResponseSchema);
  accessToken = payload.data.accessToken;
  return payload.data;
}

/**
 * Single-flight across React StrictMode remounts and any number of concurrent
 * 401 retries inside one tab. A successful refresh rotates the cookie; callers
 * share the same in-flight promise instead of racing each other.
 */
export function refreshSession(): Promise<AuthSession> {
  refreshPromise ??= withRefreshLock(performRefresh).finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function request<T>(path: string, init: ApiRequestInit, schema: ZodLike<T>): Promise<T> {
  const { auth = false, retryOnUnauthorized = true, ...rest } = init;

  let response = await send(path, rest, auth ? accessToken : null);

  if (auth && response.status === 401 && retryOnUnauthorized) {
    try {
      await refreshSession();
    } catch {
      clearAccessToken();
      unauthorizedHandler?.();
      // Keep the original 401 so the caller sees why the request failed.
    }

    if (accessToken) {
      response = await send(path, rest, accessToken);
    }
  }

  const body = await readBody(response);

  if (!response.ok) {
    if (auth && response.status === 401) {
      clearAccessToken();
      unauthorizedHandler?.();
    }

    throw toApiError(response, body);
  }

  return parseWith(response, body, schema);
}

export interface TransactionQuery {
  q?: string;
  type?: "INCOME" | "EXPENSE";
  categoryId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  order?: "asc" | "desc";
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }

  const query = search.toString();
  return query ? `?${query}` : "";
}

export const api = {
  async health(): Promise<HealthResponse> {
    return request("/v1/health", {}, HealthResponseSchema);
  },

  async ready(): Promise<HealthResponse> {
    return request("/v1/ready", {}, HealthResponseSchema);
  },

  async meta(): Promise<MetaResponse> {
    return request("/v1/meta", {}, MetaResponseSchema);
  },

  async register(input: RegisterInput): Promise<AuthSession> {
    const payload = await request(
      "/v1/auth/register",
      { method: "POST", body: input },
      AuthResponseSchema,
    );

    return payload.data;
  },

  async login(input: LoginInput): Promise<AuthSession> {
    const payload = await request(
      "/v1/auth/login",
      { method: "POST", body: input },
      AuthResponseSchema,
    );

    return payload.data;
  },

  async me(): Promise<MeResponse["data"]> {
    const payload = await request("/v1/auth/me", { auth: true }, MeResponseSchema);
    return payload.data;
  },

  async updateProfile(input: UpdateProfileInput): Promise<UpdateProfileResponse["data"]> {
    const payload = await request(
      "/v1/auth/me",
      { method: "PATCH", auth: true, body: input },
      UpdateProfileResponseSchema,
    );

    return payload.data;
  },

  async sessions(): Promise<SessionSummary[]> {
    const payload = await request("/v1/auth/sessions", { auth: true }, SessionsResponseSchema);
    return payload.data.sessions;
  },

  async revokeSession(sessionId: string): Promise<void> {
    await request(
      `/v1/auth/sessions/${encodeURIComponent(sessionId)}`,
      { method: "DELETE", auth: true },
      MessageResponseSchema,
    );
  },

  async logout(): Promise<void> {
    await request(
      "/v1/auth/logout",
      { method: "POST", retryOnUnauthorized: false },
      MessageResponseSchema,
    );
  },

  async logoutAll(): Promise<void> {
    await request("/v1/auth/logout-all", { method: "POST", auth: true }, MessageResponseSchema);
  },

  // ── Phase 3 finance ────────────────────────────────────────────────────────

  async categories(kind?: "INCOME" | "EXPENSE"): Promise<Category[]> {
    const payload = await request(
      `/v1/finance/categories${buildQuery({ kind })}`,
      { auth: true },
      CategoriesResponseSchema,
    );

    return payload.data.categories;
  },

  async createCategory(input: CreateCategoryInput): Promise<Category> {
    const payload = await request(
      "/v1/finance/categories",
      { method: "POST", auth: true, body: input },
      CategoryResponseSchema,
    );

    return payload.data.category;
  },

  async updateCategory(id: string, input: UpdateCategoryInput): Promise<Category> {
    const payload = await request(
      `/v1/finance/categories/${encodeURIComponent(id)}`,
      { method: "PATCH", auth: true, body: input },
      CategoryResponseSchema,
    );

    return payload.data.category;
  },

  async deleteCategory(id: string): Promise<void> {
    await request(
      `/v1/finance/categories/${encodeURIComponent(id)}`,
      { method: "DELETE", auth: true },
      MessageResponseSchema,
    );
  },

  async transactions(query: TransactionQuery = {}): Promise<TransactionsResponse> {
    return request(
      `/v1/finance/transactions${buildQuery({
        q: query.q,
        type: query.type,
        categoryId: query.categoryId,
        from: query.from,
        to: query.to,
        page: query.page,
        limit: query.limit,
        order: query.order,
      })}`,
      { auth: true },
      TransactionsResponseSchema,
    );
  },

  async transaction(id: string): Promise<Transaction> {
    const payload = await request(
      `/v1/finance/transactions/${encodeURIComponent(id)}`,
      { auth: true },
      TransactionResponseSchema,
    );

    return payload.data.transaction;
  },

  async createTransaction(input: CreateTransactionInput): Promise<Transaction> {
    const payload = await request(
      "/v1/finance/transactions",
      { method: "POST", auth: true, body: input },
      TransactionResponseSchema,
    );

    return payload.data.transaction;
  },

  async updateTransaction(id: string, input: UpdateTransactionInput): Promise<Transaction> {
    const payload = await request(
      `/v1/finance/transactions/${encodeURIComponent(id)}`,
      { method: "PATCH", auth: true, body: input },
      TransactionResponseSchema,
    );

    return payload.data.transaction;
  },

  async deleteTransaction(id: string): Promise<void> {
    await request(
      `/v1/finance/transactions/${encodeURIComponent(id)}`,
      { method: "DELETE", auth: true },
      MessageResponseSchema,
    );
  },

  async summary(month?: string): Promise<MonthlySummaryResponse["data"]> {
    const payload = await request(
      `/v1/finance/summary${buildQuery({ month })}`,
      { auth: true },
      MonthlySummaryResponseSchema,
    );

    return payload.data;
  },

  async budgets(month?: string): Promise<BudgetsResponse["data"]> {
    const payload = await request(
      `/v1/finance/budgets${buildQuery({ month })}`,
      { auth: true },
      BudgetsResponseSchema,
    );

    return payload.data;
  },

  async createBudget(input: CreateBudgetInput): Promise<Budget> {
    const payload = await request(
      "/v1/finance/budgets",
      { method: "POST", auth: true, body: input },
      BudgetResponseSchema,
    );

    return payload.data.budget;
  },

  async updateBudget(id: string, input: UpdateBudgetInput): Promise<Budget> {
    const payload = await request(
      `/v1/finance/budgets/${encodeURIComponent(id)}`,
      { method: "PATCH", auth: true, body: input },
      BudgetResponseSchema,
    );

    return payload.data.budget;
  },

  async deleteBudget(id: string): Promise<void> {
    await request(
      `/v1/finance/budgets/${encodeURIComponent(id)}`,
      { method: "DELETE", auth: true },
      MessageResponseSchema,
    );
  },

  async goals(status?: GoalStatus): Promise<Goal[]> {
    const payload = await request(
      `/v1/finance/goals${buildQuery({ status })}`,
      { auth: true },
      GoalsResponseSchema,
    );

    return payload.data.goals;
  },

  async goal(id: string): Promise<Goal> {
    const payload = await request(
      `/v1/finance/goals/${encodeURIComponent(id)}`,
      { auth: true },
      GoalResponseSchema,
    );

    return payload.data.goal;
  },

  async createGoal(input: CreateGoalInput): Promise<Goal> {
    const payload = await request(
      "/v1/finance/goals",
      { method: "POST", auth: true, body: input },
      GoalResponseSchema,
    );

    return payload.data.goal;
  },

  async updateGoal(id: string, input: UpdateGoalInput): Promise<Goal> {
    const payload = await request(
      `/v1/finance/goals/${encodeURIComponent(id)}`,
      { method: "PATCH", auth: true, body: input },
      GoalResponseSchema,
    );

    return payload.data.goal;
  },

  async deleteGoal(id: string): Promise<void> {
    await request(
      `/v1/finance/goals/${encodeURIComponent(id)}`,
      { method: "DELETE", auth: true },
      MessageResponseSchema,
    );
  },

  async goalContributions(
    goalId: string,
  ): Promise<{ goal: Goal; contributions: GoalContribution[] }> {
    const payload = await request(
      `/v1/finance/goals/${encodeURIComponent(goalId)}/contributions`,
      { auth: true },
      GoalContributionsResponseSchema,
    );

    return payload.data;
  },

  async addGoalContribution(
    goalId: string,
    input: CreateGoalContributionInput,
  ): Promise<{ goal: Goal; contribution: GoalContribution }> {
    const payload = await request(
      `/v1/finance/goals/${encodeURIComponent(goalId)}/contributions`,
      { method: "POST", auth: true, body: input },
      GoalContributionResponseSchema,
    );

    return payload.data;
  },

  async deleteGoalContribution(goalId: string, contributionId: string): Promise<Goal> {
    const payload = await request(
      `/v1/finance/goals/${encodeURIComponent(goalId)}/contributions/${encodeURIComponent(contributionId)}`,
      { method: "DELETE", auth: true },
      GoalResponseSchema,
    );

    return payload.data.goal;
  },

  async dashboard(month?: string): Promise<DashboardResponse["data"]> {
    const payload = await request(
      `/v1/finance/dashboard${buildQuery({ month })}`,
      { auth: true },
      DashboardResponseSchema,
    );

    return payload.data;
  },

  async analytics(month?: string, months?: number): Promise<AnalyticsResponse["data"]> {
    const payload = await request(
      `/v1/finance/analytics${buildQuery({ month, months })}`,
      { auth: true },
      AnalyticsResponseSchema,
    );

    return payload.data;
  },

  // ── Phase 4 AI ─────────────────────────────────────────────────────────────

  async listAiThreads(): Promise<AiThreadsList> {
    const payload = (await request(
      "/v1/ai/threads",
      { auth: true },
      z.object({ data: z.object({ threads: z.array(z.unknown()) }) }),
    )) as unknown as { data: AiThreadsList };
    return payload.data;
  },

  async getAiThread(threadId: string): Promise<AiThreadDetail> {
    const payload = (await request(
      `/v1/ai/threads/${encodeURIComponent(threadId)}`,
      { auth: true },
      z.object({ data: z.object({ thread: z.unknown(), messages: z.array(z.unknown()), disclaimer: z.string() }) }),
    )) as unknown as { data: AiThreadDetail };
    return payload.data;
  },

  async chatWithAi(input: AiChatRequest): Promise<AiChatResponse> {
    const payload = (await request(
      "/v1/ai/chat",
      { method: "POST", auth: true, body: input },
      z.object({ data: z.object({ threadId: z.string(), message: z.unknown(), suggestedQuestions: z.array(z.string()), disclaimer: z.string() }) }),
    )) as unknown as { data: AiChatResponse };
    return payload.data;
  },
};
