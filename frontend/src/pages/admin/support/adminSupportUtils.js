export function unwrapResponse(response) {
  return response?.data ?? response ?? {};
}

export function extractTickets(response) {
  const result = unwrapResponse(response);

  const tickets =
    result.tickets ??
    result.data?.tickets ??
    result.data?.data ??
    result.data ??
    [];

  return Array.isArray(tickets) ? tickets : [];
}

export function extractTicket(response) {
  const result = unwrapResponse(response);

  return (
    result.ticket ??
    result.data?.ticket ??
    result.data ??
    result
  );
}

export function extractMessages(response, ticket = null) {
  const result = unwrapResponse(response);

  const messages =
    result.messages ??
    result.data?.messages ??
    ticket?.messages ??
    result.ticket?.messages ??
    [];

  return Array.isArray(messages) ? messages : [];
}

export function extractPagination(response) {
  const result = unwrapResponse(response);

  return (
    result.pagination ??
    result.meta?.pagination ??
    result.data?.pagination ??
    result.meta ??
    {}
  );
}

export function getErrorMessage(
  error,
  fallback = "Something went wrong. Please try again."
) {
  return (
    error?.response?.data?.message ??
    error?.data?.message ??
    error?.message ??
    fallback
  );
}

export function formatDate(value, includeTime = false) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
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
    awaiting_user: "Awaiting user",
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
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getUserName(user) {
  if (!user) return "Unknown user";

  if (user.display_name) return user.display_name;

  const fullName = [
    user.first_name,
    user.other_name,
    user.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || user.email || "Unknown user";
}

export function getInitials(name = "") {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "U"
  );
}