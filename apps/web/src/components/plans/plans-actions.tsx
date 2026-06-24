"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PlansActions({ onCreate }: { onCreate: () => void }) {
  return (
    <Button onClick={onCreate}>
      <Plus />
      Create Plan
    </Button>
  );
}
