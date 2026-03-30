# WhatsApp Resilience Registry (50+ Defeating Scenarios)

This registry tracks the identification and resolution of critical "Conflict Zones" in the WhatsApp integration.

## Wave 1: Connection Stability (Scenarios 1-15)

| ID | Scenario Description | Expected Outcome | Status |
|:---|:---|:---|:---|
| 1 | Socket abrupt close during handshake | System retries with exponential backoff | [x] |
| 2 | Firestore timeout during credential write | Transaction rolls back, session stays active in memory | [x] |
| 3 | Baileys '401 Unauthorized' (Session Expired) | Force logout, cleanup Firestore auth, notify frontend | [x] |
| 4 | Rapid network switching (Wifi <-> 5G) | Socket rebinds without losing message state | [x] |
| 5 | Credential corruption (malformed JSON in DB) | Auto-heal by clearing corrupted keys and requesting new QR | [x] |
| 6 | System clock skew > 5 minutes | Log warning, adjust timestamp logic for message deduplication | [x] |
| 7 | Handshake hang (no event from Baileys for 30s) | Timeout trigger, kill socket, restart flow | [x] |
| 8 | Multiple simultaneous connection attempts for one channel | Mutex lock prevents "Double Socket" zombie state | [x] |
| 9 | Device logout from phone app | Detect 'logged_out' status, cleanup and update UI | [x] |
| 10 | 'Stream Closed' error mid-transmission | Re-queue outbound message, reconnect | [x] |
| 11 | Empty `auth_info` in Firestore but status 'connected' | Detect inconsistency, trigger re-authentication | [x] |
| 12 | Database write failure during 'QR_RECEIVED' event | Re-attempt write once, then reset connection | [x] |
| 13 | Baileys update available (minor version mismatch) | Log warning, ensure backward compatibility | [x] |
| 14 | Proxied connection failure (if proxy configured) | Fallback to direct or mark as error | [x] |
| 15 | Battery Optimization/Sleep during sync | Keepalive heartbeats maintain socket integrity | [x] |

## Wave 2: Concurrency & Load (Scenarios 16-30)

| ID | Scenario Description | Expected Outcome | Status |
|:---|:---|:---|:---|
| 16 | "Thundering Herd": 100+ incoming messages in 1s | BullMQ handles ingestion, IngressService doesn't crash | [x] |
| 17 | Rapid QR Clicking: "Generate QR" clicked 10 times | Throttle requests, return existing session if active | [x] |
| 18 | Delete-while-starting: Delete channel during `connect()` | Abort connection immediately, prevent orphaned memory leak | [x] |
| 19 | Stop-while-sending: Stop bot while uploading 20MB video | Kill upload stream, cleanup temp files | [x] |
| 20 | Dual-Tenant Race: Two tenants update same system config | Optimistic locking prevents config corruption | [x] |
| 21 | Redis crash during message queuing | Fallback to immediate processing or temporary memory queue | [x] |
| 22 | BullMQ Worker starvation (long-running skills) | Proper worker scaling or skill timeouts | [x] |
| 23 | Parallel media downloads (5+ large files) | Memory limits enforced, prevent OOM crash | [x] |
| 24 | "Message Loop": Bot replies to its own message | Deduplication/isFromMe logic prevents infinite loop | [x] |
| 25 | Inbound burst while updating Tenant tier | UsageGuard applies new limits mid-stream | [x] |
| 26 | Firestore rate limit hit (too many writes) | Batching and retry logic prevents data loss | [x] |
| 27 | Large group sync (5000+ contacts) | Non-blocking sync, process in background | [x] |
| 28 | Concurrent webhook delivery failures | Circuit breaker opens, prevents worker exhaustion | [x] |
| 29 | Parallel "Sync Memory Status" calls | Atomic sync ensures consistent state | [x] |
| 30 | Socket pressure: 1000+ unread messages on boot | Stream processing prevents memory spike | [x] |

## Wave 3: Gating & Security (Scenarios 31-40)

| ID | Scenario Description | Expected Outcome | Status |
|:---|:---|:---|:---|
| 31 | Message burst exceeding Plan limit | Hard drop after limit + 10% buffer | [x] |
| 32 | Malformed JID spoofing (trying to send to '0') | Validation blocks illegal destinations | [x] |
| 33 | `fullPath` manipulation attempt | Path validator blocks traversal or "undefined" segments | [x] |
| 34 | Tenant-A attempts to stop Tenant-B's channel | Ownership check blocks request | [x] |
| 35 | Secret leakage in logs (API keys, session info) | Logger sanitization redacts sensitive data | [x] |
| 36 | Rapid Plan switching (Free -> Pro -> Free) | Immediate feature toggle/gating update | [x] |
| 37 | Invalid Zod schema in incoming Baileys raw data | Log error, skip message, don't crash Ingress | [x] |
| 38 | Spoofed "isOwner" flag in request | Token validation/Context check overrides spoof | [x] |
| 39 | Direct Firestore subcollection access attempt | Firestore rules block non-owner access | [x] |
| 40 | Concurrent Agent creation > Plan limit | Transaction prevents over-provisioning | [x] |

## Wave 4: Workflow & Logic (Scenarios 41-50+)

| ID | Scenario Description | Expected Outcome | Status |
|:---|:---|:---|:---|
| 41 | Hot Reassignment: Move channel while media uploading | Finish upload, then transition adapter state | [x] |
| 42 | Skill Timeout: Research agent hangs for 120s | Workflow aborts, notifies user of timeout | [x] |
| 43 | Empty prompt from AI model | Fallback to "I don't understand" or default reply | [x] |
| 44 | Quoted message context lost in translation | Fallback to root message, log context loss | [x] |
| 45 | Platform-specific media format (e.g. .opus) | Auto-conversion to standard format or graceful skip | [x] |
| 46 | Channel moved to agent without required skills | Block move or log warning, disable skill calls | [x] |
| 47 | AI Model rate limit hit | Exponential backoff for AI calls, notify user | [x] |
| 48 | Webhook endpoint returns 404/500 | Retry once, then log and notify tenant | [x] |
| 49 | Group metadata sync fails (bot kicked from group) | Mark as disconnected/error, cleanup group cache | [x] |
| 50 | Mixed Baileys/CommonMessage stream | Unified Context handles both seamlessly (Remediated) | [x] |
| 51 | Unrecoverable auth error (Permanent Ban) | Final status update 'banned', notify owner | [x] |
| 52 | Server shutdown while message in-flight | Graceful shutdown waits for active jobs or persists state | [x] |
