import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Brain, Coffee } from 'lucide-react';

// Using a custom SVG to match the balloon-like map pin logo of date drop
const LogoIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 mr-2 sm:w-8 sm:h-8">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
  </svg>
);

const FAQ_DATA = {
  intro: {
    title: "入门",
    items: [
      { q: "LZU Date是什么？", a: "LZU Date 是兰州大学专属的校园匹配平台。我们不做刷屏式的左滑右滑，而是通过一份深度问卷了解你的价值观、生活方式和性格特质，每周四晚 21:00 为你匹配一个最合拍的兰大人。一次只认识一个人，认真了解 TA。" },
      { q: "谁可以注册？", a: "目前仅限拥有 @lzu.edu.cn 学校邮箱的兰州大学在校学生（本科生、研究生、博士生）注册。我们通过邮箱验证确保每位用户的真实学生身份。未来计划开放西北民族大学、兰州交通大学等兰州高校，敬请期待。" },
      { q: "lzu Date 收费吗？", a: "完全免费。LZU Date 是由兰州大学学生自主开发的公益项目，不收取任何费用，也没有会员制或付费功能。" }
    ]
  },
  match: {
    title: "匹配机制",
    items: [
      { q: "匹配是怎么算出来的？", a: "我们的算法基于你的问卷答案，从多个维度构建个人画像，综合价值观权重、生活方式兼容性和性格互补性进行评分。你标记为\"重要\"的选项会获得更高权重，最终为你匹配当周池中契合度最高的对象。" },
      { q: "为什么每周只匹配一个人？", a: "因为我们相信深度胜于广度。一次只认识一个人，花一周的时间去了解 TA，远比同时浏览几十个头像来得有意义。这种「慢社交」的方式，让每一次匹配都更有仪式感和期待感。" },
      { q: "这周没有匹配到人怎么办？", a: "如果匹配池中没有找到足够契合的对象，我们宁可不匹配，也不会推荐一个不合适的人。下周我们会扩大搜索范围，为你找到更合拍的兰大人。质量永远优先于数量。" },
      { q: "什么是「Shoot Your Shot」？", a: "如果你心里已经有某个兰大人，可以输入 TA 的学校邮箱发起 Shoot Your Shot。如果 TA 也向你发起了，立即触发双向匹配。如果没有，TA 永远不会知道——完全零风险。每月限用一次。" },
      { q: "支持同性匹配吗？", a: "支持。在问卷的基本信息部分可以选择性别认同和性取向偏好，算法会尊重你的选择。lzu Date 欢迎每一个真诚寻找连接的人。" }
    ]
  },
  privacy: {
    title: "隐私与安全",
    items: [
      { q: "我的问卷答案会被别人看到吗？", a: "不会。你的问卷答案仅用于匹配算法计算，不会展示给任何其他用户。匹配对象只能看到兼容性分析报告，而不是你的原始答案。" },
      { q: "对方能看到我的微信号吗？", a: "只有在双向匹配成功（双方都表达了兴趣）之后，微信号才会互相解锁。单方面不会泄露任何联系方式。" },
      { q: "可以删除我的数据吗？", a: "当然。你可以在个人设置中随时暂停匹配或导出并删除全部数据。你的数据，你做主。" },
      { q: "可以修改问卷答案吗？", a: "可以。在个人设置中随时重新填写问卷，更新后的答案在下一次匹配中生效。" },
      { q: "可以暂停匹配吗？", a: "可以。在个人资料页打开「暂停匹配」开关即可。暂停期间你的资料不会进入匹配池，数据会被保留，随时可以重新开启。" }
    ]
  }
};

