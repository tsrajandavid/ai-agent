
interface ContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContextMenu = ({ isOpen, onClose }: ContextMenuProps) => {
  if (!isOpen) return null;

  return (
    <div className="context-popup">
      <div className="context-header">Add Context</div>
      <div className="context-item" onClick={onClose}>
        <span className="context-icon">📁</span>
        <span>Files</span>
      </div>
      <div className="context-item" onClick={onClose}>
        <span className="context-icon">@</span>
        <span>Mentions</span>
      </div>
      <div className="context-item" onClick={onClose}>
        <span className="context-icon">⚡</span>
        <span>Commands</span>
      </div>
    </div>
  );
};
