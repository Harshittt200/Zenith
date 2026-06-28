import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, RefreshCw } from 'lucide-react';

export default function CalendarView({ calendarBlocks, refreshCalendar, optimizeSchedule }) {
  return (
    <div>
      <div className="section-header">
        <div>
          <h2>AI Timeblock Calendar</h2>
          <p>Synchronize optimized schedule blocks directly with your Google Calendar account.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <motion.button 
            className="btn btn-secondary" 
            onClick={refreshCalendar} 
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <RefreshCw size={15} />
            <span>Refresh Calendar</span>
          </motion.button>
          <motion.button 
            className="btn btn-neon" 
            onClick={optimizeSchedule} 
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            whileHover={{ scale: 1.02, filter: 'brightness(1.15)' }}
            whileTap={{ scale: 0.98 }}
          >
            <Sparkles size={15} />
            <span>AI Schedule &amp; GCal Sync</span>
          </motion.button>
        </div>
      </div>

      <div className="calendar-layout glass">
        <div className="calendar-grid">
          <div className="calendar-days-header" style={{ gridTemplateColumns: '80px repeat(7, 1fr)' }}>
            <div className="calendar-day-col-header">Hour</div>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
              <div key={idx} className="calendar-day-col-header">
                <div>{day}</div>
              </div>
            ))}
          </div>
          
          <div className="calendar-time-body">
            <div className="calendar-time-column">
              {['09 AM', '10 AM', '11 AM', '12 PM', '01 PM', '02 PM', '03 PM', '04 PM', '05 PM'].map((label, idx) => (
                <div key={idx} className="time-label">{label}</div>
              ))}
            </div>
            <div className="calendar-events-grid" style={{ position: 'relative', height: '450px' }}>
              <AnimatePresence>
                {calendarBlocks.map((block, idx) => {
                  let colIndex = block.dayOfWeek - 1; // 1-7 (Mon-Sun)
                  if (colIndex < 0 || colIndex > 6) colIndex = 0;
                  
                  const hourHeight = 450 / 8;
                  const topOffset = (block.startHour - 9) * hourHeight;
                  const height = block.durationHours * hourHeight;

                  return (
                    <motion.div 
                      key={block.taskId + '-' + idx} 
                      className={`calendar-event-block cat-${block.category}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      whileHover={{ scale: 1.03, zIndex: 10, boxShadow: '0 4px 15px rgba(0,0,0,0.4)' }}
                      style={{
                        top: `${topOffset}px`,
                        height: `${height}px`,
                        left: `calc(${(colIndex / 7) * 100}% + 4px)`,
                        width: `calc(${(1 / 7) * 100}% - 8px)`,
                        cursor: 'pointer'
                      }}
                    >
                      <div className="event-block-title">{block.title}</div>
                      <div className="event-block-time">{block.startTimeStr}</div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
import { AnimatePresence } from 'framer-motion';
