"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/features/settings/store/settings-store";
import { usePreferencesStore } from "../store/preferences-store";

/** Loads persisted client stores after mount, so server and first client render match (ADR 0005). */
export function PreferencesHydrator() {
  useEffect(() => {
    void usePreferencesStore.persist.rehydrate();
    void useSettingsStore.persist.rehydrate();
  }, []);
  return null;
}
