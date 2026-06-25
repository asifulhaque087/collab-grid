# Goal

complete, end-to-end Inventory Management Feature that bridges the backend database with several frontend entry points (the Inventory Dashboard, the Board Card, and the Canvas Editor).

# Instructions

## Backend

- create inventory module

- add CRUD functionalities of inventory (refer @apps/api/src/schemas/index.ts  smartWidgetTable)

- add functionality for csv file bulk import when click on import inventory button of board card


## Fontend


- 3 places to create inventory -  import inventory button of board card,  New inventory modal of /dashboard/inventory page, add modal of canvas editor page

- If add from board card import inventory button of board card or add modal of canvas editor page then inventory should include board id

- By default no no inventory would have x,y coordinate

- If inventory include tenant id it should show in the left sidebar of canvas editor so In future the tenant can drag and drop on the canvas to organize them

- Make sure required field are synced between frontend form fields and backend table fields. Currently in add inventory modal there many extra field remove them and add based on the database table

