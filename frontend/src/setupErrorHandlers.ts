/**
 * Global error handlers for production crash prevention.
 * Must be imported BEFORE any React rendering.
 * 
 * Catches:
 * 1. Unhandled JS errors (via ErrorUtils)
 * 2. Unhandled Promise rejections
 */
import { Platform, LogBox } from 'react-native';

// Suppress yellow box warnings in production
if (!__DEV__) {
  LogBox.ignoreAllLogs(true);
}

// 1. Global synchronous error handler
const defaultHandler = (ErrorUtils as any).getGlobalHandler?.();

(ErrorUtils as any).setGlobalHandler?.((error: Error, isFatal?: boolean) => {
  console.error('[GLOBAL ERROR]', isFatal ? 'FATAL' : 'NON-FATAL', error?.message || error);

  // For non-fatal errors, just log and continue
  if (!isFatal) {
    return;
  }

  // For fatal errors in production, try to let the default handler deal with it
  // but wrapped in try/catch so it doesn't double-crash
  if (defaultHandler) {
    try {
      defaultHandler(error, isFatal);
    } catch (e) {
      // Silently fail — better than crashing
      console.error('[GLOBAL ERROR] Default handler also failed:', e);
    }
  }
});

// 2. Unhandled Promise rejection handler
if (typeof global !== 'undefined') {
  const originalHandler = (global as any).onunhandledrejection;

  (global as any).onunhandledrejection = (event: any) => {
    const reason = event?.reason;
    console.warn('[UNHANDLED PROMISE]', reason?.message || reason || 'Unknown rejection');

    // Don't crash — just log
    if (originalHandler) {
      try {
        originalHandler(event);
      } catch (e) {
        // Silently fail
      }
    }
  };
}

// 3. Additional: catch any tracking/module errors during init
try {
  // Pre-validate critical modules exist
  require('expo-router');
  require('react-native-safe-area-context');
  require('@react-native-async-storage/async-storage');
} catch (e) {
  console.error('[INIT] Critical module missing:', (e as Error)?.message);
}
