const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

let csrfToken = null;
let csrfRequest = null;

function getApiUrl(path) {
  if (!API_BASE_URL) {
    throw new Error(
      "API URL is missing. Check your frontend .env file."
    );
  }

  const baseUrl = API_BASE_URL.replace(/\/+$/, "");
  const cleanPath = path.replace(/^\/+/, "");

  // IMPORTANT: Use backticks, not single or double quotes.
  return `${baseUrl}/${cleanPath}`;
}

export async function refreshCsrfToken() {
  if (csrfRequest) {
    return csrfRequest;
  }

  csrfRequest = (async () => {
    const response = await fetch(getApiUrl("/auth/csrf"), {
      method: "GET",
      credentials: "include",
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

export async function apiRequest(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const changesState = !["GET", "HEAD", "OPTIONS"].includes(method);

  if (changesState && !csrfToken) {
    await refreshCsrfToken();
  }

  const headers = {
    ...(options.body && !(options.body instanceof FormData)
      ? { "Content-Type": "application/json" }
      : {}),
    ...options.headers,
  };

  if (changesState) {
    headers["x-csrf-token"] = csrfToken;
  }

  const response = await fetch(getApiUrl(path), {
    ...options,
    method,
    credentials: "include",
    headers,
  });

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
  }

  if (!response.ok) {
    const error = new Error(
      result.message || `Request failed with status ${response.status}.`
    );

    error.status = response.status;
    throw error;
  }

  return result;
}