# Goal

Design and implement a highly scalable, real-time collaborative canvas



## When join to backend web socket server

- manage new connections through redis in-memory that will be used to get all users
- calculate the user current viewport
- find all the rooms for the viewport
- find all the widgets and the users that are connected to those rooms
- render them in frontend


## Track user

As the end user wont have any account in our app. you can temporary gave a name like google docs and unique id. You an store this unique id in the session storage. If the user refresh then all the widgets user locks should fetched from redis using this unique id. 



## Cursor update

- user move their cursor
- fire cursor:move:send
- calculate the room where the cursor currently is
- broadcast cursor:move:receive to that room with new position data
- frontend should show the realtime update of other user cursor


This very similar of widget move expect we are calculating multiple rooms for a widget using height, width along with x,y coordination. For cursor update we will find a single room.

## viewport update


- user pan across canvas
- fire viewport:update
- add to redis (position recovery on refresh)
- calculate new zones
- dynamic unsubscribing old zones & subscribing new zones
- backend emit viewport:synchronized event


```ts
calculateOverlappingZones(viewport: Viewport): string[] {
    const zones: string[] = [];
    
    // Find the index range of overlapping grid squares
    const startZoneX = Math.floor(viewport.minX / this.ZONE_SIZE);
    const endZoneX = Math.floor(viewport.maxX / this.ZONE_SIZE);
    const startZoneY = Math.floor(viewport.minY / this.ZONE_SIZE);
    const endZoneY = Math.floor(viewport.maxY / this.ZONE_SIZE);

    // Loop through the 2D matrix intersecting the viewport bounding box
    for (let x = startZoneX; x <= endZoneX; x++) {
      for (let y = startZoneY; y <= endZoneY; y++) {
        // Guardrail constraint check against the maximum 10k grid dimensions (0-9 zones)
        if (x >= 0 && x < 10 && y >= 0 && y < 10) {
          zones.push(`${x}_${y}`);
        }
      }
    }
    return zones;
  }
```



## Widget move

End user can't move any widget they only can click an widget to lock them. Only tenant or the tenant sub user that have permission can perform this operation. If there is no permission for this then add  here @apps/api/src/auth/permissions.ts


- tenant move the widget
- fire widget:move
- add new positions to redis (position recovery on refresh)
- calculate zones/rooms that the widget touches
- publish debounce event to rabbitmq to add same data (new positions)
- there would be a consumer that will update the new position of the widget
- broadcast widget:moved event to all rooms it touches with new position


```ts
calculateWidgetOverlappingZones(x: number, y: number, width: number, height: number): string[] {
    const zones: string[] = [];
    
    const minX = x;
    const minY = y;
    const maxX = x + width;
    const maxY = y + height;

    const startZoneX = Math.floor(minX / this.ZONE_SIZE);
    const endZoneX = Math.floor(maxX / this.ZONE_SIZE);
    const startZoneY = Math.floor(minY / this.ZONE_SIZE);
    const endZoneY = Math.floor(maxY / this.ZONE_SIZE);

    for (let i = startZoneX; i <= endZoneX; i++) {
      for (let j = startZoneY; j <= endZoneY; j++) {
        // Safe check against our 10,000 x 10,000 canvas boundary limits (0-9 zones)
        if (i >= 0 && i < 10 && j >= 0 && j < 10) {
          zones.push(`${i}_${j}`);
        }
      }
    }
    return zones;
  }
```

## Widget move end (optional)


- tenat mouse up or move ended
- fire widget:move:end
- publish new position to rabbimq immediately (no debounce)
- find all the zones that the widget touches
- broad widget:moved or widget:anchored event to all rooms it touches with new position



## Soft lock

This will be main guard to prevent race condition. This is only for end user. No other user should be able to perform click operation like tenant or tenant's sub user.


- user click on widget
- fire widget:lock:soft:init
- create a unique key & set in the redis for 1 minutes.
- if it returns OK then we acquired the widget
- If not OK then someone else already acquired it
- If we acquire this then find all the zones that the widget touches and broadcast a widget:lock:soft:fixed event. In that case frontend make the widget amber. If the user refresh page then frontend should fetch those locks with timer
- If we failed to acquire this then emit widget:lock:soft:denied. In that case frontend should show a alert notification similar to "Someone else already lock this"
- If the new lock item creation time is very less than previous lock that is impossible for human then drop the request or release all locks
- if 1 minute ended redis have to automatically publish widget:lock:soft:release then frontend have to make the widget default color



## Hard lock


- user click on checkout button
- fire widget:lock:hard:init
- find all the soft locks of the user and update the timer for 5 minutes for every soft lock
- backend fire widget:lock:hard:fixed and frontend should make all the widget color red
- if 5 minute ended redis have to automatically run a function that will check every widget status, if the status is paid then widget:purchased event should emit and the item should disappear from the frontend canvas board. If not paid it will event widget:lock:hard:release then frontend have to make the widget its default color.


## Payment

- user will click on checkout button that redirect to the checkout page
- checkout page user have to put shipping address and card information & click on pay button
- a new order will be created and user can download the pdf invoice of order
- user have to buy those withing 5 minutes - the hard lock


# Note

- if ui does not exits then create this for example checkout page does not exits