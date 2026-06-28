import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function SettingsView({ settings, setSettings, onSaveSettings, speakText, isSpeaking }) {
  const [voices, setVoices] = useState([]);
  const [usernameInput, setUsernameInput] = useState(settings.username || 'Guest');
  const [dailyFocusTargetInput, setDailyFocusTargetInput] = useState(settings.dailyFocusTarget || 240);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const loadVoices = () => {
        setVoices(window.speechSynthesis.getVoices());
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    onSaveSettings({
      ...settings,
      username: usernameInput,
      dailyFocusTarget: parseInt(dailyFocusTargetInput)
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 15 }}
    >
      <div className="section-header">
        <div>
          <h2>Voice Calibration &amp; Settings</h2>
          <p>Configure your vocal feedback parameters and companion user persona.</p>
        </div>
      </div>

      <motion.div 
        className="settings-container glass" 
        style={{ padding: '24px', maxWidth: '600px' }}
        whileHover={{ borderColor: 'rgba(139, 92, 246, 0.2)' }}
      >
        <form onSubmit={handleSave}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label>Companion Owner Name</label>
            <input 
              type="text" 
              value={usernameInput} 
              onChange={(e) => setUsernameInput(e.target.value)} 
              required 
            />
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label>Daily Focus Target (Minutes)</label>
            <input 
              type="number" 
              value={dailyFocusTargetInput} 
              onChange={(e) => setDailyFocusTargetInput(e.target.value)} 
              min={10} 
              required 
            />
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label>Synthesizer Voice</label>
            <select 
              value={settings.voiceURI} 
              onChange={(e) => setSettings(prev => ({ ...prev, voiceURI: e.target.value }))}
            >
              <option value="default">Default System voice</option>
              {voices.map((voice, idx) => (
                <option key={idx} value={voice.voiceURI}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Voice Pitch ({settings.pitch.toFixed(1)})</label>
              <input 
                type="range" 
                min="0.5" 
                max="2.0" 
                step="0.1" 
                value={settings.pitch} 
                onChange={(e) => setSettings(prev => ({ ...prev, pitch: parseFloat(e.target.value) }))}
              />
            </div>
            <div className="form-group">
              <label>Speech Rate ({settings.rate.toFixed(1)})</label>
              <input 
                type="range" 
                min="0.5" 
                max="2.0" 
                step="0.1" 
                value={settings.rate} 
                onChange={(e) => setSettings(prev => ({ ...prev, rate: parseFloat(e.target.value) }))}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', alignItems: 'center' }}>
            <motion.button 
              type="submit" 
              className="btn btn-primary"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Save User Profile
            </motion.button>
            <motion.button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => speakText("Vocal calibration initialized. Zenith agent ready.")}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Test Vocals
            </motion.button>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {isSpeaking ? '💬 Speaking...' : 'Ready'}
            </span>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
