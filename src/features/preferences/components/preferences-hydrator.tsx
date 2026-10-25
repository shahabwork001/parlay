"use client";

import { useEffect } from "react";
import { usePreferencesStore } from "../store/preferences-store";

export function PreferencesHydrator() {
  useEffect(() => {
    void usePreferencesStore.persist.rehydrate();
  }, []);
  return null;
}
