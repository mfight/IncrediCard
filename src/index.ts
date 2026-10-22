// NO "use client" in this file, deliberately. The namespace below is
// composed here rather than in IncrediCard.tsx because this module stays
// in the server graph; see the note above `export { IncrediCardBase }` in
// IncrediCard.tsx for why.
import { IncrediCardBase } from "./IncrediCard";
import { IncrediCardField } from "./IncrediCardField";
import { IncrediCardMaskedField } from "./IncrediCardMaskedField";

export const IncrediCard = Object.assign(IncrediCardBase, {
  Field: IncrediCardField,
  MaskedField: IncrediCardMaskedField,
});

export { DEFAULT_INCREDICARD_LABELS } from "./IncrediCard";

// Public because the iOS permission specifics (feature-detect rather than
// sniff, call synchronously inside the gesture, bind the static method,
// distinguish a refusal from a call that was never made) are this
// library's job to get right, not every caller's. The component itself
// never calls it, and the call site belongs far from the card: ask once,
// early in your app (at first sign-in, say), because iOS's prompt is
// one-shot and remembered per origin. See the header of
// IncrediCardOrientation.ts.
export { requestIncrediCardMotionAccess } from "./IncrediCardOrientation";
export type { IncrediCardMotionAccess } from "./IncrediCardOrientation";
export type {
  IncrediCardProps,
  IncrediCardValue,
  IncrediCardLayout,
  IncrediCardTheme,
  IncrediCardLabels,
} from "./IncrediCard";

// IncrediCard.Field/IncrediCard.MaskedField are the compound-namespace
// components (see the comment on that pair in IncrediCard.tsx). These are
// their prop types, for typing your own wrapper around them in a custom
// layout.
export type { IncrediCardFieldProps, IncrediCardFieldSize } from "./IncrediCardField";
export type { IncrediCardMaskedFieldProps } from "./IncrediCardMaskedField";
export type { MaskCharacterClass } from "./maskEngine";
// `CardNetwork` is deliberately NOT exported: no public API takes or
// returns a network. It stays internal (cardNetworks.ts,
// acceptanceMarks.ts), alongside detectCardNetwork/getCardNetworkInfo/
// luhnCheck.
