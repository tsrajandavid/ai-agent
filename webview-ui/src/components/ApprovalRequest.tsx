import { useState, useMemo } from 'react';
import type { ApprovalData } from '../types';

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: DiffLine[] = [];

  // Simple LCS-based diff
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldLines[i - 1] === newLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack to build diff
  const diffOps: Array<{ type: 'unchanged' | 'removed' | 'added'; line: string; oldIdx?: number; newIdx?: number }> = [];
  let i = m, j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      diffOps.unshift({ type: 'unchanged', line: oldLines[i - 1], oldIdx: i, newIdx: j });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diffOps.unshift({ type: 'added', line: newLines[j - 1], newIdx: j });
      j--;
    } else {
      diffOps.unshift({ type: 'removed', line: oldLines[i - 1], oldIdx: i });
      i--;
    }
  }

  let oldNum = 0, newNum = 0;
  for (const op of diffOps) {
    if (op.type === 'unchanged') {
      oldNum++; newNum++;
      result.push({ type: 'unchanged', content: op.line, oldLineNum: oldNum, newLineNum: newNum });
    } else if (op.type === 'removed') {
      oldNum++;
      result.push({ type: 'removed', content: op.line, oldLineNum: oldNum });
    } else {
      newNum++;
      result.push({ type: 'added', content: op.line, newLineNum: newNum });
    }
  }

  return result;
}

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

  const isEdit = tool === 'edit_file';
  const isNewFile = !oldContent || oldContent.trim() === '';

  const displayOld = isEdit ? (oldString || '') : (oldContent || '');
  const displayNew = isEdit ? (newString || '') : (newContent || '');

  const ext = filePath.split('.').pop() || '';

  const diffLines: DiffLine[] = useMemo(() => {
    if (!displayOld && displayNew) {
      return displayNew.split('\n').map((line, i): DiffLine => ({
        type: 'added',
        content: line,
        newLineNum: i + 1
      }));
    }
    if (displayOld && !displayNew) {
      return displayOld.split('\n').map((line, i): DiffLine => ({
        type: 'removed',
        content: line,
        oldLineNum: i + 1
      }));
    }
    if (displayOld && displayNew) {
      return computeDiff(displayOld, displayNew);
    }
    return [];
  }, [displayOld, displayNew]);

  const additions = diffLines.filter(l => l.type === 'added').length;
  const deletions = diffLines.filter(l => l.type === 'removed').length;

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
              {(additions > 0 || deletions > 0) && (
                <span className="diff-stats">
                  {additions > 0 && <span className="diff-stat-add">+{additions}</span>}
                  {deletions > 0 && <span className="diff-stat-del">-{deletions}</span>}
                </span>
              )}
            </div>

            {showDiff ? (
              <div className="diff-view">
                {diffLines.length > 0 ? (
                  <table className="diff-table">
                    <tbody>
                      {diffLines.map((line, idx) => (
                        <tr key={idx} className={`diff-line diff-line-${line.type}`}>
                          <td className="diff-line-number diff-line-old">
                            {line.oldLineNum ?? ''}
                          </td>
                          <td className="diff-line-number diff-line-new">
                            {line.newLineNum ?? ''}
                          </td>
                          <td className="diff-line-prefix">
                            {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                          </td>
                          <td className="diff-line-content">
                            <code>{line.content}</code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
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
