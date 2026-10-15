// In a .ts file rather than toggle-group.svelte's module script: ESLint can't
// read types out of .svelte files.
import { createContext } from "svelte";

import type { ToggleVariants } from "#lib/components/ui/toggle/index.ts";

export interface ToggleGroupContext extends Required<ToggleVariants> {
  spacing: number;
  orientation: "horizontal" | "vertical";
}

export const [getToggleGroupCtx, setToggleGroupCtx] =
  createContext<ToggleGroupContext>();
