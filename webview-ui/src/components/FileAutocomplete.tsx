
interface FileAutocompleteProps {
  files: string[];
  visible: boolean;
  filter: string;
  onSelect: (file: string) => void;
}

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx': return <span style={{ color: '#3178c6' }}>TS</span>;
    case 'js':
    case 'jsx': return <span style={{ color: '#f1e05a' }}>JS</span>;
    case 'css': return <span style={{ color: '#563d7c' }}>#</span>;
    case 'json': return <span style={{ color: '#e34c26' }}>{ }</span>;
    case 'md': return <span style={{ color: '#008ba3' }}>M↓</span>;
    case 'html': return <span style={{ color: '#e34c26' }}>&lt;&gt;</span>;
    default: return <span>📄</span>;
  }
};

export const FileAutocomplete = ({ files, visible, filter, onSelect }: FileAutocompleteProps) => {
  if (!visible) return null;

  // Filter files
  const filtered = files.filter(f => f.toLowerCase().includes(filter.toLowerCase())).slice(0, 8);

  return (
    <div className="file-autocomplete">
      <div className="context-menu-header">
        <span>Code Context Items</span>
        <span className="arrow">→</span>
      </div>

      {/* Categories (Static for now to match UI look) */}
      {!filter && (
        <>
          <div className="context-category">
            <span className="cat-icon">📁</span> Files
          </div>
          <div className="context-category">
            <span className="cat-icon">📂</span> Directories
          </div>
        </>
      )}

      {/* Filtered Files */}
      {filtered.length > 0 ? (
        <div className="file-list-section">
          {filtered.map((file, idx) => (
            <div key={idx} className="autocomplete-item" onClick={() => onSelect(file)}>
              <div className="file-icon-wrapper">{getFileIcon(file)}</div>
              <span className="file-name">{file}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="autocomplete-empty">No matching files</div>
      )}
    </div>
  );
};
