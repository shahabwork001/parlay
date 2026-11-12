"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isLanguageCode, LANGUAGES } from "@/lib/constants";
import { usePreferencesStore } from "../store/preferences-store";

export function LanguageSelect() {
  const triggerId = useId();
  const language = usePreferencesStore((state) => state.language);
  const setLanguage = usePreferencesStore((state) => state.setLanguage);

  function handleChange(value: string) {
    if (isLanguageCode(value)) setLanguage(value);
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={triggerId}>Language</Label>
      <Select value={language} onValueChange={handleChange}>
        <SelectTrigger id={triggerId} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LANGUAGES.map((option) => (
            <SelectItem key={option.code} value={option.code}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
