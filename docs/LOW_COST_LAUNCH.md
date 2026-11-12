# Low-cost free MVP operating plan

No paid API, merchant account, registered-company assumption or hosted database is required to run General Chat. All core services are existing open-source components. Real checkout and Adult Chat are unavailable by default. Do not deploy publicly or buy services without owner approval.

## Configuration and resources

The optional root docker-compose.production.yml overlay limits logs and memory, omits Mailpit unless the local-email profile is explicitly selected, and removes RabbitMQ's management UI image. Run Compose config validation first. These are starting limits, not tested capacity claims; their sum is about 3.7 GiB before OS/build overhead, so a host needs additional headroom. Build images separately from the runtime host where possible. Watch OOM, Redis usage and RabbitMQ disk alarms. Do not evict Redis matchmaking/bans to save memory. Scale only after measuring. Core API/workers/frontend and Mongo/Redis/RabbitMQ/coturn remain necessary.

Set FRONTEND_ORIGIN and NEXT_PUBLIC_API_BASE_URL to HTTPS origins, TERMS_VERSION=2026-10-28, NODE_ENV=production, PAYMENT_PROVIDER=none, RATE_LIMIT_MULTIPLIER=1, secure cookies and real TURN public addresses/credentials. When using the root production overlay, pass backend/.env as the Compose --env-file so root-level SMTP/proxy substitutions resolve correctly. Configure an existing SMTP service within its permitted free quota; Mailpit is local-only and cannot deliver verification/reset email to real users. No SMTP vendor is assumed. The validated worker config supports SMTP credentials; ensure deployment passes them. Put API/frontend behind a TLS reverse proxy supporting WSS and long-lived Upgrade connections; restrict public access to internal ports. Set TRUST_PROXY to the actual trusted proxy network; loopback may be wrong for a container proxy, and trusting all forwarded addresses is unsafe. The frontend now deliberately uses WebSocket transport only, eliminating polling-affinity requirements. Validate WSS reachability on target networks; there is no polling fallback.

The current coturn configuration has TCP/UDP on 3478 and relay ports 49160�49200, without TURN TLS. A network blocking these can still prevent calls. TURN TLS /443 requires deliberate certificates, port routing and tests; do not claim universal fallback. Never expose Redis, MongoDB or RabbitMQ publicly. Resource limits are deployment safeguards, not throughput guarantees.

## Cost model (estimates must use the actual provider contract)

Monthly cost = host + domain renewal/12 + backup storage + email above allowance + relay egress above allowance. No specific price or free quota is assumed. For B Mbps in each direction, H total one-to-one call-hours and relay fraction R, TURN egress is approximately 0.9 * B * H * R GB, plus protocol overhead. At B=1, H=1000 and R=.3 this is roughly 270 GB before overhead; all-relay privacy mode would be roughly 900 GB. Count provider billing conventions and ingress separately. Direct WebRTC avoids server media transfer but still needs signaling and relay fallback. Lower video bitrates/resolution only after usability tests, never disable safety controls to save cost.

Backups: estimate compressed Mongo size times retained generations plus off-host copies. Reports store small snapshots, not recordings; evidence grows with reports, size and 30/365-day configured retention. Product metrics keep daily data for 35 days and pseudonymous activity/waitlist data for 90 days. Trust effect IDs are retained for exact replay protection; monitor document size and plan archival before high-volume use. SMTP volume includes confirmations/resets; the waitlist currently sends no emails. CPU/memory/bandwidth and staff time remain real costs even if the software is free.

## Backup and recovery runbook

1. Identify the target environment and database explicitly. Use an authenticated mongodump from the existing Mongo container (or a matching Mongo Database Tools image) to an archive. Pass credentials via the container environment or a protected config file; never paste secrets into logs or source control. Check tool availability in the deployed image before scheduling.
2. Encrypt the archive, store an off-host copy using existing storage, restrict access, record time/size/checksum, and keep a documented daily/weekly retention policy aligned with evidence retention and legal holds. A Docker volume alone is not a backup.
3. Restore only into an isolated database/host using mongorestore. Do not use --drop on a live database. Verify indexes, account access, staff 2FA, report evidence and bans. Record recovery time and perform a drill before launch.
4. Rebuild Redis bans from Mongo and verify durable blocks survive cache loss. Stop public traffic during recovery until this is proven; API startup now rehydrates durable blocks, but cache-loss recovery and real-world behavior still require launch validation. Verify workers drain recovery jobs and inspect dead letters. Test broker outage while filing a report.

## Required launch evidence

Real desktop/mobile camera permissions; two devices on different networks; direct and forced-relay calls; ICE failure/reconnect; Next/Stop/consent withdrawal; queue/disconnect cleanup and tabs; reporting/blocking/minor-safety and staff MFA; HTTPS/WSS and secure cookies; backup restore; monitoring and abuse-response staffing. None is certified by a unit test. Public launch remains blocked until this checklist has dated results.

## Upgrade / replay boundary

Drain existing worker queues before upgrading trust handlers: historical session/flag events have no old effect marker and must not be blindly replayed. New events carry stable effect identities. Historical already-scored reports are treated as complete; investigate any known old partial failures explicitly rather than automatically deducting trust again. Before API listen, durable blocks are restored and the active-ban cache is warmed; either failure blocks startup.
