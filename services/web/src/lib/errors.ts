// Flatten a backend validation error (`message: string | string[]`) into a
// single user-facing line. Kept free of `next/headers` so it can be imported by
// both client components and server code.
export function extractErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message: unknown }).message;
    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string") return message;
  }
  return fallback;
}
