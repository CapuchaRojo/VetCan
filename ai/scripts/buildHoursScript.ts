// ai/scripts/buildHoursScript.ts
import { HOURS_SCRIPT } from "./hours";

export function buildHoursScript(): string {
  const hoursText = HOURS_SCRIPT.hours
    .map(h => `${h.days}, from ${h.open} to ${h.close}`)
    .join(". ");

  return `
${HOURS_SCRIPT.responsePrefix}.
${hoursText}.
${HOURS_SCRIPT.responseSuffix}
`.trim();
}