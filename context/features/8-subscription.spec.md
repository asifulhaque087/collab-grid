# Subscription

## Overview

add subscription route handler and a corn job to check the expiry of subscription and downgrade to free plan. Also add a api to fetch all the payment records from payment table.


## Note


When user click on any plan first user will redirect to a ssl commerce or bkash etc. After the payment The subscription route handler will hit with a transaction id and the plan name. We will handle ssl commerce bkash etc later as a different feature. For now implement the subscription part. To add a record in payment schema use a demo transaction id



## Requirements

- add @/apps/api/src/subscription module
- create a permission for this route handler in @/apps/api/src/auth/permissions.ts and run apps/api/drizzle/seed.ts script
- create a dto with property plan, transaction id.
- subscription route handler needs apps/api/src/auth/guards/access-token.guard.ts
- implement api to fetch payment from paymentHistoryTable and show this inside fontend tansaction table


## subscription logic


- add new permissions value to the exited value. suppose userSnapshotTable has board:create 15 and user subscribe to pro then userSnapshot.board:create += board:create of group perimssions (type == plan). every permissions of groupPermissionTable will have quota if the group type is plan.

- handle startData and newExpirty data
	- If still active, extend from current expiry
	- If expired or new, start from exactly right now

- create a record in paymentHistory table



## Corn job logic


- it will run everyday 12:00 Am
- fetch all the user with tenant role
- if the user.planExipre < now that means user expired and it will downgrade the user to free plan
- also it will update the userPermissionQuota with the free plan permissions value
