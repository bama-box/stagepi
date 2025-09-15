import './ProgressBar.css';

interface ProgressBarProps {
  value: number; // A percentage from 0 to 100
  label: string;
}

export function ProgressBar({ value, label }: ProgressBarProps) {
  const safeValue = Math.max(0, Math.min(100, value)); // Ensure value is between 0-100

  return (
    <div className="progress-container">
      <div className="progress-label">{label}</div>
      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${safeValue}%` }}>
          {safeValue.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}