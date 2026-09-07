import React, { useState, useEffect } from 'react';
import { auth, db } from '../cloudbase';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';

export default function Auth() {
  const location = useLocation();
  const [isLogin, setIsLogin] = useState(location.state?.isLogin ?? true);
  const [email, setEmail] = useState(location.state?.email || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [verifyOtpFn, setVerifyOtpFn] = useState<any>(null);
  const [activeUsersCount, setActiveUsersCount] = useState<number>(128);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchActiveUsers = async () => {
      try {
        const res = await db.collection('users').where({ isParticipating: true }).get();
        if (res.data) {
          setActiveUsersCount(res.data.length);
        }
      } catch (err) {
        console.error("Failed to fetch active users count:", err);
      }
    };
    fetchActiveUsers();
  }, []);


  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    setError('');
  }, [isLogin]);

  const handleSendCode = async () => {
    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedUsername) {
      setError('请先填写用户名');
      return;
    }
    if (!/^[a-z][a-z0-9]{5,}$/.test(normalizedUsername)) {
      setError('用户名是小写字母开头且至少6位哦');
      return;
    }
    if (!normalizedEmail) {
      setError('请先填写邮箱');
      return;
    }
    if (!/^[^\s@]+@lzu\.edu\.cn$/i.test(normalizedEmail)) {
      setError('邮箱必须是 @lzu.edu.cn');
      return;
    }
    if (!password) {
      setError('请先填写密码');
      return;
    }
    setError('');
    setSendingCode(true);
    try {
      const res = await auth.signUp({
        email: normalizedEmail,
        username: normalizedUsername,
        password,
      });
      if (res.error) {
        throw res.error;
      }
      if (res.data?.verifyOtp) {
        setVerifyOtpFn(() => res.data.verifyOtp);
        setCountdown(60);
      }
    } catch (err: any) {
      let errorMsg = err.message || '发送验证码失败，请重试';
      if (errorMsg.toLowerCase().includes('email')) {
        errorMsg = '邮箱必须是 @lzu.edu.cn';
      }
      setError(errorMsg);
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        if (!username || !password) {
          setError('请输入用户名和密码');
          setLoading(false);
          return;
        }
        
        const res = await auth.signInWithPassword({
          username,
          password,
        });
        
        if (res.error) throw res.error;
        
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('认证失败');

        const userRes = await db.collection('users').doc(uid).get();
        const userExists = userRes.data && userRes.data.length > 0;

        if (!userExists) {
          // 如果是登录状态但用户不存在，则创建一个基础档案
          await db.collection('users').doc(uid).set({
            uid: uid,
            username: username,
            onboardingCompleted: false,
            createdAt: new Date().toISOString()
          });
          navigate('/onboarding');
        } else {
          if (userRes.data[0].onboardingCompleted) {
            navigate('/matches');
          } else {
            navigate('/onboarding');
          }
        }
      } else {
        // 注册状态
        const normalizedUsername = username.trim();
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedUsername) {
          setError('请先填写用户名');
          setLoading(false);
          return;
        }
        if (!/^[a-z][a-z0-9]{5,}$/.test(normalizedUsername)) {
          setError('用户名是小写字母开头且至少6位哦');
          setLoading(false);
          return;
        }
        if (!normalizedEmail) {
          setError('请先填写邮箱');
          setLoading(false);
          return;
        }
        if (!/^[^\s@]+@lzu\.edu\.cn$/i.test(normalizedEmail)) {
          setError('邮箱必须是 @lzu.edu.cn');
          setLoading(false);
          return;
        }
        if (!code) {
          setError('请输入验证码');
          setLoading(false);
          return;
        }
        if (!verifyOtpFn) {
          setError('请先获取验证码');
          setLoading(false);
          return;
        }

        const res = await verifyOtpFn({ token: code });
        if (res.error) throw res.error;

        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('认证失败');

        const userRes = await db.collection('users').doc(uid).get();
        const userExists = userRes.data && userRes.data.length > 0;

        if (!userExists) {
          await db.collection('users').doc(uid).set({
            uid: uid,
            email: normalizedEmail,
            username: normalizedUsername,
            onboardingCompleted: false,
            createdAt: new Date().toISOString()
          });
        }
        navigate('/onboarding');
      }
    } catch (err: any) {
      let errorMsg = err.message || '认证失败，请检查输入是否正确';
      if (errorMsg.toLowerCase().includes('email')) {
        errorMsg = '邮箱必须是 @lzu.edu.cn';
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6 relative bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: 'url("/logback.jpg")', fontFamily: '"SimSun", "STSong", serif' }}
    >
      <Link 
        to="/" 
        className="absolute top-8 left-8 flex items-center text-white hover:text-gray-200 transition-colors font-bold z-10 drop-shadow-md"
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        返回首页
      </Link>

      <div className="w-full max-w-6xl flex flex-col md:flex-row items-center justify-between gap-12">
        {/* Left Side Text */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex-1 text-left hidden md:flex flex-col justify-center"
        >
          <div className="space-y-4 mb-12">
            <h2 className="text-5xl lg:text-6xl font-bold text-white leading-tight ml-[100px] mt-0 -mb-3">
              不刷屏<br />
              每周遇见一个<br />
              对的人
            </h2>
          </div>
          <div className="space-y-2 text-lg">
            <p className="text-white font-bold text-[20px] ml-[100px]">兰州大学专属校园匹配平台。</p>
            <p className="text-white font-bold text-[20px] ml-[100px] mt-0 -mb-[50px] pb-0">填写问卷，每周四收到你的专属匹配。</p>
          </div>
          <div className="mt-16 text-white font-bold ml-[100px]">
            本周有{activeUsersCount}位lzuer活跃
          </div>
        </motion.div>

        {/* Right Side Form */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="bg-white/5 backdrop-blur-sm border border-white/20 p-8 sm:p-10 rounded-3xl shadow-xl">
            <div className="mb-10 text-center">
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-black mb-4 drop-shadow-md">
                兰期竹约
              </h1>
              <p className="text-lg text-black font-medium drop-shadow-sm">
                告别左滑右滑。专属兰大人的交友。
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              {isLogin ? (
                <>
                  <div>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="用户名"
                      className="w-full px-5 py-4 bg-white/20 border-2 border-black rounded-2xl focus:outline-none focus:border-black/60 transition-colors text-black placeholder:text-black/70 text-lg font-medium shadow-inner"
                    />
                  </div>
                  <div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="密码"
                      className="w-full px-5 py-4 bg-white/20 border-2 border-black rounded-2xl focus:outline-none focus:border-black/60 transition-colors text-black placeholder:text-black/70 text-lg font-medium shadow-inner"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="用户名是小写字母开头且至少6位哦"
                      className="w-full px-5 py-4 bg-white/20 border-2 border-black rounded-2xl focus:outline-none focus:border-black/60 transition-colors text-black placeholder:text-black/70 text-lg font-medium shadow-inner"
                    />
                  </div>
                  <div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="设置密码"
                      className="w-full px-5 py-4 bg-white/20 border-2 border-black rounded-2xl focus:outline-none focus:border-black/60 transition-colors text-black placeholder:text-black/70 text-lg font-medium shadow-inner"
                    />
                  </div>
                  <div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="请输入 @lzu.edu.cn 邮箱"
                      className="w-full px-5 py-4 bg-white/20 border-2 border-black rounded-2xl focus:outline-none focus:border-black/60 transition-colors text-black placeholder:text-black/70 text-lg font-medium shadow-inner"
                    />
                  </div>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="邮箱验证码"
                      className="flex-1 px-5 py-4 bg-white/20 border-2 border-black rounded-2xl focus:outline-none focus:border-black/60 transition-colors text-black placeholder:text-black/70 text-lg font-medium shadow-inner w-full"
                    />
                    <button
                      type="button"
                      onClick={handleSendCode}
                      disabled={sendingCode || countdown > 0 || !email || !username || !password}
                      className="px-6 py-4 bg-black text-white rounded-2xl font-bold text-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {countdown > 0 ? `${countdown}s` : (sendingCode ? '发送中...' : '获取验证码')}
                    </button>
                  </div>
                </>
              )}

              {error && (
                <div className="text-red-600 text-sm font-medium bg-red-50/80 px-4 py-3 rounded-xl border border-red-100">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 px-4 bg-black hover:bg-gray-800 text-white rounded-2xl font-bold text-lg transition-colors disabled:opacity-50 mt-4 shadow-lg"
              >
                {loading ? '处理中...' : (isLogin ? '登录' : '创建账号')}
              </button>
            </form>

            <div className="mt-8 text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm font-bold text-white hover:text-gray-200 transition-colors drop-shadow-md"
              >
                {isLogin ? "没有账号？点击注册" : "已有账号？点击登录"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
