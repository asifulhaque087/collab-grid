# Goal

Implement a dynamic User Acquisition and Subscription Funnel

## Instructions

- Show dynamic plans in homepage from database (@apps/api/src/schemas/index.ts groupTable if type is plan)
- User clicks on plan
- Redirect to register with the state of the plan may be in query string
- After register redirect to check out page for subscription (not exits create the page)
- User will pay clicking on pay button. For now call the POST localhost:3001/subscription api  instead of any payment related api
- Redirect back to dashboard

