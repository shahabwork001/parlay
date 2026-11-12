import { defineConfig, devices } from "@playwright/test";

/**
 * Projects:
 * - `frontend`: needs only the Next.js app (started automatically unless E2E_BASE_URL is set).
 * - `stack`: needs the full Docker stack (API, workers, Mailpit). Run `npm run test:e2e:stack`
 *   after `./scripts/dev-up.sh`.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const useExistingServer = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "frontend", testIgnore: /stack\//, use: { ...devices["Desktop Chrome"] } },
    {
      name: "stack",
      testMatch: /stack\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        // Synthetic camera and microphone, granted without a prompt, for the video specs.
        permissions: ["camera", "microphone"],
        launchOptions: {
          args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
        },
      },
    },
  ],
  webServer: useExistingServer
    ? undefined
    : {
        command: "npm run build && npm run start",
        url: baseURL,
        timeout: 240_000,
        reuseExistingServer: !process.env.CI,
      },
});
