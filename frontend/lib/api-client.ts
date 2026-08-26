const DEFAULT_API_URL = "https://accounting-app-production-73e5.up.railway.app";
const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

let API_URL = DEFAULT_API_URL;
if (configuredApiUrl) {
  try {
    const parsed = new URL(configuredApiUrl);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      API_URL = configuredApiUrl;
    } else {
      console.error("Invalid NEXT_PUBLIC_API_URL; using the Railway fallback.");
    }
  } catch {
    console.error("Invalid NEXT_PUBLIC_API_URL; using the Railway fallback.");
  }
} else {
  console.error("NEXT_PUBLIC_API_URL is missing; using the Railway fallback.");
}
function apiUrl(path: string) {
  if (!API_URL?.trim()) {
    throw new Error(
      "CRITICAL: API base URL is missing. Set NEXT_PUBLIC_API_URL to the Railway URL."
    );
  }

  // Railway serves these Nest routes at the domain root. Always normalize the
  // base before joining paths so a hostname can never become Vercel-relative.
  const baseUrl = (API_URL.startsWith("http") ? API_URL : `https://${API_URL}`)
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");
  const requestPath = path.replace(/^\/+/, "");
  const url = new URL(requestPath, `${baseUrl}/`);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Invalid API URL protocol: ${url.protocol}`);
  }

  return url.toString();
}

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

async function readResponse(response: Response, url: string): Promise<any> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const text = await response.text();
  const isHtml = contentType.includes("text/html") || /^\s*<!doctype\s+html/i.test(text);

  if (!response.ok) {
    if (response.status === 401 || response.status === 403 || isHtml) clearInvalidSession();
    if (contentType.includes("application/json") || /^\s*[\[{]/.test(text)) {
      try {
        const payload = JSON.parse(text);
        throw new ApiError(response.status, payload?.message ?? payload?.error ?? "Request failed");
      } catch (error) {
        if (error instanceof ApiError) throw error;
        console.error("[API ERROR JSON PARSE FAILED]", error, { url, status: response.status, contentType, bodyPreview: text.slice(0, 500) });
      }
    }
    throw new ApiError(response.status, isHtml ? "The session expired. Please sign in again." : "Request failed");
  }

  if (!text) return null;
  const trimmed = text.trim();
  const isBalanceEndpoint = /\/balance\/?(?:[?#].*)?$/i.test(url);
  const isNumericText = /^[-+]?\d+(?:\.\d+)?$/.test(trimmed);
  if (contentType.includes("text/plain") || isBalanceEndpoint) {
    if (isNumericText) return Number(trimmed);
    if (contentType.includes("text/plain") && !isBalanceEndpoint) return trimmed;
    console.error("[API TEXT RESPONSE INVALID]", { url, status: response.status, contentType, bodyPreview: text.slice(0, 500) });
    throw new ApiError(response.status, "The server returned an invalid numeric response.");
  }
  if (!contentType.includes("application/json") && !/^\s*[\[{]/.test(text)) {
    console.error("[API UNEXPECTED SUCCESS RESPONSE]", { url, status: response.status, contentType, bodyPreview: text.slice(0, 500) });
    throw new ApiError(response.status, "The server returned an unexpected response.");
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error("[API SUCCESS JSON PARSE FAILED]", error, { url, status: response.status, contentType, bodyPreview: text.slice(0, 500) });
    throw new ApiError(response.status, "The server returned invalid JSON.");
  }
}

export async function apiRequest(path: string, getToken: GetToken, options: RequestInit = {}) {
  // Let Clerk reuse its valid session token. Clerk refreshes it automatically
  // when necessary; bypassing the cache adds an auth request to every API call.
  const token = await getToken();
  if (!token) {
    clearInvalidSession();
    throw new ApiError(401, "Please sign in first");
  }

  const headers = new Headers(options.headers);
  const authorization = `Bearer ${token}`;
  headers.set("Authorization", authorization);
  if (headers.get("Authorization") !== authorization) {
    throw new ApiError(401, "Unable to attach the Clerk authorization token");
  }
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  try {
    const url = apiUrl(path);
    console.error("[apiRequest CALLED]", {
      path,
      API_URL,
      finalUrl: url,
      stack: new Error().stack,
    });
    console.log('FINAL RUNTIME URL:', url);
    console.debug(`[API REQUEST] ${options.method ?? "GET"} ${url} with Clerk bearer token`);
    const response = await fetch(url, { ...options, cache: "no-store", headers });
    return await readResponse(response, url);
  } catch (error) {
    console.error("[API REQUEST FAILED]", error);
    if (error instanceof ApiError) throw error;
    throw new Error("Unable to reach the server.");
  }
}
