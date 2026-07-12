# Goal

Build a secure, seamless, and performant Authentication & Authorization layer for your web application (@apps/web).

## Instructions

- use BFF pattern in next js for every api call means every api call first go to api route.

- use react cache for getCurrentUser (after converted to api route)

- login and register api call should happen from client component and first go to api route, api route will call login and register api accordinly to nest js backend. Nest will return tokens and next js will set cookies for the tokens

- nextjs middleware (proxy in next 16) (@apps/web/src/proxy.ts) should verify access token and if not valid then verify refresh token. if refresh token valid, call the refresh api (@apps/api/src/auth/auth.controller.ts) for token rotation. nest will return tokens and middleware have to set cookies for the tokens. Also Inject headers into the request so the SSR PAGE can see them right now. Also inject request.nextUrl.pathname so the @apps/web/src/components/auth/permission-guard.tsx check the permissions for the current page. Next middleware should verify those tokens using the same secret from @apps/api/.env
