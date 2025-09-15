import './ToggleSwitch.css';

interface ToggleSwitchProps {
  label: string;
  checked: boolean;
  onChange: (newCheckedState: boolean) => void;
  disabled?: boolean;
}

export function ToggleSwitch({ label, checked, onChange, disabled = false }: ToggleSwitchProps) {
  const handleChange = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (
    <label className={`toggle-switch ${disabled ? 'disabled' : ''}`}>
      <span className="toggle-label">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
      />
      <span className="slider round"></span>
    </label>
  );
}