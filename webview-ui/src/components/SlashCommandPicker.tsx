import { SLASH_COMMANDS } from '../constants';

interface SlashCommandPickerProps {
  visible: boolean;
  filter: string;
  onSelect: (cmd: string) => void;
}

export const SlashCommandPicker = ({ visible, filter, onSelect }: SlashCommandPickerProps) => {
  if (!visible) return null;

  // Filter commands based on what user typed after /
  const filterText = filter.startsWith('/') ? filter.slice(1).toLowerCase() : filter.toLowerCase();
  const filtered = SLASH_COMMANDS.filter(c =>
    c.cmd.toLowerCase().includes(filterText) ||
    c.label.toLowerCase().includes(filterText)
  );

  if (filtered.length === 0) return null;

  return (
    <div className="slash-command-picker">
      <div className="slash-picker-header">
        <span>⚡ Commands</span>
      </div>
      <div className="slash-picker-list">
        {filtered.map((cmd, idx) => (
          <div
            key={idx}
            className="slash-picker-item"
            onClick={() => onSelect(cmd.cmd)}
          >
            <span className="slash-icon">{cmd.icon}</span>
            <div className="slash-info">
              <span className="slash-cmd">{cmd.cmd}</span>
              <span className="slash-desc">{cmd.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
