import React from 'react';

/**
 * Reusable ThemeToggle button for Light Mode / Dark Mode.
 * Displays a moon shape when dark mode is on, and a sun shape when light mode is on.
 */
export default function ThemeToggle({ darkMode, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: darkMode ? 'flex-end' : 'flex-start',
        width: '58px',
        height: '30px',
        padding: '3px',
        borderRadius: '20px',
        border: darkMode ? '2px solid #38bdf8' : '2px solid #f59e0b',
        backgroundColor: darkMode ? '#1e293b' : '#e2e8f0',
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: darkMode
          ? '0 0 8px rgba(56, 189, 248, 0.3), inset 0 2px 4px rgba(0,0,0,0.4)'
          : '0 0 8px rgba(245, 158, 11, 0.3), inset 0 2px 4px rgba(0,0,0,0.1)',
        outline: 'none',
        flexShrink: 0
      }}
    >
      <span
        style={{
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          backgroundColor: darkMode ? '#0f172a' : '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {darkMode ? (
          /* Moon shape when dark mode is ON */
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="#38bdf8"
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: 'drop-shadow(0 0 3px rgba(56, 189, 248, 0.8))' }}
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          /* Sun shape when light mode is ON */
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: 'drop-shadow(0 0 3px rgba(245, 158, 11, 0.8))' }}
          >
            <circle cx="12" cy="12" r="4.5" fill="#f59e0b" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        )}
      </span>
    </button>
  );
}
