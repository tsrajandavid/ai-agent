import React, { useState, useMemo } from 'react';
import { CopyIcon, CheckIcon } from './Icons';

// Lightweight syntax highlighter — covers JS/TS keywords, strings, comments, numbers
function highlightCode(code: string, language: string): React.ReactNode[] {
  const lang = language.toLowerCase();
  const isJSLike = ['js', 'jsx', 'ts', 'tsx', 'javascript', 'typescript'].includes(lang);
  const isCSSLike = ['css', 'scss', 'less'].includes(lang);
  const isJSON = lang === 'json';

  if (!isJSLike && !isCSSLike && !isJSON) {
    return [code];
  }

  const tokens: { pattern: RegExp; className: string }[] = [];

  if (isJSLike) {
    tokens.push(
      { pattern: /(\/\/.*$)/gm, className: 'token-comment' },
      { pattern: /(\/\*[\s\S]*?\*\/)/g, className: 'token-comment' },
      { pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, className: 'token-string' },
      { pattern: /\b(\d+\.?\d*)\b/g, className: 'token-number' },
      { pattern: /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|default|async|await|try|catch|throw|new|this|typeof|instanceof|interface|type|enum|extends|implements|readonly|private|public|protected|static|abstract|override)\b/g, className: 'token-keyword' },
      { pattern: /\b(true|false|null|undefined|void|never|any|string|number|boolean|object|unknown)\b/g, className: 'token-type' },
      { pattern: /([a-zA-Z_$][\w$]*)\s*(?=\()/g, className: 'token-function' },
    );
  } else if (isCSSLike) {
    tokens.push(
      { pattern: /(\/\*[\s\S]*?\*\/)/g, className: 'token-comment' },
      { pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, className: 'token-string' },
      { pattern: /(\d+\.?\d*(px|em|rem|%|vh|vw|s|ms)?)\b/g, className: 'token-number' },
      { pattern: /(#[0-9a-fA-F]{3,8})\b/g, className: 'token-string' },
    );
  } else if (isJSON) {
    tokens.push(
      { pattern: /("(?:[^"\\]|\\.)*")\s*:/g, className: 'token-keyword' },
      { pattern: /:\s*("(?:[^"\\]|\\.)*")/g, className: 'token-string' },
      { pattern: /\b(\d+\.?\d*)\b/g, className: 'token-number' },
      { pattern: /\b(true|false|null)\b/g, className: 'token-type' },
    );
  }

  // Simple approach: process line by line, apply first matching token
  const lines = code.split('\n');
  const result: React.ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) result.push('\n');

    // Find all token matches in this line
    const segments: { start: number; end: number; className: string }[] = [];
    for (const token of tokens) {
      const regex = new RegExp(token.pattern.source, token.pattern.flags);
      let match;
      while ((match = regex.exec(line)) !== null) {
        const captureIdx = match[1] !== undefined ? 1 : 0;
        const start = match.index + (match[0].indexOf(match[captureIdx]));
        segments.push({
          start,
          end: start + match[captureIdx].length,
          className: token.className
        });
      }
    }

    // Sort by start position, remove overlaps
    segments.sort((a, b) => a.start - b.start);
    const filtered: typeof segments = [];
    let lastEnd = 0;
    for (const seg of segments) {
      if (seg.start >= lastEnd) {
        filtered.push(seg);
        lastEnd = seg.end;
      }
    }

    // Build highlighted line
    let pos = 0;
    filtered.forEach((seg, i) => {
      if (seg.start > pos) {
        result.push(line.slice(pos, seg.start));
      }
      result.push(
        <span key={`${lineIdx}-${i}`} className={seg.className}>
          {line.slice(seg.start, seg.end)}
        </span>
      );
      pos = seg.end;
    });
    if (pos < line.length) {
      result.push(line.slice(pos));
    }
  });

  return result;
}

interface CodeBlockProps {
  code: string;
  language: string;
}

export const CodeBlock = React.memo(({ code, language }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);

  const highlighted = useMemo(() => highlightCode(code, language), [code, language]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-language">{language || 'code'}</span>
        <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
          {copied ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
        </button>
      </div>
      <pre>
        <code>{highlighted}</code>
      </pre>
    </div>
  );
});
