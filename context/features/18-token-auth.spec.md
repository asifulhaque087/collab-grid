# Goal

shift the authentication architecture from a cookie-based system to a pure token-based system, while simultaneously centralizing and simplifying the token rotation logic


# Instructions

- login, register, google/callback controller at @apps/api/src/auth/auth.controller.ts should return only tokens instead of cookies

- remove refresh token rotation logic from @apps/api/src/auth/guards/access-token.guard.ts

- add a new refresh token api for token rotation in @apps/api/src/auth/auth.controller.ts and use refreshAccessToken of apps/api/src/auth/auth.service.ts

