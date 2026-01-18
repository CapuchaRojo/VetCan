import { emitEvent } from "../lib/events";

/**
 * Production general inquiry voice flow.
 * Deterministic, non-generative, event-only side effects.
 */
export type GeneralInquiryState =
  | "INIT"
  | "GREETING"
  | "LISTENING"
  | "PROVIDE_INFO"
  | "OFFER_CALLBACK"
  | "COLLECT_PHONE"
  | "CONFIRM_CALLBACK"
  | "FALLBACK"
  | "END";

export type GeneralInquiryPlan = {
  say: string[];
  gather?: {
    input: Array<"speech" | "dtmf">;
    action: string;
    method: "POST";
    speechTimeout: "auto";
  };
  redirect?: string;
  hangup?: boolean;
};

const GREETING_TEXT =
  "Thank you for calling. I can help with general questions or request a callback from staff.";
const GREETING_FOLLOWUP = "How can I help you today?";
const HOURS_TEXT =
  "Our business hours are Monday through Friday, from 9 AM to 5 PM.";
const FALLBACK_TEXT =
  "I want to make sure you get the right help. Would you like a callback from a staff member?";

const GENERAL_INQUIRY_STATES: GeneralInquiryState[] = [
  "INIT",
  "GREETING",
  "LISTENING",
  "PROVIDE_INFO",
  "OFFER_CALLBACK",
  "COLLECT_PHONE",
  "CONFIRM_CALLBACK",
  "FALLBACK",
  "END",
];

const MIN_PHONE_DIGITS = 10;

export function isGeneralInquiryState(
  value: string
): value is GeneralInquiryState {
  return GENERAL_INQUIRY_STATES.includes(value as GeneralInquiryState);
}

function normalizePhone(input: string): string {
  return input.replace(/[^\d+]/g, "");
}

function isAffirmative(input: string) {
  const normalized = input.toLowerCase();
  return ["yes", "yeah", "yep", "sure", "correct", "ok", "okay"].some(word =>
    normalized.includes(word)
  );
}

function isNegative(input: string) {
  const normalized = input.toLowerCase();
  return ["no", "nope", "nah", "not"].some(word =>
    normalized.includes(word)
  );
}

function detectNextState(input: string): GeneralInquiryState {
  const normalized = input.toLowerCase();
  if (normalized.includes("hour") || normalized.includes("open")) {
    return "PROVIDE_INFO";
  }
  if (
    normalized.includes("callback") ||
    normalized.includes("call back") ||
    normalized.includes("call me") ||
    normalized.includes("call you")
  ) {
    return "OFFER_CALLBACK";
  }
  return "FALLBACK";
}

