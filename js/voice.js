/* ==========================================================================
   Zenith - Voice AI Engine (Speech Recognition & Speech Synthesis)
   ========================================================================== */

const VoiceAssistant = {
    recognition: null,
    isListening: false,
    isSpeaking: false,
    callbacks: {}, // Event handlers to trigger app-level modifications
    settings: {
        voiceURI: 'default',
        pitch: 1.0,
        rate: 1.0
    },

    /**
     * Initializes Speech Recognition and populates available voices
     */
    init(callbacks = {}) {
        this.callbacks = callbacks;
        
        // 1. Initialize Speech Recognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.lang = 'en-US';
            this.recognition.interimResults = false;
            this.recognition.maxAlternatives = 1;

            // Recognition Event Handlers
            this.recognition.onstart = () => {
                this.isListening = true;
                if (this.callbacks.onListenStart) this.callbacks.onListenStart();
            };

            this.recognition.onresult = (event) => {
                const speechToText = event.results[0][0].transcript;
                if (this.callbacks.onSpeechResult) {
                    this.callbacks.onSpeechResult(speechToText);
                }
                this.processCommand(speechToText);
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.stopListening();
                if (this.callbacks.onVoiceError) {
                    this.callbacks.onVoiceError(event.error);
                }
            };

            this.recognition.onend = () => {
                this.stopListening();
            };
        } else {
            console.warn('Speech Recognition not supported in this browser.');
        }

        // 2. Load Speech Synthesis voices
        if (window.speechSynthesis) {
            // Chrome loads voices asynchronously, so attach listener
            window.speechSynthesis.onvoiceschanged = () => this.populateVoiceDropdown();
            this.populateVoiceDropdown();
        }
    },

    /**
     * Fills the settings voice select element with available system voices
     */
    populateVoiceDropdown() {
        const select = document.getElementById('setting-voice-select');
        if (!select || !window.speechSynthesis) return;

        // Clear existing, keep default
        select.innerHTML = '<option value="default">Default System Accent</option>';
        
        const voices = window.speechSynthesis.getVoices();
        voices.forEach(voice => {
            if (voice.lang.includes('en')) { // Filter english accents for optimal flow
                const option = document.createElement('option');
                option.value = voice.voiceURI;
                option.textContent = `${voice.name} (${voice.lang})`;
                select.appendChild(option);
            }
        });

        // Restore chosen voice from settings if exists
        const savedSettings = JSON.parse(localStorage.getItem('zenith_settings')) || {};
        if (savedSettings.voiceURI) {
            select.value = savedSettings.voiceURI;
            this.settings.voiceURI = savedSettings.voiceURI;
        }
    },

    /**
     * Start speech recognition
     */
    startListening() {
        if (!this.recognition) {
            this.speak("Speech recognition is not supported by your current browser. Please type your command.");
            return;
        }
        if (this.isListening) return;

        try {
            window.speechSynthesis.cancel(); // Mute assistant talking before listening
            this.recognition.start();
        } catch (e) {
            console.error('Start recognition failed:', e);
        }
    },

    /**
     * Stop speech recognition
     */
    stopListening() {
        if (!this.isListening) return;
        this.isListening = false;
        try {
            this.recognition.stop();
        } catch (e) {}
        if (this.callbacks.onListenEnd) this.callbacks.onListenEnd();
    },

    /**
     * Text to Speech speaker
     */
    speak(text) {
        if (!window.speechSynthesis) return;

        // Stop any current audio
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        
        // Load configurations
        const savedSettings = JSON.parse(localStorage.getItem('zenith_settings')) || {};
        const pitch = parseFloat(savedSettings.pitch) || this.settings.pitch;
        const rate = parseFloat(savedSettings.rate) || this.settings.rate;
        const voiceURI = savedSettings.voiceURI || this.settings.voiceURI;

        utterance.pitch = pitch;
        utterance.rate = rate;

        const voices = window.speechSynthesis.getVoices();
        const selectedVoice = voices.find(v => v.voiceURI === voiceURI);
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }

        utterance.onstart = () => {
            this.isSpeaking = true;
            if (this.callbacks.onSpeakStart) this.callbacks.onSpeakStart();
        };

        utterance.onend = () => {
            this.isSpeaking = false;
            if (this.callbacks.onSpeakEnd) this.callbacks.onSpeakEnd();
        };

        utterance.onerror = (e) => {
            console.error('Speech synthesis error:', e);
            this.isSpeaking = false;
            if (this.callbacks.onSpeakEnd) this.callbacks.onSpeakEnd();
        };

        window.speechSynthesis.speak(utterance);
    },

    /**
     * NLP command parser maps sentences to app actions.
     */
    processCommand(text) {
        const cmd = text.toLowerCase().trim();
        console.log('Zenith parsing voice command:', cmd);

        const respond = (replyText) => {
            this.speak(replyText);
            if (window.ZenithApp) {
                window.ZenithApp.appendChatBubble(replyText, 'ai');
            }
        };

        // 1. Navigation Commands
        if (cmd.includes('show dashboard') || cmd.includes('go to dashboard') || cmd.includes('open dashboard')) {
            respond("Navigating to dashboard.");
            if (this.callbacks.onCommandNavigate) this.callbacks.onCommandNavigate('dashboard');
            return;
        }
        if (cmd.includes('show tasks') || cmd.includes('go to tasks') || cmd.includes('open tasks') || cmd.includes('open planner')) {
            respond("Opening your task planner.");
            if (this.callbacks.onCommandNavigate) this.callbacks.onCommandNavigate('tasks');
            return;
        }
        if (cmd.includes('show calendar') || cmd.includes('go to calendar') || cmd.includes('open calendar')) {
            respond("Viewing your calendar blocks.");
            if (this.callbacks.onCommandNavigate) this.callbacks.onCommandNavigate('calendar');
            return;
        }
        if (cmd.includes('show habits') || cmd.includes('go to habits') || cmd.includes('open habits')) {
            respond("Opening habits tracker.");
            if (this.callbacks.onCommandNavigate) this.callbacks.onCommandNavigate('habits');
            return;
        }
        if (cmd.includes('show settings') || cmd.includes('go to settings') || cmd.includes('open settings')) {
            respond("Opening system configurations.");
            if (this.callbacks.onCommandNavigate) this.callbacks.onCommandNavigate('settings');
            return;
        }

        // 2. Action: Optimize schedule
        if (cmd.includes('optimize schedule') || cmd.includes('re-arrange calendar') || cmd.includes('fix schedule')) {
            respond("Recalculating calendar blocks to minimize context fatigue.");
            if (this.callbacks.onCommandOptimize) this.callbacks.onCommandOptimize();
            return;
        }

        // 3. Action: Clear database / Reset
        if (cmd.includes('clear completed tasks') || cmd.includes('clean finished tasks')) {
            respond("Clearing completed tasks from your planner.");
            if (this.callbacks.onCommandClearCompleted) this.callbacks.onCommandClearCompleted();
            return;
        }

        // 4. Action: Add task command (e.g., "add task prepare slides tomorrow")
        if (cmd.startsWith('add task') || cmd.startsWith('create task')) {
            const taskContent = text.replace(/^(add task|create task)\s+/i, '');
            if (taskContent.trim()) {
                respond(`Understood. Adding task: ${taskContent}`);
                if (this.callbacks.onCommandAddTask) this.callbacks.onCommandAddTask(taskContent);
            } else {
                respond("What is the name of the task you would like to schedule?");
            }
            return;
        }

        // 5. Default/Conversational fallback queries
        if (cmd.includes('how is my day looking') || cmd.includes('what are my tasks') || cmd.includes('do i have deadlines')) {
            if (this.callbacks.onStatusQuery) {
                const responseText = this.callbacks.onStatusQuery();
                respond(responseText);
            }
            return;
        }

        if (cmd.includes('hello') || cmd.includes('hey zenith') || cmd.includes('hi zenith')) {
            respond("Hello there! I am calibrated and ready to optimize your day. Try saying show tasks or optimize schedule.");
            return;
        }

        // Catch-all response
        respond(`I heard you say: "${text}". If this is a task, try prefixing it with add task, or navigate using show calendar.`);
    }
};
