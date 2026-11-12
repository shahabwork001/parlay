import type { Logger } from "../observability/logger.js";

const SHUTDOWN_TIMEOUT_MS = 15_000;

/** Runs `cleanup` once on SIGTERM/SIGINT, forcing exit if it takes longer than the timeout. */
export function onShutdown(logger: Logger, cleanup: () => Promise<void>): void {
  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Shutting down");

    const forceExit = setTimeout(() => {
      logger.error("Shutdown timed out; exiting");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    cleanup()
      .then(() => {
        logger.info("Shutdown complete");
        process.exit(0);
      })
      .catch((error: unknown) => {
        logger.error({ err: error }, "Shutdown failed");
        process.exit(1);
      });
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
