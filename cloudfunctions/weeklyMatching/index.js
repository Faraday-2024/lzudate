const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({
  env: process.env.TCB_ENV || process.env.SCF_NAMESPACE || process.env.ENV_ID
});
const db = app.database();

function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    const a = Number(vecA[i] || 0);
    const b = Number(vecB[i] || 0);
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function isCompatibleOrientation(personA, personB) {
  if (!personA || !personB) return false;
  if (!personA.orientation || !personA.gender || !personB.gender) return true;

  if (personA.orientation === '异性恋') {
    if (personA.gender === '男' && personB.gender !== '女') return false;
    if (personA.gender === '女' && personB.gender !== '男') return false;
  } else if (personA.orientation === '同性恋') {
    if (personA.gender !== personB.gender) return false;
  }
  return true;
}

function isMutualOrientationCompatible(me, target) {
  return isCompatibleOrientation(me, target) && isCompatibleOrientation(target, me);
}

function calculateMatchScore(me, target) {
  if (!me || !target) return 0;

  if (!isMutualOrientationCompatible(me, target)) {
    return 0;
  }

  if (me.heightRange && target.height) {
    if (target.height < me.heightRange.min || target.height > me.heightRange.max) return 0;
  }
  if (target.heightRange && me.height) {
    if (me.height < target.heightRange.min || me.height > target.heightRange.max) return 0;
  }

  if (me.crossCampus === '不接受' && me.campus !== target.campus) return 0;
  if (target.crossCampus === '不接受' && me.campus !== target.campus) return 0;

  if (me.sameCollege === '不接受' && me.college === target.college) return 0;
  if (target.sameCollege === '不接受' && me.college === target.college) return 0;

  let score = 80;
  let maxPossibleScore = 80;

  const importantQuestionsMe = me.importantQuestions || [];
  const importantQuestionsTarget = target.importantQuestions || [];

  const scoreSingleSlider = (key, weight = 2) => {
    if (me[key] !== undefined && target[key] !== undefined) {
      const diff = Math.abs(me[key] - target[key]);
      let deduction = (diff / 6) * weight;
      if (importantQuestionsMe.includes(key)) deduction *= 1.5;
      if (importantQuestionsTarget.includes(key)) deduction *= 1.5;
      score -= deduction;
    }
  };

  const scoreComplementarySlider = (key, weight = 2) => {
    if (me[key] !== undefined && target[key] !== undefined) {
      const diff = Math.abs((me[key] + target[key]) - 8);
      let deduction = (diff / 6) * weight;
      if (importantQuestionsMe.includes(key)) deduction *= 1.5;
      if (importantQuestionsTarget.includes(key)) deduction *= 1.5;
      score -= deduction;
    }
  };

  const scoreDoubleSlider = (key, weight = 3) => {
    if (me[key] && target[key]) {
      const diff1 = Math.abs(me[key].partner - target[key].self);
      const diff2 = Math.abs(target[key].partner - me[key].self);

      let deduction1 = (diff1 / 6) * (weight / 2);
      if (importantQuestionsMe.includes(key)) deduction1 *= 1.5;

      let deduction2 = (diff2 / 6) * (weight / 2);
      if (importantQuestionsTarget.includes(key)) deduction2 *= 1.5;

      score -= (deduction1 + deduction2);
    }
  };

  const singleSliders = [
    'lifePath', 'marriageView', 'kindnessVsSmart', 'idealVsMaterial', 'moneyAttitude',
    'familyVsCareer', 'processVsResult', 'tryNewThings', 'conflictResponse',
    'sleepSchedule', 'partnerTidiness', 'dietPreference', 'spicyTolerance',
    'weekendDate', 'freeTimeTogether', 'travelStyle', 'spendingStyle',
    'messageAnxiety', 'ritualSense', 'oppositeSexFriend', 'relationshipPace',
    'showAffection', 'criticismResponse', 'dependency', 'similarHobbies',
    'partnerAppearanceEffort', 'appearanceWeight'
  ];
  singleSliders.forEach((key) => scoreSingleSlider(key));

  const complementarySliders = ['interactionMode', 'carePreference'];
  complementarySliders.forEach((key) => scoreComplementarySlider(key));

  const doubleSliders = ['careerAttitude', 'decisionMaking', 'socialEnergy', 'smoking', 'drinking', 'appearanceType'];
  doubleSliders.forEach((key) => scoreDoubleSlider(key));

  if (me.coreHobbies && target.coreHobbies) {
    const sharedHobbies = me.coreHobbies.filter((h) => target.coreHobbies.includes(h));
    score += sharedHobbies.length * 2;
    maxPossibleScore += Math.min(me.coreHobbies.length, target.coreHobbies.length) * 2;
  }

  if (me.partnerTraits && target.selfTraits) {
    const matchedTraits1 = me.partnerTraits.filter((t) => target.selfTraits.includes(t));
    score += matchedTraits1.length * 1.5;
    maxPossibleScore += me.partnerTraits.length * 1.5;
  }
  if (target.partnerTraits && me.selfTraits) {
    const matchedTraits2 = target.partnerTraits.filter((t) => me.selfTraits.includes(t));
    score += matchedTraits2.length * 1.5;
    maxPossibleScore += target.partnerTraits.length * 1.5;
  }

  let finalScore = Math.round((score / maxPossibleScore) * 100);
  if (finalScore > 99) finalScore = 99;
  if (finalScore < 0) finalScore = 0;

  return finalScore;
}

