import { AggregateRoot } from "../common/aggregate-root.js";
import { type EntityId, newEntityId } from "../common/entity.js";
import type { TermsAcceptance } from "./terms-acceptance.js";

export interface DeviceState {
  readonly id: EntityId;
  readonly version: number;
  /** Keyed hash of the client fingerprint; the raw fingerprint is never stored. */
  readonly fingerprintHash: string;
  readonly firstSeenAt: Date;
  readonly lastSeenAt: Date;
  readonly termsAcceptance: TermsAcceptance | null;
}

/** A browser/device. Anonymous sessions belong to a device, and device bans apply to accounts too. */
export class Device extends AggregateRoot {
  readonly fingerprintHash: string;
  readonly firstSeenAt: Date;
  #lastSeenAt: Date;
  #termsAcceptance: TermsAcceptance | null;

  private constructor(state: DeviceState) {
    super(state.id, state.version);
    this.fingerprintHash = state.fingerprintHash;
    this.firstSeenAt = state.firstSeenAt;
    this.#lastSeenAt = state.lastSeenAt;
    this.#termsAcceptance = state.termsAcceptance;
  }

  static register(fingerprintHash: string, now: Date): Device {
    return new Device({
      id: newEntityId(),
      version: 0,
      fingerprintHash,
      firstSeenAt: now,
      lastSeenAt: now,
      termsAcceptance: null,
    });
  }

  static restore(state: DeviceState): Device {
    return new Device(state);
  }

  get lastSeenAt(): Date {
    return this.#lastSeenAt;
  }

  get termsAcceptance(): TermsAcceptance | null {
    return this.#termsAcceptance;
  }

  seen(now: Date): void {
    this.#lastSeenAt = now;
  }

  recordAcceptance(acceptance: TermsAcceptance): void {
    this.#termsAcceptance = acceptance;
  }
}
