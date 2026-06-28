import React from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Shield, Calendar, Sparkles } from 'lucide-react';

export default function WelcomeScreen({ showWelcome, setShowWelcome, tasks, habits }) {
  const pendingTasksCount = tasks.filter(t => !t.completed).length;

  // Stagger container
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 100, damping: 15 }
    }
  };

  return (
    <motion.div 
      className="welcome-screen-overlay"
      initial={{ y: 0 }}
      animate={{ y: 0 }}
      exit={{ y: '-100vh' }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Particles/ambient particles */}
      <div className="ambient-glow glow-1"></div>
      <div className="ambient-glow glow-2"></div>
      <div className="ambient-glow glow-3"></div>

      <motion.div 
        className="welcome-content"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div 
          className="welcome-logo-container"
          variants={itemVariants}
          whileHover={{ scale: 1.1, rotate: 180 }}
          transition={{ type: "spring", stiffness: 200, damping: 10 }}
        >
          <svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" strokeWidth="3" fill="none">
            <polygon points="12 2 2 22 22 22" />
          </svg>
        </motion.div>

        <motion.h1 
          className="welcome-title"
          variants={itemVariants}
        >
          ZENITH
        </motion.h1>

        <motion.p 
          className="welcome-subtitle"
          variants={itemVariants}
        >
          An Intelligent AI Productivity &amp; Schedule Orchestration Engine
        </motion.p>
        
        <motion.div 
          className="welcome-card glass" 
          variants={itemVariants}
          style={{ maxWidth: '400px', backdropFilter: 'blur(16px)', background: 'rgba(12, 12, 14, 0.6)', border: '1px solid rgba(255,255,255,0.03)' }}
          whileHover={{ y: -4, borderColor: 'rgba(139, 92, 246, 0.2)' }}
        >
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
            ACTIVE COGNITIVE AGENDA
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <motion.div 
                style={{ fontSize: '26px', fontWeight: '800', color: 'var(--cyan)' }}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', delay: 0.6 }}
              >
                {pendingTasksCount}
              </motion.div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600', marginTop: '4px' }}>Tasks</div>
            </div>
            <div style={{ borderLeft: '1px solid var(--card-border)' }}></div>
            <div style={{ textAlign: 'center' }}>
              <motion.div 
                style={{ fontSize: '26px', fontWeight: '800', color: 'var(--primary)' }}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', delay: 0.7 }}
              >
                {habits.length}
              </motion.div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600', marginTop: '4px' }}>Habits</div>
            </div>
          </div>
        </motion.div>

        <motion.div 
          className="welcome-scroll-indicator" 
          onClick={() => setShowWelcome(false)}
          variants={itemVariants}
        >
          <span className="welcome-scroll-text">Scroll Down or Click to Enter</span>
          <div className="mouse-scroll">
            <div className="mouse-scroll-wheel"></div>
          </div>
          <ChevronDown size={16} />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
