# Goal

Fix the google login

## When login brokes

- Click on sign in with google
- accounts to select.
- when I select an account, redirect to this url - http://localhost:3000/dashboard/api/auth/callback?accessToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImJmNWM1NmI5LWE0ODAtNDkyZi05M2M4LWRjNmMwZWEyMTI1MyIsImVtYWlsIjoiYXNpZnVsaGFxdWUwODZAZ21haWwuY29tIiwiaWF0IjoxNzg0MTk1MDAwLCJleHAiOjE3ODQxOTU5MDB9.nQh9xgwaAhUAOIZBEt2tfPcYqIT05EpnhoyhtpPXH58&refreshToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImJmNWM1NmI5LWE0ODAtNDkyZi05M2M4LWRjNmMwZWEyMTI1MyIsImVtYWlsIjoiYXNpZnVsaGFxdWUwODZAZ21haWwuY29tIiwiaWF0IjoxNzg0MTk1MDAwLCJleHAiOjE3ODQ3OTk4MDB9.a1wCG7Cql8lu5z2dIVqP9XYjtP-tnEs1R3qjf30E_Ko
- then got -  404 - This page could not be found.

## Important files that cover the google login

@apps/web/src/components/auth/login-form.tsx
@apps/web/src/components/auth/google-button.tsx
@apps/api/src/auth/auth.controller.ts
@apps/web/src/app/api/auth/callback/route.ts

