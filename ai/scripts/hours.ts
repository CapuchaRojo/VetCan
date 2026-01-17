// ai/scripts/hours.ts

export type BusinessHours = {
  days: string;
  open: string;
  close: string;
};

export const HOURS_SCRIPT = {
  id: "hours_v1",
  responsePrefix: "Our business hours are",
  hours: [
    { days: "Monday through Friday", open: "9 AM", close: "5 PM" },
  ] as BusinessHours[],
  responseSuffix: "If you’d like, I can request a callback for you.",
};
