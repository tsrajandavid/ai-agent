import { useState } from 'react';
import { ChevronIcon } from './Icons';
import type { Mode } from '../types';

interface DropdownProps {
  label: string;
  items: Mode[];
  selectedId: string;
  onSelect: (item: Mode) => void;
  title?: string;
}

export const Dropdown = ({ label, items, selectedId, onSelect, title }: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="custom-dropdown">
      <button
        className={`dropdown-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title={label}
      >
        {label}
        <ChevronIcon isOpen={isOpen} />
      </button>
      {isOpen && (
        <>
          <div className="dropdown-backdrop" onClick={() => setIsOpen(false)} />
          <div className="dropdown-menu">
            {title && <div className="dropdown-header">{title}</div>}
            {items.map((item) => (
              <div
                key={item.id}
                className={`dropdown-item ${item.id === selectedId ? 'selected' : ''}`}
                onClick={() => {
                  onSelect(item);
                  setIsOpen(false);
                }}
              >
                <div className="item-label">{item.label}</div>
                <div className="item-desc">{item.desc}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
