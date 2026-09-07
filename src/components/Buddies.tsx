import React, { useEffect, useState } from 'react';
import { db, auth } from '../cloudbase';
import { motion, AnimatePresence } from 'motion/react';
import { Gamepad2, UtensilsCrossed, MapPinned, Compass, Plus, RefreshCw, X, MessageCircle, Send } from 'lucide-react';

type BuddyCategory = '游戏搭子' | '旅游搭子' | '吃饭搭子' | '周边玩搭子';

interface BuddyPost {
  id: string;
  uid: string;
  category: BuddyCategory;
  title: string;
  content: string;
  createdAt: string;
  expiresAt: string;
  name: string;
  avatarUrl: string;
  grade?: string;
  college?: string;
  wechat?: string;
}

interface BuddyComment {
  id: string;
  postId: string;
  uid: string;
  content: string;
  createdAt: string;
  name: string;
  avatarUrl: string;
  parentCommentId?: string;
  parentCommentAuthorName?: string;
}

function normalizeId(id: any): string {
  if (!id) return '';
  if (typeof id === 'string') return id;
  if (typeof id === 'object' && typeof id.$oid === 'string') return id.$oid;
  return String(id);
}

const CATEGORIES: Array<{ label: BuddyCategory; icon: any }> = [
  { label: '游戏搭子', icon: Gamepad2 },
  { label: '旅游搭子', icon: MapPinned },
  { label: '吃饭搭子', icon: UtensilsCrossed },
  { label: '周边玩搭子', icon: Compass }
];

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '刚刚';

  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))}分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)}小时前`;
  return `${Math.floor(diff / day)}天前`;
}

export default function Buddies() {
  const [posts, setPosts] = useState<BuddyPost[]>([]);
  const [comments, setComments] = useState<BuddyComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<BuddyPost | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishingComment, setPublishingComment] = useState(false);
  const [error, setError] = useState('');
  const [commentError, setCommentError] = useState('');
  const [commentInput, setCommentInput] = useState('');
  const [toast, setToast] = useState('');
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [categoryCursor, setCategoryCursor] = useState<Record<BuddyCategory, number>>({
    游戏搭子: 0,
    旅游搭子: 0,
    吃饭搭子: 0,
    周边玩搭子: 0
  });

  const [form, setForm] = useState({
    category: '游戏搭子' as BuddyCategory,
    title: '',
    content: ''
  });

  const fetchPosts = async () => {
    setLoading(true);
    setError('');

    const loginState = await auth.getLoginState();
    if (!loginState) {
      setLoading(false);
      return;
    }

    try {
      const res = await db.collection('buddy_posts').orderBy('createdAt', 'desc').limit(80).get();
      const raw = res.data || [];
      const now = Date.now();
      const threeDaysMs = 5 * 24 * 60 * 60 * 1000;

      const valid = raw.filter((d: any) => {
        const expiresAt = new Date(d.expiresAt).getTime();
        if (!Number.isNaN(expiresAt)) return expiresAt > now;

        const createdAt = new Date(d.createdAt).getTime();
        return !Number.isNaN(createdAt) && createdAt + threeDaysMs > now;
      });

      const userCache: Record<string, any> = {};
      const hydrated: BuddyPost[] = [];

      for (const doc of valid) {
        const uid = doc.uid;
        if (!uid) continue;
        const postId = normalizeId(doc._id);
        if (!postId) continue;

        if (!userCache[uid]) {
          const userRes = await db.collection('users').doc(uid).get();
          userCache[uid] = userRes.data && userRes.data.length > 0 ? userRes.data[0] : null;
        }

        const user = userCache[uid];
        const fallbackName = `同学${uid.slice(-4)}`;

        hydrated.push({
          id: postId,
          uid,
          category: doc.category,
          title: doc.title,
          content: doc.content,
          createdAt: doc.createdAt,
          expiresAt: doc.expiresAt,
          name: user?.name || fallbackName,
          avatarUrl: user?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
          grade: user?.questionnaire?.grade,
          college: user?.questionnaire?.college,
          wechat: user?.questionnaire?.wechat
        });
      }

      setPosts(hydrated);
    } catch (err) {
      console.error('Failed to fetch buddy posts:', err);
      setError('加载失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchComments = async (postId: string) => {
    setCommentsLoading(true);
    setCommentError('');
    try {
      const res = await db.collection('buddy_comments').where({ postId }).limit(100).get();
      const raw = res.data || [];
      const userCache: Record<string, any> = {};
      const hydrated: BuddyComment[] = [];

      for (const doc of raw) {
        const uid = doc.uid;
        if (!uid) continue;
        const commentId = normalizeId(doc._id);
        if (!commentId) continue;

        if (!userCache[uid]) {
          const userRes = await db.collection('users').doc(uid).get();
          userCache[uid] = userRes.data && userRes.data.length > 0 ? userRes.data[0] : null;
        }

        const user = userCache[uid];
        hydrated.push({
          id: commentId,
          postId,
          uid,
          content: doc.content || '',
          createdAt: doc.createdAt || new Date().toISOString(),
          name: user?.name || `同学${uid.slice(-4)}`,
          avatarUrl: user?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
          parentCommentId: doc.parentCommentId,
          parentCommentAuthorName: doc.parentCommentAuthorName
        });
      }

      hydrated.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setComments(hydrated);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setCommentError(`评论加载失败：${msg}`);
    } finally {
      setCommentsLoading(false);
    }
  };

  const openPostDetail = async (post: BuddyPost) => {
    setSelectedPost(post);
    setCommentInput('');
    await fetchComments(post.id);
  };

  const getCategoryPosts = (category: BuddyCategory) => {
    return posts.filter((p) => p.category === category);
  };

  const getStackPosts = (category: BuddyCategory, size = 3) => {
    const list = getCategoryPosts(category);
    if (list.length === 0) return [];
    const start = categoryCursor[category] % list.length;
    const output: BuddyPost[] = [];
    for (let i = 0; i < Math.min(size, list.length); i += 1) {
      output.push(list[(start + i) % list.length]);
    }
    return output;
  };

  const handleNextInCategory = (category: BuddyCategory) => {
    const list = getCategoryPosts(category);
    if (list.length <= 1) return;
    setCategoryCursor((prev) => ({ ...prev, [category]: (prev[category] + 1) % list.length }));
  };

  const handlePublishComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPost) return;

    const loginState = await auth.getLoginState();
    if (!loginState) {
      setCommentError('请先登录后再评论。');
      return;
    }
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setCommentError('账号状态异常，请重新登录后重试。');
      return;
    }

    const content = commentInput.trim();
    if (!content) {
      setCommentError('评论内容不能为空。');
      return;
    }

    if (content.length > 300) {
      setCommentError('评论最多 300 字。');
      return;
    }

    setPublishingComment(true);
    setCommentError('');

    try {
      const createdAt = new Date().toISOString();
      const currentUserRes = await db.collection('users').doc(uid).get();
      const commentAuthorName = currentUserRes.data && currentUserRes.data.length > 0 
        ? currentUserRes.data[0].name 
        : `同学${uid.slice(-4)}`;

      const commentData: any = {
        postId: selectedPost.id,
        uid,
        content,
        createdAt
      };

      // 如果在回复某条评论
      if (replyingToCommentId) {
        const parentComment = comments.find(c => c.id === replyingToCommentId);
        if (parentComment) {
          commentData.parentCommentId = replyingToCommentId;
          commentData.parentCommentAuthorName = parentComment.name;
        }
      }

      const addRes = await db.collection('buddy_comments').add(commentData);

      // 创建通知给帖子作者（如果评论者不是帖子作者）
      if (selectedPost.uid !== uid) {
        await db.collection('buddy_notifications').add({
          userId: selectedPost.uid,
          type: 'post_comment',
          postId: selectedPost.id,
          postTitle: selectedPost.title,
          commentAuthorName,
          commentAuthorUid: uid,
          commentContent: content,
          createdAt,
          read: false
        });
      }

      // 创建通知给被回复的评论者
      if (replyingToCommentId) {
        const parentComment = comments.find(c => c.id === replyingToCommentId);
        if (parentComment && parentComment.uid !== uid) {
          await db.collection('buddy_notifications').add({
            userId: parentComment.uid,
            type: 'comment_reply',
            postId: selectedPost.id,
            postTitle: selectedPost.title,
            commentAuthorName,
            commentAuthorUid: uid,
            commentContent: content,
            createdAt,
            read: false
          });
        }
      }

      const optimisticId = normalizeId((addRes as any)?._id) || `local-${Date.now()}`;
      const parentComment = comments.find(c => c.id === replyingToCommentId);
      const optimistic: BuddyComment = {
        id: optimisticId,
        postId: selectedPost.id,
        uid,
        content,
        createdAt,
        name: auth.currentUser?.customUserInfo?.name || `同学${uid.slice(-4)}`,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
        parentCommentId: replyingToCommentId,
        parentCommentAuthorName: parentComment?.name
      };

      setComments((prev) => {
        const next = prev.concat(optimistic);
        next.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        return next;
      });
      setCommentInput('');
      setReplyingToCommentId(null);

      // Refresh from server for authoritative data, but do not break UI if query is temporarily inconsistent.
      fetchComments(selectedPost.id).catch(() => undefined);
    } catch (err) {
      console.error('Failed to publish comment:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setCommentError(`评论发布失败：${msg}`);
    } finally {
      setPublishingComment(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const loginState = await auth.getLoginState();
    if (!loginState) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const title = form.title.trim();
    const content = form.content.trim();

    if (!title || title.length < 4) {
      setError('标题至少 4 个字。');
      return;
    }

    if (!content || content.length < 10) {
      setError('内容至少 10 个字。');
      return;
    }

    setPublishing(true);
    try {
      const now = new Date();
      const expires = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

      await db.collection('buddy_posts').add({
        uid,
        category: form.category,
        title,
        content,
        createdAt: now.toISOString(),
        expiresAt: expires.toISOString()
      });

      setShowCreateModal(false);
      setForm({ category: '游戏搭子', title: '', content: '' });
      setToast('发布成功，内容将在 5 天后自动过期。');
      setTimeout(() => setToast(''), 2800);
      await fetchPosts();
    } catch (err) {
      console.error('Failed to publish buddy post:', err);
      setError('发布失败，请稍后再试。');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-28 min-h-[80vh] p-6 rounded-3xl relative overflow-hidden">
      <div className="relative z-10">
        <div className="mb-7">
          <h2 className="text-3xl font-extrabold text-black tracking-tight">找搭子</h2>
          <p className="text-gray-700 mt-1 font-medium">游戏、旅游、吃饭、周边玩，找到同频的人一起出发。</p>
        </div>

        {loading ? (
          <div className="flex flex-col justify-center items-center h-[40vh]">
            <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 p-8 text-center shadow-xl">
            <h3 className="text-2xl font-extrabold text-black mb-2">还没有新的搭子帖</h3>
            <p className="text-gray-800 font-medium">先发一条吧，5 天内都能被看到。</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
              {CATEGORIES.map((c) => c.label).map((category) => {
                const stackPosts = getStackPosts(category);
                const topPost = stackPosts[0];
                const Icon = CATEGORIES.find((c) => c.label === category)?.icon || Compass;

                if (!topPost) {
                  return (
                    <div
                      key={category}
                      className="rounded-3xl border border-white/20 bg-white/10 backdrop-blur-xl h-[270px] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
                    >
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/35 rounded-full text-sm font-bold text-black border border-white/40 mb-4">
                        <Icon className="w-4 h-4" />
                        {category}
                      </div>
                      <p className="text-sm font-semibold text-gray-700">这个分类暂时还没有帖子，发一条试试。</p>
                    </div>
                  );
                }

                return (
                  <div key={category} className="relative h-[270px]">
                    {stackPosts
                      .map((post, i) => ({ post, i }))
                      .reverse()
                      .map(({ post, i }) => {
                        const depth = stackPosts.length - 1 - i;
                        return (
                          <motion.div
                            key={`${category}-${post.id}-${depth}`}
                            initial={{ opacity: 0, y: 8, scale: 0.98 }}
                            animate={{
                              opacity: 1,
                              y: depth * 12,
                              x: depth * 9,
                              scale: 1 - depth * 0.045,
                              rotate: depth * -1.25
                            }}
                            transition={{ duration: 0.22 }}
                            className="absolute inset-0 rounded-3xl border border-white/20 bg-white/12 backdrop-blur-xl p-5"
                            style={{
                              zIndex: 30 - depth,
                              boxShadow:
                                depth === 0
                                  ? '0 22px 46px rgba(0,0,0,0.24), -10px 0 22px rgba(0,0,0,0.14)'
                                  : '0 18px 30px rgba(0,0,0,0.18), -8px 0 18px rgba(0,0,0,0.11)'
                            }}
                            onClick={() => {
                              if (depth === 0) openPostDetail(post);
                            }}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/35 rounded-full text-xs font-bold text-black border border-white/40">
                                <Icon className="w-3.5 h-3.5" />
                                {category}
                              </div>
                              <span className="text-[11px] font-bold text-gray-700">{formatTime(post.createdAt)}</span>
                            </div>

                            <h3 className="text-lg font-extrabold text-black line-clamp-2 mb-2">{post.title}</h3>
                            <p className="text-sm text-gray-900 leading-relaxed line-clamp-3 mb-4">{post.content}</p>

                            <div className="absolute left-5 right-5 bottom-4 flex items-center gap-2">
                              <img
                                src={post.avatarUrl}
                                alt={post.name}
                                className="w-8 h-8 rounded-full object-cover border border-white/60"
                                referrerPolicy="no-referrer"
                              />
                              <div className="flex-1 min-w-0 text-xs font-semibold text-gray-800 truncate">{post.name}</div>
                              {depth === 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleNextInCategory(category);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/40 bg-white/35 text-xs font-bold text-black hover:bg-white/50 transition-colors"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  换一换
                                </button>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mb-4 rounded-2xl border border-green-500/30 bg-green-500/20 text-green-900 p-3 text-sm font-bold"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="fixed left-1/2 -translate-x-1/2 bottom-20 sm:bottom-8 z-40 w-[calc(100%-2rem)] max-w-xl">
        <button
          onClick={() => {
            setError('');
            setShowCreateModal(true);
          }}
          className="w-full py-4 rounded-2xl bg-white/15 backdrop-blur-2xl border border-white/30 text-black font-extrabold shadow-xl hover:bg-white/25 transition-colors inline-flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          发布找搭子
        </button>
      </div>

      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-white/20 backdrop-blur-2xl border border-white/40 rounded-3xl p-7 max-w-lg w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-2xl font-extrabold text-black">发布找搭子</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-800" />
              </button>
            </div>

            <form onSubmit={handlePublish} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">类型</label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      type="button"
                      key={cat.label}
                      onClick={() => setForm((prev) => ({ ...prev, category: cat.label }))}
                      className={`py-2.5 rounded-xl border text-sm font-bold transition-colors ${
                        form.category === cat.label
                          ? 'bg-black text-white border-black'
                          : 'bg-white/20 text-black border-white/30 hover:bg-white/35'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">标题</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="例如：周日想去兰大榆中校区散步，来个轻松搭子"
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl focus:outline-none focus:border-black text-black placeholder:text-gray-600 font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">内容</label>
                <textarea
                  rows={4}
                  value={form.content}
                  onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                  placeholder="写上时间、地点、偏好，比如：想找会玩金铲铲的同学，周末晚上都可以。"
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl focus:outline-none focus:border-black text-black placeholder:text-gray-600 font-medium resize-none"
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl text-sm font-bold bg-red-500/20 text-red-900 border border-red-500/30">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={publishing}
                className="w-full py-3.5 bg-black text-white rounded-2xl font-bold hover:bg-gray-800 transition-colors disabled:opacity-60"
              >
                {publishing ? '发布中...' : '确认发布（保留 5 天）'}
              </button>
            </form>
          </div>
        </div>
      )}

      {selectedPost && (
        <div
          className="fixed inset-0 z-50 bg-white/10 backdrop-blur-md p-4 flex items-center justify-center"
          onClick={() => {
            setSelectedPost(null);
            setCommentError('');
          }}
        >
          <div
            className="w-full max-w-2xl h-[88vh] rounded-3xl border border-white/35 bg-white/18 backdrop-blur-2xl shadow-[0_30px_80px_rgba(0,0,0,0.35)] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 帖子信息头部 - 不滚动 */}
            <div className="p-6 border-b border-white/25 flex-shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/35 rounded-full text-xs font-bold text-black border border-white/40 mb-3">
                    {(() => {
                      const Icon = CATEGORIES.find((c) => c.label === selectedPost.category)?.icon || Compass;
                      return <Icon className="w-3.5 h-3.5" />;
                    })()}
                    {selectedPost.category}
                  </div>
                  <h3 className="text-2xl font-extrabold text-black leading-tight mb-2">{selectedPost.title}</h3>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">{selectedPost.content}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPost(null)}
                  className="p-2 rounded-full hover:bg-white/25 transition-colors flex-shrink-0"
                >
                  <X className="w-5 h-5 text-gray-800" />
                </button>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs text-gray-800">
                <img
                  src={selectedPost.avatarUrl}
                  alt={selectedPost.name}
                  className="w-8 h-8 rounded-full object-cover border border-white/60"
                  referrerPolicy="no-referrer"
                />
                <span className="font-bold">{selectedPost.name}</span>
                <span className="text-gray-600">·</span>
                <span>{formatTime(selectedPost.createdAt)}</span>
              </div>
            </div>

            {/* 评论区 - 可滚动 */}
            <div className="p-6 overflow-y-auto flex-1 min-h-0">
              <div className="flex items-center gap-2 mb-4 text-sm font-bold text-black">
                <MessageCircle className="w-4 h-4" />
                评论 {comments.length}
              </div>

              {commentsLoading ? (
                <div className="text-sm text-gray-700 font-medium">评论加载中...</div>
              ) : comments.length === 0 ? (
                <div className="text-sm text-gray-700 font-medium">还没有评论，来当第一个发言的人吧。</div>
              ) : (
                <div className="space-y-3">
                  {comments.map((item) => (
                    <div key={item.id} className={`rounded-2xl border ${item.parentCommentId ? 'border-blue-300 bg-blue-50/40' : 'border-white/30 bg-white/20'} p-3`}>
                      {item.parentCommentId && item.parentCommentAuthorName && (
                        <div className="mb-2.5 p-2 rounded-lg bg-white/40 border-l-2 border-blue-400 text-xs text-gray-800 font-medium">
                          <span className="font-bold text-blue-700">回复 @{item.parentCommentAuthorName}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <img
                            src={item.avatarUrl}
                            alt={item.name}
                            className="w-7 h-7 rounded-full object-cover border border-white/60"
                            referrerPolicy="no-referrer"
                          />
                          <span className="text-xs font-bold text-black">{item.name}</span>
                          <span className="text-[11px] text-gray-600">{formatTime(item.createdAt)}</span>
                        </div>
                        <button
                          onClick={() => setReplyingToCommentId(item.id)}
                          className="text-xs text-blue-600 hover:text-blue-700 font-bold px-2 py-1 rounded hover:bg-white/20 transition-colors"
                        >
                          回复
                        </button>
                      </div>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{item.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {commentError && (
                <div className="mt-3 p-2.5 rounded-xl text-xs font-bold bg-red-500/20 text-red-900 border border-red-500/30">
                  {commentError}
                </div>
              )}
            </div>

            {/* 评论框 - 始终底部 */}
            <form onSubmit={handlePublishComment} className="p-5 border-t border-white/25 bg-white/10 flex-shrink-0">
              {replyingToCommentId && (
                <div className="mb-3 p-2.5 rounded-lg bg-blue-100/40 border border-blue-300 flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-800">
                    正在回复 @{comments.find(c => c.id === replyingToCommentId)?.name || '用户'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setReplyingToCommentId(null)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-bold px-2 py-1"
                  >
                    ✕ 取消回复
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder={replyingToCommentId ? "回复 @" + (comments.find(c => c.id === replyingToCommentId)?.name || '用户') + "..." : "写下你的评论..."}
                  className="flex-1 px-4 py-3 bg-white/25 border border-white/35 rounded-xl focus:outline-none focus:border-black text-sm text-black placeholder:text-gray-600 font-medium"
                />
                <button
                  type="submit"
                  disabled={publishingComment}
                  className="px-4 py-3 rounded-xl bg-black text-white text-sm font-bold hover:bg-gray-800 transition-colors disabled:opacity-60 inline-flex items-center gap-2 flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                  {publishingComment ? '发送中' : '发送'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
