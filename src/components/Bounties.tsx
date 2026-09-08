import React, { useEffect, useState } from 'react';
import { db, auth } from '../cloudbase';
import { BadgeHelp, Check, Heart, Plus, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Tab = 'bounties' | 'bodyguards';

interface Bounty {
  id: string;
  uid: string;
  title: string;
  description: string;
  contact: string;
  status: 'open' | 'solved';
  createdAt: string;
  authorName: string;
  authorAvatarUrl: string;
  authorEmail: string;
}

interface Bodyguard {
  id: string;
  uid: string;
  name: string;
  avatarUrl: string;
  skills: string;
  description: string;
  contact: string;
  updatedAt: string;
  likeCount: number;
  liked: boolean;
}

interface BountyComment {
  id: string;
  uid: string;
  content: string;
  createdAt: string;
  name: string;
  avatarUrl: string;
}

function normalizeId(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && typeof value.$oid === 'string') return value.$oid;
  return String(value);
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '刚刚';
  const diff = Date.now() - date.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.floor(diff / (60 * 1000)))}分钟前`;
  if (diff < day) return `${Math.floor(diff / (60 * 60 * 1000))}小时前`;
  return `${Math.floor(diff / day)}天前`;
}

export default function Bounties() {
  const [tab, setTab] = useState<Tab>('bounties');
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [bodyguards, setBodyguards] = useState<Bodyguard[]>([]);
  const [selectedBounty, setSelectedBounty] = useState<Bounty | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<Bounty | null>(null);
  const [bountyComments, setBountyComments] = useState<BountyComment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showBountyModal, setShowBountyModal] = useState(false);
  const [showBodyguardModal, setShowBodyguardModal] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [bountyForm, setBountyForm] = useState({ title: '', description: '', reward: '', contact: '' });
  const [bodyguardForm, setBodyguardForm] = useState({ skills: '', description: '', contact: '' });

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [bountyRes, bodyguardRes] = await Promise.all([
        db.collection('bounties').orderBy('createdAt', 'desc').limit(100).get(),
        db.collection('dartPersons').orderBy('updatedAt', 'desc').limit(100).get()
      ]);

      const userCache: Record<string, any> = {};
      const getUser = async (uid: string) => {
        if (!userCache[uid]) {
          const result = await db.collection('users').doc(uid).get();
          userCache[uid] = result.data?.[0] || null;
        }
        return userCache[uid];
      };

      const nextBounties: Bounty[] = [];
      for (const doc of bountyRes.data || []) {
        const uid = doc.uid || doc.authorId;
        const user = await getUser(uid);
        nextBounties.push({
          id: normalizeId(doc._id),
          uid,
          title: doc.title || '',
          description: doc.description || '',
          contact: doc.contact || doc.reward || '',
          status: doc.status === 'solved' ? 'solved' : 'open',
          createdAt: doc.createdAt || new Date().toISOString(),
          authorName: user?.name || `同学${String(uid).slice(-4)}`,
          authorAvatarUrl: user?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
          authorEmail: user?.email || ''
        });
      }

      const nextBodyguards: Bodyguard[] = [];
      for (const doc of bodyguardRes.data || []) {
        const uid = doc.uid;
        const user = await getUser(uid);
        const likesRes = await db.collection('likes').where({ toUserId: uid }).count();
        const likedRes = auth.currentUser?.uid
          ? await db.collection('likes').doc(`${auth.currentUser.uid}_${uid}`).get()
          : { data: [] };
        nextBodyguards.push({
          id: normalizeId(doc._id),
          uid,
          name: user?.name || `同学${String(uid).slice(-4)}`,
          avatarUrl: user?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
          skills: doc.skills || '',
          description: doc.description || '',
          contact: doc.contact || user?.questionnaire?.wechat || user?.email || '',
          updatedAt: doc.updatedAt || new Date().toISOString(),
          likeCount: likesRes.total || 0,
          liked: !!likedRes.data?.length
        });
      }

      setBounties(nextBounties);
      setBodyguards(nextBodyguards);
    } catch (err) {
      console.error('Failed to fetch bounty data:', err);
      setError('揭榜内容加载失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openBounty = async (bounty: Bounty) => {
    setSelectedBounty(bounty);
    setCommentInput('');
    setCommentsLoading(true);
    try {
      const result = await db.collection('bountyComments').where({ bountyId: bounty.id }).limit(100).get();
      const comments: BountyComment[] = [];
      for (const doc of result.data || []) {
        const userRes = await db.collection('users').doc(doc.uid).get();
        const user = userRes.data?.[0];
        comments.push({
          id: normalizeId(doc._id),
          uid: doc.uid,
          content: doc.content || '',
          createdAt: doc.createdAt || new Date().toISOString(),
          name: user?.name || `同学${String(doc.uid).slice(-4)}`,
          avatarUrl: user?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${doc.uid}`
        });
      }
      comments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setBountyComments(comments);
    } catch (err) {
      console.error('Failed to fetch bounty comments:', err);
      setError('悬赏评论加载失败，请稍后重试。');
    } finally {
      setCommentsLoading(false);
    }
  };

  const publishBountyComment = async (event: React.FormEvent) => {
    event.preventDefault();
    const uid = auth.currentUser?.uid;
    const content = commentInput.trim();
    if (!uid || !selectedBounty || !content) return;
    try {
      const createdAt = new Date().toISOString();
      const result = await db.collection('bountyComments').add({ bountyId: selectedBounty.id, uid, content, createdAt });
      const userRes = await db.collection('users').doc(uid).get();
      setBountyComments((current) => current.concat({
        id: normalizeId((result as any)?._id) || `local-${Date.now()}`,
        uid,
        content,
        createdAt,
        name: userRes.data?.[0]?.name || `同学${uid.slice(-4)}`,
        avatarUrl: userRes.data?.[0]?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`
      }));
      setCommentInput('');
    } catch (err) {
      console.error('Failed to publish bounty comment:', err);
      setError('评论发布失败，请稍后重试。');
    }
  };

  const publishBounty = async (event: React.FormEvent) => {
    event.preventDefault();
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const title = bountyForm.title.trim();
    const description = bountyForm.description.trim();
    if (!title || !description) {
      setError('请填写悬赏标题和问题描述。');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await db.collection('bounties').add({
        uid,
        title,
        description,
        contact: bountyForm.reward.trim(),
        status: 'open',
        createdAt: new Date().toISOString()
      });
      setBountyForm({ title: '', description: '', reward: '', contact: '' });
      setShowBountyModal(false);
      setToast('悬赏发布成功，等懂的 lzuer 来揭榜。');
      await fetchData();
    } catch (err) {
      console.error('Failed to publish bounty:', err);
      setError('悬赏发布失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  };

  const saveBodyguard = async (event: React.FormEvent) => {
    event.preventDefault();
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const skills = bodyguardForm.skills.trim();
    const description = bodyguardForm.description.trim();
    const contact = bodyguardForm.contact.trim();
    if (!skills || !description || !contact) {
      setError('请填写特长、个人介绍和联系方式。');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const existing = bodyguards.find((item) => item.uid === uid);
      const data = { uid, skills, description, contact, updatedAt: new Date().toISOString() };
      if (existing) {
        await db.collection('dartPersons').doc(existing.id).update(data);
      } else {
        await db.collection('dartPersons').add(data);
      }
      setShowBodyguardModal(false);
      setToast('镖人信息已更新，其他 lzuer 可以找到你了。');
      await fetchData();
    } catch (err) {
      console.error('Failed to save bodyguard profile:', err);
      setError('镖人信息保存失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  };

  const markSolved = async (bounty: Bounty) => {
    if (bounty.status === 'solved') return;
    try {
      await db.collection('bounties').doc(bounty.id).update({ status: 'solved' });
      setBounties((current) => current.map((item) => item.id === bounty.id ? { ...item, status: 'solved' } : item));
    } catch (err) {
      console.error('Failed to mark bounty solved:', err);
      setError('更新悬赏状态失败，请稍后重试。');
    }
  };

  const openMyBodyguard = () => {
    const mine = bodyguards.find((item) => item.uid === auth.currentUser?.uid);
    setBodyguardForm({
      skills: mine?.skills || '',
      description: mine?.description || '',
      contact: mine?.contact || ''
    });
    setShowBodyguardModal(true);
  };

  const toggleLike = async (person: Bodyguard) => {
    const uid = auth.currentUser?.uid;
    if (!uid || uid === person.uid) return;
    const likeId = `${uid}_${person.uid}`;
    try {
      if (person.liked) {
        await db.collection('likes').doc(likeId).remove();
      } else {
        await db.collection('likes').doc(likeId).set({ fromUserId: uid, toUserId: person.uid, createdAt: new Date().toISOString() });
      }
      setBodyguards((current) => current.map((item) => item.id === person.id ? { ...item, liked: !item.liked, likeCount: item.likeCount + (item.liked ? -1 : 1) } : item));
    } catch (err) {
      console.error('Failed to toggle dart person like:', err);
      setError('点赞操作失败，请稍后重试。');
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-28 min-h-[80vh] p-6 rounded-3xl relative overflow-hidden">
      <div className="relative z-10">
        <div className="mb-8">
          <h2 className="text-3xl font-extrabold text-black tracking-tight">揭榜</h2>
          <p className="text-gray-700 mt-1 font-medium">让会解决问题的人和需要帮助的人，在这里遇见。</p>
        </div>

        <div className="flex gap-2 mb-7 p-1 bg-white/20 rounded-2xl border border-white/30 max-w-md">
          <button onClick={() => setTab('bounties')} className={`flex-1 py-3 rounded-xl font-bold transition-colors ${tab === 'bounties' ? 'bg-black text-white' : 'text-gray-700 hover:bg-white/30'}`}><BadgeHelp className="inline w-4 h-4 mr-2" />悬赏</button>
          <button onClick={() => setTab('bodyguards')} className={`flex-1 py-3 rounded-xl font-bold transition-colors ${tab === 'bodyguards' ? 'bg-black text-white' : 'text-gray-700 hover:bg-white/30'}`}><Search className="inline w-4 h-4 mr-2" />镖人</button>
        </div>

        {error && <div className="mb-5 rounded-xl bg-red-50 border border-red-100 p-4 text-sm text-red-600 font-medium">{error}</div>}
        {toast && <div className="mb-5 rounded-xl bg-green-50 border border-green-100 p-4 text-sm text-green-800 font-bold">{toast}</div>}

        {tab === 'bounties' ? (
          <section>
            <div className="mb-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <p className="text-xl font-extrabold text-black mb-1">遇到了问题？问懂的 lzuer</p>
              </div>
              <button onClick={() => setShowBountyModal(true)} className="px-5 py-3 bg-black text-white rounded-xl font-bold inline-flex items-center justify-center gap-2 hover:bg-gray-800"><Plus className="w-4 h-4" />发布悬赏</button>
            </div>
            {loading ? <div className="py-20 text-center text-gray-500 font-medium">加载中...</div> : bounties.length === 0 ? <div className="bg-white/30 rounded-3xl border border-white/30 p-10 text-center text-gray-600 font-medium">还没有悬赏问题，发布一个让懂的人来帮你。</div> : <div className="grid grid-cols-1 md:grid-cols-2 gap-5">{bounties.map((bounty) => <motion.article key={bounty.id} onClick={() => openBounty(bounty)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl border-2 border-gray-100 p-6 shadow-sm cursor-pointer hover:border-gray-300 transition-colors"><div className="flex justify-between gap-3 mb-4"><span className={`px-3 py-1 rounded-full text-xs font-bold ${bounty.status === 'solved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{bounty.status === 'solved' ? '已解决' : '待揭榜'}</span><span className="text-xs text-gray-500 font-medium">{formatTime(bounty.createdAt)}</span></div><h3 className="text-xl font-extrabold text-black mb-2">{bounty.title}</h3><p className="text-gray-700 leading-relaxed whitespace-pre-wrap mb-4">{bounty.description}</p><div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-3"><span className="text-sm text-gray-600 font-medium">发布者：{bounty.authorName}</span>{bounty.status === 'open' && bounty.uid === auth.currentUser?.uid && <button onClick={(event) => { event.stopPropagation(); markSolved(bounty); }} className="px-3 py-2 bg-black text-white rounded-lg text-xs font-bold inline-flex items-center gap-1"><Check className="w-3 h-3" />标记解决</button>}{bounty.status === 'open' && bounty.uid !== auth.currentUser?.uid && <button onClick={(event) => { event.stopPropagation(); setSelectedAuthor(bounty); }} className="px-3 py-2 bg-black text-white rounded-lg text-xs font-bold">联系发布者</button>}</div><p className="text-xs text-gray-500 font-medium mt-3">点击查看和发布评论</p></motion.article>)}</div>}
          </section>
        ) : (
          <section>
            <div className="mb-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"><div><p className="text-xl font-extrabold text-black mb-1">展示你自己，让需要你的 lzuer 发现你这颗金子</p></div><button onClick={openMyBodyguard} className="px-5 py-3 bg-black text-white rounded-xl font-bold inline-flex items-center justify-center gap-2 hover:bg-gray-800"><Plus className="w-4 h-4" />更新信息</button></div>
            {loading ? <div className="py-20 text-center text-gray-500 font-medium">加载中...</div> : bodyguards.length === 0 ? <div className="bg-white/30 rounded-3xl border border-white/30 p-10 text-center text-gray-600 font-medium">还没有镖人信息，先介绍一下你的特长吧。</div> : <div className="grid grid-cols-1 md:grid-cols-2 gap-5">{bodyguards.map((person) => <motion.article key={person.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl border-2 border-gray-100 p-6 shadow-sm"><div className="flex items-center justify-between gap-3 mb-4"><div className="flex items-center gap-3"><img src={person.avatarUrl} alt={person.name} className="w-12 h-12 rounded-full object-cover border border-gray-200" referrerPolicy="no-referrer" /><div><h3 className="text-xl font-extrabold text-black">{person.name}</h3><p className="text-xs text-gray-500 font-medium">更新于 {formatTime(person.updatedAt)}</p></div></div><button type="button" onClick={() => toggleLike(person)} disabled={person.uid === auth.currentUser?.uid} className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-sm font-bold ${person.liked ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-600'} disabled:opacity-50`}><Heart className={`w-4 h-4 ${person.liked ? 'fill-current' : ''}`} />{person.likeCount}</button></div><p className="text-sm font-bold text-black mb-2">擅长：{person.skills}</p><p className="text-gray-700 leading-relaxed whitespace-pre-wrap mb-5">{person.description}</p><div className="pt-4 border-t border-gray-100 text-sm font-bold text-black">联系方式：{person.contact}</div></motion.article>)}</div>}
          </section>
        )}
      </div>

      <AnimatePresence>
        {showBountyModal && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25" onClick={() => setShowBountyModal(false)}><motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={(event) => event.stopPropagation()} className="bg-white rounded-3xl p-7 w-full max-w-lg shadow-2xl"><div className="flex justify-between items-center mb-5"><h3 className="text-2xl font-extrabold text-black">发布悬赏</h3><button onClick={() => setShowBountyModal(false)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5" /></button></div><form onSubmit={publishBounty} className="space-y-4"><input required value={bountyForm.title} onChange={(event) => setBountyForm({ ...bountyForm, title: event.target.value })} placeholder="一句话说清楚你需要什么帮助" className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-black" /><textarea required rows={5} value={bountyForm.description} onChange={(event) => setBountyForm({ ...bountyForm, description: event.target.value })} placeholder="补充背景、要求和截止时间" className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-black resize-none" /><input value={bountyForm.reward} onChange={(event) => setBountyForm({ ...bountyForm, reward: event.target.value })} placeholder="联系方式（微信号、QQ号或邮箱）" className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-black" /><button disabled={submitting} className="w-full py-4 bg-black text-white rounded-2xl font-bold disabled:opacity-50">{submitting ? '发布中...' : '确认发布'}</button></form></motion.div></div>}
        {showBodyguardModal && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25" onClick={() => setShowBodyguardModal(false)}><motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={(event) => event.stopPropagation()} className="bg-white rounded-3xl p-7 w-full max-w-lg shadow-2xl"><div className="flex justify-between items-center mb-5"><h3 className="text-2xl font-extrabold text-black">我的镖人信息</h3><button onClick={() => setShowBodyguardModal(false)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5" /></button></div><form onSubmit={saveBodyguard} className="space-y-4"><input required value={bodyguardForm.skills} onChange={(event) => setBodyguardForm({ ...bodyguardForm, skills: event.target.value })} placeholder="你的特长，例如：修电脑、PS、考研数学" className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-black" /><textarea required rows={5} value={bodyguardForm.description} onChange={(event) => setBodyguardForm({ ...bodyguardForm, description: event.target.value })} placeholder="介绍你能提供什么帮助" className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-black resize-none" /><input required value={bodyguardForm.contact} onChange={(event) => setBodyguardForm({ ...bodyguardForm, contact: event.target.value })} placeholder="微信号、QQ号或其他联系方式" className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-black" /><button disabled={submitting} className="w-full py-4 bg-black text-white rounded-2xl font-bold disabled:opacity-50">{submitting ? '保存中...' : '保存信息'}</button></form></motion.div></div>}
        {selectedBounty && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setSelectedBounty(null)}><motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={(event) => event.stopPropagation()} className="bg-white rounded-3xl p-7 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"><div className="flex justify-between items-start gap-4 mb-5"><div><p className="text-xs font-bold text-gray-500 mb-1">悬赏详情</p><h3 className="text-2xl font-extrabold text-black">{selectedBounty.title}</h3></div><button onClick={() => setSelectedBounty(null)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5" /></button></div><p className="text-gray-700 leading-relaxed whitespace-pre-wrap mb-5">{selectedBounty.description}</p><div className="border-t border-gray-100 pt-5"><h4 className="font-extrabold text-black mb-3">评论</h4>{commentsLoading ? <p className="text-sm text-gray-500">加载中...</p> : bountyComments.length === 0 ? <p className="text-sm text-gray-500 mb-4">还没有评论，来帮助一下吧。</p> : <div className="space-y-3 mb-4">{bountyComments.map((comment) => <div key={comment.id} className="bg-gray-50 rounded-xl p-3 flex gap-3"><img src={comment.avatarUrl} alt={comment.name} className="w-9 h-9 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" /><div><p className="text-xs font-bold text-gray-500 mb-1">{comment.name}</p><p className="text-sm text-gray-800 whitespace-pre-wrap">{comment.content}</p></div></div>)}</div>}<form onSubmit={publishBountyComment} className="flex gap-2"><input value={commentInput} onChange={(event) => setCommentInput(event.target.value)} placeholder="写下你的建议或解法" className="flex-1 px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black" /><button className="px-4 py-3 bg-black text-white rounded-xl font-bold">发送</button></form></div></motion.div></div>}
        {selectedAuthor && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setSelectedAuthor(null)}><motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={(event) => event.stopPropagation()} className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center"><button onClick={() => setSelectedAuthor(null)} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5" /></button><img src={selectedAuthor.authorAvatarUrl} alt={selectedAuthor.authorName} className="w-24 h-24 mx-auto mb-4 rounded-full object-cover border-4 border-gray-100" referrerPolicy="no-referrer" /><h3 className="text-2xl font-extrabold text-black mb-2">{selectedAuthor.authorName}</h3><p className="text-sm text-gray-600 font-medium mb-1">校园邮箱：{selectedAuthor.authorEmail || '未填写'}</p><p className="text-sm text-gray-800 font-bold mb-6">联系方式：{selectedAuthor.contact || '发布者暂未填写'}</p><button onClick={() => setSelectedAuthor(null)} className="w-full py-3 bg-black text-white rounded-xl font-bold">知道了</button></motion.div></div>}
      </AnimatePresence>
    </div>
  );
}