function calculateRelaxedQuestionnaireScore(me, target) {
  if (!me || !target) return 0;
  if (!isMutualOrientationCompatible(me, target)) return 0;

  let score = 72;

  if (me.heightRange && target.height !== undefined) {
    if (target.height < me.heightRange.min || target.height > me.heightRange.max) score -= 12;
  }
  if (target.heightRange && me.height !== undefined) {
    if (me.height < target.heightRange.min || me.height > target.heightRange.max) score -= 12;
  }

  if (me.crossCampus === '不接受' && me.campus && target.campus && me.campus !== target.campus) score -= 7;
  if (target.crossCampus === '不接受' && me.campus && target.campus && me.campus !== target.campus) score -= 7;

  if (me.sameCollege === '不接受' && me.college && target.college && me.college === target.college) score -= 7;
  if (target.sameCollege === '不接受' && me.college && target.college && me.college === target.college) score -= 7;

  const keyWeights = [
    ['sleepSchedule', 1.2],
    ['weekendDate', 1],
    ['spendingStyle', 1],
    ['relationshipPace', 1.2],
    ['conflictResponse', 1.2],
    ['familyVsCareer', 1],
    ['travelStyle', 1]
  ];

  keyWeights.forEach(([key, weight]) => {
    if (me[key] === undefined || target[key] === undefined) return;
    const diff = Math.abs(Number(me[key]) - Number(target[key]));
    score -= (diff / 6) * Number(weight);
  });

  const hobbiesA = Array.isArray(me.coreHobbies) ? me.coreHobbies : [];
  const hobbiesB = Array.isArray(target.coreHobbies) ? target.coreHobbies : [];
  const sharedHobbies = hobbiesA.filter((h) => hobbiesB.includes(h));
  score += Math.min(sharedHobbies.length * 1.2, 4);

  const partnerA = Array.isArray(me.partnerTraits) ? me.partnerTraits : [];
  const selfB = Array.isArray(target.selfTraits) ? target.selfTraits : [];
  const partnerB = Array.isArray(target.partnerTraits) ? target.partnerTraits : [];
  const selfA = Array.isArray(me.selfTraits) ? me.selfTraits : [];
  const traitFit = partnerA.filter((t) => selfB.includes(t)).length + partnerB.filter((t) => selfA.includes(t)).length;
  score += Math.min(traitFit * 0.9, 5);

  if (score > 95) score = 95;
  if (score < 20) score = 20;
  return Math.round(score);
}

