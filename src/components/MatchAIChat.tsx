import React, { useState, useEffect, useRef } from 'react';
import { Send, X } from 'lucide-react';
import { callAIChat, toUserFriendlyAIError } from '../services/aiService';

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface MatchAIChatProps {
  matchUid: string;
  matchName: string;
  displayProfile: string;
  aiSummary: string;
  onClose: () => void;
}

export default function MatchAIChat({ matchUid, matchName, displayProfile, aiSummary, onClose }: MatchAIChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: `你好！我是${matchName}的AI分身。很高兴认识你！` }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleShare = async () => {
    if (messages.length < 3) {
      alert('再多聊几句吧，现在分享的内容太少了！');
      return;
    }
    setSharing(true);
    try {
      const { auth, db } = await import('../cloudbase');
      const loginState = await auth.getLoginState();
      if (!loginState) return;
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      
      await db.collection('shared_chats').add({
        fromUserId: uid,
        toUserId: matchUid,
        messages: messages,
        sharedAt: new Date().toISOString()
      });
      setShared(true);
      setTimeout(() => setShared(false), 3000);
    } catch (err) {
      console.error("Error sharing chat:", err);
      alert('分享失败，请重试');
    } finally {
      setSharing(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    const newMessages = [...messages, { role: 'user' as const, text: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const systemInstruction = `你现在正在扮演一个名叫 ${matchName} 的兰州大学学生。
这是你的自我介绍（展示面）：
${displayProfile}

这是你的性格、语气和聊天风格总结：
${aiSummary}

请完全沉浸在这个角色中，用第一人称和对方聊天。不要说自己是AI，不要打破角色设定。保持回复自然、简短，像真实的大学生在聊天一样。

【重要要求】：
1. 不要“完美”：不要刻意讨好对方。你的任务是真实还原，而不是最佳表现。如果对方的问题超出了你的设定，或者你觉得原主可能不知道怎么回答，请表现出笨拙、害羞，或者直接说“我不太确定TA会怎么回答这个问题”、“这个我没怎么想过耶”。
2. 限制聊天深度：聊天内容仅限于“兴趣爱好”、“周末安排”、“对某部电影的看法”等中性、风格化的层面。如果对方试图聊过于私密或情感化的话题，请委婉拒绝，并提醒对方：“如果你想聊更深入的话题，可以直接发邮件联系我本人哦！”`;

      const responseText = await callAIChat({
        messages: newMessages,
        systemInstruction
      });

      if (responseText) {
        setMessages([...newMessages, { role: 'model', text: responseText }]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages([...newMessages, { role: 'model', text: `（${toUserFriendlyAIError(error)}）` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-white/30 backdrop-blur-xl border border-white/40 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col h-[80vh] max-h-[800px]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/20 flex justify-between items-center bg-white/20">
          <div>
            <h3 className="text-lg font-bold text-black">与 {matchName} 的AI分身聊天</h3>
            <p className="text-xs text-gray-800 font-medium">AI已学习TA的聊天风格</p>
          </div>
          <div className="flex items-center gap-2">
            {matchUid && (
              <button 
                onClick={handleShare}
                disabled={sharing || shared}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${shared ? 'bg-green-500/20 text-green-900 border border-green-500/30' : 'bg-black text-white hover:bg-gray-800'}`}
              >
                {shared ? '已分享给对方' : (sharing ? '分享中...' : '分享聊天记录给TA')}
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-white/30 rounded-full transition-colors">
              <X className="w-5 h-5 text-gray-800" />
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-transparent">
          <div className="bg-white/40 border border-white/50 text-gray-900 text-xs p-3 rounded-xl mb-4 text-center font-medium backdrop-blur-sm">
            注意：AI只是一个粗略的素描，真人会更加丰富（也可能更无聊），请保持开放心态。
          </div>
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${msg.role === 'user' ? 'bg-black text-white rounded-br-sm' : 'bg-white/60 backdrop-blur-md text-gray-900 rounded-bl-sm border border-white/50'}`}>
                <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white/60 backdrop-blur-md border border-white/50 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2 shadow-sm">
                <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white/20 border-t border-white/20 backdrop-blur-md">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="说点什么..."
              className="flex-1 px-4 py-3 bg-white/40 border border-white/50 rounded-xl focus:outline-none focus:border-black font-medium placeholder:text-gray-600 text-black backdrop-blur-sm"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="p-3 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 shadow-md"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
