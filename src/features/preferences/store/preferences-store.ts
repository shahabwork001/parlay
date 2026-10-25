import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type LanguageCode, MAX_INTERESTS } from "@/lib/constants";

interface PreferencesState {
  interests: string[];
  language: LanguageCode;
  addInterest: (interest: string) => void;
  removeInterest: (interest: string) => void;
  setLanguage: (language: LanguageCode) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      interests: [],
      language: "any",
      addInterest: (interest) =>
        set((state) =>
          state.interests.includes(interest) || state.interests.length >= MAX_INTERESTS
            ? state
            : { interests: [...state.interests, interest] },
        ),
      removeInterest: (interest) =>
        set((state) => ({ interests: state.interests.filter((item) => item !== interest) })),
      setLanguage: (language) => set({ language }),
    }),
    { name: "parley.preferences", version: 1, skipHydration: true },
  ),
);
