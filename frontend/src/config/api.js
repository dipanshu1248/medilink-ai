/**
 * Centralized API Base URL configuration.
 * Reads from VITE_API_BASE_URL environment variable if provided,
 * otherwise falls back to local development server http://127.0.0.1:8000.
 */
export const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