function buildReason(u1, u2, finalScore) {
  const q1 = u1.questionnaire || {};
  const q2 = u2.questionnaire || {};

  const reasons = [];

  const hobbies1 = Array.isArray(q1.coreHobbies) ? q1.coreHobbies : [];
  const hobbies2 = Array.isArray(q2.coreHobbies) ? q2.coreHobbies : [];
  const sharedHobbies = hobbies1.filter((h) => hobbies2.includes(h));
  if (sharedHobbies.length > 0) {
    reasons.push(`共同爱好上，你们都偏好${sharedHobbies.slice(0, 3).join('、')}`);
  }

  const selfTraits1 = Array.isArray(q1.selfTraits) ? q1.selfTraits : [];
  const selfTraits2 = Array.isArray(q2.selfTraits) ? q2.selfTraits : [];
  const partnerTraits1 = Array.isArray(q1.partnerTraits) ? q1.partnerTraits : [];
  const partnerTraits2 = Array.isArray(q2.partnerTraits) ? q2.partnerTraits : [];
  const traitFitA = partnerTraits1.filter((t) => selfTraits2.includes(t));
  const traitFitB = partnerTraits2.filter((t) => selfTraits1.includes(t));
  if (traitFitA.length > 0 || traitFitB.length > 0) {
    const topTraits = traitFitA.concat(traitFitB).slice(0, 3);
    if (topTraits.length > 0) {
      reasons.push(`在伴侣期待上可互相满足，重点体现在${topTraits.join('、')}`);
    } else {
      reasons.push('在伴侣期待上可互相满足');
    }
  }

  const sliderLabels = {
    sleepSchedule: '作息节奏',
    weekendDate: '约会方式',
    spendingStyle: '消费观',
    travelStyle: '旅行偏好',
    freeTimeTogether: '陪伴频率',
    relationshipPace: '关系推进',
    conflictResponse: '冲突处理'
  };
  const closeKeys = Object.keys(sliderLabels).filter((k) => {
    if (q1[k] === undefined || q2[k] === undefined) return false;
    return Math.abs(Number(q1[k]) - Number(q2[k])) <= 1;
  });
  if (closeKeys.length >= 2) {
    reasons.push(`价值观与生活方式同频点包括${closeKeys.slice(0, 3).map((k) => sliderLabels[k]).join('、')}`);
  }

  if (reasons.length === 0) {
    reasons.push('你们在核心偏好上没有明显冲突，沟通与相处成本较低');
  }

  const scoreText = `${Math.round(finalScore * 100)}%`;
  return `${reasons.slice(0, 2).join('；')}。综合契合度约 ${scoreText}。`;
}

function getThisWeekReleaseTime(base = new Date()) {
  const release = new Date(base);
  const day = release.getDay();
  const deltaToThisWeekThursday = 4 - day;
  release.setDate(release.getDate() + deltaToThisWeekThursday);
  release.setHours(21, 0, 0, 0);
  return release;
}

