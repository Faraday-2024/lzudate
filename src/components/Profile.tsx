import React, { useState, useEffect } from 'react';
import { db, auth, appInstance } from '../cloudbase';
import { motion, AnimatePresence } from 'motion/react';

import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showContact, setShowContact] = useState(false);
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    avatarUrl: '',
    email: ''
  });

  useEffect(() => {
    const fetchProfile = async () => {
      const loginState = await auth.getLoginState();
      if (!loginState) return;
      try {
        const res = await db.collection('users').doc(auth.currentUser?.uid).get();
        if (res.data && res.data.length > 0) {
          const data = res.data[0];
          setFormData({
            name: data.name || '',
            bio: data.bio || '',
            avatarUrl: data.avatarUrl || '',
            email: data.email || ''
          });
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loginState = await auth.getLoginState();
    if (!loginState) return;
    
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('User not found');
      await db.collection('users').doc(uid).update({
        name: formData.name,
        bio: formData.bio,
        avatarUrl: formData.avatarUrl
      });
      setMessage({ type: 'success', text: '个人资料已更新。' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || '更新失败，请重试。' });
    } finally {
      setSaving(false);
    }
  };

 
  const handleLogout = async () => {
    await auth.signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh]">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-10 flex justify-between items-end">
        <h2 className="text-4xl font-extrabold text-black tracking-tight">个人主页</h2>
        <button
          onClick={() => setShowContact(true)}
          className="px-4 py-2 text-sm font-bold text-black hover:bg-white/20 transition-colors rounded-lg"
        >
          联系我们
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/20 backdrop-blur-md border border-white/30 rounded-3xl shadow-xl p-6 sm:p-10"
      >
        <form onSubmit={handleSubmit} className="space-y-8">
          
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 pb-8 border-b border-white/20">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-white/30 border-2 border-white/40">
              <img
                className="w-full h-full object-cover"
                src={formData.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${formData.name}`}
                alt="Avatar preview"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex-1 w-full flex flex-col items-start">
              <label className="block text-sm font-bold text-black mb-2">上传头像</label>
              <label className="cursor-pointer px-6 py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-md">
                选择图片
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    const loginState = await auth.getLoginState();
                    if (!file || !loginState) return;
                    try {
                      const uid = auth.currentUser?.uid;
                      const cloudPath = `avatars/${uid}_${Date.now()}_${file.name}`;
                      
                      const res = await appInstance.uploadFile({
                        cloudPath: cloudPath,
                        filePath: file
                      });
                      
                      const tempUrlRes = await appInstance.getTempFileURL({
                        fileList: [res.fileID]
                      });
                      
                      if (tempUrlRes.fileList && tempUrlRes.fileList.length > 0) {
                        setFormData({ ...formData, avatarUrl: tempUrlRes.fileList[0].tempFileURL });
                      }
                    } catch (err) {
                      console.error("Upload failed", err);
                      alert("图片上传失败，请重试");
                    }
                  }}
                />
              </label>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-black mb-2">姓名 / 昵称</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-5 py-4 bg-white/30 border border-white/40 rounded-2xl focus:outline-none focus:border-black transition-colors text-black font-medium shadow-inner"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-black mb-2">个人简介</label>
              <textarea
                rows={4}
                value={formData.bio}
                onChange={(e) => setFormData({...formData, bio: e.target.value})}
                className="w-full px-5 py-4 bg-white/30 border border-white/40 rounded-2xl focus:outline-none focus:border-black transition-colors text-black font-medium resize-none shadow-inner"
              />
            </div>
          </div>

         <div className="bg-white/30 p-6 rounded-2xl border border-white/40 shadow-inner">
            <h4 className="text-sm font-bold text-black mb-4">已认证信息</h4>
            <div className="grid sm:grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-1">校园邮箱</label>
                <div className="text-sm font-bold text-black">{formData.email}</div>
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between">
            <div className="flex-1">
              <AnimatePresence>
                {message.text && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold ${
                      message.type === 'success' ? 'text-black bg-gray-100' : 'text-red-600 bg-red-50'
                    }`}
                  >
                    {message.text}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-4 bg-black text-white rounded-2xl font-bold hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存修改'}
            </button>
          </div>
        </form>
      </motion.div>
      
      <div className="mt-8 flex flex-col sm:flex-row gap-4">
        <button 
          onClick={() => navigate('/onboarding')}
          className="flex-1 px-6 py-4 bg-white/20 backdrop-blur-md border border-white/30 text-black rounded-2xl font-bold transition-colors shadow-sm hover:bg-white/30"
        >
          修改个性化档案
        </button>
        <button 
          onClick={handleLogout}
          className="flex-1 px-6 py-4 bg-white/20 backdrop-blur-md border border-white/30 text-black rounded-2xl font-bold transition-colors shadow-sm hover:bg-white/30"
        >
          退出
        </button>
      </div>
      
      {/* Contact Modal */}
      {showContact && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-sm"
          onClick={() => setShowContact(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-white/30 backdrop-blur-2xl border border-white/40 rounded-3xl p-8 max-w-xs w-full mx-6 shadow-2xl text-black"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-semibold leading-relaxed mb-5">如果您有任何的建议与反馈，欢迎联系我们！</p>
            <p className="text-sm mb-1">xshipeng2024@lzu.edu.cn</p>
            <p className="text-sm mb-1">faradaycn@outlook.com</p>
            <p className="text-sm">QQ：1938590518</p>
          </motion.div>
        </div>
      )}
    </div>
  );
}
