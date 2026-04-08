'use strict';

const fetch = require('node-fetch');
const tcb = require('@cloudbase/node-sdk');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function isCompatibleOrientation(personA, personB) {
  if (personA.orientation === '异性恋') {
    if (personA.gender === '男' && personB.gender !== '女') return false;
    if (personA.gender === '女' && personB.gender !== '男') return false;
  } else if (personA.orientation === '同性恋') {
    if (personA.gender !== personB.gender) return false;
  }
  return true;
}

function passesHardFilters(me, target) {
  if (!me || !target) return false;
  if (!isCompatibleOrientation(me, target) || !isCompatibleOrientation(target, me)) return false;
  if (me.heightRange && target.height) {
    if (target.height < me.heightRange.min || target.height > me.heightRange.max) return false;
  }
  if (target.heightRange && me.height) {
    if (me.height < target.heightRange.min || me.height > target.heightRange.max) return false;
  }
  if (me.crossCampus === '不接受' && me.campus !== target.campus) return false;
  if (target.crossCampus === '不接受' && me.campus !== target.campus) return false;
  if (me.sameCollege === '不接受' && me.college === target.college) return false;
  if (target.sameCollege === '不接受' && me.college === target.college) return false;
  return true;
}

async function callGLM(prompt) {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) return '';
  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'glm-4.7',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (e) {
    console.error('GLM API call failed:', e);
    return '';
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

exports.main = async () => {
  const app = tcb.init({ env: tcb.SYMBOL_CURRENT_ENV });
  const db = app.database();

  try {
    // 1. Fetch all participating users
    const usersRes = await db.collection('users').get();
    const users = [];
    const emailToUid = {};

    (usersRes.data || []).forEach((doc) => {
      const uid = doc.uid || doc._id;
      if (doc.email) emailToUid[doc.email] = uid;
      if (doc.isParticipating && doc.embedding) {
        users.push({ uid, ...doc });
      }
    });

    if (users.length < 2) {
      console.log('Not enough participating users for matching.');
      return { result: 'skipped', reason: 'not enough users' };
    }

    // 2. Fetch drops (crushes) for Graph Score
    const dropsRes = await db.collection('drops').get();
    const graphEdges = {};
    (dropsRes.data || []).forEach((doc) => {
      const fromUid = doc.fromUserId;
      const toUid = emailToUid[doc.toEmail];
      if (fromUid && toUid) {
        if (!graphEdges[fromUid]) graphEdges[fromUid] = [];
        graphEdges[fromUid].push(toUid);
      }
    });

    // 3. Fetch archived matches for Feedback Modifier
    const archivedRes = await db.collection('archived_matches').get();
    const satisfiedMatches = {};
    (archivedRes.data || []).forEach((doc) => {
      if (doc.status === 'satisfied') {
        const uid = doc.userId;
        const matchUid = doc.matchUid;
        if (!satisfiedMatches[uid]) satisfiedMatches[uid] = [];
        satisfiedMatches[uid].push(matchUid);
      }
    });

    // Helpers
    const getGraphScore = (u1, u2) => {
      let score = 0;
      if (graphEdges[u1]?.includes(u2)) score += 0.5;
      if (graphEdges[u2]?.includes(u1)) score += 0.5;
      const u1Crushes = graphEdges[u1] || [];
      const u2Crushes = graphEdges[u2] || [];
      if (u1Crushes.filter(c => u2Crushes.includes(c)).length > 0) score += 0.2;
      return Math.min(score, 1);
    };

    const getFeedbackModifier = (u1, u2Embedding) => {
      const satUids = satisfiedMatches[u1] || [];
      if (satUids.length === 0) return 0;
      let max = 0;
      satUids.forEach(satUid => {
        const satUser = users.find(u => u.uid === satUid);
        if (satUser?.embedding) {
          const sim = cosineSimilarity(u2Embedding, satUser.embedding);
          if (sim > max) max = sim;
        }
      });
      return max;
    };

    // 4. Calculate pairwise scores
    const pairs = [];
    for (let i = 0; i < users.length; i++) {
      for (let j = i + 1; j < users.length; j++) {
        const u1 = users[i];
        const u2 = users[j];
        if (!passesHardFilters(u1.questionnaire, u2.questionnaire)) continue;

        const baseSim = cosineSimilarity(u1.embedding, u2.embedding);
        const graphScore = getGraphScore(u1.uid, u2.uid);
        const feedbackMod = (getFeedbackModifier(u1.uid, u2.embedding) + getFeedbackModifier(u2.uid, u1.embedding)) / 2;
        const finalScore = baseSim * 0.7 + graphScore * 0.2 + feedbackMod * 0.1;
        pairs.push({ u1: u1.uid, u2: u2.uid, score: finalScore });
      }
    }

    // 5. Sort and greedy match
    pairs.sort((a, b) => b.score - a.score);
    const matchedUids = new Set();
    const finalMatches = [];
    for (const pair of pairs) {
      if (!matchedUids.has(pair.u1) && !matchedUids.has(pair.u2)) {
        finalMatches.push(pair);
        matchedUids.add(pair.u1);
        matchedUids.add(pair.u2);
      }
    }

    // 6. Save matches with AI reasoning
    await Promise.all(finalMatches.map(async (match) => {
      let aiReasoning = '你们在生活方式和价值观上有很高的契合度。';
      try {
        const u1Data = users.find(u => u.uid === match.u1);
        const u2Data = users.find(u => u.uid === match.u2);
        if (u1Data && u2Data) {
          const prompt = `作为恋爱匹配助手，请根据以下两人的详细信息，写一段50字左右的推荐理由，说明为什么他们很般配。
要求：
1. 语气要温暖、浪漫、真诚。
2. 必须结合他们具体的共同爱好、性格特点或生活方式，给出具体的理由（例如：你们都喜欢摄影，性格互补等），不要说空话。

用户A:
昵称: ${u1Data.name}
简介: ${u1Data.bio || '未知'}
AI总结画像: ${u1Data.aiSummary || '未知'}
问卷信息: ${JSON.stringify(u1Data.questionnaire || {})}

用户B:
昵称: ${u2Data.name}
简介: ${u2Data.bio || '未知'}
AI总结画像: ${u2Data.aiSummary || '未知'}
问卷信息: ${JSON.stringify(u2Data.questionnaire || {})}`;

          const text = await callGLM(prompt);
          if (text) aiReasoning = text.trim();
        }
      } catch (e) {
        console.error('Failed to generate AI reasoning:', e);
      }

      const matchId = [match.u1, match.u2].sort().join('_');
      const matchRes = await db.collection('matches').doc(matchId).get();
      const payload = {
        users: [match.u1, match.u2],
        matchedAt: new Date().toISOString(),
        similarityScore: match.score,
        aiReasoning,
        status: 'active'
      };

      if (matchRes.data && matchRes.data.length > 0) {
        await db.collection('matches').doc(matchId).update(payload);
      } else {
        await db.collection('matches').doc(matchId).set(payload);
      }
    }));

    console.log(`Weekly matching completed: ${finalMatches.length} matches created.`);
    return { result: 'success', matchCount: finalMatches.length };
  } catch (error) {
    console.error('Error running weekly matching:', error);
    return { result: 'error', message: error.message };
  }
};
