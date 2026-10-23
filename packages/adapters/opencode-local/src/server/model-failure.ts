/**
 * Classification of OpenCode CLI failures that point at the primary model's
 * provider rather than at the agent's own work. Used to decide whether a run
 * may be retried once with the configured fallback model
 * (`adapterConfig.fallbackModel`).
 *
 * Keep this module free of I/O so the classification stays unit-testable.
 */

const NETWORK_ERROR_PATTERN =
  /econnrefused|econnreset|etimedout|etimeout|enotfound|eai_again|econnaborted|epipe|fetch\s+failed|network\s+error|connection\s+(?:refused|reset|error|closed|terminated)|socket\s+(?:hang\s*up|disconnected)|getaddrinfo|tunneling\s+socket|request\s+timed?\s*out/i;

const RATE_LIMIT_PATTERN =
  /\b429\b|too\s+many\s+requests|rate\s*(?:limit|limiter)|rate_limit_exceeded|requests\s+per\s+(?:minute|second|day)|rpm\s+limit|tps\s+limit/i;

const QUOTA_EXHAUSTED_PATTERN =
  /insufficient(?:\s+_?\s*)?(?:user\s+)?(?:balance|quota|credit|funds)|out\s+of\s+(?:balance|quota|credit)|balance\s+is\s+(?:not\s+enough|insufficient|exhausted|used\s+up)|credit\s+(?:balance\s+)?(?:is\s+)?(?:too\s+low|exhausted|insufficient)|quota\s*exceeded|额度不足|余额不足|欠费|insufficient_?quota|billing\s+hard\s+limit|exceeded\s+your\s+current\s+quota|please\s+add\s+(?:funds|credits?|payment)|increase.*?(?:quota|rate\s+limit)|payment\s+required|\b402\b/i;

const SERVER_ERROR_PATTERN =
  /\b5\d{2}\b|bad\s+gateway|service\s+unavailable|gateway\s+time-?out|internal\s+server\s+error|server\s+error|overloaded|upstream\s+(?:error|failure|request\s+failed)|provider\s+(?:error|failure)|api\s+error|upstream\/internal|internal_error|server_error/i;

export type OpenCodeModelFailureKind =
  | "network"
  | "rate_limit"
  | "quota_exhausted"
  | "server_error";

const PATTERNS: Array<{
  kind: OpenCodeModelFailureKind;
  pattern: RegExp;
}> = [
  { kind: "network", pattern: NETWORK_ERROR_PATTERN },
  { kind: "rate_limit", pattern: RATE_LIMIT_PATTERN },
  { kind: "quota_exhausted", pattern: QUOTA_EXHAUSTED_PATTERN },
  { kind: "server_error", pattern: SERVER_ERROR_PATTERN },
];

/**
 * Classify a failed OpenCode attempt as a model-invocation failure. Both the
 * parsed JSONL error message and raw stderr are considered because providers
 * surface errors on either channel. Returns the failure kind, or null when the
 * failure does not look like a primary-model invocation problem (in which case
 * a fallback-model retry must not fire).
 */
export function classifyOpenCodeModelFailure(
  parsedErrorMessage: unknown,
  rawStderr: unknown,
): OpenCodeModelFailureKind | null {
  const messages: string[] = [];
  if (typeof parsedErrorMessage === "string" && parsedErrorMessage.trim()) {
    messages.push(parsedErrorMessage);
  }
  if (typeof rawStderr === "string" && rawStderr.trim()) {
    messages.push(rawStderr);
  }
  if (messages.length === 0) return null;
  const combined = messages.join("\n");
  for (const { kind, pattern } of PATTERNS) {
    if (pattern.test(combined)) return kind;
  }
  return null;
}

/** Short human label for run-log lines and result payloads. */
export function describeOpenCodeModelFailureKind(
  kind: OpenCodeModelFailureKind,
): string {
  switch (kind) {
    case "network":
      return "network error";
    case "rate_limit":
      return "rate limit (429)";
    case "quota_exhausted":
      return "quota exhausted";
    case "server_error":
      return "provider server error (5xx)";
  }
}
