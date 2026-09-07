/**
 * Normalizes any error thrown by an API call (Axios errors, FastAPI
 * validation errors, network errors, or plain JS errors) into a
 * human-readable string that is always safe to render directly in JSX.
 *
 * FastAPI validation errors can arrive in several shapes:
 *   - a plain string: { detail: "Something went wrong" }
 *   - a single object: { detail: { message, ... } }
 *   - a validation array: { detail: [{ type, loc, msg, input }, ...] }
 *
 * Rendering any of the object/array shapes directly as a React child
 * crashes the app ("Objects are not valid as a React child"), so every
 * page must run caught errors through this helper before calling
 * setError().
 */
export function getErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (!error) {
    return fallback;
  }

  const err = error as {
    request?: unknown;
    response?: { data?: { detail?: unknown; message?: unknown } };
    message?: string;
  };

  // Network error: request was made but no response was received.
  if (err?.request && !err?.response) {
    return "Could not reach the server. Please check your connection and try again.";
  }

  const detail = err?.response?.data?.detail;

  const fromDetail = stringifyDetail(detail);

  if (fromDetail) {
    return fromDetail;
  }

  // Fall back to a top-level message field, if any.
  const message = err?.response?.data?.message;

  if (typeof message === "string" && message.trim()) {
    return message;
  }

  if (typeof err?.message === "string" && err.message.trim()) {
    return err.message;
  }

  return fallback;
}

function stringifyDetail(detail: unknown): string | null {
  if (detail === null || detail === undefined) {
    return null;
  }

  if (typeof detail === "string") {
    return detail.trim() || null;
  }

  // FastAPI validation error array: [{ type, loc, msg, input }, ...]
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => describeValidationItem(item))
      .filter(Boolean);

    return messages.length > 0
      ? messages.join(" ")
      : "The server rejected the request.";
  }

  // A single structured object, e.g. { message, expected_offset, ... }
  // or a single FastAPI validation item { type, loc, msg, input }.
  if (typeof detail === "object") {
    return describeValidationItem(detail);
  }

  return null;
}

function describeValidationItem(item: unknown): string | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const obj = item as Record<string, unknown>;

  if (typeof obj.message === "string" && obj.message.trim()) {
    return obj.message;
  }

  if (typeof obj.msg === "string" && obj.msg.trim()) {
    const field = Array.isArray(obj.loc)
      ? obj.loc.filter((part) => typeof part === "string").join(" ")
      : "";

    return field ? `${field}: ${obj.msg}` : obj.msg;
  }

  return null;
}

/**
 * Returns true when the error represents an expired/invalid auth token
 * (401) so callers can redirect to login instead of showing an inline
 * error message.
 */
export function isAuthError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response
    ?.status;
  return status === 401;
}
