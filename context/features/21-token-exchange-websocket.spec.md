# Goal

Secure, authenticated, and resource-protected WebSocket connection initiation using a pattern known as Token Exchange (or a single-use ticket pattern)

## Basic Flow

- Nextjs will call the private catch all api route @apps/web/src/app/api/private/[[...path]]/route.ts
- api route will call the nest js server
- nest server will return short live (30s) jwt token
- api route will get this and return to next js
- next should make api call to nest js with this token
- if nest verification success user can join to websocket connection of the board apps/web/src/app/(private)/dashboard/boards/[slug]/page.tsx

## Note

- Token exchange should only relevant for tenant facing editor (@apps/web/src/app/(private)/layout.tsx) not for apps/web/src/app/(public)/b/[slug]/page.tsx

- Current we are handling auth using those files. Change them according our new architecture now.

```txt
 @apps/api/src/realtime/realtime.gateway.ts
 @apps/api/src/realtime/socket-auth.service.ts
```

- add required controllers in @apps/api/src/realtime module
