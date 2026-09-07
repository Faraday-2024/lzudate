import React, { useState, useEffect } from 'react';
import { db, auth } from '../cloudbase';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, MessageCircle, X, Bell } from 'lucide-react';
import MatchAIChat from './MatchAIChat';

interface ArchivedMatch {
  uid: string;
  name: string;
  avatarUrl: string;
  bio: string;
  email: string;
  displayProfile?: string;
  status: 'satisfied' | 'unsatisfied' | 'cupid' | 'shared_chat';
  archivedAt: string;
  college?: string;
  grade?: string;
  gender?: string;
  compatibilityScore?: number;
  aiReasoning?: string;
  aiSummary?: string;
  sharedMessages?: any[];
  voucherCode?: string;
  voucherUsed?: boolean;
  archivedMatchDocId?: string;
}

interface BuddyNotification {
  id: string;
  userId: string;
  type: 'post_comment' | 'comment_reply';
  postId: string;
  postTitle: string;
  commentAuthorName: string;
  commentAuthorUid: string;
  commentContent?: string;
  createdAt: string;
  read: boolean;
}

export default function Mailbox() {
  const [archived, setArchived] = useState<ArchivedMatch[]>([]);
  const [notifications, setNotifications] = useState<BuddyNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'matches' | 'notifications'>('matches');
  const [selectedMatch, setSelectedMatch] = useState<ArchivedMatch | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<BuddyNotification | null>(null);
  const [activeChatMatch, setActiveChatMatch] = useState<ArchivedMatch | null>(null);

  useEffect(() => {
    const fetchArchived = async () => {
      const loginState = await auth.getLoginState();
      if (!loginState) return;
      const currentUid = auth.currentUser?.uid;
      if (!currentUid) return;

      try {
        let currentEmail = '';
        const userRes = await db.collection('users').doc(currentUid).get();
        if (userRes.data && userRes.data.length > 0) {
          currentEmail = userRes.data[0].email || '';
        }

        const archivedRes = await db.collection('archived_matches').where({ userId: currentUid }).get();
        
        const profiles: ArchivedMatch[] = [];
        const archivedUids: string[] = [];
        
        for (const docSnap of archivedRes.data || []) {
          const data = docSnap;
          archivedUids.push(data.matchUid);
          const otherUserRes = await db.collection('users').doc(data.matchUid).get();
          if (otherUserRes.data && otherUserRes.data.length > 0) {
            const userData = otherUserRes.data[0];
            profiles.push({
              uid: userData.uid || userData._id,
              name: userData.name,
              avatarUrl: userData.avatarUrl,
              bio: userData.bio,
              email: userData.email,
              displayProfile: userData.displayProfile,
              status: data.status,
              archivedAt: data.archivedAt,
              college: userData.questionnaire?.college,
              grade: userData.questionnaire?.grade,
              gender: userData.questionnaire?.gender,
              compatibilityScore: data.compatibilityScore || Math.floor(Math.random() * 20) + 80,
              aiReasoning: data.aiReasoning || '你们在生活方式和价值观上有很高的契合度。',
              aiSummary: userData.aiSummary,
              voucherCode: data.voucherCode,
              voucherUsed: data.voucherUsed || false,
              archivedMatchDocId: data._id || data.id
            });
          }
        }

        const sharedChatsRes = await db.collection('shared_chats').where({ toUserId: currentUid }).get();
        
        for (const chatDoc of sharedChatsRes.data || []) {
          const data = chatDoc;
          const fromUserRes = await db.collection('users').doc(data.fromUserId).get();
          if (fromUserRes.data && fromUserRes.data.length > 0) {
            const userData = fromUserRes.data[0];
            profiles.push({
              uid: userData.uid || userData._id,
              name: userData.name,
              avatarUrl: userData.avatarUrl,
              bio: userData.bio,
              email: userData.email,
              displayProfile: userData.displayProfile,
              status: 'shared_chat',
              archivedAt: data.sharedAt || new Date().toISOString(),
              college: userData.questionnaire?.college,
              grade: userData.questionnaire?.grade,
              gender: userData.questionnaire?.gender,
              compatibilityScore: 99,
              aiReasoning: `TA刚刚和你的AI分身聊得很开心，并把聊天记录分享给了你！`,
              aiSummary: userData.aiSummary,
              sharedMessages: data.messages
            });
          }
        }

        if (currentEmail) {
          const cupidRes1 = await db.collection('cupid_matches').where({ email1: currentEmail }).get();
          const cupidRes2 = await db.collection('cupid_matches').where({ email2: currentEmail }).get();
          
          const allCupidDocs = [...(cupidRes1.data || []), ...(cupidRes2.data || [])];
          
          for (const cupidDoc of allCupidDocs) {
            const data = cupidDoc;
            const otherEmail = data.email1 === currentEmail ? data.email2 : data.email1;
            
            const usersRes = await db.collection('users').where({ email: otherEmail }).get();
            const matchedUserDoc = usersRes.data && usersRes.data.length > 0 ? usersRes.data[0] : null;
            
            if (matchedUserDoc) {
              const userData = matchedUserDoc;
              const targetUid = userData.uid || userData._id;
              if (!archivedUids.includes(targetUid) && !profiles.some(p => p.uid === targetUid)) {
                profiles.push({
                  uid: targetUid,
                  name: userData.name,
                  avatarUrl: userData.avatarUrl,
                  bio: userData.bio,
                  email: userData.email,
                  displayProfile: userData.displayProfile,
                  status: 'cupid',
                  archivedAt: data.createdAt || new Date().toISOString(),
                  college: userData.questionnaire?.college,
                  grade: userData.questionnaire?.grade,
                  gender: userData.questionnaire?.gender,
                  compatibilityScore: 99,
                  aiReasoning: `有神秘的“爱神”认为你们非常般配，并为你们牵线搭桥！\n爱神留言：${data.message || '无'}`,
                  aiSummary: userData.aiSummary
                });
              }
            }
          }
        }
        
        // Sort by archivedAt descending
        profiles.sort((a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime());
        setArchived(profiles);

        // Fetch buddy notifications
        const notificationsRes = await db.collection('buddy_notifications').where({ userId: currentUid }).orderBy('createdAt', 'desc').get();
        const notificationsList: BuddyNotification[] = [];
        
        for (const notifDoc of notificationsRes.data || []) {
          const data = notifDoc;
          notificationsList.push({
            id: data._id || data.id,
            userId: data.userId,
            type: data.type,
            postId: data.postId,
            postTitle: data.postTitle,
            commentAuthorName: data.commentAuthorName,
            commentAuthorUid: data.commentAuthorUid,
            commentContent: data.commentContent,
            createdAt: data.createdAt,
            read: data.read || false
          });
        }
        
        setNotifications(notificationsList);

        // 设置实时监听通知变化
        const notificationWatcher = db.collection('buddy_notifications').where({ userId: currentUid }).watch({
          onChange: async (snapshot: any) => {
            const updatedNotifications: BuddyNotification[] = [];
            const docs = snapshot.docs || [];
            
            for (const notifDoc of docs) {
              const data = notifDoc;
              updatedNotifications.push({
                id: data._id || data.id,
                userId: data.userId,
                type: data.type,
                postId: data.postId,
                postTitle: data.postTitle,
                commentAuthorName: data.commentAuthorName,
                commentAuthorUid: data.commentAuthorUid,
                commentContent: data.commentContent,
                createdAt: data.createdAt,
                read: data.read || false
              });
            }
            
            // 按时间倒序排列
            updatedNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setNotifications(updatedNotifications);
          },
          onError: (err: any) => {
            console.error('Notification watcher error:', err);
          }
        });

        return () => {
          if (notificationWatcher && typeof notificationWatcher.close === 'function') {
            notificationWatcher.close();
          }
        };
      } catch (err) {
        console.error("Error fetching archived matches:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchArchived();
  }, []);

  useEffect(() => {
    if (archived.length === 0) return;
    
    let watchers: any[] = [];
    
    const setupWatchers = async () => {
      for (const match of archived) {
        try {
          const watcher = db.collection('users').doc(match.uid).watch({
            onChange: (snapshot: any) => {
              if (snapshot.docs && snapshot.docs.length > 0) {
                const userData = snapshot.docs[0];
                setArchived(prevArchived => prevArchived.map(m => {
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
                
                setSelectedMatch(prevSelected => {
                  if (prevSelected && prevSelected.uid === match.uid) {
                    return {
                      ...prevSelected,
                      name: userData.name,
                      avatarUrl: userData.avatarUrl,
                      bio: userData.bio,
                      displayProfile: userData.displayProfile,
                      aiSummary: userData.aiSummary,
                    };
                  }
                  return prevSelected;
                });
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
      watchers.forEach(watcher => {
        if (watcher && typeof watcher.close === 'function') {
          watcher.close();
        }
      });
    };
  }, [archived.map(m => m.uid).join(',')]);

  const handleUseVoucher = async (match: ArchivedMatch) => {
    if (!match.archivedMatchDocId || match.voucherUsed) return;
    
    try {
      await db.collection('archived_matches').doc(match.archivedMatchDocId).update({
        voucherUsed: true
      });

      setSelectedMatch(prevMatch => {
        if (prevMatch && prevMatch.uid === match.uid) {
          return { ...prevMatch, voucherUsed: true };
        }
        return prevMatch;
      });

      setArchived(prevArchived => prevArchived.map(m => {
        if (m.uid === match.uid && m.archivedMatchDocId === match.archivedMatchDocId) {
          return { ...m, voucherUsed: true };
        }
        return m;
      }));
    } catch (err) {
      console.error("Error using voucher:", err);
    }
  };

  const handleMarkNotificationAsRead = async (notification: BuddyNotification) => {
    try {
      await db.collection('buddy_notifications').doc(notification.id).update({
        read: true
      });
      
      setNotifications(prev => prev.map(n => 
        n.id === notification.id ? { ...n, read: true } : n
      ));
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh]">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (archived.length === 0 && notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <h3 className="text-2xl font-extrabold text-black mb-2">信箱空空如也</h3>
        <p className="text-gray-500 font-medium">你的匹配记录和通知会出现在这里。</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold text-black tracking-tight">信箱</h2>
        <p className="text-gray-500 mt-2">匹配、通知、聊天记录</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('matches')}
          className={`pb-3 px-1 font-bold text-sm transition-colors ${
            activeTab === 'matches'
              ? 'text-black border-b-2 border-black'
              : 'text-gray-500 hover:text-black'
          }`}
        >
          匹配记录 ({archived.length})
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`pb-3 px-1 font-bold text-sm transition-colors flex items-center gap-2 ${
            activeTab === 'notifications'
              ? 'text-black border-b-2 border-black'
              : 'text-gray-500 hover:text-black'
          }`}
        >
          <Bell className="w-4 h-4" />
          通知 ({notifications.filter(n => !n.read).length})
        </button>
      </div>

      {/* Matches Tab */}
      {activeTab === 'matches' && (
        <div className="space-y-4">
          {archived.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 font-medium">暂无匹配记录</p>
            </div>
          ) : (
            archived.map((match, index) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            key={match.uid + match.archivedAt} 
            onClick={() => setSelectedMatch(match)}
            className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 shadow-sm cursor-pointer hover:border-gray-300 transition-colors"
          >
            <img 
              src={match.avatarUrl} 
              alt={match.name} 
              className="w-16 h-16 rounded-full object-cover bg-gray-100"
              referrerPolicy="no-referrer"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-black truncate">{match.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${match.status === 'satisfied' ? 'bg-green-100 text-green-700' : match.status === 'cupid' ? 'bg-pink-100 text-pink-700' : match.status === 'shared_chat' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                  {match.status === 'satisfied' ? '满意' : match.status === 'cupid' ? '爱神牵线' : match.status === 'shared_chat' ? '收到聊天记录' : '不满意'}
                </span>
              </div>
              <p className="text-sm text-gray-500 truncate mb-1">{match.displayProfile || match.bio}</p>
              <p className="text-xs font-medium text-gray-400 truncate">邮箱: {match.email}</p>
            </div>
          </motion.div>
            ))
          )}
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="space-y-4">
          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 font-medium">暂无通知</p>
            </div>
          ) : (
            notifications.map((notification, index) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                key={notification.id}
                onClick={() => {
                  setSelectedNotification(notification);
                  if (!notification.read) {
                    handleMarkNotificationAsRead(notification);
                  }
                }}
                className={`rounded-2xl border p-4 flex items-start gap-4 cursor-pointer transition-colors ${
                  notification.read
                    ? 'bg-white border-gray-100 hover:border-gray-300'
                    : 'bg-blue-50 border-blue-200 hover:border-blue-300'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                  notification.read ? 'bg-gray-100' : 'bg-blue-100'
                }`}>
                  <Bell className={`w-6 h-6 ${notification.read ? 'text-gray-600' : 'text-blue-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-black">
                    {notification.type === 'post_comment' 
                      ? `${notification.commentAuthorName} 评论了你的帖子`
                      : `${notification.commentAuthorName} 回复了你的评论`}
                  </h3>
                  <p className="text-sm text-gray-600 truncate mt-1">"{notification.postTitle}"</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(notification.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
                {!notification.read && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                )}
              </motion.div>
            ))
          )}
        </div>
      )}

      <AnimatePresence>
        {selectedMatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                <h3 className="font-bold text-lg">匹配详情</h3>
                <button onClick={() => setSelectedMatch(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="overflow-y-auto p-6">
                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="w-full sm:w-48 h-48 relative overflow-hidden rounded-2xl bg-gray-100 shrink-0">
                    <img 
                      src={selectedMatch.avatarUrl} 
                      alt={selectedMatch.name} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-extrabold text-black">{selectedMatch.name}</h3>
                      <div className="flex gap-1">
                        {selectedMatch.gender && <span className="text-xs font-bold bg-gray-200 text-gray-700 px-2 py-1 rounded-md">{selectedMatch.gender}</span>}
                        {selectedMatch.grade && <span className="text-xs font-bold bg-gray-200 text-gray-700 px-2 py-1 rounded-md">{selectedMatch.grade}</span>}
                        {selectedMatch.college && <span className="text-xs font-bold bg-gray-200 text-gray-700 px-2 py-1 rounded-md">{selectedMatch.college}</span>}
                      </div>
                    </div>
                    <div className="mb-4">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">自述展示面</span>
                      <p className="text-sm text-gray-700 italic font-medium">
                        "{selectedMatch.displayProfile || selectedMatch.bio || '这个人很神秘，什么都没写...'}"
                      </p>
                    </div>
                    
                    {selectedMatch.compatibilityScore && (
                      <div className="mb-4">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-gray-800 uppercase tracking-widest">共鸣程度</span>
                          <span className="text-sm font-black text-black">{selectedMatch.compatibilityScore}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-black rounded-full" 
                            style={{ width: `${selectedMatch.compatibilityScore}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {selectedMatch.aiReasoning && (
                      <div className="mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <span className="text-xs font-bold text-gray-800 uppercase tracking-widest block mb-1 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> 为什么推荐你们
                        </span>
                        <p className="text-sm text-gray-800 font-medium">
                          {selectedMatch.aiReasoning}
                        </p>
                      </div>
                    )}

                    {selectedMatch.status === 'shared_chat' && selectedMatch.sharedMessages && (
                      <div className="mb-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <span className="text-xs font-bold text-blue-800 uppercase tracking-widest block mb-3 flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" /> TA与你的AI分身的聊天记录
                        </span>
                        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                          {selectedMatch.sharedMessages.map((msg: any, idx: number) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm' : 'bg-blue-500 text-white rounded-br-sm'}`}>
                                <span className="text-[10px] opacity-50 block mb-0.5">{msg.role === 'user' ? selectedMatch.name : '你的AI分身'}</span>
                                {msg.text}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <div className="flex flex-col gap-3">
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-center">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">TA的邮箱</span>
                      <span className="text-black font-bold text-lg">{selectedMatch.email}</span>
                    </div>

                    {selectedMatch.status === 'satisfied' && selectedMatch.voucherCode && (
                      <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-4 rounded-xl border-2 border-amber-200 flex flex-col justify-center">
                        <span className="text-xs font-bold text-amber-700 uppercase tracking-widest block mb-2">☕ 咖啡核销码</span>
                        <div className="flex items-center justify-between gap-4 mb-3">
                          <span className="text-2xl font-black text-amber-900 tracking-widest font-mono">{selectedMatch.voucherCode}</span>
                          <button
                            onClick={() => handleUseVoucher(selectedMatch)}
                            disabled={selectedMatch.voucherUsed}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
                              selectedMatch.voucherUsed
                                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                : 'bg-amber-600 hover:bg-amber-700 text-white'
                            }`}
                          >
                            {selectedMatch.voucherUsed ? '✓ 已使用' : '使用'}
                          </button>
                        </div>
                        {selectedMatch.voucherUsed && (
                          <span className="text-xs text-amber-700 font-semibold">此核销码已被使用</span>
                        )}
                      </div>
                    )}
                    
                    {selectedMatch.aiSummary ? (
                      <button
                        onClick={() => setActiveChatMatch(selectedMatch)}
                        className="w-full py-4 bg-white hover:bg-gray-50 text-black rounded-xl font-bold transition-colors flex items-center justify-center gap-2 text-sm border-2 border-gray-100 shadow-sm"
                      >
                        <MessageCircle className="w-5 h-5" />
                        和TA的AI分身聊聊天
                      </button>
                    ) : (
                      <div className="w-full py-4 bg-gray-50 text-gray-500 rounded-xl font-bold text-center text-sm border border-gray-100">
                        对方未建立AI分身
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

      <AnimatePresence>
        {selectedNotification && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                <h3 className="font-bold text-lg">帖子评论</h3>
                <button onClick={() => setSelectedNotification(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="overflow-y-auto p-6 flex-1">
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Bell className="w-5 h-5 text-blue-600" />
                    <h3 className="font-bold text-lg">{selectedNotification.postTitle}</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    {selectedNotification.type === 'post_comment'
                      ? `${selectedNotification.commentAuthorName} 在你的帖子下留言了`
                      : `${selectedNotification.commentAuthorName} 回复了你的评论`}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(selectedNotification.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>

                <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200 mb-4">
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-widest block mb-2">评论内容</p>
                  <p className="text-sm text-gray-700 font-medium">{selectedNotification.commentContent || '（评论内容未加载）'}</p>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-6">
                  <p className="text-sm text-gray-700 font-medium">发送者：{selectedNotification.commentAuthorName}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedNotification.type === 'post_comment'
                      ? '点击下方按钮回到搭子页面查看完整评论及其他回复'
                      : '点击下方按钮回到搭子页面查看这条评论及回复'}
                  </p>
                </div>

                <div className="mt-6">
                  <button
                    onClick={() => {
                      setSelectedNotification(null);
                    }}
                    className="w-full py-3 bg-black hover:bg-gray-800 text-white rounded-xl font-bold transition-colors"
                  >
                    关闭
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
