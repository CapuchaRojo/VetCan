import { classifyIntent } from "./voiceIntents";
import { VOICE_LINES } from "./voiceLines";
import { pickLine } from "./pickLine";
import { humanizeLine } from "./humanize";
import type { VoiceContext, VoicePlan, VoiceState } from "./types";

const LOW_CONFIDENCE_THRESHOLD = 0.4;

const ALLOWED_TRANSITIONS: Record<VoiceState, VoiceState[]> = {
  inbound: ["intent"],
  intent: ["name", "inbound", "complete"],
  name: ["phone"],
  phone: ["time", "name"],
  time: ["complete", "inbound"],
  complete: [],
};

function ensureTransition(from: VoiceState, to: VoiceState) {
  // Guard against accidental fallthrough between steps in the flow kernel.
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new Error(`Invalid voice state transition: ${from} -> ${to}`);
  }
}

function addLowConfidenceLine(lines: string[], confidence: number) {
  if (confidence < LOW_CONFIDENCE_THRESHOLD) {
    lines.push(humanizeLine(pickLine(VOICE_LINES.reassurance)));
  }
}

function addMedicalBoundaryLine(lines: string[], medicalFlag: boolean) {
  if (medicalFlag) {
    lines.push(pickLine(VOICE_LINES.medicalBoundary));
  }
}

export function buildInboundPlan(): VoicePlan {
  const line = `${pickLine(VOICE_LINES.greeting)} ${pickLine(
    VOICE_LINES.intentPrompt
  )}`;

  ensureTransition("inbound", "intent");
  return {
    say: [humanizeLine(line)],
    nextState: "intent",
    gather: {
      input: ["speech"],
      action: "/api/voice/intent",
      method: "POST",
      speechTimeout: "auto",
    },
  };
}

export function buildIntentPlan(speech: string): {
  context: VoiceContext;
  plan: VoicePlan;
} {
  const context: VoiceContext = {
    state: "intent",
    intent: "unknown",
    confidence: 0,
    medicalFlag: false,
  };

  const trimmed = speech.trim();
  // Guard empty speech to avoid unintended intent resolution.
  if (!trimmed) {
    ensureTransition("intent", "inbound");
    return {
      context,
      plan: {
        say: [pickLine(VOICE_LINES.retry)],
        nextState: "inbound",
        redirect: "/api/voice/inbound",
      },
    };
  }

  const { intent, confidence, medicalFlag } = classifyIntent(trimmed);
  context.intent = intent;
  context.confidence = confidence;
  context.medicalFlag = medicalFlag;

  const say: string[] = [];
  addLowConfidenceLine(say, confidence);
  addMedicalBoundaryLine(say, medicalFlag);

  switch (intent) {
    case "callback":
    case "scheduling":
    case "general_question":
      ensureTransition("intent", "name");
      say.push(pickLine(VOICE_LINES.schedulingConfirm));
      return {
        context,
        plan: {
          say,
          nextState: "name",
          redirect: "/api/voice/name",
        },
      };

    case "operator":
      ensureTransition("intent", "complete");
      say.push(pickLine(VOICE_LINES.staffHandoff));
      return {
        context,
        plan: {
          say,
          nextState: "complete",
          hangup: true,
        },
      };

    default:
      ensureTransition("intent", "inbound");
      say.push(pickLine(VOICE_LINES.unknownIntent));
      return {
        context,
        plan: {
          say,
          nextState: "inbound",
          redirect: "/api/voice/inbound",
        },
      };
  }
}

export function buildNamePlan(): VoicePlan {
  ensureTransition("name", "phone");
  return {
    say: [pickLine(VOICE_LINES.reassurance)],
    nextState: "phone",
    gather: {
      input: ["speech"],
      action: "/api/voice/phone",
      method: "POST",
      speechTimeout: "auto",
    },
  };
}

export function sanitizeName(rawName: string): string {
  return rawName.trim().slice(0, 100).replace(/[<>\"\'%;()&]/g, "");
}

export function buildPhonePlan(rawName: string): {
  context: VoiceContext;
  plan: VoicePlan;
  name?: string;
} {
  const name = sanitizeName(rawName);
  const context: VoiceContext = { state: "phone", name };

  // Guard missing name to keep callers in the explicit name capture step.
  if (!name) {
    ensureTransition("phone", "name");
    return {
      context,
      plan: {
        say: [pickLine(VOICE_LINES.retry)],
        nextState: "name",
        redirect: "/api/voice/name",
      },
    };
  }

  ensureTransition("phone", "time");
  return {
    context,
    name,
    plan: {
      say: [pickLine(VOICE_LINES.reassurance)],
      nextState: "time",
      gather: {
        input: ["speech", "dtmf"],
        action: `/api/voice/time?name=${encodeURIComponent(name)}`,
        method: "POST",
        speechTimeout: "auto",
      },
    },
  };
}

export function normalizePhone(rawPhone: string): string {
  return String(rawPhone).replace(/[^\d+]/g, "");
}

export function buildTimePlan(params: {
  name: string;
  phone: string;
  preferredTime: string | null;
}): {
  ok?: true;
  context: VoiceContext;
  plan?: VoicePlan;
} {
  const context: VoiceContext = {
    state: "time",
    name: params.name,
    phone: params.phone,
    preferredTime: params.preferredTime,
  };

  // Guard incomplete capture so we do not persist partial callback data.
  if (!params.name || !params.phone) {
    ensureTransition("time", "inbound");
    return {
      context,
      plan: {
        say: [pickLine(VOICE_LINES.retry)],
        nextState: "inbound",
        redirect: "/api/voice/inbound",
      },
    };
  }

  return { ok: true, context };
}
