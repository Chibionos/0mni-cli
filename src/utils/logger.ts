/* eslint-disable @typescript-eslint/no-explicit-any */

const DEBUG = !!process.env.DEBUG;

export function debug(...args: any[]): void {
  if (DEBUG) {
    console.debug('[debug]', ...args);
  }
}

export function info(...args: any[]): void {
  console.log(...args);
}

export function error(...args: any[]): void {
  console.error(...args);
}
