export function unwrapApiResponse(response) {
  if (!response) return {};
  return response.data ?? response;
}

export function getTicketFromResponse(response) {
  const result = unwrapApiResponse(response);

  return (
    result.ticket ??
    result.data?.ticket ??
    result.data ??
    result
  );
}

export function getTicketsFromResponse(response) {
  const result = unwrapApiResponse(response);

  const tickets =
    result.tickets ??
    result.data?.tickets ??
    result.data?.data ??
    result.data ??
    [];

  return Array.isArray(tickets) ? tickets : [];
}

export function getMessagesFromResponse(response, ticket = null) {
  const result = unwrapApiResponse(response);

  const messages =
    result.messages ??
    result.data?.messages ??
    ticket?.messages ??
    result.ticket?.messages ??
    [];

  return Array.isArray(messages) ? messages : [];
}

export function getApiErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  return (
    error?.response?.data?.message ??
    error?.data?.message ??
    error?.message ??
    fallback
  );
}

export function formatSupportDate(value, includeTime = false) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(includeTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
        }
      : {}),
  }).format(date);
}

export function getStatusLabel(status = "") {
  const labels = {
    open: "Open",
    in_progress: "In progress",
    awaiting_user: "Awaiting your reply",
    resolved: "Resolved",
    closed: "Closed",
  };

  return labels[status] ?? status.replaceAll("_", " ");
}

export function getPriorityLabel(priority = "") {
  const labels = {
    low: "Low",
    normal: "Normal",
    high: "High",
    urgent: "Urgent",
  };

  return labels[priority] ?? priority;
}

export function getCategoryLabel(category = "") {
  if (!category) return "General";

  return category
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function getInitials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}