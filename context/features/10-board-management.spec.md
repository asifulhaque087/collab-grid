# Goal

Implement a complete, secure CRUD (Create, Read, Update, Delete) feature for managing "Boards", spanning across both your backend API and frontend web application.

# Instructions

## Frontend

- show all the boards in the board list in @apps/web /dashboard/boards page with dynamic data
- add a delete and edit icon in the board card and delete with a confirmation
- create board using create board modal of modal list page. Make sure required field synced between backend and frontend


## Backend

- create board module in @apps/api
- add CRUD functionalities (refer @apps/api/src/schemas/index.ts boardTable)
- add functionality for access (restricted invite or public url) when creating the board.
- make sure to add @apps/api/src/auth/decorators/require-permission.decorator.ts and @apps/api/src/auth/guards/permissions.guard.ts and @apps/api/src/auth/guards/quota.guard.ts for the controller


# Note

we are in development, so you can modify db table

