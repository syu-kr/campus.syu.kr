"use client";

import { createContext, useContext } from "react";

const RoommatesAvailability = createContext(false);
export const RoommatesAvailabilityProvider = RoommatesAvailability.Provider;
export function useRoommatesEnabled() { return useContext(RoommatesAvailability); }
