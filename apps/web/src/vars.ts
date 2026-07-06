export const vars = {
  API_GATEWAY_URL: process.env.GATEWAY_URL ?? process.env.NEXT_PUBLIC_GATEWAY_URL,
  PUBLIC_API_GATEWAY_URL: process.env.NEXT_PUBLIC_GATEWAY_URL, // need for oath
  SOCKET_GATEWAY_URL: process.env.SOCKET_URL ?? process.env.NEXT_PUBLIC_SOCKET_URL,
};
