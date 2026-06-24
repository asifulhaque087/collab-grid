# Goal

implement a secure, multi-tenant Role-Based Access Control (RBAC) and Hierarchical Permission Provisioning System that enforces strict resource/quota metering based on subscription plans.

# Instruction

## Backend

Backend = @apps/api

- modify and add fields in the @apps/api/src/schemas/index.ts GroupTable. 

```ts
  createdByUserId: uuid('created_by_user_id').references(() => userTable.id, {
  onDelete: 'set null',
  }),

  grantedByUserId: uuid('granted_by_user_id').references(() => userTable.id, {
    onDelete: 'cascade',
  }),
```

- During role creating if the user role's createdBy is not admin or tenant find their parentId. check @apps/api/src/auth/rbac.constants.ts file for constants to avoid hardcode value
- createdByUserId would be user id
- grantedByUserId by user would be parentId
- if user or its parent is admin use admin for type field
- if user or its parent is tenant use tenant for type field
- if the user roles are created by tenant then find the users parentId. And find the parents permissions quotas from @apps/api/src/schemas/index.ts userPlanSnapshotTable. And decrement the remaining for the current permission. If the remaining is 0 before plan expire, increment to @apps/api/src/schemas/index.ts userPlanSnapshotTable extra field. If the user roles are created by admin or the user is admin no need to check, it is already checked in the @apps/api/src/auth/guards/permissions.guard.ts.
- use @apps/api/src/auth/decorators/require-permission.decorator.ts and @apps/api/src/auth/guards/permissions.guard.ts to role controllers



## Note

We have to write this logic almost for every route handler except public ones. Tell me what is the industry standard to reuse this code then based on my confirmation implement this.

if the user roles are created by tenant then find the users parentId. And find the parents permissions quotas from @apps/api/src/schemas/index.ts userPlanSnapshotTable. And decrement the remaining for the current permission. If the remaining is 0 before plan expire, increment to @apps/api/src/schemas/index.ts userPlanSnapshotTable extra field. If the user roles are created by admin or the user is admin no need to check, it is already checked in the @apps/api/src/auth/guards/permissions.guard.ts.



