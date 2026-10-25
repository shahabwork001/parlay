import { cn } from "@/lib/utils";
import type { ConnectionQuality, QualityLevel } from "@/services/webrtc/connection-quality";

const LABELS: Record<QualityLevel, string> = {
  good: "Good connection",
  fair: "Fair connection",
  poor: "Poor connection",
  unknown: "Measuring connection",
};

const BARS: Record<QualityLevel, number> = { good: 3, fair: 2, poor: 1, unknown: 0 };

/** Three bars plus a text alternative; details (latency, loss, relay) in the tooltip title. */
export function QualityIndicator({ quality }: { quality: ConnectionQuality }) {
  const details = [
    quality.roundTripMs !== null ? `${quality.roundTripMs} ms` : null,
    quality.packetLoss !== null ? `${(quality.packetLoss * 100).toFixed(1)}% loss` : null,
    quality.relayed ? "relayed" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <span
      role="status"
      title={details || undefined}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
    >
      <span aria-hidden className="flex h-3 items-end gap-0.5">
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={cn(
              "w-1 rounded-sm bg-muted-foreground/30",
              bar === 1 ? "h-1" : bar === 2 ? "h-2" : "h-3",
              bar <= BARS[quality.level] &&
                (quality.level === "poor"
                  ? "bg-destructive"
                  : quality.level === "fair"
                    ? "bg-amber-500"
                    : "bg-primary"),
            )}
          />
        ))}
      </span>
      <span className="sr-only sm:not-sr-only">{LABELS[quality.level]}</span>
    </span>
  );
}
