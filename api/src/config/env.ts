export const IS_DEV =
  process.env.NODE_ENV !== "production" ||
  process.env.ALLOW_DEV_EVENTS === "true";
