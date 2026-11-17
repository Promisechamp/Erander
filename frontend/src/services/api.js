const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

let csrfToken = null;
let csrfRequest = null;
let unauthenticatedHandler = null;

/* ------------------------------------------------------------------ */
/*  URL helper                                                         */
/* ------------------------------------------------------------------ */

function getApiUrl(path) {
  if (!API_BASE_URL) {
    throw new Error(
      "API URL is missing. Check your frontend .env file."
    );
  }

  const baseUrl = API_BASE_URL.replace(/\/+$/, "");
  const cleanPath = path.replace(/^\/+/, "");

  return `${baseUrl}/${cleanPath}`;
}

/* ------------------------------------------------------------------ */
/*  Network error wrapper                                              */
/* ------------------------------------------------------------------ */

async function safeFetch(url, init) {
  try {
    return await fetch(url, init);
  } catch (cause) {
    const error = new Error(
      "We couldn't reach the ERANDER servers. Please check your connection and try again."
    );
    error.cause = cause;
    error.network = true;
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/*  CSRF — fetch, cache-dedupe, and manual reset                       */
/* ------------------------------------------------------------------ */

export async function refreshCsrfToken() {
  if (csrfRequest) {
    return csrfRequest;
  }

  csrfRequest = (async () => {
    const response = await safeFetch(getApiUrl("/auth/csrf"), {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.data?.csrfToken) {
      csrfToken = null;

      throw new Error(
        result.message || "Unable to initialize security verification."
      );
    }

    csrfToken = result.data.csrfToken;

    return csrfToken;
  })();

  try {
    return await csrfRequest;
  } finally {
    csrfRequest = null;
  }
}

export function resetApiSession() {
  csrfToken = null;
  csrfRequest = null;
}

export function setUnauthenticatedHandler(handler) {
  unauthenticatedHandler = typeof handler === "function" ? handler : null;
}

/* ------------------------------------------------------------------ */
/*  Header helpers — case-insensitive                                  */
/* ------------------------------------------------------------------ */

function hasHeader(headers, name) {
  const lower = name.toLowerCase();
  return Object.keys(headers).some(
    (key) => key.toLowerCase() === lower
  );
}

function setHeaderIfAbsent(headers, name, value) {
  if (!hasHeader(headers, name)) {
    headers[name] = value;
  }
}

/* ------------------------------------------------------------------ */
/*  Request body preparation                                           */
/* ------------------------------------------------------------------ */

function prepareRequestBody(body, headers) {
  if (body === undefined || body === null) {
    return body;
  }

  if (typeof FormData !== "undefined" && body instanceof FormData) {
    return body;
  }

  // ✅ FIXED: a pre-serialized JSON string now gets the JSON content-type,
  //    so express.json() on the backend will actually parse it.
  if (typeof body === "string") {
    const trimmed = body.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      setHeaderIfAbsent(headers, "Content-Type", "application/json");
    }
    return body;
  }

  if (typeof body === "object") {
    if (typeof Blob !== "undefined" && body instanceof Blob) {
      return body;
    }

    if (
      typeof URLSearchParams !== "undefined" &&
      body instanceof URLSearchParams
    ) {
      return body;
    }

    if (
      typeof ArrayBuffer !== "undefined" &&
      body instanceof ArrayBuffer
    ) {
      return body;
    }

    setHeaderIfAbsent(headers, "Content-Type", "application/json");

    return JSON.stringify(body);
  }

  return body;
}

/* ------------------------------------------------------------------ */
/*  Rejection detectors                                                */
/* ------------------------------------------------------------------ */

function isCsrfRejection(response) {
  return response.status === 403 || response.status === 419;
}

function isUnauthorized(response) {
  return response.status === 401;
}

/* ------------------------------------------------------------------ */
/*  Core request                                                       */
/* ------------------------------------------------------------------ */

async function apiRequestOnce(path, options, { allowCsrfRetry }) {
  const method = (options.method || "GET").toUpperCase();

  const changesState = !["GET", "HEAD", "OPTIONS"].includes(method);

  if (changesState && !csrfToken) {
    await refreshCsrfToken();
  }

  const headers = { ...options.headers };

  const body = prepareRequestBody(options.body, headers);

  if (changesState) {
    headers["x-csrf-token"] = csrfToken;
  }

  const { notifyUnauthenticated: _notifyUnauthenticated, ...fetchOptions } = options;

  const response = await safeFetch(getApiUrl(path), {
    ...fetchOptions,
    method,
    body,
    credentials: "include",
    headers,
  });

  if (changesState && allowCsrfRetry && isCsrfRejection(response)) {
    csrfToken = null;
    await refreshCsrfToken();

    return apiRequestOnce(path, options, { allowCsrfRetry: false });
  }

  if (isUnauthorized(response) && options.notifyUnauthenticated !== false && unauthenticatedHandler) {
    try {
      unauthenticatedHandler();
    } catch {
      // never let a listener break request handling
    }
  }

  const responseText = await response.text();

  let result = {};

  if (responseText.trim()) {
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error(
        "The server returned an invalid response. Please check the API URL and backend."
      );
    }
  } else if (response.status === 204) {
    if (!response.ok) {
      const error = new Error(
        `Request failed with status ${response.status}.`
      );
      error.status = response.status;
      throw error;
    }

    return null;
  }

  if (!response.ok) {
    const error = new Error(
      result.message || `Request failed with status ${response.status}.`
    );

    error.status = response.status;
    error.data = result?.data ?? null;
    error.responseData = result;

    throw error;
  }

  return result;
}

export async function apiRequest(path, options = {}) {
  return apiRequestOnce(path, options, { allowCsrfRetry: true });
}