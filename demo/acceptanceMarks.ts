// The demo's acceptance marks: recreations of the eight networks' marks,
// drawn for the IncrediCard demo, passed in through `acceptanceMarks`
// exactly as an app passes its own.
//
// They are not part of the npm package. The marks are trademarks of
// their networks (see NOTICE), and an app showing them should use each
// network's official artwork under that network's rules. They are here,
// in the repository, for the demo, and for anyone who explicitly chooses
// to copy them into their own app instead.
import type { IncrediCardAcceptanceMarks } from "../src";
import amex from "./acceptance-marks/amex.svg";
import dinersclub from "./acceptance-marks/diners-club.svg";
import discover from "./acceptance-marks/discover.svg";
import jcb from "./acceptance-marks/jcb.svg";
import maestro from "./acceptance-marks/maestro.svg";
import mastercard from "./acceptance-marks/mastercard.svg";
import unionpay from "./acceptance-marks/union-pay.svg";
import visa from "./acceptance-marks/visa.svg";

export const demoAcceptanceMarks: IncrediCardAcceptanceMarks = {
  amex,
  dinersclub,
  discover,
  jcb,
  maestro,
  mastercard,
  unionpay,
  visa,
};
