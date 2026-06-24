# Goal

set up a foundational Role-Based and Attribute-Based Access Control (RBAC/ABAC) system, complete with multi-tenancy and subscription plans, by seeding initial data into your database schemas.


# Instructions

- predefined some permissions based on the @apps/api/src/schemas (resources) and actions following casl library. 
- predefined free and pro plan with their quota
- predefined roles.
- predefined some users that include every role. use password = qwerty1234%
- seed permissions to @/apps/api/src/schemas permissions table
- seed free and pro plans to @/apps/api/src/schemas group table with type plan
- seed tenant and super-admin roles to @/apps/api/src/schemas/ group table with type role
- seed some users to @/apps/api/src/schemas/user.ts
- obviously, write a single seed script to seed them all
