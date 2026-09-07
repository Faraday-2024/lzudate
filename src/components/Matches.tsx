import React, { useState, useEffect } from 'react';
import { db, auth } from '../cloudbase';
import { motion, AnimatePresence } from 'motion/react';
import MatchAIChat from './MatchAIChat';
import AIChatOnboarding from './AIChatOnboarding';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Heart, Target, Sparkles, Check, X, Zap, RefreshCw } from 'lucide-react';

interface MatchProfile {
  uid: string;
  name: string;
  avatarUrl: string;
  bio: string;
  email: string;
  displayProfile?: string;
  aiSummary?: string;
  isDropMatch?: boolean;
  matchDocId?: string;
  college?: string;
  grade?: string;
  gender?: string;
  compatibilityScore?: number;
  aiReasoning?: string;
  wechat?: string;
}

function getThisWeekReleaseTime(base = new Date()): Date {
  const release = new Date(base);
  const day = release.getDay();
  const deltaToThisWeekThursday = 4 - day;
  release.setDate(release.getDate() + deltaToThisWeekThursday);
  release.setHours(21, 0, 0, 0);
  return release;
}

function joinedBeforeThisRoundRelease(participationUpdatedAt: any, releaseTime: Date): boolean {
  if (!participationUpdatedAt) return true;
  const joinedAt = new Date(participationUpdatedAt);
  if (Number.isNaN(joinedAt.getTime())) return true;
  return joinedAt <= releaseTime;
}

function isCurrentRoundMatch(matchDoc: any, now: Date): boolean {
  if (!matchDoc?.matchedAt) return false;
  const matchedAt = new Date(matchDoc.matchedAt);
  if (Number.isNaN(matchedAt.getTime())) return false;

  const thisWeekRelease = getThisWeekReleaseTime(now);
  const nextWeekRelease = new Date(thisWeekRelease);
  nextWeekRelease.setDate(nextWeekRelease.getDate() + 7);

  return matchedAt >= thisWeekRelease && matchedAt < nextWeekRelease;
}

