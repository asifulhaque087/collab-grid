"use client";

import { useThrottle } from "@/hooks/useThrottle";
import { useEffect, useRef, useState, MouseEvent, WheelEvent } from "react";
import { io, Socket } from "socket.io-client";

interface Viewport {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface Widget {
  id: string;
  type: "sticky" | "circle" | "product";
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  label: string;
}

export default function CanvasWorkspace({ params }: { params: { id: string } }) {
  const canvasId = params.id;
  const socketRef = useRef<Socket | null>(null);

  // App Core States
  const [canvasMeta, setCanvasMeta] = useState<any>(null);
  // const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [isCanvasReady, setIsCanvasReady] = useState(true);
  const [activeServerZones, setActiveServerZones] = useState<string[]>([]);

  // State Management for Local Canvas Mock Widgets
  const [widgets, setWidgets] = useState<Widget[]>([
    { id: "widget-1", type: "sticky", x: 850, y: 200, width: 200, height: 150, color: "bg-amber-500", label: "Straddling Note (X:850)" },
    { id: "widget-2", type: "circle", x: 300, y: 400, width: 160, height: 160, color: "bg-emerald-500", label: "Circular Asset" },
    { id: "widget-3", type: "product", x: 1400, y: 600, width: 300, height: 150, color: "bg-blue-500", label: "Shoe Product Vector" },
  ]);

  // Camera Transformation Matrices
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // Workspace Drag Anchors
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const canvasDragStart = useRef({ x: 0, y: 0 });

  // Widget Drag Anchors
  const [activeDraggedWidgetId, setActiveDraggedWidgetId] = useState<string | null>(null);
  const widgetDragStart = useRef({ offsetX: 0, offsetY: 0 });

  const MIN_ZOOM = 0.15;
  const MAX_ZOOM = 4.0;

  // 1. Initial Meta Bootstrap
  useEffect(() => {
    async function bootstrapCanvas() {
      const response = await fetch(`/api/v1/canvases/${canvasId}`);
      if (response.ok) {
        const data = await response.json();
        setCanvasMeta(data);
      } else {
        // Fallback layout bounds for demo sandbox stability
        setCanvasMeta({ width: 10000, height: 10000 });
      }
    }
    bootstrapCanvas();
  }, [canvasId]);

  // 2. Setup WebSocket Connection Hub
  useEffect(() => {
    if (!canvasMeta) return;

    socketRef.current = io("wss://api.collabgrid.com", {
      auth: { token: "USER_JWT_ACCESS_TOKEN" },
    });

    socketRef.current.on("connect", () => {
      socketRef.current?.emit("canvas:join", {
        canvasId,
        viewport: calculateViewportBounds(pan.x, pan.y, zoom, canvasMeta),
      });
    });

    socketRef.current.on("canvas:acknowledged", (payload: { status: string; subscribedZones: string[] }) => {
      if (payload.status === "SUCCESS") {
        setActiveServerZones(payload.subscribedZones);
        setIsCanvasReady(true);
      }
    });

    // Capture incoming concurrent peer live streams from server
    socketRef.current.on("widget:moved", (incoming: { widgetId: string; x: number; y: number }) => {
      setWidgets((prev) => prev.map((w) => (w.id === incoming.widgetId ? { ...w, x: incoming.x, y: incoming.y } : w)));
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [canvasMeta]);

  // Geometry Helpers
  const calculateViewportBounds = (pX: number, pY: number, currentZoom: number, meta: any): Viewport => {
    return {
      minX: Math.max(0, pX),
      minY: Math.max(0, pY),
      maxX: Math.min(meta.width, pX + window.innerWidth / currentZoom),
      maxY: Math.min(meta.height, pY + window.innerHeight / currentZoom),
    };
  };

  /**
   * HIGH-SPEED HIGH-FREQUENCY THROTTLED NETWORK EMITTERS
   */
  const emitThrottledViewportUpdate = useThrottle((pX: number, pY: number, currentZoom: number) => {
    if (!socketRef.current || !canvasMeta) return;
    const freshViewport = calculateViewportBounds(pX, pY, currentZoom, canvasMeta);
    socketRef.current.emit("viewport:update", { viewport: freshViewport, isIdle: false });

    console.log(`📡 viewport:upadte for  at ${freshViewport.maxX - freshViewport.minX}`);
    // }, 100);
  }, 500);

  const emitThrottledWidgetMove = useThrottle((widgetId: string, x: number, y: number, width: number, height: number) => {
    if (!socketRef.current) return;

    // CRITICAL FIX: Sending complete bounding dimensions down the pipe
    socketRef.current.emit("widget:move", {
      canvasId,
      widgetId,
      x,
      y,
      width,
      height,
    });
    console.log(`📡 Emitting bounded widget:move for ${widgetId} at (${x}, ${y})`);
    // }, 50); // Lower throttle rate for smoother object visibility updates on peer screens
  }, 500); // Lower throttle rate for smoother object visibility updates on peer screens

  /**
   * INTERACTIONS: Camera Panning & Zoom Mechanics
   */
  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (!canvasMeta || activeDraggedWidgetId) return;

    const zoomFactor = 1.1;
    const nextZoom = e.deltaY < 0 ? Math.min(MAX_ZOOM, zoom * zoomFactor) : Math.max(MIN_ZOOM, zoom / zoomFactor);

    if (nextZoom === zoom) return;

    const mouseX = e.clientX;
    const mouseY = e.clientY;

    const nextPanX = mouseX - (mouseX - pan.x) * (nextZoom / zoom);
    const nextPanY = mouseY - (mouseY - pan.y) * (nextZoom / zoom);

    setZoom(nextZoom);
    setPan({ x: nextPanX, y: nextPanY });

    emitThrottledViewportUpdate(nextPanX, nextPanY, nextZoom);
  };

  /**
   * MIXED MOUSE ACTION HANDLERS (Canvas vs Widget Engine Routing)
   */
  const handleGlobalMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return; // Left click only

    const target = e.target as HTMLElement;
    const widgetIdAttr = target.getAttribute("data-widget-id");

    if (widgetIdAttr) {
      // Scenario A: User clicked directly on an interactive widget item
      const clickedWidget = widgets.find((w) => w.id === widgetIdAttr);
      if (!clickedWidget) return;

      setActiveDraggedWidgetId(widgetIdAttr);

      // Convert viewport screen positions down into canvas matrix coordinates
      const canvasX = (e.clientX - pan.x) / zoom;
      const canvasY = (e.clientY - pan.y) / zoom;

      // Keep track of the offset relative to the item's top-left origin
      widgetDragStart.current = {
        offsetX: canvasX - clickedWidget.x,
        offsetY: canvasY - clickedWidget.y,
      };
    } else {
      // Scenario B: User clicked on empty canvas background workspace space
      setIsDraggingCanvas(true);
      canvasDragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleGlobalMouseMove = (e: MouseEvent) => {
    if (activeDraggedWidgetId) {
      // 1. Process Widget Move Flow Matrix
      const currentWidget = widgets.find((w) => w.id === activeDraggedWidgetId);
      if (!currentWidget) return;

      const canvasX = (e.clientX - pan.x) / zoom;
      const canvasY = (e.clientY - pan.y) / zoom;

      const targetX = Math.round(canvasX - widgetDragStart.current.offsetX);
      const targetY = Math.round(canvasY - widgetDragStart.current.offsetY);

      // const targetX = Math.round(canvasX - widgetDragStart.current.offsetX);
      // const targetX = Math.round(canvasX );
      // const targetY = Math.round(canvasY );

      // 2. Render locally right away at 60fps
      setWidgets((prev) => prev.map((w) => (w.id === activeDraggedWidgetId ? { ...w, x: targetX, y: targetY } : w)));

      // 3. Queue high-speed update to backend with dimensions intact
      emitThrottledWidgetMove(currentWidget.id, targetX, targetY, currentWidget.width, currentWidget.height);
    } else if (isDraggingCanvas) {
      // Process Camera Workspace Pan Flow
      const nextPanX = e.clientX - canvasDragStart.current.x;
      const nextPanY = e.clientY - canvasDragStart.current.y;

      setPan({ x: nextPanX, y: nextPanY });
      emitThrottledViewportUpdate(nextPanX, nextPanY, zoom);
    }
  };

  const handleGlobalMouseUp = () => {
    setActiveDraggedWidgetId(null);
    setIsDraggingCanvas(false);
  };

  return (
    <main
      className="w-screen h-screen overflow-hidden bg-slate-900 relative select-none"
      onWheel={handleWheel}
      onMouseDown={handleGlobalMouseDown}
      onMouseMove={handleGlobalMouseMove}
      onMouseUp={handleGlobalMouseUp}
    >
      {/* Absolute Preloader Backplate */}
      {!isCanvasReady && (
        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center z-50">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="font-mono text-xs text-slate-400">Locking Bounded Real-Time Matrix...</p>
        </div>
      )}

      {/* FIXED: Infinite Operational Canvas Plane */}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)]"
        style={{
          // 1. Move the grid pattern infinitely via background position
          backgroundPosition: `${pan.x}px ${pan.y}px`,
          // 2. Adjust grid sizing dynamically based on zoom level (default 40px)
          backgroundSize: `${40 * zoom}px ${40 * zoom}px`,
        }}
      >
        {/* NEW: Independent Transformed Layer dedicated strictly to Widgets */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            width: "100%",
            height: "100%",
            pointerEvents: "none", // Ensures background clicks still register on parent
          }}
        >
          {/* Render Workspace Bounded Assets Layer */}
          {widgets.map((widget) => (
            <div
              key={widget.id}
              data-widget-id={widget.id}
              className={`absolute flex flex-col p-3 shadow-2xl select-none text-white transition-shadow duration-150 cursor-grab active:cursor-grabbing text-xs font-sans font-semibold pointer-events-auto
              ${widget.color} 
              ${widget.type === "circle" ? "rounded-full items-center justify-center text-center" : "rounded-lg"}
              ${activeDraggedWidgetId === widget.id ? "ring-4 ring-white shadow-emerald-500/20" : ""}
            `}
              style={{
                left: `${widget.x}px`,
                top: `${widget.y}px`,
                width: `${widget.width}px`,
                height: `${widget.height}px`,
              }}
            >
              <p className="pointer-events-none">{widget.label}</p>
              <span className="text-[10px] opacity-60 font-mono pointer-events-none block mt-1">
                [{widget.x}, {widget.y}]
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Real-Time Status HUD Dashboard Display Overlay */}
      <div className="absolute bottom-4 left-4 bg-slate-950/90 border border-slate-800 p-4 rounded-lg shadow-2xl font-mono text-[11px] text-slate-400 pointer-events-none max-w-sm z-10">
        <p className="text-emerald-400 font-bold mb-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          SPATIAL PIPELINE BOUNDED ARCHITECTURE
        </p>
        <p className="mb-1">Camera Zoom Axis: {Math.round(zoom * 100)}%</p>
        <p className="mb-1">
          Camera Offset Vectors: X: {Math.round(pan.x)}px, Y: {Math.round(pan.y)}px
        </p>
        <p className="text-amber-400 line-clamp-2">Active Listener Spatial Rooms: {activeServerZones.map((z) => `zone:${z}`).join(", ")}</p>
      </div>
    </main>
  );
}