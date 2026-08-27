"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { toast } from "sonner";
import type { DemoPeer, DemoProduct, DemoWidget } from "@/types/home";
import {
  CELL,
  DEMO_CATALOG,
  DEMO_INITIAL_COORDS,
  DEMO_PEERS,
  HARD_MS,
  LEGEND_ITEMS,
  SOFT_MS,
  demoImage,
} from "@/lib/home-content";
import { SectionHead } from "./section-head";

// Transient UI flags layered on top of the shared widget shape.
type W = DemoWidget & { leaving?: boolean; pop?: boolean };
type Timer = { endsAt: number; kind: "soft" | "hard" };
type PeerRuntime = DemoPeer & { x: number; y: number; tx: number; ty: number; el: HTMLDivElement | null };
// Allow CSS custom properties in inline styles without `any`.
type CSSVars = CSSProperties & Record<`--${string}`, string>;

// Cursor readout isolated so the once-per-second parent tick doesn't reset it.
const CursorReadout = forwardRef<{ set: (s: string) => void }>(function CursorReadout(_props, ref) {
  const [txt, setTxt] = useState("x0 y0");
  useImperativeHandle(ref, () => ({ set: setTxt }), []);
  return <b>{txt}</b>;
});

function fmt(ms: number) {
  if (ms < 0) ms = 0;
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${ss < 10 ? "0" : ""}${ss}`;
}

/**
 * Self-contained marketing simulation of the live board — no API, no sockets.
 * Pan the canvas, soft-lock widgets, run them through checkout, and watch
 * simulated peers compete for the same stock.
 */
export function BoardDemo() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<{ set: (s: string) => void }>(null);

  const [widgets, setWidgets] = useState<W[]>([]);
  const [pan, setPan] = useState({ x: -20, y: -20 });
  const [locked, setLocked] = useState<string[]>([]);
  const [trayOpen, setTrayOpen] = useState(false);
  const [peerCount, setPeerCount] = useState(DEMO_PEERS.length);
  const [, setTick] = useState(0);

  const timersRef = useRef<Record<string, Timer>>({});
  const widgetsRef = useRef<W[]>([]);
  const lockedRef = useRef<string[]>([]);
  const panRef = useRef(pan);
  const uidRef = useRef(0);
  const catalogPtrRef = useRef(0);
  const didInitRef = useRef(false);
  const draggingRef = useRef(false);
  const lastRef = useRef({ x: 0, y: 0 });
  const peerRef = useRef<PeerRuntime[]>(
    DEMO_PEERS.map((p, i) => {
      const x = i === 0 ? 200 : 500;
      const y = i === 0 ? 120 : 360;
      return { ...p, x, y, tx: x, ty: y, el: null };
    })
  );

  // Mirror state into refs so intervals/RAF read fresh values without re-binding.
  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);
  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  const nextProduct = useCallback((): DemoProduct => {
    const p = DEMO_CATALOG[catalogPtrRef.current % DEMO_CATALOG.length];
    catalogPtrRef.current++;
    return p;
  }, []);

  const addWidget = useCallback(
    (product: DemoProduct, x: number, y: number, animateIn = false) => {
      const id = `w${++uidRef.current}`;
      const wd: W = {
        id,
        name: product.name,
        price: product.price,
        img: product.img,
        stock: 1,
        x,
        y,
        state: "open",
        peer: null,
        leaving: animateIn,
      };
      setWidgets((ws) => [...ws, wd]);
      if (animateIn) {
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            setWidgets((ws) => ws.map((w) => (w.id === id ? { ...w, leaving: false } : w)))
          )
        );
      }
      return id;
    },
    []
  );

  const freeCoord = useCallback(() => {
    const r = stageRef.current?.getBoundingClientRect();
    const p = panRef.current;
    const worldW = Math.max(820, (r?.width ?? 800) + 200);
    const worldH = Math.max(560, (r?.height ?? 480) + 120);
    const ws = widgetsRef.current;
    for (let attempt = 0; attempt < 20; attempt++) {
      const x = p.x + 30 + Math.random() * (worldW - 220);
      const y = p.y + 30 + Math.random() * (worldH - 220);
      const clash = ws.some((w) => Math.abs(w.x - x) < 170 && Math.abs(w.y - y) < 190);
      if (!clash) return { x: Math.round(x), y: Math.round(y) };
    }
    return {
      x: Math.round(p.x + 40 + Math.random() * 700),
      y: Math.round(p.y + 40 + Math.random() * 400),
    };
  }, []);

  const respawn = useCallback(() => {
    const c = freeCoord();
    addWidget(nextProduct(), c.x, c.y, true);
  }, [freeCoord, addWidget, nextProduct]);

  const removeWidget = useCallback((id: string) => {
    delete timersRef.current[id];
    setLocked((l) => l.filter((x) => x !== id));
    setWidgets((ws) => ws.map((w) => (w.id === id ? { ...w, leaving: true } : w)));
    setTimeout(() => setWidgets((ws) => ws.filter((w) => w.id !== id)), 420);
  }, []);

  const softLock = useCallback((id: string, isYou: boolean, peerName?: string) => {
    timersRef.current[id] = { endsAt: Date.now() + SOFT_MS, kind: "soft" };
    setWidgets((ws) =>
      ws.map((w) =>
        w.id === id
          ? { ...w, state: "soft", peer: isYou ? null : peerName ?? w.peer, pop: isYou ? true : w.pop }
          : w
      )
    );
    if (isYou) {
      setLocked((l) => (l.includes(id) ? l : [...l, id]));
      const w = widgetsRef.current.find((x) => x.id === id);
      toast.warning(`Soft lock — ${w?.name ?? "item"}`, {
        description: "Reserved for you for 60 seconds.",
      });
      setTimeout(() => setWidgets((ws) => ws.map((x) => (x.id === id ? { ...x, pop: false } : x))), 420);
    }
  }, []);

  const expireWidget = useCallback((id: string, silent: boolean) => {
    delete timersRef.current[id];
    const w = widgetsRef.current.find((x) => x.id === id);
    setWidgets((ws) => ws.map((x) => (x.id === id ? { ...x, state: "open", peer: null } : x)));
    setLocked((l) => l.filter((x) => x !== id));
    if (!silent && w) {
      toast.error("Reservation expired", { description: `${w.name} returned to the canvas.` });
    }
  }, []);

  const onWidgetClick = useCallback(
    (wd: W) => {
      if (wd.state === "committed") return;
      if (wd.state === "open") softLock(wd.id, true);
      else if (wd.peer) {
        toast(`Held by ${wd.peer}`, { description: "Another shopper has this one locked." });
      }
    },
    [softLock]
  );

  const handleCheckout = useCallback(() => {
    const ids = lockedRef.current;
    if (!ids.length) return;
    const now = Date.now();
    ids.forEach((id) => {
      timersRef.current[id] = { endsAt: now + HARD_MS, kind: "hard" };
    });
    setWidgets((ws) => ws.map((w) => (ids.includes(w.id) ? { ...w, state: "hard" } : w)));
    toast.warning("Moved to checkout queue", {
      description: `${ids.length} item(s) hard-locked for 5:00.`,
    });
  }, []);

  const handlePay = useCallback(() => {
    const ids = [...lockedRef.current];
    if (!ids.length) return;
    setWidgets((ws) =>
      ws.map((w) => (ids.includes(w.id) ? { ...w, state: "committed", peer: null, pop: true } : w))
    );
    ids.forEach((id) => {
      delete timersRef.current[id];
      setTimeout(() => {
        removeWidget(id);
        respawn();
      }, 650);
    });
    setLocked([]);
    toast.success("Payment confirmed", {
      description: `${ids.length} item(s) sold — invoice sent, items left the board.`,
    });
  }, [removeWidget, respawn]);

  // ---- canvas grid ----
  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const p = panRef.current;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1;
    let ox = -(p.x % CELL);
    let oy = -(p.y % CELL);
    if (ox > 0) ox -= CELL;
    if (oy > 0) oy -= CELL;
    ctx.strokeStyle = "rgba(51,65,85,0.30)";
    ctx.beginPath();
    for (let x = ox; x < w; x += CELL) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
    }
    for (let y = oy; y < h; y += CELL) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
    }
    ctx.stroke();
    ctx.fillStyle = "rgba(100,116,139,0.5)";
    ctx.font = "10px 'JetBrains Mono', monospace";
    const startCellX = Math.floor(p.x / CELL);
    const startCellY = Math.floor(p.y / CELL);
    let i = 0;
    for (let sx = ox; sx < w; sx += CELL, i++) {
      const cellX = startCellX + i + (ox < 0 ? 1 : 0);
      if (cellX % 5 !== 0) continue;
      let j = 0;
      for (let sy = oy; sy < h; sy += CELL, j++) {
        const cellY = startCellY + j + (oy < 0 ? 1 : 0);
        if (cellY % 5 === 0) ctx.fillText(`${cellX * CELL},${cellY * CELL}`, sx + 4, sy + 13);
      }
    }
  }, []);

  const sizeCanvas = useCallback(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const r = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = r.width * dpr;
    canvas.height = r.height * dpr;
    canvas.style.width = `${r.width}px`;
    canvas.style.height = `${r.height}px`;
    canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGrid();
  }, [drawGrid]);

  useEffect(() => {
    drawGrid();
  }, [pan, drawGrid]);

  // ---- init (once) ----
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    DEMO_INITIAL_COORDS.forEach((c) => addWidget(nextProduct(), c.x, c.y));
    sizeCanvas();
    const onResize = () => sizeCanvas();
    window.addEventListener("resize", onResize);
    const intro = setTimeout(
      () =>
        toast("Board is live", {
          description: "Drag to pan · click any teal widget to lock it for 60s.",
        }),
      900
    );
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(intro);
    };
  }, [addWidget, nextProduct, sizeCanvas]);

  // ---- per-second tick: expire timers + refresh tray countdowns ----
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      Object.entries(timersRef.current).forEach(([wid, t]) => {
        if (t.endsAt - now <= 0) expireWidget(wid, !lockedRef.current.includes(wid));
      });
      setPeerCount(DEMO_PEERS.length + (Math.random() > 0.6 ? 1 : 0));
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [expireWidget]);

  // ---- simulated peers: soft-lock and occasionally buy open widgets ----
  useEffect(() => {
    const id = setInterval(() => {
      if (Math.random() > 0.5) return;
      const open = widgetsRef.current.filter((w) => w.state === "open");
      if (!open.length) return;
      const wd = open[Math.floor(Math.random() * open.length)];
      const who = DEMO_PEERS[Math.floor(Math.random() * DEMO_PEERS.length)].name;
      softLock(wd.id, false, who);
      const buys = Math.random() > 0.7;
      setTimeout(() => {
        const cur = widgetsRef.current.find((w) => w.id === wd.id);
        if (!cur || cur.state !== "soft" || cur.peer !== who) return;
        if (buys) {
          setWidgets((ws) =>
            ws.map((w) => (w.id === wd.id ? { ...w, state: "committed", peer: null, pop: true } : w))
          );
          delete timersRef.current[wd.id];
          setTimeout(() => {
            removeWidget(wd.id);
            respawn();
          }, 600);
        } else {
          expireWidget(wd.id, true);
        }
      }, 4000 + Math.random() * 8000);
    }, 6500);
    return () => clearInterval(id);
  }, [softLock, expireWidget, removeWidget, respawn]);

  // ---- peer cursors: smooth RAF chase toward shifting targets ----
  useEffect(() => {
    let raf = 0;
    const animate = () => {
      const p = panRef.current;
      peerRef.current.forEach((peer) => {
        peer.x += (peer.tx - peer.x) * 0.05;
        peer.y += (peer.ty - peer.y) * 0.05;
        if (peer.el) peer.el.style.transform = `translate(${peer.x - p.x}px,${peer.y - p.y}px)`;
      });
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    const tid = setInterval(() => {
      peerRef.current.forEach((peer) => {
        peer.tx = 60 + Math.random() * 800;
        peer.ty = 40 + Math.random() * 520;
      });
    }, 3000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(tid);
    };
  }, []);

  // ---- panning ----
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".widget")) return;
    draggingRef.current = true;
    lastRef.current = { x: e.clientX, y: e.clientY };
    stageRef.current?.classList.add("grabbing");
    stageRef.current?.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const stage = stageRef.current;
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    const p = panRef.current;
    cursorRef.current?.set(
      `x${Math.round(e.clientX - r.left + p.x)} y${Math.round(e.clientY - r.top + p.y)}`
    );
    if (!draggingRef.current) return;
    const dx = e.clientX - lastRef.current.x;
    const dy = e.clientY - lastRef.current.y;
    lastRef.current = { x: e.clientX, y: e.clientY };
    setPan((prev) => ({ x: prev.x - dx, y: prev.y - dy }));
  };
  const endDrag = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    stageRef.current?.classList.remove("grabbing");
    try {
      stageRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // pointer may already be released
    }
  };

  const subtotal = locked.reduce((sum, id) => sum + (widgets.find((w) => w.id === id)?.price ?? 0), 0);
  // Once items are hard-locked they're in the queue → show "Complete payment".
  const inCheckout = locked.some((id) => widgets.find((w) => w.id === id)?.state === "hard");

  return (
    <section className="console-section" id="board">
      <div className="wrap">
        <SectionHead eyebrow="Live demo" title="Drag the canvas. Click a widget to lock it." />

        <div className="console">
          <div className="console-bar">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <span className="bar-title">
              board / <b>spring-drop-bd</b> · published
            </span>
            <span className="bar-right">
              <span>
                cursor <CursorReadout ref={cursorRef} />
              </span>
              <span>
                peers <b>{peerCount}</b>
              </span>
            </span>
            <button className="tray-toggle" onClick={() => setTrayOpen(true)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6h15l-1.5 9h-12z" />
                <circle cx="9" cy="20" r="1" />
                <circle cx="18" cy="20" r="1" />
                <path d="M6 6L5 3H2" />
              </svg>
              Cart <span className="cnt">{locked.length}</span>
            </button>
          </div>

          <div className="console-body">
            <div
              className="stage"
              ref={stageRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <canvas ref={canvasRef} />
              <div className="stage-hint">drag empty space to pan · click a widget to soft-lock</div>

              {widgets.map((w) => {
                const transform = `translate(${w.x - pan.x}px,${w.y - pan.y}px)`;
                return (
                  <div
                    key={w.id}
                    className={`widget state-${w.state}${w.leaving ? " leaving" : ""}${w.pop ? " pop" : ""}`}
                    style={{ transform, "--tf": transform } as CSSVars}
                    tabIndex={0}
                    role="button"
                    aria-label={`${w.name}, $${w.price}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onWidgetClick(w);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onWidgetClick(w);
                      }
                    }}
                  >
                    <div className="w-photo">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={demoImage(w.img)}
                        alt=""
                        draggable={false}
                        onError={(e) => e.currentTarget.remove()}
                      />
                    </div>
                    <div className="w-body">
                      <div className="w-name">{w.name}</div>
                      <div className="w-meta">
                        <span className="w-qty">Qty {w.stock}</span>
                        <span className="w-price">${w.price}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {peerRef.current.map((peer, i) => (
                <div
                  key={peer.name}
                  className="hp-peer"
                  ref={(el) => {
                    peerRef.current[i].el = el;
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path d="M5 3l15 8-6 1.5L11 19z" fill={peer.color} />
                  </svg>
                  <span className="hp-peer-tag" style={{ background: peer.color }}>
                    {peer.name}
                  </span>
                </div>
              ))}
            </div>

            <div
              className={`tray-backdrop${trayOpen ? " show" : ""}`}
              onClick={() => setTrayOpen(false)}
            />

            <aside className={`tray${trayOpen ? " open" : ""}`}>
              <div className="tray-head">
                <div>
                  <div className="t">
                    Your locked items <span className="badge">{locked.length}</span>
                  </div>
                  <div className="s">Held for you even if you pan away.</div>
                </div>
                <button className="tray-close" aria-label="Close cart" onClick={() => setTrayOpen(false)}>
                  ×
                </button>
              </div>

              <div className="tray-list">
                {locked.length === 0 ? (
                  <div className="tray-empty">
                    {"// no holds yet"}
                    <br />
                    click any open widget
                    <br />
                    to reserve it
                  </div>
                ) : (
                  locked.map((id) => {
                    const w = widgets.find((x) => x.id === id);
                    if (!w) return null;
                    const t = timersRef.current[id];
                    return (
                      <div key={id} className={`tray-item${w.state === "hard" ? " is-hard" : ""}`}>
                        <div className="ti-top">
                          <span className="ti-name">{w.name}</span>
                          <span className="ti-price">${w.price}</span>
                        </div>
                        <div className="ti-bot">
                          <span className="ti-state">{w.state === "hard" ? "queued" : "soft hold"}</span>
                          <span className="ti-timer">{t ? fmt(t.endsAt - Date.now()) : "--:--"}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {locked.length > 0 && (
                <div className="tray-foot">
                  <div className="tray-total">
                    subtotal <b>${subtotal}</b>
                  </div>
                  {inCheckout ? (
                    <button className="hp-btn hp-btn-pay" onClick={handlePay}>
                      Complete payment
                    </button>
                  ) : (
                    <button className="hp-btn hp-btn-checkout" onClick={handleCheckout}>
                      Checkout — hard lock (5:00)
                    </button>
                  )}
                </div>
              )}
            </aside>
          </div>
        </div>

        <div className="legend">
          {LEGEND_ITEMS.map((item) => (
            <span key={item.label} className={item.sold ? "sold" : undefined}>
              <i style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
