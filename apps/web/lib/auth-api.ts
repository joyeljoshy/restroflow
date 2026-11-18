import {
  authResponseSchema,
  errorResponseSchema,
  type AuthenticatedUser,
  type LoginRequest,
} from "@restroflow/contracts";

export const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => undefined);
  const parsed = errorResponseSchema.safeParse(body);
  return new ApiError(
    parsed.success ? parsed.data.error.message : "The request failed.",
    response.status,
    parsed.success ? parsed.data.error.code : undefined,
  );
}

export async function fetchCurrentUser(): Promise<AuthenticatedUser | null> {
  const response = await fetch(`${apiUrl}/api/v1/auth/me`, {
    credentials: "include",
  });
  if (response.status === 401) return null;
  if (!response.ok) throw await apiError(response);
  const body: unknown = await response.json();
  return authResponseSchema.parse(body).user;
}

export async function loginStaff(
  input: LoginRequest,
): Promise<AuthenticatedUser> {
  const response = await fetch(`${apiUrl}/api/v1/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await apiError(response);
  const body: unknown = await response.json();
  return authResponseSchema.parse(body).user;
}

export async function logoutStaff(): Promise<void> {
  const response = await fetch(`${apiUrl}/api/v1/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw await apiError(response);
}
