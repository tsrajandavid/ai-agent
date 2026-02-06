import React from 'react';
import { CodeBlock } from './CodeBlock';

// Render markdown text to React nodes
export const renderMarkdown = (text: string): React.ReactNode[] => {
  const elements: React.ReactNode[] = [];

  // Split by code blocks first
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  let keyIndex = 0;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Add text before the code block
    if (match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index);
      elements.push(...renderInlineContent(textBefore, keyIndex));
      keyIndex += 100;
    }

    // Add the code block
    const language = match[1] || '';
    const code = match[2].trim();
    elements.push(<CodeBlock key={`code-${keyIndex++}`} code={code} language={language} />);

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last code block
  if (lastIndex < text.length) {
    elements.push(...renderInlineContent(text.slice(lastIndex), keyIndex));
  }

  return elements;
};

const renderInlineContent = (text: string, startKey: number): React.ReactNode[] => {
  const elements: React.ReactNode[] = [];
  let keyIndex = startKey;

  // Split by paragraphs (double newlines)
  const paragraphs = text.split(/\n\n+/);

  paragraphs.forEach((paragraph) => {
    const trimmed = paragraph.trim();
    if (!trimmed) return;

    // Check for headings
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/m);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      if (level === 1) {
        elements.push(<h1 key={`h-${keyIndex++}`}>{renderInlineFormatting(content)}</h1>);
      } else if (level === 2) {
        elements.push(<h2 key={`h-${keyIndex++}`}>{renderInlineFormatting(content)}</h2>);
      } else if (level === 3) {
        elements.push(<h3 key={`h-${keyIndex++}`}>{renderInlineFormatting(content)}</h3>);
      } else {
        elements.push(<h4 key={`h-${keyIndex++}`}>{renderInlineFormatting(content)}</h4>);
      }
      return;
    }

    // Check for bullet lists
    if (/^[\s]*[-*]\s/.test(trimmed)) {
      const items = trimmed.split(/\n/).filter(line => /^[\s]*[-*]\s/.test(line));
      elements.push(
        <ul key={`ul-${keyIndex++}`}>
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineFormatting(item.replace(/^[\s]*[-*]\s+/, ''))}</li>
          ))}
        </ul>
      );
      return;
    }

    // Check for numbered lists
    if (/^[\s]*\d+\.\s/.test(trimmed)) {
      const items = trimmed.split(/\n/).filter(line => /^[\s]*\d+\.\s/.test(line));
      elements.push(
        <ol key={`ol-${keyIndex++}`}>
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineFormatting(item.replace(/^[\s]*\d+\.\s+/, ''))}</li>
          ))}
        </ol>
      );
      return;
    }

    // Regular paragraph
    elements.push(<p key={`p-${keyIndex++}`}>{renderInlineFormatting(trimmed)}</p>);
  });

  return elements;
};

const renderInlineFormatting = (text: string): React.ReactNode => {
  // Handle inline code, bold, italic
  const parts: React.ReactNode[] = [];
  let key = 0;

  // Process inline code first
  const inlineCodeRegex = /`([^`]+)`/g;
  let lastIdx = 0;
  let codeMatch;

  while ((codeMatch = inlineCodeRegex.exec(text)) !== null) {
    if (codeMatch.index > lastIdx) {
      parts.push(formatBoldItalic(text.slice(lastIdx, codeMatch.index), key++));
    }
    parts.push(<code key={`ic-${key++}`}>{codeMatch[1]}</code>);
    lastIdx = codeMatch.index + codeMatch[0].length;
  }

  if (lastIdx < text.length) {
    parts.push(formatBoldItalic(text.slice(lastIdx), key++));
  }

  return parts.length > 0 ? parts : text;
};

const formatBoldItalic = (text: string, key: number): React.ReactNode => {
  // Bold: **text** or __text__
  // Italic: *text* or _text_
  let result: React.ReactNode = text;

  // Handle bold
  result = text.replace(/\*\*(.+?)\*\*/g, '<<BOLD>>$1<<ENDBOLD>>');

  if (typeof result === 'string' && result.includes('<<BOLD>>')) {
    const parts = result.split(/(<<BOLD>>.*?<<ENDBOLD>>)/g);
    return (
      <span key={`bf-${key}`}>
        {parts.map((part, idx) => {
          if (part.startsWith('<<BOLD>>')) {
            return <strong key={idx}>{part.replace(/<<BOLD>>|<<ENDBOLD>>/g, '')}</strong>;
          }
          return part;
        })}
      </span>
    );
  }

  return result;
};
