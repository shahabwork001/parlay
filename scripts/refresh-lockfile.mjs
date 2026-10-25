// Regenerates package-lock.json from a clean install. npm drops other platforms' optional
// dependencies when the lockfile is updated with an existing node_modules (npm/cli#4828), which
// breaks `npm ci` in the Linux Docker build. Run after adding or upgrading dependencies.
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

rmSync("node_modules", { recursive: true, force: true });
rmSync("package-lock.json", { force: true });
execSync("npm install --no-audit --no-fund", { stdio: "inherit" });
