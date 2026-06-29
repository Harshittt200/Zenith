import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { API_URL } from './config';

// Modular components
import WelcomeScreen from './components/WelcomeScreen';
import Sidebar from './components/Sidebar';
import AIPanel from './components/AIPanel';
import DashboardView from './components/DashboardView';
import TasksView from './components/TasksView';
import CalendarView from './components/CalendarView';
import HabitsView from './components/HabitsView';
import SettingsView from './components/SettingsView';
import ToastContainer from './components/ToastContainer';

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [habits, setHabits] = useState([]);
  const [insights, setInsights] = useState([]);
  const [calendarBlocks, setCalendarBlocks] = useState([]);
  const [settings, setSettings] = useState({
    username: 'Guest',
    dailyFocusTarget: 240,
    voiceURI: 'default',
    pitch: 1.0,
    rate: 1.0
  });

  const [currentView, setCurrentView] = useState('dashboard');
  const [focusShieldActive, setFocusShieldActive] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  
  // Modals & notices
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [habitModalOpen, setHabitModalOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  
  // Chat Companion panel
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { sender: 'ai', text: 'Greetings, I am Zenith, your productivity companion. How can I help you optimize your day? Feel free to speak or type commands.' }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [alertedTaskIds, setAlertedTaskIds] = useState([]);
  
  // Voice Synthesis/Recognition
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef(null);
  const chatHistoryEndRef = useRef(null);
  const canvasRef = useRef(null);

  // 1. Particle Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let animationId;
    let particles = [];
    const maxParticles = 65;
    
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    
    // Create random nodes
    for (let i = 0; i < maxParticles; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 2 + 1
      });
    }
    
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const isDark = !document.body.classList.contains('light-mode');
      
      // Select canvas color based on light/dark mode
      ctx.fillStyle = isDark ? 'rgba(139, 92, 246, 0.12)' : 'rgba(139, 92, 246, 0.05)';
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.01)';
      
      particles.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        
        for (let j = idx + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      });
      
      animationId = requestAnimationFrame(draw);
    };
    
    draw();
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, []);

  // 2. Load API backend details & voice hooks
  useEffect(() => {
    // Clear Google Calendar session on load/reload to force a new sign-in
    fetch(`${API_URL}/api/logout`, { method: 'POST' }).catch(() => {});

    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
    fetchInitialData();
    initSpeechRecognition();

    const handleUnload = () => {
      navigator.sendBeacon(`${API_URL}/api/logout`);
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  // 3. Welcome Screen Scroll event blocker
  useEffect(() => {
    if (!showWelcome) {
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
      return;
    }
    
    const handleScroll = (e) => {
      if (e.deltaY > 15) {
        if (e.cancelable) e.preventDefault();
        setShowWelcome(false);
      }
    };

    let touchStart = 0;
    const handleTouchStart = (e) => {
      touchStart = e.touches[0].clientY;
    };
    
    const handleTouchMove = (e) => {
      const touchEnd = e.touches[0].clientY;
      if (touchStart - touchEnd > 40) {
        if (e.cancelable) e.preventDefault();
        setShowWelcome(false);
      }
    };

    window.addEventListener('wheel', handleScroll, { passive: false });
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    
    return () => {
      window.removeEventListener('wheel', handleScroll);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [showWelcome]);

  useEffect(() => {
    if (chatHistoryEndRef.current) {
      chatHistoryEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isTyping]);

  // Periodic active task checker for alarms
  useEffect(() => {
    const checkDeadlines = () => {
      const now = new Date();
      tasks.forEach(task => {
        if (task.completed) return;
        
        const deadline = new Date(task.deadline);
        if (deadline <= now && !alertedTaskIds.includes(task.id)) {
          const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000);
          if (deadline > tenMinsAgo) {
            triggerToast("⏰ Task Reminder", `Time to complete: ${task.title}`);
            speakText(`Vocal alarm. It is time to complete ${task.title}`);
          }
          setAlertedTaskIds(prev => [...prev, task.id]);
        }
      });
    };

    checkDeadlines();
    const interval = setInterval(checkDeadlines, 5000);
    return () => clearInterval(interval);
  }, [tasks, alertedTaskIds]);

  const fetchInitialData = async () => {
    try {
      const tasksRes = await fetch(`${API_URL}/api/tasks`);
      if (tasksRes.ok) setTasks(await tasksRes.json());

      const habitsRes = await fetch(`${API_URL}/api/habits`);
      if (habitsRes.ok) setHabits(await habitsRes.json());

      const settingsRes = await fetch(`${API_URL}/api/settings`);
      if (settingsRes.ok) setSettings(await settingsRes.json());

      const insightsRes = await fetch(`${API_URL}/api/insights`);
      if (insightsRes.ok) setInsights(await insightsRes.json());

      const calRes = await fetch(`${API_URL}/api/calendar`);
      if (calRes.ok) {
        const calData = await calRes.json();
        setCalendarBlocks(calData.calendar_blocks || []);
      }
    } catch (e) {
      console.error("Local mock server active", e);
      triggerToast("⚠️ Sandbox Connected", "Running Zenith locally with simulated DB.");
    }
  };

  const triggerToast = (title, description) => {
    if (focusShieldActive) return;
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, description }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const speakText = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = settings.pitch;
    utterance.rate = settings.rate;

    const voices = window.speechSynthesis.getVoices();
    const selectedVoice = voices.find(v => v.voiceURI === settings.voiceURI);
    if (selectedVoice) utterance.voice = selectedVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const initSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.lang = 'en-US';
    rec.interimResults = false;

    rec.onstart = () => setIsListening(true);
    rec.onresult = (e) => submitUserMessage(e.results[0][0].transcript);
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);

    recognitionRef.current = rec;
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      triggerToast("Audio Error", "Microphone speech is unsupported.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      window.speechSynthesis.cancel();
      recognitionRef.current.start();
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    const title = e.target.title.value;
    const deadline = e.target.deadline.value;
    const duration = parseInt(e.target.duration.value);
    const difficulty = e.target.difficulty.value;
    const category = e.target.category.value;
    const autoDecompose = e.target.autoDecompose.checked;

    setTaskModalOpen(false);
    triggerToast("🤖 Zenith Agent Decomposing", "Formulating task outlines...");

    try {
      const res = await fetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          deadline: new Date(deadline).toISOString().replace('.000', ''),
          duration,
          difficulty,
          category,
          autoDecompose
        })
      });

      if (res.ok) {
        const newTask = await res.json();
        setTasks(prev => [...prev, newTask]);
        triggerToast("✅ Action Added", `Roadmap created for: ${title}`);
        speakText(`Task ${title} registered.`);
        refreshCalendarSilent();
      }
    } catch (err) {
      console.error(err);
      triggerToast("❌ API Error", "Db write failed.");
    }
  };

  const toggleTaskCompletion = async (taskId) => {
    try {
      const res = await fetch(`${API_URL}/api/tasks/${taskId}/toggle`, { method: 'PATCH' });
      if (res.ok) {
        const updated = await res.json();
        setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
        if (updated.completed) {
          triggerToast("🎉 Focus Clear", "Focus slot successfully finished!");
          speakText("Workblock completed.");
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleSubtaskCompletion = async (taskId, subtaskId) => {
    try {
      const res = await fetch(`${API_URL}/api/tasks/${taskId}/subtask/${subtaskId}/toggle`, { method: 'PATCH' });
      if (res.ok) {
        const updated = await res.json();
        setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteTask = async (taskId) => {
    try {
      const res = await fetch(`${API_URL}/api/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok) {
        setTasks(prev => prev.filter(t => t.id !== taskId));
        triggerToast("🗑️ Task Cleared", "Agenda details updated.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const optimizeSchedule = async () => {
    triggerToast("🤖 Optimization Running", "Regulating schedule blocks...");
    try {
      const res = await fetch(`${API_URL}/api/optimize`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setCalendarBlocks(data.calendar_blocks || []);
        setInsights(data.insights || []);
        triggerToast("🗓️ Schedule Tuned", "Synchronized GCal blocks!");
        speakText("Schedule optimized and synced to Google Calendar.");
      }
    } catch (e) {
      console.error(e);
      triggerToast("⚠️ Sync Error", "Schedule sync failed.");
    }
  };

  const refreshCalendar = async () => {
    triggerToast("🔄 Syncing External Blocks", "Updating latest calendar items...");
    try {
      const res = await fetch(`${API_URL}/api/calendar`);
      if (res.ok) {
        const data = await res.json();
        setCalendarBlocks(data.calendar_blocks || []);
        triggerToast("🔄 GCal Connected", "Updated calendar schedule.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const refreshCalendarSilent = async () => {
    try {
      const res = await fetch(`${API_URL}/api/calendar`);
      if (res.ok) {
        const data = await res.json();
        setCalendarBlocks(data.calendar_blocks || []);
      }
    } catch (e) {}
  };

  const handleAddHabit = async (e) => {
    e.preventDefault();
    const name = e.target.name.value;
    const frequency = e.target.frequency.value;
    const time = e.target.time.value;
    setHabitModalOpen(false);

    try {
      const res = await fetch(`${API_URL}/api/habits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, frequency, time })
      });

      if (res.ok) {
        const newHabit = await res.json();
        setHabits(prev => [...prev, newHabit]);
        triggerToast("✨ Ritual Formed", `Logged ritual: ${name}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleHabitCompletion = async (habitId, dateStr) => {
    try {
      const res = await fetch(`${API_URL}/api/habits/${habitId}/toggle/${dateStr}`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        setHabits(prev => prev.map(h => h.id === habitId ? updated : h));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteHabit = async (habitId) => {
    try {
      const res = await fetch(`${API_URL}/api/habits/${habitId}`, { method: 'DELETE' });
      if (res.ok) {
        setHabits(prev => prev.filter(h => h.id !== habitId));
        triggerToast("🗑️ Habit Removed", "Habit tracker updated.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const submitUserMessage = async (messageText) => {
    if (!messageText.trim()) return;
    setChatInput('');
    
    const userMsg = { sender: 'user', text: messageText };
    setChatHistory(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          history: [...chatHistory, userMsg]
        })
      });

      if (res.ok) {
        const data = await res.json();
        setChatHistory(prev => [...prev, { sender: 'ai', text: data.reply }]);
        setIsTyping(false);
        speakText(data.reply);

        if (data.reply.includes("reminder") || data.reply.includes("schedule")) {
          setTimeout(fetchInitialData, 1000);
        }
      }
    } catch (err) {
      console.error(err);
      setIsTyping(false);
    }
  };

  const saveSettings = async (updatedSettings) => {
    try {
      const res = await fetch(`${API_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        triggerToast("⚙️ Calibration Saved", "Updated user settings.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getHeaderDate = () => {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  // Dynamic calculations
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const highEnergyPending = tasks.filter(t => !t.completed && t.difficulty === 'high').length;

  return (
    <div className="app-container">
      {/* HTML5 Particle Network Canvas */}
      <canvas ref={canvasRef} className="background-canvas" />

      <AnimatePresence>
        {showWelcome && (
          <WelcomeScreen 
            showWelcome={showWelcome}
            setShowWelcome={setShowWelcome}
            tasks={tasks}
            habits={habits}
          />
        )}
      </AnimatePresence>

      {/* LEFT SIDEBAR NAVIGATION */}
      <Sidebar 
        currentView={currentView}
        setCurrentView={setCurrentView}
        username={settings.username}
      />

      {/* MAIN VIEWPORT */}
      <main className="main-content">
        <header className="app-header">
          <div className="header-search">
            <span className="current-date-pill">{getHeaderDate()}</span>
          </div>
          <div className="header-actions">
            <button 
              className="header-btn" 
              onClick={() => {
                document.body.classList.toggle('light-mode');
                document.body.classList.toggle('dark-mode');
              }}
              title="Toggle Light/Dark Theme"
            >
              <Sun size={16} />
            </button>
          </div>
        </header>

        <div className="view-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="view-section"
              style={{ display: 'block' }}
            >
              {currentView === 'dashboard' && (
                <DashboardView 
                  settings={settings}
                  highEnergyPending={highEnergyPending}
                  focusShieldActive={focusShieldActive}
                  setFocusShieldActive={setFocusShieldActive}
                  triggerToast={triggerToast}
                  speakText={speakText}
                  taskCompletionRate={taskCompletionRate}
                  habits={habits}
                  tasks={tasks}
                  toggleTaskCompletion={toggleTaskCompletion}
                  insights={insights}
                  setCurrentView={setCurrentView}
                />
              )}

              {currentView === 'tasks' && (
                <TasksView 
                  tasks={tasks}
                  setTaskModalOpen={setTaskModalOpen}
                  toggleTaskCompletion={toggleTaskCompletion}
                  toggleSubtaskCompletion={toggleSubtaskCompletion}
                  deleteTask={deleteTask}
                />
              )}

              {currentView === 'calendar' && (
                <CalendarView 
                  calendarBlocks={calendarBlocks}
                  refreshCalendar={refreshCalendar}
                  optimizeSchedule={optimizeSchedule}
                />
              )}

              {currentView === 'habits' && (
                <HabitsView 
                  habits={habits}
                  setHabitModalOpen={setHabitModalOpen}
                  toggleHabitCompletion={toggleHabitCompletion}
                  deleteHabit={deleteHabit}
                />
              )}

              {currentView === 'settings' && (
                <SettingsView 
                  settings={settings}
                  setSettings={setSettings}
                  onSaveSettings={saveSettings}
                  speakText={speakText}
                  isSpeaking={isSpeaking}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Companion Panel */}
      <AIPanel 
        isListening={isListening}
        isSpeaking={isSpeaking}
        chatHistory={chatHistory}
        chatInput={chatInput}
        setChatInput={setChatInput}
        isTyping={isTyping}
        chatHistoryEndRef={chatHistoryEndRef}
        submitUserMessage={submitUserMessage}
        toggleListening={toggleListening}
      />

      {/* Task Creation Modal */}
      <AnimatePresence>
        {taskModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-backdrop"
            onClick={() => setTaskModalOpen(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="modal-content glass"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Decompose Goal Block</h3>
                <button className="close-modal" onClick={() => setTaskModalOpen(false)}>&times;</button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleAddTask}>
                  <div className="form-group">
                    <label>Task Name</label>
                    <input type="text" name="title" required placeholder="e.g. Prepare client financial review" />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Deadline</label>
                      <input type="datetime-local" name="deadline" required />
                    </div>
                    <div className="form-group">
                      <label>Duration (minutes)</label>
                      <input type="number" name="duration" defaultValue={60} min={5} required />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Difficulty</label>
                      <select name="difficulty">
                        <option value="low">Low Energy</option>
                        <option value="medium">Medium Focus</option>
                        <option value="high">High Deep Work</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Category</label>
                      <select name="category">
                        <option value="work">Work &amp; Projects</option>
                        <option value="study">Study &amp; Research</option>
                        <option value="life">Personal &amp; Health</option>
                        <option value="finance">Finance &amp; Bills</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group checkbox-group">
                    <label className="checkbox-container">
                      <input type="checkbox" name="autoDecompose" defaultChecked />
                      <span className="checkmark"></span>
                      Auto-decompose into checklists
                    </label>
                  </div>
                  <div className="modal-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setTaskModalOpen(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary">Prioritize &amp; Schedule</button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Habit Creation Modal */}
      <AnimatePresence>
        {habitModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-backdrop"
            onClick={() => setHabitModalOpen(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="modal-content glass"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Track Daily Ritual</h3>
                <button className="close-modal" onClick={() => setHabitModalOpen(false)}>&times;</button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleAddHabit}>
                  <div className="form-group">
                    <label>Habit Name</label>
                    <input type="text" name="name" required placeholder="e.g. Workout 30 mins" />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Frequency</label>
                      <select name="frequency">
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Time target</label>
                      <input type="time" name="time" defaultValue="09:00" />
                    </div>
                  </div>
                  <div className="modal-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setHabitModalOpen(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary">Establish Habit</button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ToastContainer toasts={toasts} setToasts={setToasts} />
    </div>
  );
}
