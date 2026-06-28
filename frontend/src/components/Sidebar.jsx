import React from 'react';
import { motion } from 'framer-motion';
import { LayoutGrid, FileText, Calendar, Shield, Settings as SettingsIcon } from 'lucide-react';

export default function Sidebar({ currentView, setCurrentView, username }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'tasks', label: 'Tasks Planner', icon: FileText },
    { id: 'calendar', label: 'AI Calendar', icon: Calendar },
    { id: 'habits', label: 'Habit Tracker', icon: Shield },
    { id: 'settings', label: 'Calibration', icon: SettingsIcon },
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <motion.div 
          className="brand-logo"
          whileHover={{ scale: 1.05, rotate: 10 }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="3" fill="none">
            <polygon points="12 2 2 22 22 22" />
          </svg>
        </motion.div>
        <h1>Zenith</h1>
      </div>

      <div className="nav-menu">
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <motion.button 
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`} 
              onClick={() => setCurrentView(item.id)}
              whileHover={{ x: 4, backgroundColor: 'rgba(255, 255, 255, 0.04)' }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              style={{ position: 'relative', width: '100%', textAlign: 'left' }}
            >
              {isActive && (
                <motion.div 
                  layoutId="activeNavBg"
                  style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--card-border)',
                    borderRadius: '8px',
                    zIndex: -1
                  }}
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <Icon size={18} />
              <span>{item.label}</span>
            </motion.button>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <div className="user-profile">
          <motion.div 
            className="user-avatar"
            whileHover={{ scale: 1.05 }}
          >
            {username ? username[0].toUpperCase() : 'G'}
          </motion.div>
          <div className="user-info">
            <span className="user-name">{username || 'Guest'}</span>
            <span className="user-status">AI Connected</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
