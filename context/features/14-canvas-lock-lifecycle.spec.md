# Goal

Manage the lifecycle of a real-time item locking system during a collaborative or interactive canvas checkout process.


## Instructions

All feature are implemented as other feature but there are some problems. I want fix those problems.


- If user remove from an Item from the right sidebar it should release from the redis also. so after refresh released item won't be shown from the redis

- Canvas editor page for both (internal canvas editor page for tenant, public canvas board for enduser ), there should a button to toggle the right sidebar of canvas where all locked items are listed

- In checkout page of end user,  only keep email (optional), phone, address for shipping address form. The right sidebar of canvas should render in this checkout page also, so the user can aware of the checkout time

- After checkout all locks should be release from the redis

