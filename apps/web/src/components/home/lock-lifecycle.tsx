"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import type { LifecycleState } from "@/types/home";
import { LIFECYCLE_STATES } from "@/lib/home-content";
import { SectionHead } from "./section-head";

// Allow CSS custom properties in inline styles without `any`.
type CSSVars = CSSProperties & Record<`--${string}`, string>;

// Tabbed explainer for the four lock states. Each tab themes itself via --c.
export function LockLifecycle() {
  const [active, setActive] = useState<LifecycleState["id"]>(LIFECYCLE_STATES[0].id);
  const state = LIFECYCLE_STATES.find((s) => s.id === active)!;

  return (
    <section className="lifecycle" id="lifecycle">
      <div className="wrap">
        <SectionHead
          eyebrow="The state machine"
          title="Four states. One shared color language."
        />

        <div className="tabs-nav" role="tablist">
          {LIFECYCLE_STATES.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={s.id === active}
              className={`tab-btn${s.id === active ? " active" : ""}`}
              style={{ "--c": s.color } as CSSVars}
              onClick={() => setActive(s.id)}
            >
              <span className="swatch" />
              {s.tab}
            </button>
          ))}
        </div>

        <div className="tab-panel active" style={{ "--c": state.color } as CSSVars}>
          <div className="panel-text">
            <span className="state-tag">{state.stateTag}</span>
            <h3>{state.heading}</h3>
            <p>{state.body}</p>
            <div className="dur">
              {state.durationLead} <span>{state.durationNote}</span>
            </div>
          </div>
          <div className="panel-visual">
            <div className="demo-widget" style={{ "--c": state.color } as CSSVars}>
              <div className="dw-photo" />
              <div className="dw-body">
                <div className="dw-name">Air Zephyr 270</div>
                <div className="dw-meta">
                  <span>Qty {state.demoQty}</span>
                  <b>$189</b>
                </div>
                <div className="dw-state">
                  <span>{state.demoState}</span>
                  <span>{state.demoMeta}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
