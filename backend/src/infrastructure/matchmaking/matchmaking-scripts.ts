import { LuaScript } from "../caching/lua-script.js";

/*
 * Key layout (prefix `mm`):
 *   mm:queue:{mode}:{pool}  ZSET  waiting subjects, score = first enqueue time (ms)
 *   mm:ticket:{subject}     HASH  device, meta, language, interests (csv), enqueuedAt, mode, pool
 *   mm:active:{subject}     STR   session id the subject is in
 *   mm:session:{id}         HASH  caller, callerDevice, callerMeta, callee, calleeDevice, calleeMeta,
 *                                 mode, startedAt, shared
 *   mm:ended:{id}           HASH  the same fields, kept for the report window after the session ends
 *   mm:sessions             SET   live session ids (for the presence sweeper)
 *   mm:blocks:{subject}     SET   subject and device ids this subject blocked
 *   mm:recent:{subject}     ZSET  recent partners, score = when the session ended (ms)
 *   mm:presence:{subject}   STR   set while the subject has a connected socket (short TTL)
 *
 * `meta` is an opaque "kind|networkHash|subnetHash" string the scripts only copy.
 *
 * Keys are derived inside the scripts, so these scripts target a single Redis node (or a cluster
 * with all matchmaking keys pinned to one slot via a hash tag on the prefix).
 */

/**
 * Pairs the caller with the best compatible waiting subject in the same mode and pool, or queues
 * them. Compatibility: compatible language, no block in either direction, not a recent partner.
 * Preference: most shared interests, then longest waiting. Without shared interests a pairing needs
 * both sides to accept random partners: no interests, or waited past the fallback.
 *
 * ARGV: prefix, subject, device, meta, mode, pool, language, interestsCsv, nowMs, fallbackMs,
 *       scanLimit, recentWindowMs, newSessionId, sessionTtlSeconds, interaction
 * Returns: {"active", sessionId} | {"matched", sessionId, partner, partnerDevice, partnerMeta, sharedCsv, waitedMs}
 *        | {"queued"}
 */
export const PAIR_SCRIPT = new LuaScript(`
local p, me, dev, meta, mode, pool, lang, csv = ARGV[1], ARGV[2], ARGV[3], ARGV[4], ARGV[5], ARGV[6], ARGV[7], ARGV[8]
local now, fallback, limit, recentWindow = tonumber(ARGV[9]), tonumber(ARGV[10]), tonumber(ARGV[11]), tonumber(ARGV[12])
local sid, ttl = ARGV[13], tonumber(ARGV[14])
if ARGV[17] and ARGV[17] ~= '' and redis.call('GET', p .. ':owner:' .. me) ~= ARGV[17] then return {'cancelled'} end

local active = redis.call('GET', p .. ':active:' .. me)
if active then return {'active', active} end

local queue = p .. ':queue:' .. mode .. ':' .. pool
local myTicket = p .. ':ticket:' .. me
-- A retry must never resurrect a consumed or cancelled consent ticket.
if ARGV[16] == '0' and redis.call('EXISTS', myTicket) == 0 then return {'cancelled'} end
local enqueuedAt = tonumber(redis.call('HGET', myTicket, 'enqueuedAt')) or now
local myWait = now - enqueuedAt
local mine = {}
for interest in string.gmatch(csv, '[^,]+') do mine[interest] = true end
local acceptsRandom = csv == '' or myWait >= fallback
local myBlocks = p .. ':blocks:' .. me
local myRecent = p .. ':recent:' .. me

local best, bestDevice, bestMeta, bestShared, bestSharedCsv, bestAt = nil, nil, nil, -1, '', now
for _, candidate in ipairs(redis.call('ZRANGE', queue, 0, limit - 1)) do
  if candidate ~= me then
    local t = redis.call('HMGET', p .. ':ticket:' .. candidate, 'device', 'language', 'interests', 'enqueuedAt', 'meta', 'owner')
    local cDevice, cLanguage, cCsv, cAt, cMeta = t[1], t[2], t[3] or '', tonumber(t[4]) or now, t[5] or ''
    local cOwner = t[6] or ''
    if not cDevice or (cOwner ~= '' and redis.call('GET', p .. ':owner:' .. candidate) ~= cOwner) then
      redis.call('ZREM', queue, candidate)
      redis.call('DEL', p .. ':ticket:' .. candidate)
    else
      local ok = lang == 'any' or cLanguage == 'any' or lang == cLanguage
      if ok and (redis.call('SISMEMBER', myBlocks, candidate) == 1 or redis.call('SISMEMBER', myBlocks, cDevice) == 1) then ok = false end
      if ok then
        local theirBlocks = p .. ':blocks:' .. candidate
        if redis.call('SISMEMBER', theirBlocks, me) == 1 or redis.call('SISMEMBER', theirBlocks, dev) == 1 then ok = false end
      end
      if ok then
        local endedAt = redis.call('ZSCORE', myRecent, candidate)
        if endedAt and now - tonumber(endedAt) < recentWindow then ok = false end
      end
      if ok then
        local shared, sharedList = 0, {}
        for interest in string.gmatch(cCsv, '[^,]+') do
          if mine[interest] then
            shared = shared + 1
            table.insert(sharedList, interest)
          end
        end
        local theyAcceptRandom = cCsv == '' or now - cAt >= fallback
        if (shared > 0 or (acceptsRandom and theyAcceptRandom)) and shared > bestShared then
          best, bestDevice, bestMeta, bestShared, bestSharedCsv, bestAt = candidate, cDevice, cMeta, shared, table.concat(sharedList, ','), cAt
        end
      end
    end
  end
end

if best then
  redis.call('ZREM', queue, best, me)
  redis.call('DEL', p .. ':ticket:' .. best, myTicket)
  local session = p .. ':session:' .. sid
  redis.call('HSET', session, 'caller', best, 'callerDevice', bestDevice, 'callerMeta', bestMeta,
    'callee', me, 'calleeDevice', dev, 'calleeMeta', meta, 'mode', mode, 'interaction', ARGV[15], 'startedAt', now, 'shared', bestSharedCsv)
  redis.call('EXPIRE', session, ttl)
  redis.call('SET', p .. ':active:' .. best, sid, 'EX', ttl)
  redis.call('SET', p .. ':active:' .. me, sid, 'EX', ttl)
  redis.call('SADD', p .. ':sessions', sid)
  return {'matched', sid, best, bestDevice, bestMeta, bestSharedCsv, tostring(now - bestAt)}
end

redis.call('ZADD', queue, 'NX', enqueuedAt, me)
redis.call('HSET', myTicket, 'device', dev, 'meta', meta, 'language', lang, 'interests', csv,
  'enqueuedAt', enqueuedAt, 'mode', mode, 'pool', pool, 'owner', ARGV[17] or '')
redis.call('EXPIRE', myTicket, ttl)
return {'queued'}
`);

