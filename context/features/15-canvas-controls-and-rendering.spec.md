# Goal

Refine the user experience (UX), fix user permission logic, and correct data rendering bugs across your public and private canvas boards.

## Instructions


- There are two canvas public in @apps/web/src/app/b/[slug]/page.tsx for end user and private in @apps/web/src/app/dashboard/boards/[slug]/page.tsx for tenant who organize the canvas. Currently tenant or tenant sub user can click on widget and widget gets locked in private canvas editor. But they should not lock widgets here in private canvas.

- move the tray more left - In public canvas board, the tools tray should be align in the more left. Now there are lot of white space between the very left side and the tools tray.

- When canvas render for the first time there are many static widgets rendered, after a while, dynamic widgets render and static widgets disappeared. But there should not be any static widgets

