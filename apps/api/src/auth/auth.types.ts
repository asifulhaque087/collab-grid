// Internal contracts (not request bodies — these are return shapes / token
// payloads, so they stay as interfaces rather than validated DTO classes).

// Payload embedded in every signed JWT (access + refresh share the same shape).
export interface JwtPayload {
  id: string;
  email: string;
}

// Shape attached to `req.user` by JwtStrategy.validate().
export interface AuthUser {
  userId: string;
  email: string;
}

// A freshly minted access/refresh token pair.
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
