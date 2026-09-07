import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { callAIChat, toUserFriendlyAIError } from '../services/aiService';

interface Message {
  role: 'user' | 'model';
  text: string;
}

export default function AIChatOnboarding({ onSummaryGenerated }: { onSummaryGenerated: (summary: string) => void }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: '你好！我是你的专属AI助手。为了更好地了解你并帮你找到合适的匹配，我们来随便聊聊吧！你可以说说你的爱好，或者最近开心的事情。' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [summaryDone, setSummaryDone] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading || analyzing) return;

    const userMessage = input.trim();
    setInput('');
    const newMessages = [...messages, { role: 'user' as const, text: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const responseText = await callAIChat({
        messages: newMessages,
        systemInstruction: '你是一个友好的校园交友助手。你的目标是通过轻松的聊天了解用户的性格、说话风格和兴趣爱好。每次回复简短一些，像朋友一样聊天，并适当提问引导用户多说一点。'
      });

      if (responseText) {
        setMessages([...newMessages, { role: 'model', text: responseText }]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages([...newMessages, { role: 'model', text: toUserFriendlyAIError(error) }]);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (messages.length < 3) {
      alert('再多聊几句吧，我还不够了解你呢！');
      return;
    }
    
    setAnalyzing(true);
    try {
      const conversationText = messages.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.text}`).join('\n');
      
      const responseText = await callAIChat({
        model: import.meta.env.VITE_GLM_HIGH_QUALITY_MODEL || 'glm-4.7',
        messages: [
          {
            role: 'user',
            text: `Based on the following conversation, summarize the user's personality, tone of voice, and conversation style in a detailed paragraph. This summary will be used as a system instruction for an AI to roleplay as this user. Write the summary in Chinese.\n\nConversation:\n${conversationText}`
          }
        ]
      });

      if (responseText) {
        onSummaryGenerated(responseText);
        setSummaryDone(true);
      }
    } catch (error) {
      console.error("Analysis error:", error);
      alert('分析失败，请重试。');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-black text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'}`}>
              <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-2">
              <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-gray-100">
        {summaryDone ? (
          <div className="text-center text-green-600 font-bold py-2 bg-green-50 rounded-xl">
            ✅ AI已成功学习你的聊天风格！
          </div>
        ) : (
          <div className="space-y-3">
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
                placeholder="输入消息..."
                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-black font-medium"
                disabled={loading || analyzing}
              />
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!input.trim() || loading || analyzing}
                className="p-3 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing || messages.length < 3}
              className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-black rounded-xl font-bold transition-colors disabled:opacity-50 text-sm"
            >
              {analyzing ? '正在分析你的风格...' : '聊得差不多了，生成我的AI分身'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
