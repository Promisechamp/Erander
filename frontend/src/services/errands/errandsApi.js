import { apiRequest } from "../api";

export function createErrand(payload) {
  return apiRequest("/erands", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getMyErrands(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });

  const query = params.toString();

  return apiRequest(
    `/erands${query ? `?${query}` : ""}`
  );
}

export function getErrandById(errandId) {
  if (!errandId) {
    throw new Error("An errand ID is required.");
  }

  return apiRequest(
    `/erands/${encodeURIComponent(errandId)}`
  );
}

export function updateErrand(errandId, payload) {
  if (!errandId) {
    throw new Error("An errand ID is required.");
  }

  return apiRequest(
    `/erands/${encodeURIComponent(errandId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
}

export function closeErrand(errandId) {
  if (!errandId) {
    throw new Error("An errand ID is required.");
  }

  return apiRequest(
    `/erands/${encodeURIComponent(errandId)}/close`,
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  );
}


export function deleteErrand(errandId) {
  if (!errandId) {
    throw new Error("An errand ID is required.");
  }

  return apiRequest(
    `/erands/${encodeURIComponent(errandId)}`,
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  );
}



export function startErrandExecution(errandId) {
  if (!errandId) throw new Error("An errand ID is required.");
  return apiRequest(`/erands/${encodeURIComponent(errandId)}/start`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function submitErrandCompletion(errandId) {
  if (!errandId) throw new Error("An errand ID is required.");
  return apiRequest(`/erands/${encodeURIComponent(errandId)}/submit-completion`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function confirmErrandCompletion(errandId) {
  if (!errandId) throw new Error("An errand ID is required.");
  return apiRequest(`/erands/${encodeURIComponent(errandId)}/confirm-completion`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
