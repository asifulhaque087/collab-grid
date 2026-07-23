// Internal contracts (not request bodies — these are return shapes / token
// payloads, so they stay as interfaces rather than validated DTO classes).

// Payload embedded in every signed JWT (access + refresh share the same shape).
export interface JwtPayload {
  id: string;
  email: string;
  primaryUserId: string | null;
  secondaryUserId: string | null;
}

// Shape attached to `req.user` by JwtStrategy.validate().
export interface AuthUser {
  userId: string;
  email: string;
  primaryUserId: string | null;
  secondaryUserId: string | null;
}

// A freshly minted access/refresh token pair.
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// One row of the user's plan-quota snapshot, as returned by GET /auth/me.
// `granted` is null for boolean-capability grants; numeric for tracked quotas
// (e.g. create:Board). `granted === -1` denotes an unlimited quota.
export interface Quota {
  id: string;
  action: string;
  subject: string;
  granted: number | null;
  remaining: number | null;
  extra: number;
}
