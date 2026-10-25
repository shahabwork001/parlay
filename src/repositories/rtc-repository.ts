import { z } from "zod";
import { type HttpClient, httpClient } from "@/lib/http";

const iceServersSchema = z.object({
  iceServers: z.array(
    z.object({
      urls: z.array(z.string()),
      username: z.string().optional(),
      credential: z.string().optional(),
    }),
  ),
  ttlSeconds: z.number().int().positive(),
});

/** STUN/TURN configuration; TURN credentials are per participant and expire after `ttlSeconds`. */
export class RtcRepository {
  constructor(private readonly client: HttpClient) {}

  async getIceServers(signal?: AbortSignal): Promise<RTCIceServer[]> {
    const response = await this.client.request("/api/v1/rtc/ice-servers", {
      schema: iceServersSchema,
      signal,
    });
    return response.iceServers.map((server) => ({
      urls: server.urls,
      ...(server.username ? { username: server.username } : {}),
      ...(server.credential ? { credential: server.credential } : {}),
    }));
  }
}

export const rtcRepository = new RtcRepository(httpClient);
