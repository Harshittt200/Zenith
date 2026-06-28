import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Check, Trash2, Shield } from 'lucide-react';

export default function HabitsView({
  habits,
  setHabitModalOpen,
  toggleHabitCompletion,
  deleteHabit
}) {
  return (
    <div>
      <div className="section-header">
        <div>
          <h2>Consistency Habit Tracker</h2>
          <p>Create habit rituals and track streaks directly inside the glassmorphic planner.</p>
        </div>
        <motion.button 
          className="btn btn-primary" 
          onClick={() => setHabitModalOpen(true)}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <Plus size={16} />
          <span>Create New Habit</span>
        </motion.button>
      </div>

      <div className="habits-container">
        {habits.length === 0 ? (
          <div className="empty-state">
            <p>No habits configured. Click 'Create New Habit' to begin.</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {habits.map(habit => {
              const dayLabels = [];
              for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                dayLabels.push({
                  dateStr: d.toISOString().split('T')[0],
                  dayLetter: d.toLocaleDateString('en-US', { weekday: 'narrow' })
                });
              }

              return (
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                  key={habit.id} 
                  className="habit-card glass" 
                  style={{ position: 'relative' }}
                  whileHover={{ y: -4, borderColor: 'rgba(16, 185, 129, 0.3)' }}
                >
                  <div className="habit-card-header">
                    <div className="habit-info">
                      <h3>{habit.name}</h3>
                      <p>Target: {habit.time} | Frequency: {habit.frequency}</p>
                    </div>
                    <div className="habit-streak-badge">Streak: {habit.streak}d</div>
                  </div>
                  
                  <div className="habit-grid-tracker" style={{ marginTop: '16px' }}>
                    <span className="tracker-title">PAST 7 DAYS</span>
                    <div className="habit-weeks-dots" style={{ marginTop: '8px' }}>
                      {dayLabels.map(day => {
                        const isCompleted = habit.history && habit.history[day.dateStr];
                        return (
                          <div key={day.dateStr} className="habit-dot-day">
                            <motion.div 
                              className={`habit-dot ${isCompleted ? 'completed' : ''}`}
                              onClick={() => toggleHabitCompletion(habit.id, day.dateStr)}
                              whileTap={{ scale: 0.8 }}
                            >
                              {isCompleted && <Check size={10} style={{ color: 'black' }} />}
                            </motion.div>
                            <span className="habit-dot-label">{day.dayLetter}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <motion.button 
                    className="btn-icon-danger" 
                    onClick={() => deleteHabit(habit.id)}
                    style={{ position: 'absolute', bottom: '12px', right: '16px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Trash2 size={12} />
                    <span>Delete</span>
                  </motion.button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
