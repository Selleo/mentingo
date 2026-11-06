export const AUTH_TOKEN_VERSION = 3;

export const MFA_CHALLENGE_CONFIG = {
  TTL_SECONDS: 300,
  ATTEMPT_LIMIT: 10,
  ACCOUNT_ATTEMPT_WINDOW_SECONDS: 60,
  RETRY_AFTER_SECONDS: 60,
  TOTP_STEP_SECONDS: 30,
  USED_CODE_TTL_SECONDS: 90,
  CODE_PATTERN: /^\d{6}$/,
} as const;

export const MFA_CHALLENGE_RESULT = {
  CONSUMED: "consumed",
  EXPIRED: "expired",
  CODE_REUSED: "code_reused",
} as const;

export const SESSION_REDIS_KEY_PREFIXES = {
  MFA_CHALLENGE: "auth:mfa",
  MFA_ACCOUNT_ATTEMPTS: "auth:mfa:attempts",
  MFA_USED_CODE: "auth:mfa:used",
  SUPPORT_MFA_ASSURANCE: "auth:support",
} as const;

/** Counts an attempt against both the account and the challenge, returning the higher count. */
export const COUNT_MFA_ATTEMPT_SCRIPT = `
  local account = redis.call('INCR', KEYS[1])
  if account == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
  local challenge = redis.call('INCR', KEYS[2])
  if challenge == 1 then redis.call('EXPIRE', KEYS[2], ARGV[2]) end
  return math.max(account, challenge)
`;

/** Consumes a challenge once and marks its TOTP time step as used, so a code cannot be replayed. */
export const CONSUME_MFA_CHALLENGE_SCRIPT = `
  if redis.call('EXISTS', KEYS[1]) == 0 then return '${MFA_CHALLENGE_RESULT.EXPIRED}' end
  if redis.call('EXISTS', KEYS[2]) == 1 then return '${MFA_CHALLENGE_RESULT.CODE_REUSED}' end
  redis.call('SET', KEYS[2], '1', 'EX', ARGV[1])
  redis.call('DEL', KEYS[1], KEYS[3])
  return '${MFA_CHALLENGE_RESULT.CONSUMED}'
`;
