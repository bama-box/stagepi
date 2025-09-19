import { useState, useEffect } from 'preact/hooks';
import { FiZap } from 'react-icons/fi';
import { API_BASE_URL } from '../../config';
import './LedView.css';

const LED_API = "/system/led";
const REFRESH_INTERVAL = 2000; // Refresh every 2 seconds

type LedState = {
  ACT?: { available: boolean; state?: string; error?: string };
  PWR?: { available: boolean; state?: string; error?: string };
};

export default function LedView() {
  const [ledState, setLedState] = useState<LedState>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLedState = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}${LED_API}`);
      if (!res.ok) throw new Error("Failed to fetch LED state");
      const data = await res.json();
      setLedState(data);
      setError(null);
    } catch (e: any) {
      console.error("LED fetch error:", e);
      setError(e.message);
    }
  };

  const setLed = async (led: string, action: "on" | "off" | "blink") => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ action, led }).toString();
      const res = await fetch(`${API_BASE_URL}${LED_API}?${query}`, { method: "PUT" });
      if (!res.ok) throw new Error("Failed to set LED state");
      
      // Only update the changed LED state
      const updatedLed = await res.json();
      setLedState(prev => ({
        ...prev,
        [led]: updatedLed[led]
      }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchLedState();

    // Set up polling
    const interval = setInterval(fetchLedState, REFRESH_INTERVAL);

    // Clean up interval on unmount
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h2><FiZap /> LED Control</h2>
      {error && <div className="card error">{error}</div>}
      <div className="led-grid">
        {Object.entries(ledState).map(([led, state]) => (
          <div key={led} className="card led-card">
            <h3>
              {led} LED
              <span className="led-indicator">
                <div style={{ 
                  width: 8, 
                  height: 8, 
                  borderRadius: "50%", 
                  backgroundColor: led === "ACT" ? "#4CAF50" : "#f44336" 
                }} />
                {led === "ACT" ? "Green" : "Red"} LED
              </span>
            </h3>
            {state?.available ? (
              <div className="led-controls">
                <button 
                  onClick={() => setLed(led, "on")}
                  disabled={loading}
                  className={state.state === "{on}" ? 
                    (led === "ACT" ? "active-green" : "active-red") : undefined}
                >
                  On
                </button>
                <button 
                  onClick={() => setLed(led, "off")}
                  disabled={loading}
                  className={state.state === "{off}" ? "active-off" : undefined}
                >
                  Off
                </button>
                <button 
                  onClick={() => setLed(led, "blink")}
                  disabled={loading}
                  className={[
                    state.state === "{blink}" ? (led === "ACT" ? "active-green" : "active-red") : undefined,
                    state.state === "{blink}" ? "blinking" : undefined
                  ].filter(Boolean).join(" ")}
                >
                  Blink
                </button>
              </div>
            ) : (
              <div style={{ color: "#666" }}>
                Not available {state?.error && <div>Error: {state.error}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
