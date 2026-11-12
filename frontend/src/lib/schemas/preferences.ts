import { z } from "zod";
import { MAX_INTEREST_LENGTH } from "@/lib/constants";

export const interestSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Use at least 2 characters.")
  .max(MAX_INTEREST_LENGTH, `Use at most ${MAX_INTEREST_LENGTH} characters.`)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} -]*$/u, "Use letters, numbers, spaces or hyphens.");
