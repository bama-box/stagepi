import { useState, useEffect } from 'preact/hooks';
import { FiZap } from 'react-icons/fi';
import { API_BASE_URL } from '../../config';
import './LedView.css';

const LED_API = "/system/led";
const REFRESH_INTERVAL = 2000; // Refresh every 2 seconds

type LedAction = "on" | "off" | "blink";
type LedStateValue = LedAction | "unknown";

type LedInfo = {
  available: boolean;
  state?: string; // Backend returns "{on}", "{off}", "{blink}", "{unknown}"
  error?: string
};

type LedState = {
  ACT?: LedInfo;
  PWR?: LedInfo;
};

const LED_COLORS: Record<string, { color: string; name: string }> = {
  ACT: { color: "#4CAF50", name: "Activity" },
  PWR: { color: "#f44336", name: "Power" }
};

// Parse LED state from backend format (e.g., "{on}" -> "on")
const parseLedState = (state?: string): LedStateValue | null => {
  if (!state) return null;
  const match = state.match(/^\{(.+)\}$/);
  return match ? (match[1] as LedStateValue) : null;
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

  const setLed = async (led: string, action: LedAction) => {
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

  const getLedIndicatorClass = (rawState?: string, led?: string) => {
    const state = parseLedState(rawState);
    if (!state || state === "unknown") return "led-unknown";

    const isBlinking = state === "blink";
    const baseClass = state === "on" || isBlinking ?
      (led === "ACT" ? "led-on-green" : "led-on-red") :
      "led-off";
    return isBlinking ? `${baseClass} led-blinking` : baseClass;
  };

  const getStatusBadgeText = (rawState?: string): string => {
    const state = parseLedState(rawState);
    if (!state) return "LOADING...";
    return state.toUpperCase();
  };

  const isActiveButton = (rawState?: string, action?: LedAction): boolean => {
    const state = parseLedState(rawState);
    return state === action;
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
        {Object.entries(ledState).map(([led, state]) => {
          const ledInfo = LED_COLORS[led] || { color: "#888", name: led };
          return (
            <div key={led} className="card led-card">
              <div className="led-header">
                <div className="led-title">
                  <div
                    className={`led-visual ${getLedIndicatorClass(state?.state, led)}`}
                    style={{ backgroundColor: ledInfo.color }}
                  />
                  <h3>{ledInfo.name}</h3>
                </div>
                {state?.available && (
                  <span className={`led-status-badge ${parseLedState(state.state) === "unknown" ? "unknown" : ""}`}>
                    {getStatusBadgeText(state.state)}
                  </span>
                )}
              </div>

              {state?.available ? (
                <>
                  {parseLedState(state.state) === "unknown" && (
                    <div className="led-warning">
                      The LED is in an unknown state. Try setting it to a known state.
                    </div>
                  )}
                  <div className="led-controls">
                    <button
                      onClick={() => setLed(led, "on")}
                      disabled={loading}
                      className={isActiveButton(state.state, "on") ? "active" : ""}
                      aria-label={`Turn ${ledInfo.name} LED on`}
                    >
                      On
                    </button>
                    <button
                      onClick={() => setLed(led, "off")}
                      disabled={loading}
                      className={isActiveButton(state.state, "off") ? "active" : ""}
                      aria-label={`Turn ${ledInfo.name} LED off`}
                    >
                      Off
                    </button>
                    <button
                      onClick={() => setLed(led, "blink")}
                      disabled={loading}
                      className={isActiveButton(state.state, "blink") ? "active" : ""}
                      aria-label={`Make ${ledInfo.name} LED blink`}
                    >
                      Blink
                    </button>
                  </div>
                </>
              ) : (
                <div className="led-unavailable">
                  LED not available
                  {state?.error && <div className="led-error-detail">{state.error}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
