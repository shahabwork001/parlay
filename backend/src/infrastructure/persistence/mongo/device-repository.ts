import type { Db } from "mongodb";
import type { DeviceRepository } from "../../../application/features/identity/ports.js";
import { Device } from "../../../domain/identity/device.js";
import type { TermsAcceptance } from "../../../domain/identity/terms-acceptance.js";
import type { MongoIndexDefinition } from "./mongo-indexes.js";
import { translateDuplicateKey } from "./mongo-errors.js";
import { type AggregateDocument, MongoRepository } from "./mongo-repository.js";

const COLLECTION = "devices";

interface DeviceDocument extends AggregateDocument {
  fingerprintHash: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  termsAcceptance: TermsAcceptance | null;
}

export const DEVICE_INDEXES: MongoIndexDefinition = {
  collection: COLLECTION,
  indexes: [{ key: { fingerprintHash: 1 }, name: "fingerprint_unique", unique: true }],
};

export class MongoDeviceRepository
  extends MongoRepository<Device, DeviceDocument>
  implements DeviceRepository
{
  constructor(database: Db) {
    super(database, COLLECTION);
  }

  async findByFingerprintHash(fingerprintHash: string): Promise<Device | null> {
    const document = await this.collection.findOne({ fingerprintHash });
    return document ? this.toAggregate(document) : null;
  }

  override add(device: Device): Promise<void> {
    return translateDuplicateKey("devices.fingerprintHash", () => super.add(device));
  }

  protected toDocument(device: Device): DeviceDocument {
    return {
      _id: device.id,
      version: device.version,
      fingerprintHash: device.fingerprintHash,
      firstSeenAt: device.firstSeenAt,
      lastSeenAt: device.lastSeenAt,
      termsAcceptance: device.termsAcceptance,
    };
  }

  protected toAggregate(document: DeviceDocument): Device {
    return Device.restore({ ...document, id: document._id });
  }
}
