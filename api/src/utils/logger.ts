const isTest = process.env.NODE_ENV === "test";

export const logger = {
  debug: (...args: unknown[]) => {
    if (!isTest) {
      console.debug(...args);
    }
  },
  info: (...args: unknown[]) => {
    if (!isTest) {
      console.log(...args);
    }
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    if (isTest) {
      console.warn(...args);
      return;
    }
    console.error(...args);
  },
};
