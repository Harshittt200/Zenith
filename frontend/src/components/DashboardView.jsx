import React from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles, Award } from 'lucide-react';

export default function DashboardView({
  settings,
  highEnergyPending,
  focusShieldActive,
  setFocusShieldActive,
  triggerToast,
  speakText,
  taskCompletionRate,
  habits,
  tasks,
  toggleTaskCompletion,
  insights,
  setCurrentView
}) {
  const activeTasks = tasks.filter(t => !t.completed);
  const maxStreak = habits.length > 0 ? Math.max(...habits.map(h => h.streak), 0) : 0;

  // Stagger configurations
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1, y: 0,
      transition: { type: 'spring', stiffness: 100, damping: 15 }
    }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Banner */}
      <motion.div 
        className="welcome-banner" 
        variants={itemVariants}
        style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(6, 182, 212, 0.04) 100%)' }}
      >
        <div className="welcome-text">
          <h2>Welcome back, {settings.username}!</h2>
          <p>Zenith AI optimized today's agenda. You have <span className="high-priority-count">{highEnergyPending}</span> intensive focus tasks pending.</p>
        </div>
        <div className="focus-mode-toggle-card">
          <span className="focus-label">DEEP FOCUS SHIELD</span>
          <label className="switch">
            <input 
              type="checkbox" 
              checked={focusShieldActive} 
              onChange={(e) => {
                setFocusShieldActive(e.target.checked);
                triggerToast(
                  e.target.checked ? "🛡️ Shield Active" : "Shield Deactivated",
                  e.target.checked ? "Notifications muted for deep focus window." : "Ambient notices restored."
                );
                speakText(e.target.checked ? "Deep focus shield activated." : "Focus shield deactivated.");
              }}
            />
            <span className="slider"></span>
          </label>
        </div>
      </motion.div>

      {/* Metrics Grid */}
      <motion.div className="metrics-grid" variants={itemVariants}>
        <motion.div 
          className="metric-card glass"
          whileHover={{ y: -4, borderColor: 'rgba(6, 182, 212, 0.3)' }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <div className="metric-icon completion">
            <Check size={20} />
          </div>
          <div className="metric-data">
            <h3>Task Completion</h3>
            <div className="metric-val">{taskCompletionRate}%</div>
            <div className="progress-bar-container">
              <motion.div 
                className="progress-bar" 
                initial={{ width: 0 }}
                animate={{ width: `${taskCompletionRate}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
        </motion.div>
        
        <motion.div 
          className="metric-card glass"
          whileHover={{ y: -4, borderColor: 'rgba(139, 92, 246, 0.3)' }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <div className="metric-icon energy">
            <Sparkles size={20} />
          </div>
          <div className="metric-data">
            <h3>Self-Regulation</h3>
            <div className="metric-val">84/100</div>
            <span className="metric-sub">Optimal focus window</span>
          </div>
        </motion.div>

        <motion.div 
          className="metric-card glass"
          whileHover={{ y: -4, borderColor: 'rgba(239, 68, 68, 0.3)' }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <div className="metric-icon streak">
            <Award size={20} />
          </div>
          <div className="metric-data">
            <h3>Streak Count</h3>
            <div className="metric-val">
              {maxStreak} {maxStreak === 1 ? 'Day' : 'Days'}
            </div>
            <span className="metric-sub">Consistent habits logged</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Grid columns */}
      <div className="dashboard-grid">
        <motion.div className="dashboard-card glass" variants={itemVariants}>
          <div className="card-header">
            <div>
              <h3>Urgency Priority Matrix</h3>
              <p className="subtitle">Sorted using LangGraph agent metrics</p>
            </div>
            <button className="btn-text" onClick={() => setCurrentView('tasks')}>Manage Planner</button>
          </div>
          <motion.div className="task-mini-list" layout>
            {activeTasks.length === 0 ? (
              <div className="empty-state">
                <p>No active tasks remaining. Add some inside tasks menu!</p>
              </div>
            ) : (
              activeTasks
                .sort((a, b) => b.priorityScore - a.priorityScore)
                .slice(0, 4)
                .map(task => (
                  <motion.div 
                    key={task.id} 
                    className="mini-task-item"
                    layoutId={`mini-task-${task.id}`}
                    whileHover={{ x: 4, backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
                  >
                    <div className="mini-task-left">
                      <motion.div 
                        className="mini-task-cb" 
                        onClick={() => toggleTaskCompletion(task.id)}
                        whileTap={{ scale: 0.8 }}
                      />
                      <span className="mini-task-title">{task.title}</span>
                    </div>
                    <div className="mini-task-right">
                      <span className={`mini-task-pill ${task.difficulty}`}>{task.difficulty}</span>
                      <span className="mini-task-pill ai-score">AI Score: {task.priorityScore}</span>
                    </div>
                  </motion.div>
                ))
            )}
          </motion.div>
        </motion.div>

        <motion.div className="dashboard-card glass" variants={itemVariants}>
          <div className="card-header">
            <h3>Cognitive Insights Feed</h3>
          </div>
          <div className="insights-feed">
            {insights.length === 0 ? (
              <div className="empty-state">
                <p>Calculating insights. Ask Zenith to optimize your calendar schedule.</p>
              </div>
            ) : (
              insights.map((insight, idx) => (
                <motion.div 
                  key={idx} 
                  className="insight-item"
                  whileHover={{ scale: 1.01 }}
                >
                  <div className={`insight-indicator ${insight.type}`} />
                  <div className="insight-content">
                    <h4>{insight.title}</h4>
                    <p>{insight.description}</p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
