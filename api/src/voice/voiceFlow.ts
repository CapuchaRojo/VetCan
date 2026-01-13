import { classifyIntent } from "./voiceIntents";
import { VOICE_LINES } from "./voiceLines";
import { pickLine } from "./pickLine";
import { humanizeLine } from "./humanize";
import { emitEvent } from "../lib/events";
import { validationFail } from "../lib/validationFail";
import type { VoiceContext, VoicePlan, VoiceState } from "./types";
import { VOICE_TRANSITIONS } from "./types";

const LOW_CONFIDENCE_THRESHOLD = 0.4;

function ensureTransition(from: VoiceState, to: VoiceState) {
  if (!(VOICE_TRANSITIONS[from] as readonly VoiceState[]).includes(to)) {
    throw new Error(`Invalid voice state transition: ${from} -> ${to}`);
  }
  emitEvent("voice_state_transition", { from, to });
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

export function buildInboundPlan(): VoicePlan<"inbound"> {
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
  plan: VoicePlan<"intent">;
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
    validationFail({ scope: "voice", reason: "missing_speech", state: "intent" });
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

export function buildNamePlan(): VoicePlan<"name"> {
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

export function validateNameInput(rawName: unknown): {
  name: string;
  reason?: string;
} {
  if (typeof rawName !== "string") {
    return { name: "", reason: "invalid_name" };
  }

  const trimmed = rawName.trim();
  if (!trimmed) {
    return { name: "", reason: "missing_name" };
  }

  if (trimmed.length > 50) {
    return { name: "", reason: "name_too_long" };
  }

  const sanitized = trimmed.replace(/[<>\"\'%;()&]/g, "");
  if (!sanitized) {
    return { name: "", reason: "invalid_name" };
  }

  return { name: sanitized, reason: undefined };
}

export function buildPhonePlan(rawName: unknown): {
  context: VoiceContext;
  plan: VoicePlan<"phone">;
  name?: string;
} {
  const { name, reason } = validateNameInput(rawName);
  const context: VoiceContext = { state: "phone", name };

  // Guard missing name to keep callers in the explicit name capture step.
  if (!name) {
    validationFail({
      scope: "voice",
      reason: reason || "missing_name",
      state: "phone",
    });
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
  skipValidation?: boolean;
}): {
  ok?: true;
  context: VoiceContext;
  plan?: VoicePlan<"time">;
} {
  const context: VoiceContext = {
    state: "time",
    name: params.name,
    phone: params.phone,
    preferredTime: params.preferredTime,
  };

  // Guard incomplete capture so we do not persist partial callback data.
  if (!params.name || !params.phone) {
    if (!params.skipValidation) {
      validationFail({
        scope: "voice",
        reason: "missing_name_or_phone",
        state: "time",
      });
    }
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
