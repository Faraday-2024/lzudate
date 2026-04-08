import { db } from '../cloudbase';
import { calculateMatchScore } from '../utils/matching';
import { callGLM } from '../utils/glm';

// Cosine Similarity calculation
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function runWeeklyMatching() {
  try {
    // 1. Fetch all participating users
    const usersRes = await db.collection('users').get();
    const users: any[] = [];
    const emailToUid: Record<string, string> = {};
    
    (usersRes.data || []).forEach((doc: any) => {
      const data = doc;
      const uid = doc.uid || doc._id;
      if (data.email) {
        emailToUid[data.email] = uid;
      }
      if (data.isParticipating && data.embedding) {
        users.push({ uid: uid, ...data });
      }
    });

    if (users.length < 2) {
      console.log("Not enough participating users for matching.");
      return;
    }

    // 2. Fetch drops (crushes) for Graph Score
    const dropsRes = await db.collection('drops').get();
    const graphEdges: Record<string, string[]> = {}; // uid -> array of uids they dropped
    (dropsRes.data || []).forEach((doc: any) => {
      const data = doc;
      const fromUid = data.fromUserId;
      const toUid = emailToUid[data.toEmail];
      if (fromUid && toUid) {
        if (!graphEdges[fromUid]) graphEdges[fromUid] = [];
        graphEdges[fromUid].push(toUid);
      }
    });

    // 3. Fetch archived matches for Feedback Modifier
    const archivedRes = await db.collection('archived_matches').get();
    const satisfiedMatches: Record<string, string[]> = {}; // uid -> array of uids they were satisfied with
    (archivedRes.data || []).forEach((doc: any) => {
      const data = doc;
      if (data.status === 'satisfied') {
        const uid = data.userId;
        const matchUid = data.matchUid;
        if (!satisfiedMatches[uid]) satisfiedMatches[uid] = [];
        satisfiedMatches[uid].push(matchUid);
      }
    });

    // Helper to calculate Graph Score (0 to 1)
    const getGraphScore = (u1: string, u2: string) => {
      let score = 0;
      // Direct crush
      if (graphEdges[u1]?.includes(u2)) score += 0.5;
      if (graphEdges[u2]?.includes(u1)) score += 0.5;
      
      // 2nd degree connection (mutual crush on someone else, or A crushes B who crushes C)
      // Simplified: if they both crushed the same person
      const u1Crushes = graphEdges[u1] || [];
      const u2Crushes = graphEdges[u2] || [];
      const mutualCrushes = u1Crushes.filter(c => u2Crushes.includes(c));
      if (mutualCrushes.length > 0) score += 0.2;

      return Math.min(score, 1);
    };

    // Helper to calculate Feedback Modifier (0 to 1)
    const getFeedbackModifier = (u1: string, u2: string, u2Embedding: number[]) => {
      const satisfiedUids = satisfiedMatches[u1] || [];
      if (satisfiedUids.length === 0) return 0;

      let maxSimilarityToSatisfied = 0;
      satisfiedUids.forEach(satUid => {
        const satUser = users.find(u => u.uid === satUid);
        if (satUser && satUser.embedding) {
          const sim = cosineSimilarity(u2Embedding, satUser.embedding);
          if (sim > maxSimilarityToSatisfied) {
            maxSimilarityToSatisfied = sim;
          }
        }
      });
      return maxSimilarityToSatisfied;
    };

    // 4. Calculate pairwise similarities (Weighted Score)
    const pairs: { u1: string, u2: string, score: number }[] = [];
    
    for (let i = 0; i < users.length; i++) {
      for (let j = i + 1; j < users.length; j++) {
        const u1 = users[i];
        const u2 = users[j];
        
        // Check hard filters using calculateMatchScore
        const hardScore = calculateMatchScore(u1.questionnaire, u2.questionnaire);
        if (hardScore === 0) {
          console.log(`[Matching] ${u1.name} and ${u2.name} failed hard filters (gender, orientation, height, campus, etc).`);
          continue; // Incompatible
        }

        const baseSim = cosineSimilarity(u1.embedding, u2.embedding);
        const graphScore = getGraphScore(u1.uid, u2.uid);
        const feedbackMod1 = getFeedbackModifier(u1.uid, u2.uid, u2.embedding);
        const feedbackMod2 = getFeedbackModifier(u2.uid, u1.uid, u1.embedding);
        const feedbackMod = (feedbackMod1 + feedbackMod2) / 2;
        
        // 70% Vector + 20% Graph + 10% Feedback
        const finalScore = (baseSim * 0.7) + (graphScore * 0.2) + (feedbackMod * 0.1);
        pairs.push({ u1: u1.uid, u2: u2.uid, score: finalScore });
      }
    }

    // 5. Sort pairs by score descending
    pairs.sort((a, b) => b.score - a.score);

    // 6. Greedy matching
    const matchedUids = new Set<string>();
    const finalMatches: { u1: string, u2: string, score: number }[] = [];

    for (const pair of pairs) {
      if (!matchedUids.has(pair.u1) && !matchedUids.has(pair.u2)) {
        finalMatches.push(pair);
        matchedUids.add(pair.u1);
        matchedUids.add(pair.u2);
      }
    }

    // 7. Save matches to Firestore
    const matchPromises = finalMatches.map(async (match) => {
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
          
          const responseText = await callGLM([{ role: 'user', content: prompt }]);
          if (responseText) {
            aiReasoning = responseText.trim();
          }
        }
      } catch (e) {
        console.error("Failed to generate AI reasoning:", e);
      }

      // Create a unique match ID
      const matchId = [match.u1, match.u2].sort().join('_');
      
      // Check if match exists
      const matchRes = await db.collection('matches').doc(matchId).get();
      if (matchRes.data && matchRes.data.length > 0) {
        await db.collection('matches').doc(matchId).update({
          users: [match.u1, match.u2],
          matchedAt: new Date().toISOString(),
          similarityScore: match.score,
          aiReasoning: aiReasoning,
          status: 'active'
        });
      } else {
        await db.collection('matches').doc(matchId).set({
          users: [match.u1, match.u2],
          matchedAt: new Date().toISOString(),
          similarityScore: match.score,
          aiReasoning: aiReasoning,
          status: 'active'
        });
      }
    });

    await Promise.all(matchPromises);
    console.log("Weekly matching completed successfully.");

  } catch (error) {
    console.error("Error running weekly matching:", error);
  }
}
