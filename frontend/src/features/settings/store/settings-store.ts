import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  /** Preferred camera and microphone (deviceId); null means the browser default. */
  cameraId: string | null;
  microphoneId: string | null;
  /** Route all video through the TURN relay so partners never see this device's IP address. */
  relayOnly: boolean;
  /** Play a short sound when a partner is found. */
  matchSound: boolean;
  setCamera: (deviceId: string | null) => void;
  setMicrophone: (deviceId: string | null) => void;
  setRelayOnly: (relayOnly: boolean) => void;
  setMatchSound: (matchSound: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      cameraId: null,
      microphoneId: null,
      relayOnly: false,
      matchSound: true,
      setCamera: (cameraId) => set({ cameraId }),
      setMicrophone: (microphoneId) => set({ microphoneId }),
      setRelayOnly: (relayOnly) => set({ relayOnly }),
      setMatchSound: (matchSound) => set({ matchSound }),
    }),
    { name: "parley.settings", version: 1, skipHydration: true },
  ),
);
