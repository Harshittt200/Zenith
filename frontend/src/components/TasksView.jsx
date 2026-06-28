import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Check, Trash2, Calendar, AlertTriangle } from 'lucide-react';

export default function TasksView({
  tasks,
  setTaskModalOpen,
  toggleTaskCompletion,
  toggleSubtaskCompletion,
  deleteTask
}) {
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('ai-priority');

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (filter === 'active') return !task.completed;
    if (filter === 'completed') return task.completed;
    return true;
  });

  // Sort tasks
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (sortBy === 'deadline') {
      return new Date(a.deadline) - new Date(b.deadline);
    }
    if (sortBy === 'difficulty') {
      const diffMap = { high: 3, medium: 2, low: 1 };
      return (diffMap[b.difficulty] || 0) - (diffMap[a.difficulty] || 0);
    }
    // Default: AI Priority score descending
    return (b.priorityScore || 0) - (a.priorityScore || 0);
  });

  return (
    <div>
      <div className="section-header">
        <div>
          <h2>LangGraph Task Planner</h2>
          <p>Decompose goals, prioritize cognitive load, and track subtask check points.</p>
        </div>
        <motion.button 
          className="btn btn-primary" 
          onClick={() => setTaskModalOpen(true)}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <Plus size={16} />
          <span>Create New Task</span>
        </motion.button>
      </div>

      {/* Filter Tabs & Sorting */}
      <div className="task-filters">
        <div className="filter-group">
          {['all', 'active', 'completed'].map(f => (
            <button 
              key={f}
              className={`filter-tab ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
              style={{ textTransform: 'capitalize', position: 'relative' }}
            >
              {filter === f && (
                <motion.div 
                  layoutId="activeFilterBg"
                  style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '6px',
                    border: '1px solid var(--card-border)',
                    zIndex: -1
                  }}
                />
              )}
              {f === 'all' ? 'All Tasks' : f}
            </button>
          ))}
        </div>
        <div className="sort-selector" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <label style={{ color: 'var(--text-muted)' }}>Sort By:</label>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--card-border)',
              borderRadius: '6px',
              padding: '4px 8px',
              color: 'var(--text-bright)',
              cursor: 'pointer'
            }}
          >
            <option value="ai-priority">AI Priority Index</option>
            <option value="deadline">Deadline Proximity</option>
            <option value="difficulty">Difficulty Level</option>
          </select>
        </div>
      </div>

      {/* Tasks List */}
      <motion.div className="task-master-container" layout>
        <AnimatePresence mode="popLayout" initial={false}>
          {sortedTasks.length === 0 ? (
            <motion.div 
              className="empty-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              key="empty"
            >
              <p>No tasks matched this view. Create one or request recommendations from Zenith AI.</p>
            </motion.div>
          ) : (
            sortedTasks.map(task => (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                key={task.id} 
                className={`task-card glass priority-${task.difficulty} ${task.completed ? 'completed' : ''}`}
                whileHover={{ borderColor: 'rgba(255,255,255,0.06)', y: -2 }}
              >
                <div className="task-card-top">
                  <div className="task-meta-left">
                    <motion.div 
                      className="mini-task-cb" 
                      onClick={() => toggleTaskCompletion(task.id)}
                      whileTap={{ scale: 0.8 }}
                    >
                      {task.completed && <Check size={10} />}
                    </motion.div>
                    <div className="task-title-group">
                      <h4>{task.title}</h4>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px', alignItems: 'center' }}>
                        <span className="task-category-badge">{task.category}</span>
                        <span className="task-date-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={11} />
                          {new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="task-meta-right">
                    {!task.completed && (
                      <span className="ai-priority-score-badge">AI Score: {task.priorityScore}</span>
                    )}
                    <motion.button 
                      className="btn-icon-danger" 
                      onClick={() => deleteTask(task.id)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Trash2 size={16} />
                    </motion.button>
                  </div>
                </div>

                {/* Subtask Section */}
                {task.subtasks && task.subtasks.length > 0 && (
                  <motion.div 
                    className="task-subtasks-section"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ delay: 0.1 }}
                  >
                    <div className="subtask-section-header">
                      <h5>DECOMPOSED ROADMAP</h5>
                    </div>
                    <div className="subtask-list">
                      {task.subtasks.map(sub => (
                        <div key={sub.id} className={`subtask-item ${sub.completed ? 'completed' : ''}`}>
                          <motion.div 
                            className="subtask-cb" 
                            onClick={() => toggleSubtaskCompletion(task.id, sub.id)}
                            whileTap={{ scale: 0.8 }}
                          >
                            {sub.completed && <Check size={8} />}
                          </motion.div>
                          <span>{sub.title}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
