import { useState } from 'react';
import { useVSCode } from './hooks/useVSCode';
import './App.css';

function App() {
  const { postMessage, messages } = useVSCode();
  const [inputValue, setInputValue] = useState("");
  const [mode, setMode] = useState<"PLAN" | "ACT" | "ASK">("PLAN");

  const handleModeChange = (newMode: "PLAN" | "ACT" | "ASK") => {
    setMode(newMode);
    postMessage("setMode", newMode);
  };

  const handleSend = () => {
    if (inputValue.trim()) {
      postMessage("hello", inputValue);
      setInputValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="app-container">
      <h1>AI Agent</h1>
      <div className="mode-selector">
        <button
          className={mode === "PLAN" ? "active" : ""}
          onClick={() => handleModeChange("PLAN")}
          title="Plan mode: Read-only, explore"
        >
          📋 PLAN
        </button>
        <button
          className={mode === "ACT" ? "active" : ""}
          onClick={() => handleModeChange("ACT")}
          title="Act mode: Execute changes"
        >
          ⚡ ACT
        </button>
        <button
          className={mode === "ASK" ? "active" : ""}
          onClick={() => handleModeChange("ASK")}
          title="Ask mode: Q&A only"
        >
          💬 ASK
        </button>
      </div>
      <div className="chat-area">
        {messages.length === 0 && <p>Welcome to AI Agent!</p>}
        {messages.map((msg, index) => (
          <div key={index} className="message">
            <pre>{JSON.stringify(msg, null, 2)}</pre>
          </div>
        ))}
      </div>
      <div className="input-area">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask something..."
          rows={3}
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}

export default App;
