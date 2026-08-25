const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type GetToken = (options?: { skipCache?: boolean }) => Promise<string | null>;

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

function redirectToSignIn() {
  if (typeof window === "undefined" || window.location.pathname.startsWith("/sign-in")) return;
  const returnTo = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`);
}

function clearInvalidSession() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("ledgerly:auth-failure"));
  redirectToSignIn();
}

async function readResponse(response: Response): Promise<any> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const text = await response.text();
  const isHtml = contentType.includes("text/html") || /^\s*<!doctype\s+html/i.test(text);

  if (!response.ok) {
    if (response.status === 401 || response.status === 403 || isHtml) clearInvalidSession();
    if (contentType.includes("application/json")) {
      try {
        const payload = JSON.parse(text);
        throw new ApiError(response.status, payload?.message ?? payload?.error ?? "Request failed");
      } catch (error) {
        if (error instanceof ApiError) throw error;
      }
    }
    throw new ApiError(response.status, isHtml ? "The session expired. Please sign in again." : "Request failed");
  }

  if (!text) return null;
  if (!contentType.includes("application/json")) {
    throw new ApiError(response.status, "The server returned an unexpected response.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(response.status, "The server returned invalid JSON.");
  }
}

export async function apiRequest(path: string, getToken: GetToken, options: RequestInit = {}) {
  const token = await getToken({ skipCache: true });
  if (!token) {
    clearInvalidSession();
    throw new ApiError(401, "Please sign in first");
  }

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  try {
    const response = await fetch(`${API_URL}${path}`, { ...options, headers });
    return await readResponse(response);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error("Unable to reach the server.");
  }
}
