"use client";

import { Search } from "lucide-react";

export function SearchBar({ placeholder }: { placeholder: string }) {
  return (
    <div className="relative flex max-w-[360px] flex-1 items-center">
      <Search className="pointer-events-none absolute left-3 size-4 text-text-muted" />
      <input
        type="text"
        placeholder={placeholder}
        className="w-full rounded-sm border border-border bg-bg py-[9px] pl-9 pr-3 text-[0.85rem] text-text outline-none transition-colors placeholder:text-text-muted focus:border-active"
      />
    </div>
  );
}
