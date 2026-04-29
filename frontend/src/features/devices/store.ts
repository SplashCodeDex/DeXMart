import { create } from "zustand";
import type { PairedDevice, PendingDevice, DevicePairingList } from "@/types";

interface DevicesState {
  pending: PendingDevice[];
  paired: PairedDevice[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setDevices: (devices: DevicePairingList) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearDevices: () => void;
}

export const useDevicesStore = create<DevicesState>((set) => ({
  pending: [],
  paired: [],
  isLoading: false,
  error: null,

  setDevices: (devices) =>
    set({
      pending: devices.pending,
      paired: devices.paired,
      isLoading: false,
      error: null,
    }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  clearDevices: () => set({ pending: [], paired: [], error: null, isLoading: false }),
}));
