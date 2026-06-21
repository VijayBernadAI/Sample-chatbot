import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { MessageCircle, X, Send, Image as ImageIcon, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChatMessage {
  text: string;
  isBot: boolean;
  time: string;
  imagePreview?: string;
}

interface SelectedImage {
  mimeType: string;
  data: string; // Base64 raw data
  preview: string; // Base64 data URL
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      text: 'Hello! How can I help you with your food order today?',
      isBot: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to the bottom of the chat window when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const commaIndex = result.indexOf(",");
      const mimeType = result.substring(result.indexOf(":") + 1, result.indexOf(";"));
      const data = result.substring(commaIndex + 1);
      
      setSelectedImage({
        mimeType,
        data,
        preview: result
      });
    };
    reader.readAsDataURL(file);
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = async () => {
    const userMsg = message.trim();
    if (!userMsg && !selectedImage) return;

    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Add user message to the chat view logs
    const userMessageObj: ChatMessage = {
      text: userMsg || "Photo uploaded for quality inspection",
      isBot: false,
      time: timeString,
      imagePreview: selectedImage?.preview
    };

    setMessages((prev) => [...prev, userMessageObj]);
    setMessage('');
    
    // Keep reference and immediately clear UI state
    const currentImg = selectedImage ? { mimeType: selectedImage.mimeType, data: selectedImage.data } : null;
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setIsTyping(true);

    try {
      // Gather dynamic historical context to let Gemini understand conversation
      const chatHistory = messages.map(msg => ({
        text: msg.text,
        isBot: msg.isBot
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query: userMsg || "Food photo check request",
          history: chatHistory,
          image: currentImg
        })
      });

      if (!response.ok) {
        throw new Error("Failed to communicate with FoodFix assistant");
      }

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          text: data.text || "I was unable to analyze your query correctly.",
          isBot: true,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          text: "⚠️ Thank you for your inquiry. Our support systems are currently undergoing updates. Please try again shortly or contact FoodFix Hotline at 1-800-FOOD-FIX.",
          isBot: true,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Small, circular chatbot bubble at the bottom-right corner */}
      <button
        id="chatbot-trigger-bubble"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-orange-600 text-white rounded-full shadow-lg shadow-orange-500/30 z-50 flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer focus:outline-none"
        aria-label="Open support chat"
      >
        <MessageCircle size={28} />
      </button>

      {/* Chat window overlay fitting within screen bounds */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="chatbot-window-overlay"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed inset-4 sm:inset-auto sm:bottom-24 sm:right-6 sm:w-96 sm:h-[550px] bg-white shadow-2xl rounded-3xl border border-zinc-100 z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-900 text-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-orange-600 flex items-center justify-center font-bold text-sm">
                  FF
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-tight">Food Fix Support</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[10px] text-zinc-400 font-medium tracking-wide uppercase">AI Support Assistant</span>
                  </div>
                </div>
              </div>
              <button
                id="chatbot-close-button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
                aria-label="Close chat support"
              >
                <X size={20} />
              </button>
            </div>

            {/* Chat Messages Log */}
            <div className="flex-1 p-5 overflow-y-auto bg-zinc-50 space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col max-w-[85%] ${msg.isBot ? 'items-start' : 'items-end ml-auto'}`}
                >
                  {/* Photo attachment from user */}
                  {msg.imagePreview && (
                    <div className="mb-2 rounded-2xl overflow-hidden shadow-sm border border-zinc-200">
                      <img
                        src={msg.imagePreview}
                        alt="Uploaded food description"
                        className="max-h-40 object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                  <div
                    className={`p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.isBot
                        ? 'bg-white text-zinc-800 rounded-tl-none border border-zinc-100 shadow-sm'
                        : 'bg-orange-600 text-white rounded-tr-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-1 px-1">{msg.time}</span>
                </div>
              ))}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex flex-col max-w-[80%] items-start">
                  <div className="p-4 rounded-2xl bg-white border border-zinc-100 shadow-sm rounded-tl-none flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-zinc-300 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-2 h-2 bg-zinc-300 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-2 h-2 bg-zinc-300 rounded-full animate-bounce"></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Selected Image Preview Chip */}
            {selectedImage && (
              <div className="px-4 py-2 bg-zinc-100 border-t border-zinc-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 overflow-hidden">
                  <img
                    src={selectedImage.preview}
                    alt="Preview"
                    className="w-10 h-10 object-cover rounded-lg border border-zinc-300 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <span className="text-xs text-zinc-600 truncate font-medium">Ready to upload...</span>
                </div>
                <button
                  type="button"
                  onClick={removeSelectedImage}
                  className="p-1.5 text-zinc-500 hover:text-red-600 rounded-full hover:bg-zinc-200 transition-colors"
                  title="Remove image"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}

            {/* Message input space & tool area */}
            <div className="p-4 border-t border-zinc-100 bg-white flex gap-2 items-center">
              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/*"
                className="hidden"
                id="chatbot-file-upload-input"
              />
              
              {/* Image Upload Trigger */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`p-2.5 rounded-full border transition-all ${
                  selectedImage 
                    ? 'border-orange-500 text-orange-600 bg-orange-50' 
                    : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700'
                }`}
                title="Attach Food Quality Image"
              >
                <ImageIcon size={20} />
              </button>

              <input
                id="chatbot-input-field"
                type="text"
                placeholder={selectedImage ? "Add comments about the food picture..." : "Ask about policies or food quality..."}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                className="flex-1 bg-zinc-50 border border-zinc-200 outline-none focus:border-orange-500 focus:bg-white rounded-full px-5 py-2.5 text-sm text-zinc-800 transition-all placeholder:text-zinc-400"
              />
              
              <button
                id="chatbot-send-button"
                onClick={handleSend}
                disabled={!message.trim() && !selectedImage}
                className="bg-orange-600 disabled:opacity-40 text-white w-10 h-10 flex items-center justify-center rounded-full hover:bg-orange-500 transition-colors shrink-0"
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