export default function Matches() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>('');
  const [activeChatMatch, setActiveChatMatch] = useState<MatchProfile | null>(null);
  const [isParticipating, setIsParticipating] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showShootModal, setShowShootModal] = useState(false);
  const [showCupidModal, setShowCupidModal] = useState(false);
  const [showTrainModal, setShowTrainModal] = useState(false);
  const [showFailedMatchScreen, setShowFailedMatchScreen] = useState(false);
  const [showCoffeeModal, setShowCoffeeModal] = useState(false);
  const [coffeeCardIndex, setCoffeeCardIndex] = useState(0);
  const [revealedEmails, setRevealedEmails] = useState<Record<string, boolean>>({});
  const [activeUsersCount, setActiveUsersCount] = useState<number>(0);
  const [matchedPairsCount, setMatchedPairsCount] = useState<number>(0);
  const [maleCount, setMaleCount] = useState<number>(0);
  const [femaleCount, setFemaleCount] = useState<number>(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [activeUsersRes, maleCountRes, femaleCountRes, matchesRes] = await Promise.all([
          db.collection('users').where({ isParticipating: true }).count(),
          db.collection('users').where({ isParticipating: true, 'questionnaire.gender': '男' }).count(),
          db.collection('users').where({ isParticipating: true, 'questionnaire.gender': '女' }).count(),
          db.collection('matches').count()
        ]);

        if (activeUsersRes?.total !== undefined) {
          setActiveUsersCount(activeUsersRes.total);
        }
        if (maleCountRes?.total !== undefined) {
          setMaleCount(maleCountRes.total);
        }
        if (femaleCountRes?.total !== undefined) {
          setFemaleCount(femaleCountRes.total);
        }
        if (matchesRes?.total !== undefined) {
          setMatchedPairsCount(matchesRes.total);
        }
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      }
    };
    fetchStats();
  }, []);

  const handleTrainAI = async (summary: string) => {
    const loginState = await auth.getLoginState();
    if (!loginState) return;
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      await db.collection('users').doc(uid).update({
        aiSummary: summary
      });
      setTimeout(() => {
        setShowTrainModal(false);
      }, 2000);
    } catch (err) {
      console.error("Error updating AI summary:", err);
    }
  };
  const [shootEmail, setShootEmail] = useState('');
  const [shootMessageText, setShootMessageText] = useState('');
  const [cupidEmail1, setCupidEmail1] = useState('');
  const [cupidEmail2, setCupidEmail2] = useState('');
  const [cupidMessageText, setCupidMessageText] = useState('');
  const [modeMessage, setModeMessage] = useState({ text: '', type: '' });

  const handleShoot = async (e: React.FormEvent) => {
    e.preventDefault();
    const loginState = await auth.getLoginState();
    if (!loginState || !shootEmail) return;
    try {
      const uid = auth.currentUser?.uid;
      // Note: CloudBase auth doesn't expose email directly on currentUser in all cases,
      // you might need to fetch it from the user document if it's not available.
      // Assuming it's stored in the users collection.
      const userRes = await db.collection('users').doc(uid).get();
      const userEmail = userRes.data && userRes.data.length > 0 ? (userRes.data[0].email || '') : '';

      if (!userEmail) {
        setModeMessage({ text: '发送失败: 请先在个人档案中设置你的校园邮箱。', type: 'error' });
        return;
      }

      await db.collection('drops').add({
        fromUserId: uid,
        fromEmail: userEmail,
        toEmail: shootEmail.toLowerCase(),
        message: shootMessageText,
        createdAt: new Date().toISOString(),
        type: 'shoot'
      });
      setModeMessage({ text: '暗恋已发送！如果TA也填了你，你们就会匹配成功。', type: 'success' });
      setTimeout(() => {
        setShowShootModal(false);
        setShootEmail('');
        setShootMessageText('');
        setModeMessage({ text: '', type: '' });
      }, 3000);
    } catch (err: any) {
      setModeMessage({ text: '发送失败: ' + err.message, type: 'error' });
      console.error(err);
    }
  };

  const handleCupid = async (e: React.FormEvent) => {
    e.preventDefault();
    const loginState = await auth.getLoginState();
    if (!loginState || !cupidEmail1 || !cupidEmail2) return;
    try {
      const uid = auth.currentUser?.uid;
      await db.collection('cupid_matches').add({
        cupidUserId: uid,
        email1: cupidEmail1.toLowerCase(),
        email2: cupidEmail2.toLowerCase(),
        message: cupidMessageText,
        createdAt: new Date().toISOString()
      });
      setModeMessage({ text: '撮合已发送！他们将收到提醒。', type: 'success' });
      setTimeout(() => {
        setShowCupidModal(false);
        setCupidEmail1('');
        setCupidEmail2('');
        setCupidMessageText('');
        setModeMessage({ text: '', type: '' });
      }, 3000);
    } catch (err: any) {
      setModeMessage({ text: '发送失败: ' + err.message, type: 'error' });
      console.error(err);
    }
  };

  const fetchData = async () => {
    setLoadError('');
    const loginState = await auth.getLoginState();
    if (!loginState) return;
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;

    try {
      const nowTime = new Date();
      const releaseTime = getThisWeekReleaseTime(nowTime);
      const isRoundReleased = nowTime >= releaseTime;

      // Fetch user participation status and email
      const userRes = await db.collection('users').doc(currentUid).get();
      let currentEmail = '';
      let participating = false;
      let participationUpdatedAt: string | undefined;
      if (userRes.data && userRes.data.length > 0) {
        participating = userRes.data[0].isParticipating || false;
        participationUpdatedAt = userRes.data[0].participationUpdatedAt;
        setIsParticipating(participating);
        currentEmail = userRes.data[0].email?.toLowerCase() || '';
      }

      // Fetch archived matches to filter them out
      const archivedRes = await db.collection('archived_matches').where({ userId: currentUid }).get();
      const archivedUids = (archivedRes.data || []).map((d: any) => d.matchUid);

      const matchProfiles: MatchProfile[] = [];

      // 1. Fetch regular matches
      // CloudBase doesn't have array-contains, we might need a different query strategy
      // For now, we'll fetch all matches and filter client-side if array-contains is not supported
      // Alternatively, if users array is indexed, we can try to query it.
      // Assuming we can query by array field containing a value in CloudBase (it usually supports it via where({ users: currentUid }))
      // Let's try fetching all and filtering for safety if the query fails, but ideally we should query.
      // Cloudbase JS SDK supports querying arrays: .where({ users: db.command.in([currentUid]) }) or similar.
      // Actually, for array contains, CloudBase uses db.command.in or just passing the value if it's an array field.
      // Let's fetch all matches where currentUid is in the users array.
      const matchesRes = await db.collection('matches').where({
        users: currentUid // CloudBase often allows this for array-contains
      }).get();

      const regularMatchDocs = matchesRes.data || [];
      
      for (const matchDoc of regularMatchDocs) {
        if (matchDoc.status && matchDoc.status !== 'active') {
          continue;
        }

        // Weekly match results should only be published after the release timestamp.
        if (!isRoundReleased) {
          continue;
        }

        if (!isCurrentRoundMatch(matchDoc, nowTime)) {
          continue;
        }

        const users = matchDoc.users as string[];
        const otherUid = users.find(id => id !== currentUid);
        
        if (otherUid && !archivedUids.includes(otherUid)) {
          const otherUserRes = await db.collection('users').doc(otherUid).get();
          if (otherUserRes.data && otherUserRes.data.length > 0) {
            const userData = otherUserRes.data[0];
            matchProfiles.push({
              uid: userData.uid || userData._id,
              name: userData.name,
              avatarUrl: userData.avatarUrl,
              bio: userData.bio,
              email: userData.email,
              displayProfile: userData.displayProfile,
              aiSummary: userData.aiSummary,
              college: userData.questionnaire?.college,
              grade: userData.questionnaire?.grade,
              gender: userData.questionnaire?.gender,
              wechat: userData.questionnaire?.wechat,
              compatibilityScore: matchDoc.similarityScore ? Math.round(matchDoc.similarityScore * 100) : (matchDoc.compatibilityScore || Math.floor(Math.random() * 20) + 80),
              aiReasoning: matchDoc.aiReasoning || '你们在生活方式和价值观上有很高的契合度。',
              isDropMatch: false,
              matchDocId: matchDoc._id
            });
          }
        }
      }

      // 2. Fetch mutual drops
      const myDropsRes = await db.collection('drops').where({ fromUserId: currentUid }).get();
      
      for (const dropDoc of myDropsRes.data || []) {
        const toEmail = dropDoc.toEmail;
        if (!toEmail || !currentEmail) continue;

        const reverseRes = await db.collection('drops').where({
          fromEmail: toEmail,
          toEmail: currentEmail
        }).get();
      
        try {
          if (reverseRes.data && reverseRes.data.length > 0) {
            const usersRes = await db.collection('users').where({ email: toEmail }).get();
            const matchedUserDoc = usersRes.data && usersRes.data.length > 0 ? usersRes.data[0] : null;
            
            if (matchedUserDoc) {
              const userData = matchedUserDoc;
              const targetUid = userData.uid || userData._id;
                if (!archivedUids.includes(targetUid) && !matchProfiles.some(p => p.uid === targetUid)) {
                  matchProfiles.push({
                    uid: targetUid,
                    name: userData.name,
                    avatarUrl: userData.avatarUrl,
                    bio: userData.bio,
                    email: userData.email,
                    displayProfile: userData.displayProfile,
                    aiSummary: userData.aiSummary,
                    college: userData.questionnaire?.college,
                    grade: userData.questionnaire?.grade,
                    gender: userData.questionnaire?.gender,
                    wechat: userData.questionnaire?.wechat,
                    compatibilityScore: 100, // Mutual drop is 100%
                    aiReasoning: '你们互相暗恋了对方！这就是最好的推荐理由。',
                    isDropMatch: true
                  });
                }
              }
            }
          } catch (err: any) {
            console.error("Error checking reverse drop:", err);
          }
      }

      // 3. Fetch cupid matches is moved to Mailbox.tsx
      
      setMatches(matchProfiles);
      const joinedThisRound = joinedBeforeThisRoundRelease(participationUpdatedAt, releaseTime);
      const shouldShowFailed = participating && isRoundReleased && joinedThisRound && matchProfiles.length === 0;
      setShowFailedMatchScreen(shouldShowFailed);
      return matchProfiles;
    } catch (err) {
      console.error("Error fetching data:", err);
      setLoadError('匹配结果加载失败，请稍后重试。');
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (matches.length === 0) return;
    
    // CloudBase watch (realtime)
    let watchers: any[] = [];
    
    const setupWatchers = async () => {
      for (const match of matches) {
        try {
          const watcher = db.collection('users').doc(match.uid).watch({
            onChange: (snapshot: any) => {
              if (snapshot.docs && snapshot.docs.length > 0) {
                const userData = snapshot.docs[0];
                setMatches(prevMatches => prevMatches.map(m => {
                  if (m.uid === match.uid) {
                    return {
                      ...m,
                      name: userData.name,
                      avatarUrl: userData.avatarUrl,
                      bio: userData.bio,
                      displayProfile: userData.displayProfile,
                      aiSummary: userData.aiSummary,
                    };
                  }
                  return m;
                }));
              }
            },
            onError: (err: any) => {
              console.error('Watch error', err);
            }
          });
          watchers.push(watcher);
        } catch (e) {
          console.error("Failed to setup watcher", e);
        }
      }
    };
    
    setupWatchers();

    return () => {
      // CloudBase watchers need to be closed
      watchers.forEach(watcher => {
        if (watcher && typeof watcher.close === 'function') {
          watcher.close();
        }
      });
    };
  }, [matches.map(m => m.uid).join(',')]);

  const toggleParticipation = async () => {
    const loginState = await auth.getLoginState();
    if (!loginState) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const newState = !isParticipating;
    setIsParticipating(newState);
    try {
      await db.collection('users').doc(uid).update({
        isParticipating: newState,
        participationUpdatedAt: new Date().toISOString()
      });
      if (!newState) {
        setShowFailedMatchScreen(false);
      } else {
        fetchData();
      }
    } catch (err) {
      console.error("Error updating participation:", err);
      setIsParticipating(!newState); // revert on error
    }
  };

  const generateCoffeeCode = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleFeedback = async (match: MatchProfile, status: 'satisfied' | 'unsatisfied') => {
    const loginState = await auth.getLoginState();
    if (!loginState) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    setArchiving(true);
    try {
      // Generate coffee code for satisfied matches
      let coffeeCode = undefined;
      if (status === 'satisfied') {
        coffeeCode = generateCoffeeCode();
      }

      const archivedData: any = {
        userId: uid,
        matchUid: match.uid,
        status,
        archivedAt: new Date().toISOString()
      };

      if (coffeeCode) {
        archivedData.voucherCode = coffeeCode;
        archivedData.voucherUsed = false;
      }

      await db.collection('archived_matches').add(archivedData);

      // If satisfied, try to sync coffee code with counterpart
      if (status === 'satisfied' && coffeeCode) {
        try {
          const counterpartRes = await db.collection('archived_matches').where({
            userId: match.uid,
            matchUid: uid,
            status: 'satisfied'
          }).get();

          if (counterpartRes.data && counterpartRes.data.length > 0) {
            const counterpartDoc = counterpartRes.data[0];
            // Update counterpart with same coffee code
            await db.collection('archived_matches').doc(counterpartDoc._id || counterpartDoc.id).update({
              voucherCode: coffeeCode,
              voucherUsed: false
            });
          }
        } catch (err) {
          console.error("Error syncing coffee code with counterpart:", err);
        }
      }
      
      setMatches(matches.filter(m => m.uid !== match.uid));
    } catch (err) {
      console.error("Error archiving match:", err);
    } finally {
      setArchiving(false);
    }
  };

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate next Thursday 9:00 PM
  const getNextMatchTime = () => {
    const nextMatch = new Date();
    nextMatch.setDate(now.getDate() + ((4 - now.getDay() + 7) % 7));
    nextMatch.setHours(21, 0, 0, 0);
    if (now > nextMatch) {
      nextMatch.setDate(nextMatch.getDate() + 7);
    }
    
    const diff = nextMatch.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${days}天 ${hours}小时 ${minutes}分 ${seconds}秒`;
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh]">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto pb-12 min-h-[80vh] p-6 rounded-3xl relative overflow-hidden">
        <div className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 p-8 text-center mb-8 shadow-xl">
          <h3 className="text-2xl font-extrabold text-black mb-2">结果加载失败</h3>
          <p className="text-gray-800 mb-6 font-medium">{loadError}</p>
          <button
            onClick={() => {
              setLoading(true);
              fetchData();
            }}
            className="px-6 py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-sm"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  const genderTotal = maleCount + femaleCount;
  const malePercent = genderTotal > 0 ? Math.round((maleCount / genderTotal) * 100) : 0;
  const femalePercent = genderTotal > 0 ? 100 - malePercent : 0;
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const maleStroke = circumference * (malePercent / 100);
  const femaleStroke = circumference - maleStroke;

  return (
    <div className="max-w-3xl mx-auto pb-12 min-h-[80vh] p-6 rounded-3xl relative overflow-hidden">
      <div className="relative z-10">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-extrabold text-black tracking-tight">匹配</h2>
            <p className="text-gray-700 mt-1 font-medium">每周一次的专属相遇</p>
          </div>
          <button
            onClick={toggleParticipation}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${isParticipating ? 'bg-black text-white' : 'bg-white/80 text-black border border-black hover:bg-black hover:text-white'}`}
          >
            {isParticipating ? '已参与本周匹配' : '参与本周匹配'}
          </button>
        </div>
        {isParticipating && (
          <div className="relative h-56 sm:h-64 mb-8">
            {[
              { idx: coffeeCardIndex, title1: '蜜雪甜意', title2: '雪王加入中', image: '/雪王.png' },
              { idx: (coffeeCardIndex + 1) % 2, title1: 'LZU Coffee联名', title2: '"八分"咖啡，二分春色', image: '/lzucoffee.jpg' }
            ]
              .sort((a, b) => a.idx - b.idx)
              .reverse()
              .map((card, i) => {
                const depth = 1 - i;
                return (
                  <motion.div
                    key={`coffee-${card.title1}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{
                      opacity: 1,
                      y: depth * 12,
                      x: depth * 9,
                      scale: 1 - depth * 0.045,
                      rotate: depth * -1.25
                    }}
                    transition={{ duration: 0.22 }}
                    onClick={() => setShowCoffeeModal(true)}
                    className="absolute inset-0 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md cursor-pointer overflow-hidden shadow-xl hover:border-white/20 transition-colors"
                    style={{
                      zIndex: 30 - depth
                    }}
                  >
                    <img 
                      src={card.image}
                      alt={card.title1}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="relative z-10 h-full p-6 sm:p-8 pt-9 sm:pt-10 flex flex-col justify-start">
                      <h3 className="text-3xl font-bold italic text-white leading-tight">{card.title1}</h3>
                      <h3 className="text-3xl font-bold italic text-white leading-tight">{card.title2}</h3>
                    </div>
                    {depth === 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCoffeeCardIndex((coffeeCardIndex + 1) % 2);
                        }}
                        className="absolute bottom-4 right-4 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/40 bg-white/35 text-xs font-bold text-black hover:bg-white/50 transition-colors z-20"
                      >
                        <RefreshCw className="w-3 h-3" />
                        换一换
                      </button>
                    )}
                  </motion.div>
                );
              })}
          </div>
        )}

        {!isParticipating ? (
          <div className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 p-8 text-center mb-8 shadow-xl">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Heart className="w-8 h-8 text-gray-800" />
            </div>
            <h3 className="text-xl font-bold text-black mb-2">你当前未参与匹配</h3>
            <p className="text-gray-800 mb-6 font-medium">点击右上角按钮参与，每周四晚9点获取你的专属匹配。</p>
            <button
              onClick={toggleParticipation}
              className="px-8 py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-colors"
            >
              立即参与
            </button>
          </div>
        ) : matches.length === 0 ? (
          showFailedMatchScreen ? (
            <div className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 p-8 text-center mb-8 shadow-xl">
              <h3 className="text-2xl font-extrabold text-black mb-2">暂时还没有合适对象</h3>
              <p className="text-gray-800 mb-6 font-medium">缘分还在路上，不要着急。</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                <button
                  onClick={() => {
                    setShowFailedMatchScreen(false);
                  }}
                  className="px-6 py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-sm"
                >
                  等待下一轮
                </button>
                <button
                  onClick={() => {
                    setShowFailedMatchScreen(false);
                    toggleParticipation();
                  }}
                  className="px-6 py-3 bg-white/80 text-black border border-black hover:bg-black hover:text-white rounded-xl font-bold transition-colors shadow-sm"
                >
                  暂不匹配
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 p-8 text-center mb-8 shadow-xl">
              <h3 className="text-2xl font-extrabold text-black mb-2">等待下一次匹配</h3>
              <p className="text-gray-800 mb-2 font-medium">我们正在为你寻找最合适的人</p>
              <div className="mb-8 flex flex-col items-center">
                <span className="text-base text-gray-800 font-bold uppercase tracking-widest mb-2">距离下次匹配还有</span>
                <span className="text-4xl font-black text-black tabular-nums">{getNextMatchTime()}</span>
              </div>
              <div className="flex flex-col items-center gap-4">
                <button
                  onClick={() => setShowTrainModal(true)}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-black rounded-xl font-bold transition-colors inline-flex items-center gap-2 text-sm border border-white/10 shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  不妨和你的AI分身聊聊天吧
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="space-y-6 mb-8">
            {matches.map((match, index) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                key={match.uid} 
                className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 overflow-hidden shadow-xl"
              >
              <div className="flex flex-col sm:flex-row">
                <div className="w-full sm:w-48 h-48 sm:h-auto relative overflow-hidden bg-gray-100 shrink-0">
                  <img 
                    src={match.avatarUrl} 
                    alt={match.name} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {match.isDropMatch && (
                    <div className="absolute top-3 left-3 z-10 bg-black text-white text-xs font-bold px-3 py-1 rounded-full">
                      双向暗恋
                    </div>
                  )}
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-extrabold text-black">{match.name}</h3>
                      <div className="flex gap-1">
                        {match.gender && <span className="text-xs font-bold bg-gray-200 text-gray-700 px-2 py-1 rounded-md">{match.gender}</span>}
                        {match.grade && <span className="text-xs font-bold bg-gray-200 text-gray-700 px-2 py-1 rounded-md">{match.grade}</span>}
                        {match.college && <span className="text-xs font-bold bg-gray-200 text-gray-700 px-2 py-1 rounded-md">{match.college}</span>}
                      </div>
                    </div>
                    <div className="mb-4">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">自述展示面</span>
                      <p className="text-sm text-gray-700 italic font-medium">
                        "{match.displayProfile || match.bio || '这个人很神秘，什么都没写...'}"
                      </p>
                    </div>
                    
                    {match.compatibilityScore && (
                      <div className="mb-4">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-gray-800 uppercase tracking-widest">共鸣程度</span>
                          <span className="text-sm font-black text-black">{match.compatibilityScore}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-black rounded-full" 
                            style={{ width: `${match.compatibilityScore}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {match.aiReasoning && (
                      <div className="mb-4 bg-white/40 p-3 rounded-xl border border-white/20">
                        <span className="text-xs font-bold text-gray-800 uppercase tracking-widest block mb-1 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> 为什么推荐你们
                        </span>
                        <p className="text-sm text-gray-800 font-medium">
                          {match.aiReasoning}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="pt-4 border-t border-white/10">
                    <div className="flex flex-col gap-2">
                      {!revealedEmails[match.uid] ? (
                        <button
                          onClick={() => setRevealedEmails(prev => ({ ...prev, [match.uid]: true }))}
                          className="w-full py-3 bg-black text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 text-sm shadow-sm hover:bg-gray-800"
                        >
                          看看TA的邮箱
                        </button>
                      ) : (
                        <div className="w-full py-3 px-4 bg-gray-100 text-black rounded-xl font-bold flex flex-col items-center justify-center gap-2 text-sm border border-gray-200">
                          <div>{match.email}</div>
                          {match.wechat && (
                            <div className="text-xs font-normal text-gray-600 border-t border-gray-300 pt-2 w-full text-center">
                              微信号：{match.wechat}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {match.aiSummary ? (
                        <button
                          onClick={() => setActiveChatMatch(match)}
                          className="w-full py-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-black rounded-xl font-bold transition-colors flex items-center justify-center gap-2 text-sm border border-white/10 shadow-sm"
                        >
                          <MessageCircle className="w-4 h-4" />
                          不妨和TA的AI分身聊聊天吧
                        </button>
                      ) : (
                        <div className="w-full py-3 bg-white/5 backdrop-blur-sm text-gray-800 rounded-xl font-bold text-center text-sm border border-white/10">
                          对方未建立AI分身
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Feedback Section */}
              <div className="bg-white/10 backdrop-blur-sm p-4 border-t border-white/10 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900">你对这次匹配满意吗？</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleFeedback(match, 'unsatisfied')}
                    disabled={archiving}
                    className="px-4 py-2 bg-white/10 border border-white/10 text-gray-900 hover:bg-white/20 rounded-lg text-sm font-bold transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <X className="w-4 h-4" /> 不满意
                  </button>
                  <button 
                    onClick={() => handleFeedback(match, 'satisfied')}
                    disabled={archiving}
                    className="px-4 py-2 bg-black text-white hover:bg-gray-800 rounded-lg text-sm font-bold transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <Check className="w-4 h-4" /> 满意
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Bottom Modes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
        <div 
          onClick={() => setShowShootModal(true)}
          className="bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-xl hover:border-black transition-colors cursor-pointer group"
        >
          <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-4 group-hover:bg-black transition-colors shadow-sm">
            <Target className="w-6 h-6 text-black group-hover:text-white transition-colors" />
          </div>
          <h4 className="text-lg font-extrabold text-black mb-1">Shoot your shot</h4>
          <p className="text-sm text-gray-800 font-medium">暗恋模式：输入TA的邮箱，如果TA也填了你，双方即刻揭晓。</p>
        </div>
        
        <div 
          onClick={() => setShowCupidModal(true)}
          className="bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-xl hover:border-black transition-colors cursor-pointer group"
        >
          <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-4 group-hover:bg-black transition-colors shadow-sm">
            <Heart className="w-6 h-6 text-black group-hover:text-white transition-colors" />
          </div>
          <h4 className="text-lg font-extrabold text-black mb-1">CP嗑起来</h4>
          <p className="text-sm text-gray-800 font-medium">看到他们特别配？撮合你的朋友，当赛博月老</p>
        </div>
      </div>

      <div className="mt-4 mb-8">
        <div
          onClick={() => navigate('/buddies')}
          className="bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-xl hover:border-black transition-colors cursor-pointer group"
        >
          <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-4 group-hover:bg-black transition-colors shadow-sm">
            <Zap className="w-6 h-6 text-black group-hover:text-white transition-colors" />
          </div>
          <h4 className="text-lg font-extrabold text-black mb-1">找搭子</h4>
          <p className="text-sm text-gray-800 font-medium">游戏搭子、旅游搭子、吃饭搭子、周边玩搭子。点我进入发布和浏览。</p>
        </div>
      </div>

      {showShootModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20"
          onClick={() => setShowShootModal(false)}
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="bg-white/20 backdrop-blur-2xl border border-white/40 rounded-3xl p-8 max-w-md w-full shadow-2xl"
          >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-extrabold text-black">Shoot your shot</h3>
                <button onClick={() => setShowShootModal(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-800" />
                </button>
              </div>
              <p className="text-gray-800 mb-6 font-medium">输入你暗恋对象的校园邮箱。如果TA也在这里输入了你的邮箱，你们就会立刻匹配成功！</p>
              
              <form onSubmit={handleShoot} className="space-y-4">
                <div>
                  <input
                    type="email"
                    required
                    value={shootEmail}
                    onChange={(e) => setShootEmail(e.target.value)}
                    placeholder="TA的校园邮箱 (@lzu.edu.cn)"
                    className="w-full px-5 py-4 bg-white/20 border border-white/30 rounded-2xl focus:outline-none focus:border-black transition-colors text-black font-medium placeholder:text-gray-600"
                  />
                </div>
                <div>
                  <textarea
                    required
                    value={shootMessageText}
                    onChange={(e) => setShootMessageText(e.target.value)}
                    placeholder="留下一句话..."
                    rows={3}
                    className="w-full px-5 py-4 bg-white/20 border border-white/30 rounded-2xl focus:outline-none focus:border-black transition-colors text-black font-medium placeholder:text-gray-600 resize-none"
                  />
                </div>
                {modeMessage.text && (
                  <div className={`p-3 rounded-xl text-sm font-bold ${modeMessage.type === 'success' ? 'bg-green-500/20 text-green-900 border border-green-500/30' : 'bg-red-500/20 text-red-900 border border-red-500/30'}`}>
                    {modeMessage.text}
                  </div>
                )}
                <button type="submit" className="w-full py-4 bg-black text-white rounded-2xl font-bold hover:bg-gray-800 transition-colors shadow-lg">
                  发送暗恋
                </button>
              </form>
            </div>
          </div>
        )}

      {showCupidModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20"
          onClick={() => setShowCupidModal(false)}
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="bg-white/20 backdrop-blur-2xl border border-white/40 rounded-3xl p-8 max-w-md w-full shadow-2xl"
          >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-extrabold text-black">CP嗑起来</h3>
                <button onClick={() => setShowCupidModal(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-800" />
                </button>
              </div>
              <p className="text-gray-800 mb-6 font-medium">觉得身边的两个朋友很合适？来当当赛博月老</p>
              
              <form onSubmit={handleCupid} className="space-y-4">
                <div>
                  <input
                    type="email"
                    required
                    value={cupidEmail1}
                    onChange={(e) => setCupidEmail1(e.target.value)}
                    placeholder="朋友A的校园邮箱"
                    className="w-full px-5 py-4 bg-white/20 border border-white/30 rounded-2xl focus:outline-none focus:border-black transition-colors text-black font-medium placeholder:text-gray-600"
                  />
                </div>
                <div>
                  <input
                    type="email"
                    required
                    value={cupidEmail2}
                    onChange={(e) => setCupidEmail2(e.target.value)}
                    placeholder="朋友B的校园邮箱"
                    className="w-full px-5 py-4 bg-white/20 border border-white/30 rounded-2xl focus:outline-none focus:border-black transition-colors text-black font-medium placeholder:text-gray-600"
                  />
                </div>
                <div>
                  <textarea
                    required
                    value={cupidMessageText}
                    onChange={(e) => setCupidMessageText(e.target.value)}
                    placeholder="留下一句话..."
                    rows={3}
                    className="w-full px-5 py-4 bg-white/20 border border-white/30 rounded-2xl focus:outline-none focus:border-black transition-colors text-black font-medium placeholder:text-gray-600 resize-none"
                  />
                </div>
                {modeMessage.text && (
                  <div className={`p-3 rounded-xl text-sm font-bold ${modeMessage.type === 'success' ? 'bg-green-500/20 text-green-900 border border-green-500/30' : 'bg-red-500/20 text-red-900 border border-red-500/30'}`}>
                    {modeMessage.text}
                  </div>
                )}
                <button type="submit" className="w-full py-4 bg-black text-white rounded-2xl font-bold hover:bg-gray-800 transition-colors shadow-lg">
                  发送撮合
                </button>
              </form>
            </div>
          </div>
        )}

      {showTrainModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20"
          onClick={() => setShowTrainModal(false)}
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col h-[80vh] max-h-[800px]"
          >
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-lg font-bold text-black">训练你的AI分身</h3>
                <p className="text-xs text-gray-500 font-medium">多聊天能让它更懂你</p>
              </div>
              <button onClick={() => setShowTrainModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <AIChatOnboarding onSummaryGenerated={handleTrainAI} />
            </div>
          </div>
        </div>
      )}

      {showCoffeeModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setShowCoffeeModal(false)}
        >
          <motion.div 
            onClick={e => e.stopPropagation()}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="rounded-3xl w-full max-w-2xl shadow-2xl border border-white/20 p-[1px]"
          >
            <div
              className="rounded-[22px] overflow-hidden"
              style={{ backgroundImage: 'url(/lzucoffee.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
            >
              <div className="relative p-8">
                <h2 className="text-3xl font-bold italic text-white leading-tight">LZU Coffee联名</h2>
                <h2 className="text-3xl font-bold italic text-white leading-tight mb-3">十分真诚，“八分”融在咖啡，两分带给春色</h2>
                <p className="text-lg font-normal italic text-white leading-relaxed mt-3" style={{ textShadow: '0 1px 4px rgba(0, 0, 0, 0.9)' }}>
                  匹配成功的lzuer可与你的匹配伴侣一起凭证去lzu coffee享八折咖啡与附赠茶歇，外加活动哦！
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Stats Section */}
      <div className="mt-12 mb-8 text-center bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-xl">
        <h4 className="text-lg font-extrabold text-black mb-4">平台实时数据</h4>
        {/* 移动端纵向排列，桌面端横向排列 */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-0">
          <div className="flex-1 w-full flex flex-col items-center py-3 sm:py-0">
            <span className="text-3xl font-black text-black">{activeUsersCount}</span>
            <span className="text-xs font-bold text-gray-800 uppercase tracking-widest mt-1">参与匹配的同学</span>
          </div>

          {/* 移动端横线，桌面端竖线 */}
          <div className="w-24 h-px sm:w-px sm:h-12 bg-gray-500 sm:mx-6"></div>

          <div className="flex-1 w-full flex flex-col items-center py-3 sm:py-0">
            <span className="text-3xl font-black text-black">{matchedPairsCount}</span>
            <span className="text-xs font-bold text-gray-800 uppercase tracking-widest mt-1">成功匹配对数</span>
          </div>

          <div className="w-24 h-px sm:w-px sm:h-12 bg-gray-500 sm:mx-6"></div>

          <div className="flex-1 w-full flex flex-col items-center py-3 sm:py-0">
            <div className="flex items-center gap-3">
              <div className="relative w-20 h-20">
                <svg viewBox="0 0 64 64" className="w-20 h-20 -rotate-90">
                  <circle cx="32" cy="32" r={radius} fill="none" stroke="#E5E7EB" strokeWidth="8" />
                  {genderTotal > 0 && (
                    <>
                      <circle
                        cx="32"
                        cy="32"
                        r={radius}
                        fill="none"
                        stroke="#93C5FD"
                        strokeWidth="8"
                        strokeDasharray={`${maleStroke} ${circumference - maleStroke}`}
                        strokeLinecap="round"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r={radius}
                        fill="none"
                        stroke="#FFB6D9"
                        strokeWidth="8"
                        strokeDasharray={`${femaleStroke} ${circumference - femaleStroke}`}
                        strokeDashoffset={-maleStroke}
                        strokeLinecap="round"
                      />
                    </>
                  )}
                </svg>
              </div>
              <div className="text-base font-semibold text-gray-800">
                <div>男 {malePercent}%</div>
                <div>女 {femalePercent}%</div>
              </div>
            </div>
          </div>
        </div>
      </div>
        
      <AnimatePresence>
        {activeChatMatch && (
          <MatchAIChat
            matchUid={activeChatMatch.uid}
            matchName={activeChatMatch.name}
            displayProfile={activeChatMatch.displayProfile || activeChatMatch.bio || ''}
            aiSummary={activeChatMatch.aiSummary || ''}
            onClose={() => setActiveChatMatch(null)}
          />
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
