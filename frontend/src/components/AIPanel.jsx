import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Send } from 'lucide-react';

export default function AIPanel({
  isListening,
  isSpeaking,
  chatHistory,
  chatInput,
  setChatInput,
  isTyping,
  chatHistoryEndRef,
  submitUserMessage,
  toggleListening
}) {
  return (
    <aside className="ai-panel glass">
      <div className="ai-header">
        <div className="ai-brand-badge">
          <span className="pulse-ring"></span>
          <span>ZENITH AI</span>
        </div>
      </div>

      <div className="ai-body">
        <AnimatePresence mode="wait">
          {(isListening || isSpeaking) && (
            <motion.div 
              className="voice-visualizer-container listening"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 32 }}
              exit={{ opacity: 0, height: 0 }}
              style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '3px' }}
            >
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  className="wave-bar"
                  animate={{
                    height: isListening ? [4, 28, 4] : [4, 18, 4],
                  }}
                  transition={{
                    duration: isListening ? (0.4 + (i * 0.08)) : (0.6 + (i * 0.1)),
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  style={{
                    width: '2px',
                    borderRadius: '2px',
                    background: 'linear-gradient(180deg, var(--cyan), var(--primary))'
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="ai-status">
          {isListening ? 'Listening for voice command...' : isSpeaking ? 'Zenith Vocalizing...' : 'Zenith Assistant Active'}
        </div>

        <div className="ai-chat-history">
          <AnimatePresence initial={false}>
            {chatHistory.map((chat, idx) => (
              <motion.div 
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                key={idx} 
                className={`chat-bubble ${chat.sender}`}
              >
                {chat.text}
              </motion.div>
            ))}
          </AnimatePresence>
          {isTyping && (
            <motion.div 
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 0.7, y: 0 }}
              transition={{ repeat: Infinity, duration: 1, repeatType: 'reverse' }}
              className="chat-bubble ai"
            >
              Zenith is formulating...
            </motion.div>
          )}
          <div ref={chatHistoryEndRef}></div>
        </div>
      </div>

      <div className="ai-footer">
        <div className="chat-input-wrapper">
          <input 
            type="text" 
            placeholder="Talk with Zenith..." 
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitUserMessage(chatInput)}
          />
          <motion.button 
            className={`mic-btn ${isListening ? 'active' : ''}`}
            onClick={toggleListening}
            title="Mic Speech recognition"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
          >
            <Mic size={15} />
          </motion.button>
          <motion.button 
            className="send-btn" 
            onClick={() => submitUserMessage(chatInput)}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
          >
            <Send size={15} />
          </motion.button>
        </div>
      </div>
    </aside>
  );
}
