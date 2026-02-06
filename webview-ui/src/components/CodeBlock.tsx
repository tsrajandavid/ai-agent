import { useState } from 'react';
import { CopyIcon, CheckIcon } from './Icons';

interface CodeBlockProps {
  code: string;
  language: string;
}

export const CodeBlock = ({ code, language }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);

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
        <code>{code}</code>
      </pre>
    </div>
  );
};
