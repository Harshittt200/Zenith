import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export default function ToastContainer({ toasts, setToasts }) {
  return (
    <div className="toast-container">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div 
            key={toast.id} 
            className="toast"
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            layout
          >
            <div className="toast-icon">
              <Sparkles size={16} />
            </div>
            <div className="toast-body">
              <h4>{toast.title}</h4>
              <p>{toast.description}</p>
            </div>
            <span className="toast-close" onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}>
              &times;
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
