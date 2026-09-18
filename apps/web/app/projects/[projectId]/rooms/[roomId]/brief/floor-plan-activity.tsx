"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// Whether the floor plan panel is replacing its plan right now (S5b, PR review).
//
// The upload panel and the list of rooms beneath it are two components, and
// only the upload panel knows when a new plan is on its way in. Without this the
// list went on offering the OLD plan's rooms for the whole of the new plan's
// read, ten to forty-five seconds, and a click there was not harmless: server
// actions run one at a time, so it was sent only after the new read had landed,
// and its index then named a room on a different list. Criterion 11 says no
// control from the first plan is rendered once a second is uploaded, whatever
// the second read is doing, and this is what makes that true in the tab doing
// the uploading. Another tab is the server's to refuse, by the read the list
// came from.
export type FloorPlanActivity = {
  replacing: boolean;
  // How many replacements this page has started. A reply given about one plan
  // carries the count it was given under, so it does not caption the next
  // plan's rooms (PR review).
  replacements: number;
  setReplacing: (replacing: boolean) => void;
};

export function nextFloorPlanActivity(
  current: Pick<FloorPlanActivity, "replacing" | "replacements">,
  replacing: boolean
): Pick<FloorPlanActivity, "replacing" | "replacements"> {
  return { replacing, replacements: current.replacements + (replacing ? 1 : 0) };
}

// Not replacing, and nothing to tell, outside a provider: a component rendered
// on its own, as the component tests render it, behaves as it always has.
export const FloorPlanActivityContext = createContext<FloorPlanActivity>({
  replacing: false,
  replacements: 0,
  setReplacing: () => {}
});

export function FloorPlanActivityProvider({ children }: { children: ReactNode }) {
  const [activity, setActivity] = useState({ replacing: false, replacements: 0 });
  const setReplacing = (replacing: boolean) => setActivity((current) => nextFloorPlanActivity(current, replacing));
  return (
    <FloorPlanActivityContext.Provider value={{ ...activity, setReplacing }}>{children}</FloorPlanActivityContext.Provider>
  );
}

export function useFloorPlanActivity(): FloorPlanActivity {
  return useContext(FloorPlanActivityContext);
}