const FaqCard = ({ data }: { data: any }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const items = data.items;

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  return (
    <div className="flex flex-col">
      <h4 className="text-2xl font-bold mb-6 text-center text-[#2D2D2D]">{data.title}</h4>
      <div 
        className="relative h-[380px] sm:h-[340px] w-full cursor-pointer group"
        onClick={handleNext}
      >
        {/* Stacked background cards (Right side) */}
        <div className="absolute inset-y-6 -right-4 left-4 bg-gray-200/60 rounded-3xl shadow-sm border border-gray-200 transition-transform duration-300 group-hover:translate-x-1"></div>
        <div className="absolute inset-y-3 -right-2 left-2 bg-gray-100/80 rounded-3xl shadow-sm border border-gray-100 transition-transform duration-300 group-hover:translate-x-0.5"></div>
        
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 10, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-white rounded-3xl p-8 shadow-sm border-2 border-gray-100 flex flex-col text-left hover:shadow-md hover:border-gray-200 transition-all z-10"
          >
            <div className="text-xs text-gray-400 font-bold mb-4 uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-full self-start">
              {currentIndex + 1} / {items.length}
            </div>
            <h5 className="text-xl font-bold text-black mb-4">{items[currentIndex].q}</h5>
            <p className="text-gray-600 font-medium leading-relaxed text-sm sm:text-base overflow-y-auto mb-8">
              {items[currentIndex].a}
            </p>
            <div className="absolute bottom-6 right-8 text-gray-400 group-hover:text-black transition-colors flex items-center">
              <span className="text-sm font-bold">下一个</span>
              <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default function Landing() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [showContact, setShowContact] = useState(false);

  const handleGetStarted = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/login', { state: { email } });
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7]" style={{ fontFamily: '"SimSun", "STSong", serif' }}>
      {/* Hero Section */}
      <div className="relative min-h-[115vh] flex flex-col pb-12">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img
            src="/1.png"
            alt="Dreamy landscape"
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#FDFBF7] to-transparent" />
        </div>

        {/* Header */}
        <header className="relative z-20 px-6 py-8 flex justify-between items-center max-w-7xl mx-auto w-full">
          <div className="flex items-center text-white font-sans">
            <LogoIcon />
            <span className="text-2xl sm:text-3xl font-bold tracking-tight">lzu date.</span>
          </div>
          <div className="flex space-x-4 sm:space-x-6 text-white/90 text-sm font-medium">
            <Link to="/login" state={{ isLogin: true }} className="hover:text-white transition-colors bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">登录</Link>
            <Link to="/login" state={{ isLogin: false }} className="hover:text-white transition-colors bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full hidden sm:block">注册</Link>
          </div>
        </header>

        {/* Hero Content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 text-center -mt-20 w-full">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="flex flex-col items-center w-full max-w-4xl mx-auto"
          >
            <h1 className="text-4xl sm:text-6xl lg:text-7xl text-white mb-6 leading-tight drop-shadow-lg text-center">
              告别左滑右滑。<br />专属兰大人的校园交友。
            </h1>

            <p className="text-xl sm:text-2xl text-white/90 mb-10 font-medium drop-shadow-md text-center">
              输入你的校园邮箱，开启心动之旅。
            </p>

            <form onSubmit={handleGetStarted} className="w-full max-w-lg flex flex-col sm:flex-row gap-3 mx-auto justify-center">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="你的校园邮箱 (@lzu.edu.cn)"
                className="flex-1 px-6 py-4 rounded-full bg-white text-black focus:outline-none focus:ring-2 focus:ring-white/50 text-lg shadow-xl font-medium"
              />
              <button
                type="submit"
                className="px-8 py-4 rounded-full bg-white/30 backdrop-blur-md text-white font-bold text-lg hover:bg-white/40 transition-colors shadow-xl border border-white/20 whitespace-nowrap"
              >
                开始使用
              </button>
            </form>
          </motion.div>
        </div>
      </div>

      {/* How it works */}
      <div className="py-24 px-4 max-w-5xl mx-auto">
        <h2 className="text-4xl sm:text-5xl text-center text-[#2D2D2D] mb-16 font-bold">
          运作方式
        </h2>

        <div className="space-y-8">
          {/* Card 1 */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative h-[28rem] rounded-[2rem] overflow-hidden group"
          >
            <img src="/2.png" alt="Bench" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            
            <div className="relative z-10 p-10 sm:p-16 h-full flex flex-col justify-center max-w-xl">
              <h3 className="text-4xl sm:text-5xl text-white mb-4 font-bold drop-shadow-lg">告诉我们关于你的事</h3>
              <p className="text-xl text-white/90 leading-relaxed drop-shadow-md font-medium">你的核心价值观、兴趣爱好，以及对你来说真正重要的东西。</p>
            </div>
          </motion.div>

          {/* Card 2 */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative h-[28rem] rounded-[2rem] overflow-hidden group"
          >
            <img src="/3.jpg" alt="Beach" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            
            <div className="relative z-10 p-10 sm:p-16 h-full flex flex-col justify-center max-w-xl">
              <h3 className="text-4xl sm:text-5xl text-white mb-4 font-bold drop-shadow-lg">每周参与匹配</h3>
              <p className="text-xl text-white/90 leading-relaxed drop-shadow-md font-medium mb-[100px]">在每周截止时间前确认参与，我们会为你发送一位匹配对象，并附上我们认为你们会合拍的原因。</p>
            </div>
          </motion.div>

          {/* Card 3 */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative h-[28rem] rounded-[2rem] overflow-hidden group"
          >
            <img src="/4.png" alt="Couple" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            
            <div className="relative z-10 p-10 sm:p-16 h-full flex flex-col justify-center max-w-xl">
              <h3 className="text-4xl sm:text-5xl text-white mb-4 font-bold drop-shadow-lg ml-0">去约会吧！</h3>
              <p className="text-xl text-white/90 leading-relaxed drop-shadow-md font-medium mb-0 ml-0 mt-0 pt-0 pb-0 pl-0 pr-0">我们会提供对方的邮箱。剩下的就交给你们了——见面、喝杯咖啡，或者一起去散散步。</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 px-4 max-w-7xl mx-auto">
        <h2 className="text-4xl sm:text-5xl text-center text-[#2D2D2D] mb-16 font-bold">
          我能用lzu date吗？
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center px-4 sm:px-8">
          {/* Left: Library Image */}
          <div className="relative h-[400px] sm:h-[500px] rounded-[2rem] overflow-hidden shadow-xl group">
            <img 
              src="/library.jpg" 
              alt="Library" 
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
              referrerPolicy="no-referrer" 
            />
            <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-700"></div>
          </div>
          
          {/* Right: Vertical Features */}
          <div className="flex flex-col gap-10">
            <div className="flex items-start text-left group">
              <div className="w-16 h-16 bg-white shadow-sm border border-gray-100 rounded-2xl flex items-center justify-center shrink-0 mr-6 transform transition-transform group-hover:scale-110 group-hover:border-black">
                <ShieldCheck className="w-8 h-8 text-black" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-3 text-black">实名制与邮箱验证</h3>
                <p className="text-gray-500 font-medium leading-relaxed">仅限 @lzu.edu.cn 邮箱验证的兰大学生加入，确保社区环境纯净安全。</p>
              </div>
            </div>
            <div className="flex items-start text-left group">
              <div className="w-16 h-16 bg-white shadow-sm border border-gray-100 rounded-2xl flex items-center justify-center shrink-0 mr-6 transform transition-transform group-hover:scale-110 group-hover:border-black">
                <Brain className="w-8 h-8 text-black" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-3 text-black">算法精准匹配</h3>
                <p className="text-gray-500 font-medium leading-relaxed">基于心理学模型深入分析灵魂共鸣度，而非单纯的地理距离。</p>
              </div>
            </div>
            <div className="flex items-start text-left group">
              <div className="w-16 h-16 bg-white shadow-sm border border-gray-100 rounded-2xl flex items-center justify-center shrink-0 mr-6 transform transition-transform group-hover:scale-110 group-hover:border-black">
                <Coffee className="w-8 h-8 text-black" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-3 text-black">深度社交体验</h3>
                <p className="text-gray-500 font-medium leading-relaxed">一次只认识一个人，并认真了解TA——这是我们对"深度"最朴素的理解。</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quote Section */}
      <div className="relative px-6 w-full bg-[#1e3a5f] flex justify-center items-center overflow-hidden" style={{ height: '585.949px' }}>
        {/* Starry background effect */}
        <div className="absolute inset-0 opacity-60 pointer-events-none">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="stars" width="120" height="120" patternUnits="userSpaceOnUse">
                <circle cx="15" cy="25" r="1" fill="white" opacity="0.8" />
                <circle cx="45" cy="10" r="1.5" fill="white" opacity="0.6" />
                <circle cx="85" cy="40" r="0.5" fill="white" opacity="0.9" />
                <circle cx="25" cy="85" r="1" fill="white" opacity="0.5" />
                <circle cx="65" cy="95" r="2" fill="white" opacity="0.3" />
                <circle cx="105" cy="70" r="1" fill="white" opacity="0.7" />
                <circle cx="55" cy="55" r="0.8" fill="white" opacity="0.8" />
                <circle cx="95" cy="15" r="1.2" fill="white" opacity="0.4" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#stars)" />
          </svg>
        </div>
        
        <div className="relative z-20 max-w-4xl mx-auto text-center">
          <p 
            className="text-2xl sm:text-3xl md:text-4xl leading-loose text-white drop-shadow-md"
            style={{ fontFamily: '"SimSun", "STSong", serif', fontStyle: 'italic' }}
          >
            “在这里我没有遇到一百个人，但我遇到了一个在草坪散步时能和我讨论加缪的人。用LZU Date，在萃英山下享受美好时光。” ——一位lzuer
          </p>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="py-24 px-4 max-w-7xl mx-auto mb-12">
        <h2 className="text-4xl sm:text-5xl text-center text-[#2D2D2D] mb-16 font-bold">
          常见问题
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 px-4 sm:px-0">
          <FaqCard data={FAQ_DATA.intro} />
          <FaqCard data={FAQ_DATA.match} />
          <FaqCard data={FAQ_DATA.privacy} />
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#3A171C] text-white py-16 px-6 font-sans">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-start gap-10">
          <div>
            <div className="flex items-center mb-6">
              <LogoIcon />
              <span className="text-3xl font-bold tracking-tight">lzu date.</span>
            </div>
            <p className="text-white/60 text-sm">© 2026 lzu date.</p>
          </div>
          <div className="flex gap-16">
            <div>
              <h4 className="font-bold mb-4 text-sm tracking-wider text-white/80 uppercase">平台</h4>
              <ul className="space-y-3 text-sm text-white/60">
                <li><Link to="/login" className="hover:text-white transition-colors">登录</Link></li>
                <li><Link to="/login" className="hover:text-white transition-colors">注册</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-sm tracking-wider text-white/80 uppercase">关于</h4>
              <ul className="space-y-3 text-sm text-white/60">
                <li><a href="#" className="hover:text-white transition-colors">隐私政策</a></li>
                <li><button onClick={() => setShowContact(true)} className="hover:text-white transition-colors text-white/60 text-sm">联系我们</button></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
      {/* Contact Modal */}
      {showContact && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setShowContact(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-white border border-gray-100 rounded-3xl p-8 max-w-xs w-full mx-6 shadow-2xl text-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-semibold leading-relaxed mb-5">如果您有任何的建议与反馈，欢迎联系我们！</p>
            <p className="text-sm text-gray-600 mb-1">邮箱1：xshipeng2024@lzu.edu.cn</p>
            <p className="text-sm text-gray-600 mb-1">邮箱2：faradaycn@outlook.com</p>
            <p className="text-sm text-gray-600">QQ：1938590518</p>
          </motion.div>
        </div>
      )}
    </div>
  );
}