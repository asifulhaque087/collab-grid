# Goal

Implement a complete Plan and Permission Packages Management Feature across both the backend and frontend. This feature allows administrators to bundle permissions into distinct subscription plans (e.g., Free, Pro, Enterprise) that will ultimately drive multi-tenant quota and access control systems.

# Instruction

## Backend

- create a plan module
- implement plan CRUD functionalities (table is GroupTable) like @apps/api/src/roles
- admin have to send plan information (plan name) and permissions
- slug should be auto created
- type should be plan


## Frontend


- there is already add plan modal exits. Use this modal for adding
- show all the plans in the plans table
- delete plan clicking on delete icon of the table. Make sure to add a confirmation
- edit plan clicking on the edit icon. Use the same modal for edit also just change the button name


