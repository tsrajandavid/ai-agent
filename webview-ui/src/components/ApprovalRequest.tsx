import { useState } from 'react';
import type { ApprovalData } from '../types';

interface ApprovalRequestProps extends ApprovalData {
  onApprove: () => void;
  onReject: () => void;
}

export const ApprovalRequest = ({
  tool,
  filePath,
  oldContent,
  newContent,
  oldString,
  newString,
  onApprove,
  onReject
}: ApprovalRequestProps) => {
  const [showDiff, setShowDiff] = useState(true);

  // Determine what to show
  const isEdit = tool === 'edit_file';
  const isNewFile = !oldContent || oldContent.trim() === '';

  // Get display content
  const displayOld = isEdit ? oldString : oldContent;
  const displayNew = isEdit ? newString : newContent;

  // Get file extension for syntax hint
  const ext = filePath.split('.').pop() || '';

  return (
    <div className="message approval">
      <div className="message-wrapper">
        <div className="message-avatar approval-avatar">⚡</div>
        <div className="message-body">
          <div className="approval-header">
            <span className="approval-title">
              {isEdit ? 'Edit File' : isNewFile ? 'Create File' : 'Overwrite File'}
            </span>
            <span className="approval-path">{filePath}</span>
          </div>

          <div className="approval-diff-container">
            <div className="diff-toolbar">
              <button
                className={`diff-tab ${showDiff ? 'active' : ''}`}
                onClick={() => setShowDiff(true)}
              >
                Changes
              </button>
              <button
                className={`diff-tab ${!showDiff ? 'active' : ''}`}
                onClick={() => setShowDiff(false)}
              >
                Preview
              </button>
              <span className="diff-file-type">{ext.toUpperCase()}</span>
            </div>

            {showDiff ? (
              <div className="diff-view">
                {displayOld && (
                  <div className="diff-section removed">
                    <div className="diff-label">- Removed</div>
                    <pre><code>{displayOld}</code></pre>
                  </div>
                )}
                {displayNew && (
                  <div className="diff-section added">
                    <div className="diff-label">+ Added</div>
                    <pre><code>{displayNew}</code></pre>
                  </div>
                )}
                {!displayOld && !displayNew && (
                  <div className="diff-empty">No changes to preview</div>
                )}
              </div>
            ) : (
              <div className="preview-view">
                <pre><code>{displayNew || newContent || ''}</code></pre>
              </div>
            )}
          </div>

          <div className="approval-actions">
            <button className="approval-btn reject" onClick={onReject}>
              ✕ Reject
            </button>
            <button className="approval-btn accept" onClick={onApprove}>
              ✓ Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