/**
 * Ends the subject's session for both participants, records each as the other's recent partner and
 * keeps the session's details for the report window.
 * ARGV: prefix, subject, nowMs, recentTtlSeconds, reportWindowSeconds
 * Returns: nil | {sessionId, caller, callerDevice, callerMeta, callee, calleeDevice, calleeMeta, mode,
 *                 sharedCsv, startedAt}
 */
export const END_SCRIPT = new LuaScript(`
local p, me, now, recentTtl, reportWindow = ARGV[1], ARGV[2], tonumber(ARGV[3]), tonumber(ARGV[4]), tonumber(ARGV[5])
if ARGV[6] and ARGV[6] ~= '' and redis.call('GET', p .. ':owner:' .. me) ~= ARGV[6] then return nil end
local sid = redis.call('GET', p .. ':active:' .. me)
if not sid then return nil end
if ARGV[7] and ARGV[7] ~= '' and sid ~= ARGV[7] then return nil end

local session = p .. ':session:' .. sid
local f = redis.call('HMGET', session, 'caller', 'callerDevice', 'callerMeta', 'callee', 'calleeDevice',
  'calleeMeta', 'mode', 'shared', 'startedAt', 'interaction')
if redis.call('EXISTS', session) == 1 then
  local ended = p .. ':ended:' .. sid
  redis.call('RENAME', session, ended)
  redis.call('EXPIRE', ended, reportWindow)
end
redis.call('SREM', p .. ':sessions', sid)
for _, subject in ipairs({me, f[1], f[4]}) do
  if subject and redis.call('GET', p .. ':active:' .. subject) == sid then
    redis.call('DEL', p .. ':active:' .. subject)
  end
end
if not f[1] or not f[4] then return nil end

for _, pair in ipairs({{f[1], f[4]}, {f[4], f[1]}}) do
  local recent = p .. ':recent:' .. pair[1]
  redis.call('ZADD', recent, now, pair[2])
  redis.call('EXPIRE', recent, recentTtl)
end
return {sid, f[1], f[2], f[3] or '', f[4], f[5], f[6] or '', f[7], f[8] or '', f[9] or '', f[10] or 'general'}
`);
