import React, { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../cloudbase';
import { Users, Handshake, User, Inbox } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [showAnnouncement, setShowAnnouncement] = useState(false);

  // 后续复用公告时这样改：
  // 1) 把 ANNOUNCEMENT_KEY 改成新的唯一值（例如 feature_xxx_YYYYMMDD）。
  // 2) 把 ANNOUNCEMENT_CUTOFF 改成目标分界时间（只通知该时间之前注册的用户）。
  // 3) 在下方「Update Announcement」区块修改标题和文案。
  const ANNOUNCEMENT_KEY = 'buddy_mbti_update_20260416';
  const ANNOUNCEMENT_CUTOFF = new Date('2026-04-17T00:00:00+08:00');

  useEffect(() => {
    const checkProfile = async () => {
      const loginState = await auth.getLoginState();
      if (!loginState) {
        navigate('/');
        return;
      }
      const uid = auth.currentUser?.uid;
      if (!uid) {
        navigate('/');
        return;
      }
      try {
        const res = await db.collection('users').doc(uid).get();
        const userData = res.data && res.data.length > 0 ? res.data[0] : null;
        if (!userData || !userData.onboardingCompleted) {
          navigate('/onboarding');
          return;
        }

        const seenInDb = !!userData.announcementsSeen?.[ANNOUNCEMENT_KEY];
        const createdAt = userData.createdAt ? new Date(userData.createdAt) : null;
        // 「老用户」定义：注册时间早于 cutoff；新用户不会看到这条公告。
        const isLegacyUser = !createdAt || Number.isNaN(createdAt.getTime()) || createdAt < ANNOUNCEMENT_CUTOFF;
        if (isLegacyUser && !seenInDb) {
          setShowAnnouncement(true);
        }
      } catch (err) {
        console.error("Error checking profile:", err);
      } finally {
        setChecking(false);
      }
    };
    checkProfile();
  }, [navigate]);

  const [showContact, setShowContact] = useState(false);

  const handleAcknowledgeAnnouncement = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setShowAnnouncement(false);
      return;
    }
    try {
      // 每个用户、每个公告 key 只记录一次已读，写入 CloudBase 的 users 文档。
      await db.collection('users').doc(uid).update({
        [`announcementsSeen.${ANNOUNCEMENT_KEY}`]: true,
        [`announcementsSeen.${ANNOUNCEMENT_KEY}_at`]: new Date().toISOString()
      });
      setShowAnnouncement(false);
    } catch (err) {
      console.error('Failed to save announcement state:', err);
    }
  };

  const navItems = [
    { name: '匹配', path: '/matches', icon: Users },
    { name: '搭子', path: '/buddies', icon: Handshake },
    { name: '信箱', path: '/mailbox', icon: Inbox },
    { name: '我的', path: '/profile', icon: User },
  ];

  if (checking) return null;

  return (
    <div 
      className="min-h-screen flex flex-col font-sans text-black bg-cover bg-center bg-no-repeat bg-fixed"
      style={{ backgroundImage: 'url("/match.png")', backgroundColor: 'transparent' }}
    >
      {/* Desktop Header */}
      <header className="hidden sm:block z-50 py-6 bg-transparent">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <Link to="/matches" className="text-2xl font-extrabold tracking-tight hover:opacity-70 transition-opacity">
              lzu date.
            </Link>
            <div className="flex items-center space-x-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={cn(
                      "px-5 py-2.5 rounded-full text-sm font-bold transition-colors",
                      isActive 
                        ? "bg-black text-white" 
                        : "text-gray-500 hover:text-black hover:bg-gray-100"
                    )}
                  >
                    {item.name}
                  </Link>
                );
              })}
              <div className="w-px h-4 bg-gray-300 mx-3"></div>
              <button
                onClick={() => setShowContact(true)}
                className="px-4 py-2.5 rounded-full text-sm font-bold text-gray-500 hover:text-black hover:bg-gray-100 transition-colors"
              >
                联系我们
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 pb-24 sm:pb-8">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="h-full"
        >
          <Outlet />
        </motion.div>
      </main>

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
            <p className="text-sm mb-1">邮箱1：xshipeng2024@lzu.edu.cn</p>
            <p className="text-sm mb-1">邮箱2：faradaycn@outlook.com</p>
            <p className="text-sm">QQ：1938590518</p>
          </motion.div>
        </div>
      )}

      {/* Update Announcement */}
      {showAnnouncement && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center backdrop-blur-sm px-4"
          onClick={handleAcknowledgeAnnouncement}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-md rounded-3xl border border-white/40 bg-white/30 backdrop-blur-2xl p-7 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-extrabold text-black mb-3">功能更新</h3>
            <p className="text-sm text-gray-800 leading-relaxed mb-1">咖啡优惠券使用方法：双方都点击满意后，可在信箱查看对方信息，即可收到核销码</p>
            <p className="text-sm text-gray-700 leading-relaxed">点击卡片周围任意位置即可关闭。</p>
          </motion.div>
        </div>
      )}

      {/* Mobile Bottom Nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe z-50">
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                  isActive ? "text-black" : "text-gray-400 hover:text-black"
                )}
              >
                <Icon className={cn("w-6 h-6", isActive && "fill-current")} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-bold">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
