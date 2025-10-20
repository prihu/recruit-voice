import { format, formatDistanceToNow } from 'date-fns';

let warned = false;
const warnOnce = (...args: any[]) => {
  if (!warned) {
    console.warn(...args);
    warned = true;
  }
};

/**
 * Safely parse various timestamp formats to a Date object
 * Handles: Date, number (ms or 10-digit seconds), numeric strings, ISO strings, 
 * and object shapes like {seconds, nanoseconds}, {epochMs}, {value}
 */
export function parseToDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  
  if (typeof value === 'number') {
    // Handle both milliseconds and seconds (10-digit Unix timestamp)
    const ms = String(value).length === 10 ? value * 1000 : value;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return null;
    
    // Handle numeric strings
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      const ms = s.length === 10 ? n * 1000 : n;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
    
    // Handle ISO strings and other date formats
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  
  if (value && typeof value === 'object') {
    const v: any = value;
    
    // Handle {epochMs} shape
    if (typeof v.epochMs === 'number') {
      return parseToDate(v.epochMs);
    }
    
    // Handle {value} shape
    if (typeof v.value === 'number' || typeof v.value === 'string') {
      return parseToDate(v.value);
    }
    
    // Handle Firestore Timestamp shape {seconds, nanoseconds}
    if (typeof v.seconds === 'number') {
      const ms = v.seconds * 1000 + (typeof v.nanoseconds === 'number' ? Math.floor(v.nanoseconds / 1e6) : 0);
      return parseToDate(ms);
    }
  }
  
  return null;
}

/**
 * Safely format a date with fallback
 */
export function safeFormat(value: unknown, fmt: string, fallback = '-'): string {
  try {
    const d = parseToDate(value);
    return d ? format(d, fmt) : fallback;
  } catch (e) {
    warnOnce('safeFormat failed for', value, e);
    return fallback;
  }
}

/**
 * Safely format distance to now with fallback
 */
export function safeFormatDistance(value: unknown, options?: any, fallback = '-'): string {
  try {
    const d = parseToDate(value);
    return d ? formatDistanceToNow(d, options) : fallback;
  } catch (e) {
    warnOnce('safeFormatDistance failed for', value, e);
    return fallback;
  }
}
