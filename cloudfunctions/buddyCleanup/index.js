const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({
  env: process.env.TCB_ENV || process.env.SCF_NAMESPACE || process.env.ENV_ID
});
const db = app.database();

const DEFAULT_LIMIT = 500;
const BATCH_SIZE = 100;

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }
  return Boolean(value);
}

function toNumber(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

async function queryExpiredIds(where, orderField, limit) {
  let ids = [];
  let skip = 0;

  while (ids.length < limit) {
    const pageSize = Math.min(BATCH_SIZE, limit - ids.length);
    const res = await db
      .collection('buddy_posts')
      .where(where)
      .orderBy(orderField, 'asc')
      .skip(skip)
      .limit(pageSize)
      .get();

    const rows = res.data || [];
    if (rows.length === 0) break;

    ids = ids.concat(rows.map((row) => row._id).filter(Boolean));
    if (rows.length < pageSize) break;
    skip += rows.length;
  }

  return ids;
}

async function deleteByIds(ids) {
  let deleted = 0;
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((id) => db.collection('buddy_posts').doc(id).remove()));
    results.forEach((r) => {
      if (r.status === 'fulfilled') deleted += 1;
    });
  }
  return deleted;
}

exports.main = async (event = {}) => {
  try {
    const dryRun = toBoolean(event.dryRun, false);
    const includeLegacyCreatedAt = toBoolean(event.includeLegacyCreatedAt, true);
    const limit = toNumber(event.limit, DEFAULT_LIMIT);

    const now = new Date();
    const nowIso = now.toISOString();
    const legacyCutoffIso = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();

    const expiredByExpiresAt = await queryExpiredIds(
      { expiresAt: db.command.lte(nowIso) },
      'expiresAt',
      limit
    );

    let legacyExpired = [];
    if (includeLegacyCreatedAt && expiredByExpiresAt.length < limit) {
      const legacyLimit = limit - expiredByExpiresAt.length;
      legacyExpired = await queryExpiredIds(
        {
          expiresAt: db.command.exists(false),
          createdAt: db.command.lte(legacyCutoffIso)
        },
        'createdAt',
        legacyLimit
      );
    }

    const allIds = Array.from(new Set(expiredByExpiresAt.concat(legacyExpired))).slice(0, limit);

    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        now: nowIso,
        limit,
        foundByExpiresAt: expiredByExpiresAt.length,
        foundLegacyByCreatedAt: legacyExpired.length,
        totalToDelete: allIds.length,
        sampleIds: allIds.slice(0, 20)
      };
    }

    const deleted = await deleteByIds(allIds);

    return {
      success: true,
      dryRun: false,
      now: nowIso,
      limit,
      foundByExpiresAt: expiredByExpiresAt.length,
      foundLegacyByCreatedAt: legacyExpired.length,
      deleted,
      totalFound: allIds.length
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown cleanup error'
    };
  }
};
