"use client";

import { useEffect, useState } from "react";

// The "Live now" shopper count — gently fluctuates to feel real-time.
// Starts at the server-rendered value so hydration matches.
export function LiveCounter({ initial = 4 }: { initial?: number }) {
  const [count, setCount] = useState(initial);

  useEffect(() => {
    const id = setInterval(() => {
      setCount(4 + (Math.random() > 0.7 ? 1 : 0));
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return <div className="big">{count}</div>;
}
