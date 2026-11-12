const VALID_TICKET_TYPES = ["support", "issue"];

const VALID_CATEGORIES = [
  "account",
  "verification",
  "payment",
  "wallet",
  "withdrawal",
  "errand",
  "erander",
  "customer",
  "missing_item",
  "damaged_item",
  "technical",
  "safety",
  "fraud",
		"chat",
  "other",
];

const VALID_PRIORITIES = [
  "low",
  "normal",
  "high",
  "urgent",
];

const VALID_STATUSES = [
  "open",
  "in_progress",
  "awaiting_user",
  "resolved",
  "closed",
];

const MAX_SUBJECT_LENGTH = 180;
const MAX_DESCRIPTION_LENGTH = 10000;
const MAX_MESSAGE_LENGTH = 10000;
const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

function isNonEmptyString(value) {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

export function validateUUID(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

export function validateAttachments(attachments = []) {
  if (!Array.isArray(attachments)) {
    return {
      valid: false,
      message: "Attachments must be an array.",
    };
  }

  if (attachments.length > MAX_ATTACHMENTS) {
    return {
      valid: false,
      message: `A maximum of ${MAX_ATTACHMENTS} attachments is allowed.`,
    };
  }

  const allowedFields = [
    "name",
    "path",
    "mime_type",
    "size",
  ];

  for (const attachment of attachments) {
    if (
      !attachment ||
      typeof attachment !== "object" ||
      Array.isArray(attachment)
    ) {
      return {
        valid: false,
        message: "Invalid attachment information.",
      };
    }

    if (
      Object.keys(attachment).some(
        (field) => !allowedFields.includes(field)
      )
    ) {
      return {
        valid: false,
        message: "Unsupported attachment properties.",
      };
    }

    if (
      !isNonEmptyString(attachment.name) ||
      !isNonEmptyString(attachment.path) ||
      !isNonEmptyString(attachment.mime_type)
    ) {
      return {
        valid: false,
        message: "Attachment name, path and MIME type are required.",
      };
    }

    if (
      typeof attachment.size !== "number" ||
      !Number.isFinite(attachment.size) ||
      attachment.size <= 0 ||
      attachment.size > MAX_ATTACHMENT_SIZE
    ) {
      return {
        valid: false,
        message: "Invalid attachment size. Maximum size is 10MB.",
      };
    }
  }

  return {
    valid: true,
  };
}

export function validateCreateTicket(body = {}) {
  const {
    ticket_type,
    subject,
    description,
    category,
    errand_id,
    attachments = [],
  } = body;

  if (!VALID_TICKET_TYPES.includes(ticket_type)) {
    return {
      valid: false,
      message: "Select a valid ticket type.",
    };
  }

  if (!isNonEmptyString(subject)) {
    return {
      valid: false,
      message: "Ticket subject is required.",
    };
  }

  if (subject.trim().length > MAX_SUBJECT_LENGTH) {
    return {
      valid: false,
      message: "Ticket subject is too long.",
    };
  }

  if (!isNonEmptyString(description)) {
    return {
      valid: false,
      message: "Ticket description is required.",
    };
  }

  if (description.trim().length > MAX_DESCRIPTION_LENGTH) {
    return {
      valid: false,
      message: "Ticket description is too long.",
    };
  }

  if (!VALID_CATEGORIES.includes(category)) {
    return {
      valid: false,
      message: "Select a valid support category.",
    };
  }

  if (errand_id && !validateUUID(errand_id)) {
    return {
      valid: false,
      message: "Invalid errand reference.",
    };
  }

  if (ticket_type === "issue" && !errand_id) {
    return {
      valid: false,
      message: "An errand must be selected when reporting an issue.",
    };
  }

  const attachmentResult = validateAttachments(attachments);

  if (!attachmentResult.valid) {
    return attachmentResult;
  }

  return {
    valid: true,
  };
}

export function validateMessage(body = {}) {
  const {
    message,
    attachments = [],
  } = body;

  if (!isNonEmptyString(message)) {
    return {
      valid: false,
      message: "Message cannot be empty.",
    };
  }

  if (message.trim().length > MAX_MESSAGE_LENGTH) {
    return {
      valid: false,
      message: "Message is too long.",
    };
  }

  const attachmentResult = validateAttachments(attachments);

  if (!attachmentResult.valid) {
    return attachmentResult;
  }

  return {
    valid: true,
  };
}

export function validateAdminTicketUpdate(body = {}) {
  const {
    status,
    priority,
  } = body;

  if (
    status === undefined &&
    priority === undefined
  ) {
    return {
      valid: false,
      message: "Provide a status or priority to update.",
    };
  }

  if (
    status !== undefined &&
    !VALID_STATUSES.includes(status)
  ) {
    return {
      valid: false,
      message: "Invalid ticket status.",
    };
  }

  if (
    priority !== undefined &&
    !VALID_PRIORITIES.includes(priority)
  ) {
    return {
      valid: false,
      message: "Invalid ticket priority.",
    };
  }

  return {
    valid: true,
  };
}