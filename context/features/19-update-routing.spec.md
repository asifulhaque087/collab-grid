# Goal

Update current routing system to a clean, production-ready Next.js App Router structure that enforces a strict separation of concerns using Next.js Route Groups.

## Instructions

Should be three route group inside app (@apps/web/src/app) - (public), (private), (auth).

- (private) - Every protected page should go inside here
- (auth) - login, register, forgotpass, etc.. page should go here
- (public) - Every other pages should go inside (public) route group

## Note

Dont update getCurrentUser in @apps/web/src/lib/auth.ts. Keep this as it is. We will update this as separate feature later.
