/* ==========================================================================
   Zenith - Main Orchestrator & UI Controller
   ========================================================================== */

const ZenithApp = {
    state: {
        tasks: [],
        habits: [],
        settings: {
            username: 'Harshit',
            dailyFocusTarget: 240,
            voiceURI: 'default',
            pitch: 1.0,
            rate: 1.0
        },
        currentView: 'dashboard',
        focusShieldActive: false,
        calendarOffset: 0
    },

    /**
     * Bootstraps application, loads data from localStorage, binds listeners
     */
    async init() {
        this.loadLocalStorage();
        this.bindEvents();
        this.setupVoiceCallbacks();
        
        // Sync with backend database on load
        await this.syncWithBackend();
        
        // Start periodic reminder check
        this.startReminderCheck();
        
        // Initial renders
        this.switchView(this.state.currentView);
        this.updateHeaderDate();
        this.renderAll();
        
        // Simulate a context notification toast 4 seconds after opening
        setTimeout(() => {
            this.triggerContextReminderSim();
        }, 4000);
    },

    startReminderCheck() {
        this.alertedTaskIds = JSON.parse(localStorage.getItem('zenith_alerted_tasks') || '[]');
        
        setInterval(() => {
            const now = new Date();
            this.state.tasks.forEach(task => {
                if (task.completed) return;
                
                const deadline = new Date(task.deadline);
                if (deadline <= now && !this.alertedTaskIds.includes(task.id)) {
                    this.alertedTaskIds.push(task.id);
                    localStorage.setItem('zenith_alerted_tasks', JSON.stringify(this.alertedTaskIds));
                    
                    // Trigger UI notification toast
                    this.showToast('🚨 Task Due Reminder', `"${task.title}" has reached its scheduled deadline!`);
                    
                    // Speak the reminder
                    VoiceAssistant.speak(`Reminder: The deadline for ${task.title} has arrived.`);
                }
            });
        }, 10000); // Check every 10 seconds
    },

    async syncWithBackend() {
        try {
            const [tasksRes, habitsRes, settingsRes] = await Promise.all([
                fetch('/api/tasks'),
                fetch('/api/habits'),
                fetch('/api/settings')
            ]);
            
            if (tasksRes.ok) this.state.tasks = await tasksRes.json();
            if (habitsRes.ok) this.state.habits = await habitsRes.json();
            if (settingsRes.ok) this.state.settings = await settingsRes.json();
            
            this.saveTasks();
            this.saveHabits();
            this.saveSettings();
        } catch (err) {
            console.warn("Backend server not responding, loaded from local storage fallback.", err);
        }
    },

    /**
     * Load state from localStorage. Installs highly polished dummy data if empty.
     */
    loadLocalStorage() {
        const storedTasks = localStorage.getItem('zenith_tasks');
        const storedHabits = localStorage.getItem('zenith_habits');
        const storedSettings = localStorage.getItem('zenith_settings');

        if (storedSettings) {
            this.state.settings = JSON.parse(storedSettings);
        } else {
            this.saveSettings();
        }

        // Install default demo data to wow user on first load
        if (storedTasks) {
            this.state.tasks = JSON.parse(storedTasks);
        } else {
            const today = new Date();
            
            const tomorrow = new Date();
            tomorrow.setDate(today.getDate() + 1);
            tomorrow.setHours(14, 0, 0, 0);

            const dayAfter = new Date();
            dayAfter.setDate(today.getDate() + 2);
            dayAfter.setHours(17, 30, 0, 0);

            const todayUrgent = new Date();
            todayUrgent.setHours(18, 0, 0, 0);

            this.state.tasks = [
                {
                    id: 'task-demo-1',
                    title: 'Deconstruct Deep Learning Backpropagation',
                    deadline: tomorrow.toISOString(),
                    duration: 120,
                    difficulty: 'high',
                    category: 'study',
                    completed: false,
                    subtasks: [
                        { id: 'sub-demo-1-1', title: 'Read Chapter 3 textbook notes', completed: true },
                        { id: 'sub-demo-1-2', title: 'Derive partial derivatives on paper', completed: false },
                        { id: 'sub-demo-1-3', title: 'Code simple numpy layer test', completed: false }
                    ]
                },
                {
                    id: 'task-demo-2',
                    title: 'Draft Zenith Product Pitch Deck',
                    deadline: dayAfter.toISOString(),
                    duration: 90,
                    difficulty: 'medium',
                    category: 'work',
                    completed: false,
                    subtasks: [
                        { id: 'sub-demo-2-1', title: 'Establish core value propositions', completed: true },
                        { id: 'sub-demo-2-2', title: 'Create slide layouts & wireframe aesthetics', completed: true },
                        { id: 'sub-demo-2-3', title: 'Synthesize pricing structures', completed: false }
                    ]
                },
                {
                    id: 'task-demo-3',
                    title: 'Renew server cloud hosting invoice',
                    deadline: todayUrgent.toISOString(),
                    duration: 15,
                    difficulty: 'low',
                    category: 'finance',
                    completed: false,
                    subtasks: []
                }
            ];

            // Calculate initial priority scores
            this.state.tasks.forEach(t => {
                t.priorityScore = AIEngine.calculatePriorityScore(t);
            });
            this.saveTasks();
        }

        if (storedHabits) {
            this.state.habits = JSON.parse(storedHabits);
        } else {
            this.state.habits = [
                {
                    id: 'habit-demo-1',
                    name: 'Deep Work Session (90 min)',
                    frequency: 'daily',
                    time: '09:00',
                    streak: 4,
                    history: { [this.getYesterdayDateStr()]: true }
                },
                {
                    id: 'habit-demo-2',
                    name: 'Read 20 pages research paper',
                    frequency: 'daily',
                    time: '21:00',
                    streak: 2,
                    history: { [this.getYesterdayDateStr()]: true }
                }
            ];
            this.saveHabits();
        }
    },

    saveTasks() {
        localStorage.setItem('zenith_tasks', JSON.stringify(this.state.tasks));
    },

    saveHabits() {
        localStorage.setItem('zenith_habits', JSON.stringify(this.state.habits));
    },

    saveSettings() {
        localStorage.setItem('zenith_settings', JSON.stringify(this.state.settings));
    },

    formatLocalDateStr(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    getYesterdayDateStr() {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return this.formatLocalDateStr(d);
    },

    getTodayDateStr() {
        return this.formatLocalDateStr(new Date());
    },

    /**
     * UI Event Bindings
     */
    bindEvents() {
        // 1. Sidebar views routing
        document.querySelectorAll('.nav-item').forEach(button => {
            button.addEventListener('click', (e) => {
                const targetView = button.getAttribute('data-view');
                this.switchView(targetView);
            });
        });

        // 2. Sidebar Toggle (both desktop and mobile)
        document.getElementById('mobile-menu-btn').addEventListener('click', () => {
            if (window.innerWidth > 1024) {
                const container = document.querySelector('.app-container');
                container.classList.toggle('sidebar-collapsed');
            } else {
                const sidebar = document.getElementById('sidebar');
                if (sidebar.style.transform === 'translateX(0px)') {
                    sidebar.style.transform = 'translateX(-260px)';
                } else {
                    sidebar.style.transform = 'translateX(0px)';
                }
            }
        });

        // Close sidebar automatically on mobile nav clicks
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 1024) {
                    document.getElementById('sidebar').style.transform = 'translateX(-260px)';
                }
            });
        });

        // 3. Theme switch
        document.getElementById('theme-toggle').addEventListener('click', () => {
            document.body.classList.toggle('light-mode');
            document.body.classList.toggle('dark-mode');
        });

        // 4. Focus Shield switch toggle
        document.getElementById('focus-shield-toggle').addEventListener('click', (e) => {
            this.state.focusShieldActive = e.target.checked;
            const container = document.querySelector('.app-container');
            const overlay = document.getElementById('focus-shield-overlay');

            if (this.state.focusShieldActive) {
                if (container) container.classList.add('focus-shield-active');
                if (overlay) {
                    overlay.classList.add('show');
                    setTimeout(() => {
                        overlay.classList.remove('show');
                    }, 2000);
                }
                this.showToast('🛡️ Deep Work Shield Active', 'Notifications muted. Focus block is live.');
                VoiceAssistant.speak("Deep work shield activated. Muting non-urgent alerts.");
            } else {
                if (container) container.classList.remove('focus-shield-active');
                this.showToast('Shield Deactivated', 'Ambient notifications restored.');
                VoiceAssistant.speak("Focus shield deactivated.");
            }
        });

        // 5. Tasks filters & Sorting
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.renderTasksList();
            });
        });

        document.getElementById('sort-select').addEventListener('change', () => {
            this.renderTasksList();
        });

        // 6. Task Modals toggles
        document.getElementById('open-task-modal-btn').addEventListener('click', () => {
            document.getElementById('task-modal').classList.add('show');
            
            // Auto-populate deadline with a default (tomorrow at 12 PM)
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(12, 0, 0, 0);
            
            // Format to datetime-local expected string 'YYYY-MM-DDThh:mm'
            const offset = tomorrow.getTimezoneOffset();
            const localTomorrow = new Date(tomorrow.getTime() - (offset*60*1000));
            document.getElementById('task-deadline').value = localTomorrow.toISOString().slice(0, 16);
        });

        const closeTaskModal = () => document.getElementById('task-modal').classList.remove('show');
        document.getElementById('close-task-modal-btn').addEventListener('click', closeTaskModal);
        document.getElementById('cancel-task-btn').addEventListener('click', closeTaskModal);

        // Submit task form
        document.getElementById('task-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addNewTaskFromForm();
            closeTaskModal();
        });

        // Quick task text parsing
        document.getElementById('quick-task-submit').addEventListener('click', () => {
            this.parseQuickTaskInput();
        });
        document.getElementById('quick-task-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.parseQuickTaskInput();
            }
        });

        // 7. Habit Modal triggers
        document.getElementById('add-habit-btn').addEventListener('click', () => {
            document.getElementById('habit-modal').classList.add('show');
        });
        const closeHabitModal = () => document.getElementById('habit-modal').classList.remove('show');
        document.getElementById('close-habit-modal-btn').addEventListener('click', closeHabitModal);
        document.getElementById('cancel-habit-btn').addEventListener('click', closeHabitModal);

        document.getElementById('habit-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addNewHabitFromForm();
            closeHabitModal();
        });

        // 8. Calendar Navigation
        document.getElementById('cal-prev-week').addEventListener('click', () => {
            this.state.calendarOffset--;
            this.renderCalendarView();
        });
        document.getElementById('cal-next-week').addEventListener('click', () => {
            this.state.calendarOffset++;
            this.renderCalendarView();
        });

        // GCal Sync trigger
        document.getElementById('gcal-sync-btn').addEventListener('click', () => {
            this.gcalSyncAction();
        });

        // AI calendar optimizer trigger
        document.getElementById('ai-optimize-schedule-btn').addEventListener('click', () => {
            this.optimizeScheduleAction();
        });

        // 9. Profile settings
        document.getElementById('save-profile-btn').addEventListener('click', () => {
            const newName = document.getElementById('setting-username').value.trim();
            const focusGoal = document.getElementById('setting-focus-goal').value;
            if (newName) {
                this.state.settings.username = newName;
                this.state.settings.dailyFocusTarget = parseInt(focusGoal) || 240;
                this.saveSettings();
                this.renderAll();
                this.showToast('Settings Saved', 'Profile settings successfully updated.');
                VoiceAssistant.speak(`Profile preferences saved, ${newName}`);
            }
        });

        // 10. AI Chat Panel interactive typing
        document.getElementById('ai-send-btn').addEventListener('click', () => {
            this.handleUserChatMessage();
        });
        document.getElementById('ai-text-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleUserChatMessage();
            }
        });

        // Voice controls configuration in settings
        const rateSlider = document.getElementById('setting-voice-rate');
        const pitchSlider = document.getElementById('setting-voice-pitch');
        
        if (rateSlider && pitchSlider) {
            rateSlider.addEventListener('input', (e) => {
                document.getElementById('rate-val').textContent = e.target.value;
                this.state.settings.rate = parseFloat(e.target.value);
                this.saveSettings();
            });
            pitchSlider.addEventListener('input', (e) => {
                document.getElementById('pitch-val').textContent = e.target.value;
                this.state.settings.pitch = parseFloat(e.target.value);
                this.saveSettings();
            });
        }

        const voiceSelect = document.getElementById('setting-voice-select');
        if (voiceSelect) {
            voiceSelect.addEventListener('change', (e) => {
                this.state.settings.voiceURI = e.target.value;
                this.saveSettings();
            });
        }

        // Test Voice button
        document.getElementById('test-voice-btn').addEventListener('click', () => {
            const feed = document.getElementById('voice-test-feedback');
            feed.textContent = "Speaking...";
            VoiceAssistant.speak("Voice synthesis calibrated. Zenith is fully functional.");
            setTimeout(() => { feed.textContent = "Ready"; }, 2500);
        });

        // Floating AI panel collapser (both header toggle and internal panel toggle)
        const toggleAIPanel = () => {
            document.querySelector('.app-container').classList.toggle('ai-collapsed');
        };
        document.getElementById('ai-toggle-btn').addEventListener('click', toggleAIPanel);
        document.getElementById('header-ai-toggle-btn').addEventListener('click', toggleAIPanel);

        // Mic Button
        const micBtn = document.getElementById('ai-mic-btn');
        micBtn.addEventListener('click', () => {
            if (VoiceAssistant.isListening) {
                VoiceAssistant.stopListening();
            } else {
                VoiceAssistant.startListening();
            }
        });

        // Dashboard quick links
        document.getElementById('dash-view-all-tasks').addEventListener('click', () => {
            this.switchView('tasks');
        });

        // Showcase details modal listeners
        const showcaseModal = document.getElementById('showcase-detail-modal');
        const showcaseTitle = document.getElementById('showcase-modal-title');
        const showcaseBody = document.getElementById('showcase-modal-body');
        const closeShowcaseBtn = document.getElementById('close-showcase-modal-btn');

        const showcaseData = {
            langgraph: {
                title: 'LangGraph AI Companion',
                html: `
                    <p><strong>Conversational Task Automation Core:</strong> Powered by a stateful multi-agent execution graph that parses direct request prompts into active checklists.</p>
                    <ul style="margin: 10px 0 10px 20px; line-height: 1.6;">
                        <li><strong>Dynamic NLP Extraction:</strong> Zenith reads context tags such as deadlines, energy levels, and duration weights automatically from single-line chat sentences.</li>
                        <li><strong>Self-Correction Router:</strong> If instructions are ambiguous, the LLM requests clarification instead of inserting corrupted tasks.</li>
                        <li><strong>Recursive Subtask Decomposer:</strong> Converts complex goals like <em>"prepare slides for project review"</em> into recursive checklist items instantly.</li>
                    </ul>
                `
            },
            timeblocking: {
                title: 'Dynamic Timeblocking Engine',
                html: `
                    <p><strong>Automated Calendar Scheduling Optimization:</strong> An algorithmic slot allocator built to distribute workloads intelligently based on cognitive fatigue curves.</p>
                    <ul style="margin: 10px 0 10px 20px; line-height: 1.6;">
                        <li><strong>Cognitive Load Balancing:</strong> High-difficulty assignments are automatically scheduled during high-focus morning slots.</li>
                        <li><strong>Adaptive Rest Insertion:</strong> Zenith inserts 15-minute guided restoration blocks following intensive high-energy tasks.</li>
                        <li><strong>Google Calendar Integration:</strong> Bidirectional synchronization that merges external schedule boundaries and avoids conflict blocking.</li>
                    </ul>
                `
            },
            habits: {
                title: 'Habit Ritual Analytics',
                html: `
                    <p><strong>Consistency Loop Monitor:</strong> Designed to cultivate positive daily automation routines using visual feedback rings and progress multiplier trackers.</p>
                    <ul style="margin: 10px 0 10px 20px; line-height: 1.6;">
                        <li><strong>7-Day Circular Tracker:</strong> Log consistency histories using interactive checklist dots to visualize momentum streaks.</li>
                        <li><strong>Streak Energy Multiplier:</strong> Completed habit chains feed back into the priority score formulas, raising focus points.</li>
                        <li><strong>Peak Performance Reporting:</strong> Correlates focus statistics with hourly energy levels to suggest the best times to execute tasks.</li>
                    </ul>
                `
            },
            speech: {
                title: 'Speech Synthesis Reminders',
                html: `
                    <p><strong>Real-time Foreground Notification Daemon:</strong> A lightweight background thread monitoring system deadlines for active work blocks.</p>
                    <ul style="margin: 10px 0 10px 20px; line-height: 1.6;">
                        <li><strong>Speech warnings:</strong> Voice alerts sound through the browser audio synthesis engine as deadlines approach.</li>
                        <li><strong>Interactive Alert Cards:</strong> Visual card overlays slide onto the screen, providing one-click options to postpone or mark tasks as completed.</li>
                        <li><strong>Zero-polling Background Loop:</strong> Runs every 10 seconds checking relative times, avoiding performance lag or latency.</li>
                    </ul>
                `
            }
        };

        document.querySelectorAll('.showcase-card').forEach(card => {
            card.addEventListener('click', () => {
                const featureKey = card.getAttribute('data-feature');
                const data = showcaseData[featureKey];
                if (data) {
                    showcaseTitle.textContent = data.title;
                    showcaseBody.innerHTML = data.html;
                    showcaseModal.classList.add('show');
                }
            });
        });

        if (closeShowcaseBtn) {
            closeShowcaseBtn.addEventListener('click', () => {
                showcaseModal.classList.remove('show');
            });
        }

        window.addEventListener('click', (e) => {
            if (e.target === showcaseModal) {
                showcaseModal.classList.remove('show');
            }
        });
    },

    /**
     * Setup Event Listeners matching voice command results back to app modifications
     */
    setupVoiceCallbacks() {
        VoiceAssistant.init({
            onListenStart: () => {
                const micBtn = document.getElementById('ai-mic-btn');
                const visualizer = document.getElementById('voice-visualizer');
                const status = document.getElementById('ai-voice-status');

                micBtn.classList.add('active');
                visualizer.style.display = 'flex';
                visualizer.classList.add('listening');
                status.textContent = "Zenith is listening...";
            },
            onListenEnd: () => {
                const micBtn = document.getElementById('ai-mic-btn');
                const visualizer = document.getElementById('voice-visualizer');
                const status = document.getElementById('ai-voice-status');

                micBtn.classList.remove('active');
                visualizer.style.display = 'none';
                visualizer.classList.remove('listening');
                status.textContent = 'Hold mic to speak or ask "Hey Zenith..."';
            },
            onSpeechResult: (text) => {
                this.appendChatBubble(text, 'user');
            },
            onSpeakStart: () => {
                const visualizer = document.getElementById('voice-visualizer');
                visualizer.style.display = 'flex';
                visualizer.classList.add('listening');
            },
            onSpeakEnd: () => {
                const visualizer = document.getElementById('voice-visualizer');
                visualizer.style.display = 'none';
                visualizer.classList.remove('listening');
            },
            onVoiceError: (error) => {
                this.showToast('Voice Assistant Error', `Failed to register microphone: ${error}`);
                this.appendChatBubble(`[Mic error: ${error}. Try typing commands instead.]`, 'ai');
            },
            onCommandNavigate: (view) => {
                this.switchView(view);
            },
            onCommandOptimize: () => {
                this.optimizeScheduleAction();
            },
            onCommandClearCompleted: () => {
                this.clearCompletedTasks();
            },
            onCommandAddTask: (taskTitle) => {
                this.createNewTaskFromParsedTitle(taskTitle);
            },
            onStatusQuery: () => {
                const active = this.state.tasks.filter(t => !t.completed);
                if (active.length === 0) {
                    return "Your agenda is completely clean. Great job!";
                }
                const high = active.filter(t => t.difficulty === 'high');
                let response = `You have ${active.length} active tasks scheduled. `;
                if (high.length > 0) {
                    response += `Of note, you have ${high.length} high priority cognitive workblocks, including "${high[0].title}".`;
                } else {
                    response += `All pending tasks fall within medium or low energy requirements.`;
                }
                return response;
            }
        });
    },

    /**
     * Switches viewport sections and highlights navigation button
     */
    switchView(viewId) {
        this.state.currentView = viewId;
        
        // Hide all views
        document.querySelectorAll('.view-section').forEach(view => {
            view.classList.remove('active');
        });
        
        // Unhighlight all buttons
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.remove('active');
        });

        // Activate selected view and highlights menu button
        const targetView = document.getElementById(`view-${viewId}`);
        if (targetView) {
            targetView.classList.add('active');
        }

        const targetBtn = document.querySelector(`.nav-item[data-view="${viewId}"]`);
        if (targetBtn) {
            targetBtn.classList.add('active');
        }

        // Select canvas color based on light/dark mode
        ctx.fillStyle = isDark ? 'rgba(139, 92, 246, 0.12)' : 'rgba(65, 105, 225, 0.08)';
        ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(65, 105, 225, 0.04)';

        // Renders specifics based on selected view
        if (viewId === 'calendar') {
            this.renderCalendarView();
        } else if (viewId === 'tasks') {
            this.renderTasksList();
        } else if (viewId === 'habits') {
            this.renderHabitsView();
        } else if (viewId === 'dashboard') {
            this.renderDashboardView();
        } else if (viewId === 'settings') {
            this.loadSettingsToForm();
        }
    },

    /**
     * Renders date in application header date badge
     */
    updateHeaderDate() {
        const options = { weekday: 'long', month: 'short', day: 'numeric' };
        document.getElementById('header-date').textContent = new Date().toLocaleDateString('en-US', options);
    },

    /**
     * Centralized renderer triggers updates across dashboards
     */
    renderAll() {
        // Sync usernames and settings values
        document.querySelectorAll('.user-greeting-name').forEach(el => el.textContent = this.state.settings.username);
        document.getElementById('user-display-name').textContent = this.state.settings.username;
        document.getElementById('user-avatar-initial').textContent = this.state.settings.username.charAt(0).toUpperCase();

        // Calculate focus / completion scores
        const totalTasks = this.state.tasks.length;
        const completedTasks = this.state.tasks.filter(t => t.completed).length;
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        
        document.getElementById('metric-completion').textContent = `${completionRate}%`;
        document.getElementById('bar-completion').style.width = `${completionRate}%`;

        // Calculate and update Habit Streak dynamically
        const maxStreak = this.state.habits.reduce((max, h) => Math.max(max, h.streak || 0), 0);
        document.getElementById('metric-habit-streak').textContent = `${maxStreak} days`;

        // Calculate and update Focus Score dynamically
        const baseScore = 65;
        const completionBonus = completionRate * 0.25; // max 25 points
        const streakBonus = Math.min(10, maxStreak * 1.5); // max 10 points
        const focusScore = Math.min(100, Math.round(baseScore + completionBonus + streakBonus));
        document.getElementById('metric-focus-score').textContent = `${focusScore}/100`;

        // Update focus description subtext
        const focusDesc = document.getElementById('focus-score-status');
        if (focusDesc) {
            if (focusScore >= 90) {
                focusDesc.textContent = "Supercharged cognitive flow";
            } else if (focusScore >= 75) {
                focusDesc.textContent = "Optimal cognitive flow";
            } else {
                focusDesc.textContent = "Recharging focus capacity";
            }
        }

        // Update dashboard active counts
        const highTasks = this.state.tasks.filter(t => !t.completed && t.difficulty === 'high').length;
        document.getElementById('dash-high-count').textContent = highTasks;

        // Render sections if visible
        if (this.state.currentView === 'dashboard') {
            this.renderDashboardView();
        } else if (this.state.currentView === 'tasks') {
            this.renderTasksList();
        } else if (this.state.currentView === 'calendar') {
            this.renderCalendarView();
        } else if (this.state.currentView === 'habits') {
            this.renderHabitsView();
        }
    },

    /**
     * 1. DASHBOARD VIEW RENDERER
     */
    renderDashboardView() {
        const miniList = document.getElementById('dashboard-task-list');
        
        // Sort remaining tasks by AI Priority Score descending
        const activeTasks = this.state.tasks
            .filter(t => !t.completed)
            .sort((a, b) => b.priorityScore - a.priorityScore)
            .slice(0, 4);

        if (activeTasks.length === 0) {
            miniList.innerHTML = `
                <div class="empty-state">
                    <p>Congratulations! No active tasks remain for today. Relax or configure habits.</p>
                </div>
            `;
            return;
        }

        miniList.innerHTML = '';
        activeTasks.forEach(task => {
            const item = document.createElement('div');
            item.className = 'mini-task-item';
            item.innerHTML = `
                <div class="mini-task-left">
                    <div class="mini-task-cb" onclick="ZenithApp.toggleTaskCompletion('${task.id}')"></div>
                    <span class="mini-task-title">${task.title}</span>
                </div>
                <div class="mini-task-right">
                    <span class="mini-task-pill ${task.difficulty}">${task.difficulty}</span>
                    <span class="mini-task-pill ai-score">AI Score: ${task.priorityScore}</span>
                </div>
            `;
            miniList.appendChild(item);
        });

        // Render AI Insights
        const insightsContainer = document.getElementById('insights-feed-container');
        const insights = AIEngine.getAIInsightRecommendations(this.state.tasks, this.state.habits);
        
        insightsContainer.innerHTML = '';
        insights.forEach(insight => {
            const el = document.createElement('div');
            el.className = 'insight-item';
            el.innerHTML = `
                <div class="insight-indicator ${insight.type}"></div>
                <div class="insight-content">
                    <h4>${insight.title}</h4>
                    <p>${insight.description}</p>
                </div>
            `;
            insightsContainer.appendChild(el);
        });
    },

    /**
     * 2. TASKS MASTER PLANNER RENDERER
     */
    renderTasksList() {
        const container = document.getElementById('task-master-list');
        
        // 1. Get filter
        const activeFilter = document.querySelector('.filter-tab.active').getAttribute('data-filter');
        
        let filtered = [...this.state.tasks];
        if (activeFilter === 'pending') {
            filtered = filtered.filter(t => !t.completed);
        } else if (activeFilter === 'completed') {
            filtered = filtered.filter(t => t.completed);
        }

        // 2. Get sorting option
        const sortVal = document.getElementById('sort-select').value;
        if (sortVal === 'ai-priority') {
            filtered.sort((a, b) => b.priorityScore - a.priorityScore);
        } else if (sortVal === 'deadline') {
            filtered.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
        } else if (sortVal === 'difficulty') {
            const diffMap = { 'high': 3, 'medium': 2, 'low': 1 };
            filtered.sort((a, b) => diffMap[b.difficulty] - diffMap[a.difficulty]);
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No tasks matched current criteria. Click "Add Custom Task" to build one.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        filtered.forEach(task => {
            const isUrgent = this.isTaskUrgent(task);
            const dateStr = new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            
            const card = document.createElement('div');
            card.className = `task-card glass priority-${task.difficulty} ${task.completed ? 'completed' : ''}`;
            
            // Subtasks HTML
            let subtasksHTML = '';
            if (task.subtasks && task.subtasks.length > 0) {
                const completedSub = task.subtasks.filter(s => s.completed).length;
                subtasksHTML = `
                    <div class="task-subtasks-section">
                        <div class="subtask-section-header">
                            <h5>AI ROADMAP (${completedSub}/${task.subtasks.length})</h5>
                        </div>
                        <div class="subtask-list">
                            ${task.subtasks.map(sub => `
                                <div class="subtask-item ${sub.completed ? 'completed' : ''}">
                                    <div class="subtask-cb" onclick="ZenithApp.toggleSubtaskCompletion('${task.id}', '${sub.id}')"></div>
                                    <span>${sub.title}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="task-card-top">
                    <div class="task-meta-left">
                        <div class="mini-task-cb" onclick="ZenithApp.toggleTaskCompletion('${task.id}')"></div>
                        <div class="task-title-group">
                            <h4>${task.title}</h4>
                            <div style="display: flex; gap: 8px; align-items: center; margin-top: 4px;">
                                <span class="task-category-badge">${task.category}</span>
                                <span class="task-date-warning ${isUrgent ? 'urgent' : ''}">
                                    <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                    ${dateStr}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="task-meta-right">
                        ${!task.completed ? `<span class="ai-priority-score-badge">AI Score: ${task.priorityScore}</span>` : ''}
                        <button class="btn-icon-danger" onclick="ZenithApp.deleteTask('${task.id}')" title="Delete Task">
                            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    </div>
                </div>
                ${subtasksHTML}
            `;
            container.appendChild(card);
        });
    },

    isTaskUrgent(task) {
        if (task.completed) return false;
        const diffHours = (new Date(task.deadline) - new Date()) / (1000 * 60 * 60);
        return diffHours < 12; // High alert if under 12 hours remaining
    },

    /**
     * 3. CALENDAR VIEW RENDERER
     */
    renderCalendarView() {
        Calendar.render(this.state.tasks, this.state.calendarOffset);
    },

    /**
     * 4. HABITS VIEW RENDERER
     */
    renderHabitsView() {
        const container = document.getElementById('habits-master-list');
        if (this.state.habits.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No habits configured. Create a habit to start building positive streaks.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        const todayStr = this.getTodayDateStr();

        // Get past 7 day labels
        const dayLabels = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dayLabels.push({
                dateStr: this.formatLocalDateStr(d),
                dayLetter: d.toLocaleDateString('en-US', { weekday: 'narrow' })
            });
        }

        this.state.habits.forEach(habit => {
            const card = document.createElement('div');
            card.className = 'habit-card glass';
            
            // Build streak dots
            let dotsHTML = '';
            dayLabels.forEach(day => {
                const isCompleted = habit.history && habit.history[day.dateStr];
                dotsHTML += `
                    <div class="habit-dot-day">
                        <div class="habit-dot ${isCompleted ? 'completed' : ''}" 
                             onclick="ZenithApp.toggleHabitCompletion('${habit.id}', '${day.dateStr}')"
                             title="${day.dateStr} (${isCompleted ? 'Completed' : 'Pending'})">
                        </div>
                        <span class="habit-dot-label">${day.dayLetter}</span>
                    </div>
                `;
            });

            card.innerHTML = `
                <div class="habit-card-header">
                    <div class="habit-info">
                        <h3>${habit.name}</h3>
                        <p>Time Target: ${habit.time} | Frequency: ${habit.frequency}</p>
                    </div>
                    <div class="habit-streak-badge">Streak: ${habit.streak}d</div>
                </div>
                <div class="habit-grid-tracker">
                    <span class="tracker-title">PAST 7 DAYS</span>
                    <div class="habit-weeks-dots">
                        ${dotsHTML}
                    </div>
                </div>
                <button class="btn-icon-danger" onclick="ZenithApp.deleteHabit('${habit.id}')" 
                        style="position: absolute; bottom: 12px; right: 16px; font-size:12px; display:flex; align-items:center; gap:4px;">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    Delete
                </button>
            `;
            container.appendChild(card);
        });
    },

    /**
     * 5. SETTINGS FORM POPULATOR
     */
    loadSettingsToForm() {
        document.getElementById('setting-username').value = this.state.settings.username;
        document.getElementById('setting-focus-goal').value = this.state.settings.dailyFocusTarget;
        
        // Voice sliders
        const rateSlider = document.getElementById('setting-voice-rate');
        const pitchSlider = document.getElementById('setting-voice-pitch');
        
        if (rateSlider && pitchSlider) {
            rateSlider.value = this.state.settings.rate;
            document.getElementById('rate-val').textContent = this.state.settings.rate;
            pitchSlider.value = this.state.settings.pitch;
            document.getElementById('pitch-val').textContent = this.state.settings.pitch;
        }

        // Voice Select populate check
        const select = document.getElementById('setting-voice-select');
        if (select) select.value = this.state.settings.voiceURI;
    },

    /**
     * Add task from modal form submission
     */
    addNewTaskFromForm() {
        const title = document.getElementById('task-title').value.trim();
        const deadline = document.getElementById('task-deadline').value;
        const duration = parseInt(document.getElementById('task-duration').value) || 60;
        const difficulty = document.getElementById('task-difficulty').value;
        const category = document.getElementById('task-category').value;
        const autoDecompose = document.getElementById('task-auto-decompose').checked;

        if (!title || !deadline) return;

        const newTask = {
            id: 'task-' + Date.now(),
            title,
            deadline: new Date(deadline).toISOString(),
            duration,
            difficulty,
            category,
            completed: false,
            subtasks: autoDecompose ? AIEngine.decomposeTask(title) : []
        };

        // Run priority scoring
        newTask.priorityScore = AIEngine.calculatePriorityScore(newTask);

        this.state.tasks.push(newTask);
        this.saveTasks();
        this.renderAll();
        
        this.showToast('📝 Task Scheduled', `"${title}" has been structured and prioritized by Zenith.`);
        VoiceAssistant.speak(`Task scheduled: ${title}. AI has rated priority index at ${newTask.priorityScore}.`);

        // Reset form
        document.getElementById('task-form').reset();
    },

    /**
     * Adds task parsed from speech recognition or quick text input box
     */
    createNewTaskFromParsedTitle(title) {
        // Defaults for voice-created tasks: due tomorrow, medium difficulty, 60 minutes
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(12, 0, 0, 0);

        const newTask = {
            id: 'task-' + Date.now(),
            title: title.trim(),
            deadline: tomorrow.toISOString(),
            duration: 60,
            difficulty: 'medium',
            category: 'work',
            completed: false,
            subtasks: AIEngine.decomposeTask(title) // Auto-decompose for voice tasks
        };

        newTask.priorityScore = AIEngine.calculatePriorityScore(newTask);
        
        this.state.tasks.push(newTask);
        this.saveTasks();
        this.renderAll();

        this.showToast('📝 Task Added', `"${title}" parsed and added by Zenith.`);
    },

    /**
     * Parse text entered in "Quick Task" input card
     */
    parseQuickTaskInput() {
        const inputVal = document.getElementById('quick-task-input').value.trim();
        if (!inputVal) return;

        this.createNewTaskFromParsedTitle(inputVal);
        document.getElementById('quick-task-input').value = '';
    },

    /**
     * Toggle Task completions
     */
    toggleTaskCompletion(taskId) {
        const task = this.state.tasks.find(t => t.id === taskId);
        if (!task) return;

        task.completed = !task.completed;
        
        // If task is completed, also check off all subtasks
        if (task.completed && task.subtasks) {
            task.subtasks.forEach(s => s.completed = true);
        }

        // Recalculate priority scores for all tasks
        this.state.tasks.forEach(t => {
            t.priorityScore = AIEngine.calculatePriorityScore(t);
        });

        this.saveTasks();
        this.renderAll();

        if (task.completed) {
            this.showToast('✅ Task Completed', `"${task.title}" checked off.`);
            VoiceAssistant.speak(`Great job completing: ${task.title}. Focus metric updated.`);
        }
    },

    /**
     * Toggle individual subtask completions
     */
    toggleSubtaskCompletion(taskId, subtaskId) {
        const task = this.state.tasks.find(t => t.id === taskId);
        if (!task) return;

        const sub = task.subtasks.find(s => s.id === subtaskId);
        if (!sub) return;

        sub.completed = !sub.completed;

        // If all subtasks are now checked, mark main task completed too
        const allCompleted = task.subtasks.every(s => s.completed);
        if (allCompleted) {
            task.completed = true;
            this.showToast('✅ Task Completed', `"${task.title}" completed via subtasks roadmap.`);
            VoiceAssistant.speak(`All roadmap steps complete. Task finalized.`);
        } else {
            task.completed = false; // Restores to active if subtask unchecked
        }

        this.state.tasks.forEach(t => {
            t.priorityScore = AIEngine.calculatePriorityScore(t);
        });

        this.saveTasks();
        this.renderAll();
    },

    deleteTask(taskId) {
        this.state.tasks = this.state.tasks.filter(t => t.id !== taskId);
        this.saveTasks();
        this.renderAll();
        this.showToast('🗑️ Task Deleted', 'Selected task has been removed from planner.');
    },

    clearCompletedTasks() {
        this.state.tasks = this.state.tasks.filter(t => !t.completed);
        this.saveTasks();
        this.renderAll();
        this.showToast('🗑️ Clean Agenda', 'Removed all completed tasks.');
    },

    /**
     * Add new Habit
     */
    addNewHabitFromForm() {
        const name = document.getElementById('habit-name').value.trim();
        const frequency = document.getElementById('habit-frequency').value;
        const time = document.getElementById('habit-time').value;

        if (!name) return;

        const newHabit = {
            id: 'habit-' + Date.now(),
            name,
            frequency,
            time,
            streak: 0,
            history: {}
        };

        this.state.habits.push(newHabit);
        this.saveHabits();
        this.renderAll();

        this.showToast('✨ Habit Created', `Started habit tracker for "${name}"`);
        VoiceAssistant.speak(`New habit tracker configured: ${name}. Daily streak is initiated at zero.`);

        document.getElementById('habit-form').reset();
    },

    /**
     * Toggle Habit completions on grid tracker
     */
    toggleHabitCompletion(habitId, dateStr) {
        const habit = this.state.habits.find(h => h.id === habitId);
        if (!habit) return;

        if (!habit.history) habit.history = {};

        if (habit.history[dateStr]) {
            delete habit.history[dateStr];
            // Recalculate streak down
            habit.streak = Math.max(0, habit.streak - 1);
        } else {
            habit.history[dateStr] = true;
            
            // Calculate new streak
            let streak = 0;
            const checkDate = new Date();
            
            // Iterate backwards checking consecutive completed days
            for (let i = 0; i < 30; i++) {
                const dateKey = this.formatLocalDateStr(checkDate);
                if (habit.history[dateKey]) {
                    streak++;
                } else {
                    // Break on first empty day unless it is today and yesterday was checked
                    if (i > 0) break;
                }
                checkDate.setDate(checkDate.getDate() - 1);
            }
            habit.streak = streak;
        }

        this.saveHabits();
        this.renderAll();

        const completedToday = habit.history[dateStr];
        if (completedToday) {
            this.showToast('🔥 Streak Advanced', `"${habit.name}" checked for ${dateStr}.`);
            VoiceAssistant.speak(`Ritual recorded. Streak is now at ${habit.streak} days. Keep it up!`);
        }
    },

    deleteHabit(habitId) {
        this.state.habits = this.state.habits.filter(h => h.id !== habitId);
        this.saveHabits();
        this.renderAll();
        this.showToast('🗑️ Habit Removed', 'Habit tracker has been deleted.');
    },

    /**
     * Visual UI schedule optimization action trigger
     */
    optimizeScheduleAction() {
        this.showToast('🤖 AI Calendar Optimizing', 'Grouping timeblocks to minimize energy transition drag...');
        
        // Trigger calendar optimization visual pulse
        if (this.state.currentView !== 'calendar') {
            this.switchView('calendar');
        }

        setTimeout(() => {
            Calendar.animateOptimization();
            this.renderCalendarView();
            VoiceAssistant.speak("Schedule optimization completed. I have rearranged your work blocks and injected guided cognitive breaks to maximize output.");
        }, 300);
    },

    /**
     * Synchronize calendar blocks with Google Calendar API
     */
    async gcalSyncAction() {
        this.showToast('📅 Google Calendar Syncing', 'Synchronizing scheduled timeblocks with Google Calendar API...');
        try {
            const response = await fetch('/api/optimize', { method: 'POST' });
            if (response.ok) {
                this.showToast('✅ Sync Completed', 'Google Calendar successfully synchronized with Zenith planning.');
                VoiceAssistant.speak("Google calendar synchronization is complete.");
                Calendar.animateOptimization();
            } else {
                throw new Error("API error");
            }
        } catch (err) {
            this.showToast('❌ Sync Failed', 'Failed to synchronize with Google Calendar. Running local optimization.');
            this.optimizeScheduleAction();
        }
    },

    async handleUserChatMessage() {
        const inputEl = document.getElementById('ai-text-input');
        const userText = inputEl.value.trim();
        if (!userText) return;

        // Append user bubble
        this.appendChatBubble(userText, 'user');
        inputEl.value = '';

        // Simulate Zenith typing loading indicator
        const history = document.getElementById('ai-chat-history');
        const typingBubble = document.createElement('div');
        typingBubble.className = 'chat-bubble ai typing';
        typingBubble.id = 'zenith-typing-indicator';
        typingBubble.textContent = 'Zenith is formulating...';
        history.appendChild(typingBubble);
        history.scrollTop = history.scrollHeight;

        try {
            // Map local chat history to API format
            const apiHistory = [];
            const bubbles = document.querySelectorAll('.chat-bubble');
            const startIdx = Math.max(0, bubbles.length - 10);
            for (let i = startIdx; i < bubbles.length; i++) {
                const bubble = bubbles[i];
                if (bubble.classList.contains('typing')) continue;
                apiHistory.push({
                    sender: bubble.classList.contains('user') ? 'user' : 'ai',
                    text: bubble.textContent
                });
            }

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userText,
                    history: apiHistory
                })
            });

            const indicator = document.getElementById('zenith-typing-indicator');
            if (indicator) indicator.remove();

            if (response.ok) {
                const data = await response.json();
                this.appendChatBubble(data.reply, 'ai');
                VoiceAssistant.speak(data.reply);

                // Fetch updated tasks from backend since AI chat might have added a reminder!
                const tasksRes = await fetch('/api/tasks');
                if (tasksRes.ok) {
                    const updatedTasks = await tasksRes.json();
                    this.state.tasks = updatedTasks;
                    this.saveTasks();
                    this.renderAll();
                }
            } else {
                throw new Error("Chat API failed");
            }
        } catch (err) {
            console.error("Backend chat failed, falling back to local command processing.", err);
            const indicator = document.getElementById('zenith-typing-indicator');
            if (indicator) indicator.remove();
            
            // Fallback to offline local command processing
            VoiceAssistant.processCommand(userText);
        }
    },

    /**
     * Appends chat bubble element in the AI panel
     */
    appendChatBubble(text, sender) {
        const history = document.getElementById('ai-chat-history');
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${sender}`;
        bubble.textContent = text;
        history.appendChild(bubble);
        
        // Scroll to bottom
        history.scrollTop = history.scrollHeight;
    },

    /**
     * Appends sliding toast alerts at bottom-right viewport
     */
    showToast(title, description) {
        if (this.state.focusShieldActive) return; // Mute notifications when focus shield active

        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `
            <div class="toast-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
            </div>
            <div class="toast-body">
                <h4>${title}</h4>
                <p>${description}</p>
            </div>
            <span class="toast-close" onclick="this.parentElement.remove()">&times;</span>
        `;

        container.appendChild(toast);

        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 400);
        }, 5000);
    },

    /**
     * Trigger Context toast alerts simulating system reminders
     */
    triggerContextReminderSim() {
        const notifications = [
            {
                title: '⚡ Zenith Energy Check-in',
                desc: "It is 2:00 PM. Your cognitive energy levels are currently high. Zenith recommends tackling your high-difficulty study block now."
            },
            {
                title: '💧 Habit Check: Hydration',
                desc: "Don't forget to keep hydrated during your deep work intervals. Take a quick stretching break."
            },
            {
                title: '📅 Proactive Schedule Shift',
                desc: "A calendar slot conflict resolved: Zenith delayed your routine emails review task by 30 mins to preserve focus flow."
            }
        ];

        // Pick one at random
        const chosen = notifications[Math.floor(Math.random() * notifications.length)];
        this.showToast(chosen.title, chosen.desc);
        
        // Add notification button pulse flash
        const notifyBtn = document.getElementById('notify-sim-btn');
        notifyBtn.classList.add('pulse');
        setTimeout(() => notifyBtn.classList.remove('pulse'), 2000);
    }
};

// Bind button simulation
document.addEventListener('DOMContentLoaded', () => {
    ZenithApp.init();
    
    // Bind context simulation button in header
    document.getElementById('notify-sim-btn').addEventListener('click', () => {
        ZenithApp.triggerContextReminderSim();
    });
});
