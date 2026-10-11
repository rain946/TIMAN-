import { API_URL } from "../config/api";

const DEFAULT_TIMEOUT_MS = 15_000;

type ApiErrorKind = "invalid-response" | "network" | "timeout";

export class ApiClientError extends Error {
  kind: ApiErrorKind;
  status?: number;

  constructor(message: string, kind: ApiErrorKind, status?: number) {
    super(message);
    this.name = "ApiClientError";
    this.kind = kind;
    this.status = status;
  }
}

export type ApiResponse<T> = {
  data: T;
  ok: boolean;
  status: number;
};

type ApiRequestOptions = RequestInit & {
  authToken?: string | null;
  timeoutMs?: number;
};

const buildApiUrl = (path: string) => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${API_URL}/${path.replace(/^\/+/, "")}`;
};

const fallbackResponseData = (responseText: string, status: number) => {
  const cleanText = responseText.trim();
  const isHtml = /^<!doctype html|^<html/i.test(cleanText);

  return {
    success: false,
    message:
      cleanText && !isHtml
        ? cleanText
        : `The server returned an unexpected response (${status}).`,
  };
};

export async function apiRequest<T = Record<string, unknown>>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResponse<T>> {
  const {
    authToken,
    headers: suppliedHeaders,
    signal: suppliedSignal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    ...requestOptions
  } = options;
  const controller = new AbortController();
  const headers = new Headers(suppliedHeaders);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  if (authToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const handleExternalAbort = () => controller.abort();
  if (suppliedSignal?.aborted) {
    controller.abort();
  } else {
    suppliedSignal?.addEventListener("abort", handleExternalAbort, { once: true });
  }
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildApiUrl(path), {
      ...requestOptions,
      headers,
      signal: controller.signal,
    });
    const responseText = await response.text();
    let data: unknown = {};

    if (responseText.trim()) {
      try {
        data = JSON.parse(responseText);
      } catch {
        if (response.ok) {
          throw new ApiClientError(
            "The server returned an invalid response.",
            "invalid-response",
            response.status,
          );
        }
        data = fallbackResponseData(responseText, response.status);
      }
    }

    return {
      data: data as T,
      ok: response.ok,
      status: response.status,
    };
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }
    if (controller.signal.aborted) {
      throw new ApiClientError("The request timed out.", "timeout");
    }
    throw new ApiClientError("Unable to connect to the TIMAN server.", "network");
  } finally {
    clearTimeout(timeout);
    suppliedSignal?.removeEventListener("abort", handleExternalAbort);
  }
}
