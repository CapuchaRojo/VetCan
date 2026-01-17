import { Router } from "express";
import { runGeneralInquiry } from "../../../ai/runtime/generalInquiryEngine";
import { resolveNextState } from "../../../ai/runtime/intentRouter";
import { CallState } from "../../../ai/state/callStates";

const router = Router();

router.post("/general-inquiry", (req, res) => {
  const userInput = req.body.SpeechResult || "";
  const state = userInput
    ? resolveNextState(userInput)
    : CallState.GREETING;

  const result = runGeneralInquiry({
    callSid: req.body.CallSid,
    state,
    lastUserInput: userInput,
  });

  res.type("text/xml").send(`
    <Response>
      <Say>${result.speech}</Say>
    </Response>
  `);
});

export default router;