export function buildGeneralInquiryPlan(params: {
  state: GeneralInquiryState;
  speech?: string;
  phone?: string;
  name?: string;
}): GeneralInquiryPlan {
  const speech = (params.speech || "").trim();
  const phone = (params.phone || "").trim();

  switch (params.state) {
    case "GREETING":
      return {
        say: [`${GREETING_TEXT} ${GREETING_FOLLOWUP}`],
        gather: {
          input: ["speech"],
          action: "/api/voice/general-inquiry?state=LISTENING",
          method: "POST",
          speechTimeout: "auto",
        },
      };

    case "LISTENING": {
      const next = detectNextState(speech);
      if (next === "PROVIDE_INFO") {
        return {
          say: [
            HOURS_TEXT,
            "Would you like a callback from a staff member?",
          ],
          gather: {
            input: ["speech"],
            action: "/api/voice/general-inquiry?state=OFFER_CALLBACK",
            method: "POST",
            speechTimeout: "auto",
          },
        };
      }

      if (next === "OFFER_CALLBACK") {
        return {
          say: ["I can request a callback. Would you like me to do that?"],
          gather: {
            input: ["speech"],
            action: "/api/voice/general-inquiry?state=OFFER_CALLBACK",
            method: "POST",
            speechTimeout: "auto",
          },
        };
      }

      return {
        say: [FALLBACK_TEXT],
        gather: {
          input: ["speech"],
          action: "/api/voice/general-inquiry?state=OFFER_CALLBACK",
          method: "POST",
          speechTimeout: "auto",
        },
      };
    }

    case "OFFER_CALLBACK": {
      if (!speech) {
        return {
          say: ["Would you like a callback from our staff?"],
          gather: {
            input: ["speech"],
            action: "/api/voice/general-inquiry?state=OFFER_CALLBACK",
            method: "POST",
            speechTimeout: "auto",
          },
        };
      }

      if (isAffirmative(speech)) {
        return {
          say: ["Please say the best phone number to reach you."],
          gather: {
            input: ["speech", "dtmf"],
            action: "/api/voice/general-inquiry?state=COLLECT_PHONE",
            method: "POST",
            speechTimeout: "auto",
          },
        };
      }

      if (isNegative(speech)) {
        return {
          say: ["Okay. If you need anything else, feel free to call back."],
          hangup: true,
        };
      }

      return {
        say: ["Sorry, I didn’t catch that. Please say yes or no."],
        gather: {
          input: ["speech"],
          action: "/api/voice/general-inquiry?state=OFFER_CALLBACK",
          method: "POST",
          speechTimeout: "auto",
        },
      };
    }

    case "COLLECT_PHONE": {
      const normalized = normalizePhone(speech);
      if (!normalized || normalized.replace(/\D/g, "").length < MIN_PHONE_DIGITS) {
        return {
          say: ["Sorry, I didn’t catch that number. Please say it again."],
          gather: {
            input: ["speech", "dtmf"],
            action: "/api/voice/general-inquiry?state=COLLECT_PHONE",
            method: "POST",
            speechTimeout: "auto",
          },
        };
      }

      return {
        say: [`Thanks. I heard ${normalized}. Is that correct?`],
        gather: {
          input: ["speech"],
          action: `/api/voice/general-inquiry?state=CONFIRM_CALLBACK&phone=${encodeURIComponent(
            normalized
          )}`,
          method: "POST",
          speechTimeout: "auto",
        },
      };
    }

    case "CONFIRM_CALLBACK": {
      if (isAffirmative(speech)) {
        const confirmedPhone = phone || normalizePhone(speech);
        if (!confirmedPhone) {
          return {
            say: ["Please say your phone number again."],
            gather: {
              input: ["speech", "dtmf"],
              action: "/api/voice/general-inquiry?state=COLLECT_PHONE",
              method: "POST",
              speechTimeout: "auto",
            },
          };
        }
        emitEvent("callback_requested", {
          source: "voice",
          intent: "general_inquiry",
          phone: confirmedPhone,
          name: params.name,
        });
        return {
          say: ["Great. Someone will follow up shortly."],
          hangup: true,
        };
      }

      if (isNegative(speech)) {
        return {
          say: ["Okay, please say your phone number again."],
          gather: {
            input: ["speech", "dtmf"],
            action: "/api/voice/general-inquiry?state=COLLECT_PHONE",
            method: "POST",
            speechTimeout: "auto",
          },
        };
      }

      return {
        say: ["Please say yes or no."],
        gather: {
          input: ["speech"],
          action: `/api/voice/general-inquiry?state=CONFIRM_CALLBACK&phone=${encodeURIComponent(
            phone
          )}`,
          method: "POST",
          speechTimeout: "auto",
        },
      };
    }

    case "FALLBACK":
      return {
        say: [FALLBACK_TEXT],
        gather: {
          input: ["speech"],
          action: "/api/voice/general-inquiry?state=OFFER_CALLBACK",
          method: "POST",
          speechTimeout: "auto",
        },
      };

    case "END":
    case "INIT":
    default:
      return {
        say: ["Thanks for calling."],
        hangup: true,
      };
  }
}
