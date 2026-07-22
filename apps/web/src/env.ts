import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    ACCESS_TOKEN_SECRET: z.string().min(1),
    REFRESH_TOKEN_SECRET: z.string().min(1),
    GATEWAY_URL: z.string().url(),
    NODE_ENV: z.enum(["development", "production", "test"]).optional(),
  },
  client: {
    NEXT_PUBLIC_GATEWAY_URL: z.string().url(),
    NEXT_PUBLIC_SOCKET_URL: z.string().url(),
  },
  runtimeEnv: {
    ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
    GATEWAY_URL: process.env.GATEWAY_URL,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_GATEWAY_URL: process.env.NEXT_PUBLIC_GATEWAY_URL,
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
  },
});
