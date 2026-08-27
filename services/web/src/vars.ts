import { env } from "@/env";

export const vars = {
  API_GATEWAY_URL: env.GATEWAY_URL,
  PUBLIC_API_GATEWAY_URL: env.NEXT_PUBLIC_GATEWAY_URL,
  SOCKET_GATEWAY_URL: env.NEXT_PUBLIC_SOCKET_URL,
};
