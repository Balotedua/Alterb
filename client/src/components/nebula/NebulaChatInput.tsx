import { useState, useRef, useEffect } from 'react';
import { useNebulaStore } from '@/store/nebulaStore';
import { useIntent } from '@/hooks/useIntent';
import { haptics } from '@/utils/haptics';

export function NebulaChatInput() {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { isThinking, message, chatHistory, setTypingIntensity, triggerBurst } =
    useNebulaStore();
  const { processInput } = useIntent();

  const lastAssistant = [...chatHistory].reverse().find((m) => m.role === 'assistant');

  const handleSubmit = () => {
    if (!value.trim() || isThinking) return;
    haptics.send();
    triggerBurst();           // explosion on send
    processInput(value);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setValue(v);
    // Typing intensity: grows with length, caps at 1
    setTypingIntensity(Math.min(v.length * 0.07, 1));
  };

  // Reset intensity when input empties after submit
  useEffect(() => {
    if (value === '') setTypingIntensity(0);
  }, [value, setTypingIntensity]);

  // Keep focused after thinking — skip on touch devices to avoid reopening keyboard
  useEffect(() => {
    const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (!isThinking && !isTouch) inputRef.current?.focus();
  }, [isThinking]);

  const displayMessage = lastAssistant?.content ?? message;

  return (
    <div className="nebula-chat-wrapper">
      <div className={`nebula-reply ${isThinking ? 'nebula-reply--thinking' : ''}`}>
        {isThinking ? (
          <span className="nebula-dots">
            <span /><span /><span />
          </span>
        ) : (
          <span>{displayMessage}</span>
        )}
      </div>

      <div className="nebula-input-bar">
        <input
          ref={inputRef}
          className="nebula-input"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Parla con Nebula…"
          disabled={isThinking}
          autoComplete="off"
        />
        <button
          className="nebula-send-btn"
          onClick={handleSubmit}
          disabled={!value.trim() || isThinking}
          aria-label="Invia"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
               strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