function getRoundId(roundStart) {
  const y = roundStart.getFullYear();
  const m = String(roundStart.getMonth() + 1).padStart(2, '0');
  const d = String(roundStart.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getOrientationGroup(questionnaire = {}) {
  const orientation = questionnaire.orientation;
  if (orientation === '异性恋') return 'hetero';
  if (orientation === '同性恋') return 'homo';
  return 'open';
}

function getCampusBucket(questionnaire = {}) {
  if (questionnaire.crossCampus === '不接受' && questionnaire.campus) {
    return `campus:${questionnaire.campus}`;
  }
  return 'campus:any';
}

function buildUserBuckets(users) {
  const buckets = new Map();
  users.forEach((user) => {
    const q = user.questionnaire || {};
    const key = `${getOrientationGroup(q)}|${getCampusBucket(q)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(user);
  });
  return Array.from(buckets.values());
}

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

async function runWithConcurrency(items, limit, worker) {
  if (!Array.isArray(items) || items.length === 0) return;
  const concurrency = Math.max(1, Math.floor(toFiniteNumber(limit, 8)));
  let index = 0;

  const runners = new Array(Math.min(concurrency, items.length)).fill(0).map(async () => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(runners);
}

async function fetchAll(collectionName, where = null, limit = 100) {
  let all = [];
  let skip = 0;
  while (true) {
    let query = db.collection(collectionName);
    if (where) query = query.where(where);
    const res = await query.skip(skip).limit(limit).get();
    const rows = res.data || [];
    all = all.concat(rows);
    if (rows.length < limit) break;
    skip += rows.length;
  }
  return all;
}

exports.main = async (event = {}) => {
  try {
    const forceRun = Boolean(event.forceRun || event.force || event.recompute);
    const now = new Date();
    const roundStart = getThisWeekReleaseTime(now);
    const roundEnd = new Date(roundStart);
    roundEnd.setDate(roundEnd.getDate() + 7);
    const roundId = getRoundId(roundStart);

    const [usersAll, dropsAll, archivedAll, existingMatches] = await Promise.all([
      fetchAll('users', { isParticipating: true }, 100),
      fetchAll('drops', null, 200),
      fetchAll('archived_matches', null, 200),
      fetchAll('matches', {
        matchedAt: db.command.gte(roundStart.toISOString())
      }, 200)
    ]);

    const users = usersAll
      .map((doc) => {
        const uid = doc.uid || doc._id;
        return { ...doc, uid };
      })
      .filter((u) => Array.isArray(u.embedding) && u.embedding.length > 0);

    const existingActiveThisRound = existingMatches.filter((m) => {
      const t = m.matchedAt ? new Date(m.matchedAt).getTime() : 0;
      return m.status === 'active' && t >= roundStart.getTime() && t < roundEnd.getTime();
    });

    if (!forceRun && existingActiveThisRound.length > 0) {
      return {
        success: true,
        skipped: true,
        reason: 'This round has already been generated. Use forceRun to recompute.',
        roundId,
        participatingUsers: usersAll.length,
        eligibleUsers: users.length,
        existingActiveMatches: existingActiveThisRound.length,
        createdMatches: 0
      };
    }

    if (users.length < 2) {
      return {
        success: true,
        message: 'Not enough participating users with embeddings.',
        roundId,
        participatingUsers: usersAll.length,
        eligibleUsers: users.length,
        createdMatches: 0
      };
    }

    const largeScaleMode = Boolean(event.largeScaleMode) || users.length >= 800;
    const enableBucketPass = event.enableBucketPass !== undefined ? Boolean(event.enableBucketPass) : largeScaleMode;
    const bucketFallbackGlobal = event.bucketFallbackGlobal !== undefined ? Boolean(event.bucketFallbackGlobal) : true;
    const minStrictScore = clamp(toFiniteNumber(event.minStrictScore, largeScaleMode ? 0.22 : 0), 0, 1);
    const minRelaxedScore = clamp(toFiniteNumber(event.minRelaxedScore, largeScaleMode ? 0.18 : 0), 0, 1);
    const maxStrictPairs = Math.max(0, Math.floor(toFiniteNumber(event.maxStrictPairs, largeScaleMode ? users.length * 120 : 0)));
    const maxRelaxedPairs = Math.max(0, Math.floor(toFiniteNumber(event.maxRelaxedPairs, largeScaleMode ? users.length * 80 : 0)));
    const writeConcurrency = Math.max(1, Math.floor(toFiniteNumber(event.writeConcurrency, largeScaleMode ? 25 : 10)));
    const userByUid = new Map(users.map((u) => [u.uid, u]));

    const emailToUid = {};
    users.forEach((u) => {
      if (u.email) emailToUid[String(u.email).toLowerCase()] = u.uid;
    });

    const graphEdges = {};
    dropsAll.forEach((d) => {
      const fromUid = d.fromUserId;
      const toUid = d.toEmail ? emailToUid[String(d.toEmail).toLowerCase()] : null;
      if (!fromUid || !toUid) return;
      if (!graphEdges[fromUid]) graphEdges[fromUid] = [];
      graphEdges[fromUid].push(toUid);
    });

    const satisfiedMatches = {};
    const unsatisfiedMatches = {};
    const unsatisfiedPairSet = new Set();
    archivedAll.forEach((a) => {
      if (!a?.userId || !a?.matchUid) return;
      if (a.status === 'satisfied') {
        if (!satisfiedMatches[a.userId]) satisfiedMatches[a.userId] = [];
        satisfiedMatches[a.userId].push(a.matchUid);
        return;
      }

      if (a.status === 'unsatisfied') {
        if (!unsatisfiedMatches[a.userId]) unsatisfiedMatches[a.userId] = [];
        unsatisfiedMatches[a.userId].push(a.matchUid);

        const pairKey = [a.userId, a.matchUid].sort().join('__');
        unsatisfiedPairSet.add(pairKey);
      }
    });

    const satisfiedEmbeddings = {};
    Object.keys(satisfiedMatches).forEach((uid) => {
      const embeds = (satisfiedMatches[uid] || [])
        .map((satUid) => userByUid.get(satUid))
        .filter((u) => Array.isArray(u?.embedding) && u.embedding.length > 0)
        .map((u) => u.embedding);
      if (embeds.length > 0) satisfiedEmbeddings[uid] = embeds;
    });

    const unsatisfiedEmbeddings = {};
    Object.keys(unsatisfiedMatches).forEach((uid) => {
      const embeds = (unsatisfiedMatches[uid] || [])
        .map((unsatUid) => userByUid.get(unsatUid))
        .filter((u) => Array.isArray(u?.embedding) && u.embedding.length > 0)
        .map((u) => u.embedding);
      if (embeds.length > 0) unsatisfiedEmbeddings[uid] = embeds;
    });

    const getGraphScore = (u1, u2) => {
      let score = 0;
      if (graphEdges[u1]?.includes(u2)) score += 0.5;
      if (graphEdges[u2]?.includes(u1)) score += 0.5;

      const u1Crushes = graphEdges[u1] || [];
      const u2Crushes = graphEdges[u2] || [];
      const mutualCrushes = u1Crushes.filter((c) => u2Crushes.includes(c));
      if (mutualCrushes.length > 0) score += 0.2;
      return Math.min(score, 1);
    };

    const getFeedbackModifier = (u1, u2Embedding) => {
      const embeddings = satisfiedEmbeddings[u1] || [];
      if (embeddings.length === 0) return 0;
      let maxSimilarity = 0;
      embeddings.forEach((embedding) => {
        const sim = cosineSimilarity(u2Embedding, embedding);
        if (sim > maxSimilarity) maxSimilarity = sim;
      });
      return maxSimilarity;
    };

    const getUnsatisfiedModifier = (u1, u2Embedding) => {
      const embeddings = unsatisfiedEmbeddings[u1] || [];
      if (embeddings.length === 0) return 0;

      let maxSimilarity = 0;
      embeddings.forEach((embedding) => {
        const sim = cosineSimilarity(u2Embedding, embedding);
        if (sim > maxSimilarity) maxSimilarity = sim;
      });
      return maxSimilarity;
    };

    const diagnostics = {
      totalPossiblePairs: 0,
      orientationRejectedPairs: 0,
      strictRejectedPairs: 0,
      strictCandidatePairs: 0,
      relaxedCandidatePairs: 0,
      relaxedAddedPairs: 0,
      mutuallyOrientationCompatiblePairs: 0,
      unsatisfiedBlockedPairs: 0,
      unsatisfiedPenaltyAppliedPairs: 0,
      strictScoreFilteredPairs: 0,
      relaxedScoreFilteredPairs: 0,
      strictPairsAfterFilter: 0,
      relaxedPairsAfterFilter: 0,
      strictBuckets: 0,
      relaxedBuckets: 0
    };

    const pairs = [];
    const strictBuckets = enableBucketPass ? buildUserBuckets(users) : [users];
    diagnostics.strictBuckets = strictBuckets.length;

    strictBuckets.forEach((bucketUsers) => {
      for (let i = 0; i < bucketUsers.length; i++) {
        for (let j = i + 1; j < bucketUsers.length; j++) {
          const u1 = bucketUsers[i];
          const u2 = bucketUsers[j];
        diagnostics.totalPossiblePairs += 1;

        const pairKey = [u1.uid, u2.uid].sort().join('__');
        if (unsatisfiedPairSet.has(pairKey)) {
          diagnostics.unsatisfiedBlockedPairs += 1;
          continue;
        }

        const q1 = u1.questionnaire || {};
        const q2 = u2.questionnaire || {};
        if (!isMutualOrientationCompatible(q1, q2)) {
          diagnostics.orientationRejectedPairs += 1;
          continue;
        }
        diagnostics.mutuallyOrientationCompatiblePairs += 1;

        const hardScore = calculateMatchScore(q1, q2);
        if (hardScore === 0) {
          diagnostics.strictRejectedPairs += 1;
          continue;
        }
        diagnostics.strictCandidatePairs += 1;

        const baseSim = cosineSimilarity(u1.embedding, u2.embedding);
        const graphScore = getGraphScore(u1.uid, u2.uid);
        const feedbackMod = (getFeedbackModifier(u1.uid, u2.embedding) + getFeedbackModifier(u2.uid, u1.embedding)) / 2;
        const unsatisfiedMod = (getUnsatisfiedModifier(u1.uid, u2.embedding) + getUnsatisfiedModifier(u2.uid, u1.embedding)) / 2;
        const questionnaireBonus = hardScore / 100;
        if (unsatisfiedMod > 0) diagnostics.unsatisfiedPenaltyAppliedPairs += 1;

        const rawScore = (baseSim * 0.55) + (questionnaireBonus * 0.2) + (graphScore * 0.15) + (feedbackMod * 0.1) - (unsatisfiedMod * 0.12);
        const finalScore = Math.max(0, Math.min(1, rawScore));

        if (finalScore < minStrictScore) {
          diagnostics.strictScoreFilteredPairs += 1;
          continue;
        }

          pairs.push({ u1: u1.uid, u2: u2.uid, score: finalScore });
        }
      }
    });

    if (maxStrictPairs > 0 && pairs.length > maxStrictPairs) {
      pairs.sort((a, b) => b.score - a.score);
      pairs.length = maxStrictPairs;
    }
    diagnostics.strictPairsAfterFilter = pairs.length;

    pairs.sort((a, b) => b.score - a.score);

    const matched = new Set();
    const finalMatches = [];
    for (const pair of pairs) {
      if (!matched.has(pair.u1) && !matched.has(pair.u2)) {
        finalMatches.push(pair);
        matched.add(pair.u1);
        matched.add(pair.u2);
      }
    }

    // Pass 2 fallback: if strict pass matched too few users, try relaxed pairing for remaining users.
    const strictMatchedUsers = matched.size;
    const strictRatio = strictMatchedUsers / users.length;
    if (strictRatio < 0.6) {
      const remaining = users.filter((u) => !matched.has(u.uid));
      const relaxedPairs = [];

      const relaxedBuckets = enableBucketPass ? buildUserBuckets(remaining) : [remaining];
      diagnostics.relaxedBuckets = relaxedBuckets.length;

      relaxedBuckets.forEach((bucketUsers) => {
        for (let i = 0; i < bucketUsers.length; i++) {
          for (let j = i + 1; j < bucketUsers.length; j++) {
            const a = bucketUsers[i];
            const b = bucketUsers[j];

            const qa = a.questionnaire || {};
            const qb = b.questionnaire || {};

            const pairKey = [a.uid, b.uid].sort().join('__');
            if (unsatisfiedPairSet.has(pairKey)) continue;

            if (!isMutualOrientationCompatible(qa, qb)) continue;

            const sim = cosineSimilarity(a.embedding, b.embedding);
            const relaxedQuestionnaireScore = calculateRelaxedQuestionnaireScore(qa, qb) / 100;
            const graphScore = getGraphScore(a.uid, b.uid);
            const unsatisfiedMod = (getUnsatisfiedModifier(a.uid, b.embedding) + getUnsatisfiedModifier(b.uid, a.embedding)) / 2;
            const rawScore = (sim * 0.65) + (relaxedQuestionnaireScore * 0.25) + (graphScore * 0.1) - (unsatisfiedMod * 0.1);
            const score = Math.max(0, Math.min(1, rawScore));

            if (score < minRelaxedScore) {
              diagnostics.relaxedScoreFilteredPairs += 1;
              continue;
            }

            diagnostics.relaxedCandidatePairs += 1;
            relaxedPairs.push({ u1: a.uid, u2: b.uid, score, source: 'relaxed' });
          }
        }

      });

      if (bucketFallbackGlobal && enableBucketPass && relaxedPairs.length === 0 && remaining.length > 1) {
        for (let i = 0; i < remaining.length; i++) {
          for (let j = i + 1; j < remaining.length; j++) {
            const a = remaining[i];
            const b = remaining[j];

            const qa = a.questionnaire || {};
            const qb = b.questionnaire || {};
            const pairKey = [a.uid, b.uid].sort().join('__');

            if (unsatisfiedPairSet.has(pairKey)) continue;
            if (!isMutualOrientationCompatible(qa, qb)) continue;

            const sim = cosineSimilarity(a.embedding, b.embedding);
            const relaxedQuestionnaireScore = calculateRelaxedQuestionnaireScore(qa, qb) / 100;
            const graphScore = getGraphScore(a.uid, b.uid);
            const unsatisfiedMod = (getUnsatisfiedModifier(a.uid, b.embedding) + getUnsatisfiedModifier(b.uid, a.embedding)) / 2;
            const rawScore = (sim * 0.65) + (relaxedQuestionnaireScore * 0.25) + (graphScore * 0.1) - (unsatisfiedMod * 0.1);
            const score = Math.max(0, Math.min(1, rawScore));

            if (score < minRelaxedScore) {
              diagnostics.relaxedScoreFilteredPairs += 1;
              continue;
            }

            diagnostics.relaxedCandidatePairs += 1;
            relaxedPairs.push({ u1: a.uid, u2: b.uid, score, source: 'relaxed-global-fallback' });
          }
        }
      }

      if (maxRelaxedPairs > 0 && relaxedPairs.length > maxRelaxedPairs) {
        relaxedPairs.sort((a, b) => b.score - a.score);
        relaxedPairs.length = maxRelaxedPairs;
      }
      diagnostics.relaxedPairsAfterFilter = relaxedPairs.length;

      relaxedPairs.sort((a, b) => b.score - a.score);
      for (const pair of relaxedPairs) {
        if (!matched.has(pair.u1) && !matched.has(pair.u2)) {
          finalMatches.push(pair);
          matched.add(pair.u1);
          matched.add(pair.u2);
          diagnostics.relaxedAddedPairs += 1;
        }
      }
    }

    // Invalidate existing this-round active matches before writing fresh set.
    const toDeactivate = existingMatches.filter((m) => {
      const t = m.matchedAt ? new Date(m.matchedAt).getTime() : 0;
      return m.status === 'active' && t >= roundStart.getTime() && t < roundEnd.getTime();
    });

    await runWithConcurrency(toDeactivate, writeConcurrency, async (old) => {
      const id = old?._id;
      if (!id) return;
      await db.collection('matches').doc(id).update({
        status: 'inactive',
        supersededAt: new Date().toISOString()
      });
    });

    await runWithConcurrency(finalMatches, writeConcurrency, async (match) => {
      const matchId = [match.u1, match.u2].sort().join('_');
      const u1Data = userByUid.get(match.u1) || {};
      const u2Data = userByUid.get(match.u2) || {};
      const payload = {
        users: [match.u1, match.u2],
        // Use release time as the round timestamp so the round identity stays stable
        // even when computation is executed before publish time.
        matchedAt: roundStart.toISOString(),
        similarityScore: match.score,
        compatibilityScore: Math.round(match.score * 100),
        aiReasoning: buildReason(u1Data, u2Data, match.score),
        roundId,
        status: 'active'
      };

      const existing = await db.collection('matches').doc(matchId).get();
      if (existing.data && existing.data.length > 0) {
        await db.collection('matches').doc(matchId).update(payload);
      } else {
        await db.collection('matches').doc(matchId).set(payload);
      }
    });

    return {
      success: true,
      roundId,
      forceRun,
      largeScaleMode,
      enableBucketPass,
      bucketFallbackGlobal,
      minStrictScore,
      minRelaxedScore,
      maxStrictPairs,
      maxRelaxedPairs,
      writeConcurrency,
      participatingUsers: usersAll.length,
      eligibleUsers: users.length,
      generatedPairs: finalMatches.length,
      createdMatches: finalMatches.length,
      unmatchedUsers: users.length - finalMatches.length * 2,
      deactivatedOldMatches: toDeactivate.length,
      diagnostics
    };
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Unknown error'
    };
  }
};
