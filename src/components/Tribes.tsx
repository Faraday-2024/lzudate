import React, { useEffect, useState } from 'react';
import { db, auth } from '../cloudbase';
import { Users, Plus, Shuffle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Tribe {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  memberIds: string[];
  createdAt: string;
}

interface ContactResult {
  name: string;
  avatarUrl: string;
  email: string;
  contact: string;
}

function normalizeId(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && typeof value.$oid === 'string') return value.$oid;
  return String(value);
}

export default function Tribes() {
  const [tribes, setTribes] = useState<Tribe[]>([]);
  const [joinedIds, setJoinedIds] = useState<string[]>([]);
  const [selectedTribe, setSelectedTribe] = useState<Tribe | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [result, setResult] = useState<ContactResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const currentUid = auth.currentUser?.uid;

  const fetchTribes = async () => {
    setLoading(true);
    setError('');
    try {
      const [tribesRes, userRes] = await Promise.all([
        db.collection('tribes').orderBy('createdAt', 'desc').limit(100).get(),
        currentUid ? db.collection('users').doc(currentUid).get() : Promise.resolve({ data: [] })
      ]);
      const list = (tribesRes.data || []).map((doc: any) => ({
        id: normalizeId(doc._id),
        name: doc.name,
        description: doc.description || '',
        ownerId: doc.ownerId,
        memberIds: Array.isArray(doc.memberIds) ? doc.memberIds : [],
        createdAt: doc.createdAt
      }));
      setTribes(list);
      const memberships = userRes.data?.[0]?.tribeIds;
      setJoinedIds(Array.isArray(memberships) ? memberships : list.filter((tribe: Tribe) => tribe.memberIds.includes(currentUid || '')).map((tribe: Tribe) => tribe.id));
    } catch (err) {
      console.error('Failed to fetch tribes:', err);
      setError('部落加载失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTribes();
  }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = form.name.trim();
    const description = form.description.trim();
    if (!currentUid) return;
    if (!name || name.length < 2) {
      setError('部落名称至少 2 个字。');
      return;
    }
    if (!description) {
      setError('请简单介绍一下这个部落。');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await db.collection('tribes').add({
        name,
        description,
        ownerId: currentUid,
        memberIds: [],
        createdAt: new Date().toISOString()
      });
      setForm({ name: '', description: '' });
      setShowCreateModal(false);
      await fetchTribes();
    } catch (err) {
      console.error('Failed to create tribe:', err);
      setError('创建失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  };

  const joinTribe = async (tribe: Tribe) => {
    if (!currentUid || tribe.memberIds.includes(currentUid)) return;
    setSubmitting(true);
    setError('');
    try {
      const memberIds = [...tribe.memberIds, currentUid];
      await db.collection('tribes').doc(tribe.id).update({ memberIds });
      await db.collection('users').doc(currentUid).update({ tribeIds: [...joinedIds, tribe.id] });
      await fetchTribes();
    } catch (err) {
      console.error('Failed to join tribe:', err);
      setError('加入失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  };

  const randomMatch = async (tribe: Tribe) => {
    if (!currentUid) return;
    const candidates = tribe.memberIds.filter((uid) => uid !== currentUid);
    if (candidates.length === 0) {
      setError('部落里暂时还没有其他成员。');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const targetUid = candidates[Math.floor(Math.random() * candidates.length)];
      const userRes = await db.collection('users').doc(targetUid).get();
      const user = userRes.data?.[0];
      if (!user) throw new Error('Member not found');
      setSelectedTribe(tribe);
      setResult({
        name: user.name || '一位部落成员',
        avatarUrl: user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetUid}`,
        email: user.email || '暂无校园邮箱',
        contact: user.questionnaire?.wechat || '对方暂未填写联系方式'
      });
    } catch (err) {
      console.error('Failed to match tribe member:', err);
      setError('匹配失败，请稍后再试。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-28 min-h-[80vh] p-6 rounded-3xl relative overflow-hidden">
      <div className="relative z-10">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div>
            <h2 className="text-3xl font-extrabold text-black tracking-tight">lzuer部落</h2>
            <p className="text-gray-700 mt-1 font-medium">找到一群同频的人，在部落里随机认识一位新朋友。</p>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="px-5 py-3 bg-black text-white rounded-xl font-bold inline-flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors">
            <Plus className="w-4 h-4" /> 新建部落
          </button>
        </div>

        {error && <div className="mb-5 rounded-xl bg-red-50 border border-red-100 p-4 text-sm text-red-600 font-medium">{error}</div>}
        {loading ? (
          <div className="flex justify-center items-center h-[40vh]"><div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" /></div>
        ) : tribes.length === 0 ? (
          <div className="bg-white rounded-3xl border-2 border-gray-100 p-10 text-center">
            <Users className="w-10 h-10 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-extrabold text-black mb-2">还没有部落</h3>
            <p className="text-gray-600 font-medium">创建第一个部落，邀请同频的 lzuer 加入。</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {tribes.map((tribe) => {
              const joined = tribe.memberIds.includes(currentUid || '') || joinedIds.includes(tribe.id);
              return (
                <motion.div key={tribe.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl border-2 border-gray-100 p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-xl font-extrabold text-black">{tribe.name}</h3>
                      <p className="text-sm text-gray-500 mt-1 font-medium">{tribe.memberIds.length} 位成员</p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-gray-100 flex items-center justify-center"><Users className="w-5 h-5 text-black" /></div>
                  </div>
                  <p className="text-gray-700 font-medium leading-relaxed min-h-12">{tribe.description}</p>
                  <div className="flex gap-3 mt-6">
                    {!joined && <button onClick={() => joinTribe(tribe)} disabled={submitting} className="flex-1 py-3 bg-gray-100 text-black rounded-xl font-bold hover:bg-gray-200 disabled:opacity-50">加入部落</button>}
                    {joined && <button onClick={() => randomMatch(tribe)} disabled={submitting} className="flex-1 py-3 bg-black text-white rounded-xl font-bold inline-flex items-center justify-center gap-2 hover:bg-gray-800 disabled:opacity-50"><Shuffle className="w-4 h-4" /> 随机匹配</button>}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20" onClick={() => setShowCreateModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={(event) => event.stopPropagation()} className="bg-white rounded-3xl p-7 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-6"><h3 className="text-2xl font-extrabold text-black">新建部落</h3><button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5" /></button></div>
              <form onSubmit={handleCreate} className="space-y-4">
                <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="部落名称" className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-black" />
                <textarea required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="这个部落聊什么？" rows={4} className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-black resize-none" />
                <button disabled={submitting} className="w-full py-4 bg-black text-white rounded-2xl font-bold disabled:opacity-50">{submitting ? '创建中...' : '确认创建'}</button>
              </form>
            </motion.div>
          </div>
        )}

        {result && selectedTribe && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setResult(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={(event) => event.stopPropagation()} className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl text-center">
              <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-black text-white flex items-center justify-center"><Shuffle className="w-7 h-7" /></div>
              <p className="text-sm text-gray-500 font-bold mb-2">{selectedTribe.name} 的随机匹配</p>
              <img src={result.avatarUrl} alt={result.name} className="w-24 h-24 mx-auto mb-4 rounded-full object-cover border-4 border-gray-100" referrerPolicy="no-referrer" />
              <h3 className="text-3xl font-extrabold text-black mb-6">{result.name}</h3>
              <div className="text-left space-y-3 bg-gray-50 rounded-2xl p-5 mb-6">
                <p className="text-sm font-medium text-gray-700"><span className="font-bold text-black">校园邮箱：</span>{result.email}</p>
                <p className="text-sm font-medium text-gray-700"><span className="font-bold text-black">微信号/QQ号：</span>{result.contact}</p>
              </div>
              <button onClick={() => setResult(null)} className="w-full py-3 bg-black text-white rounded-xl font-bold">知道了</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
