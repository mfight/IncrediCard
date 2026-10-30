import { describe, expect, it } from "vitest";
import { getNetworkMark } from "./acceptanceMarks";

describe("getNetworkMark", () => {
  it("shows nothing until a network is detected", () => {
    expect(getNetworkMark("unknown", "Unknown", { visa: "/visa.svg" })).toBeUndefined();
  });

  it("takes a mark as a URL or as a static import's object", () => {
    expect(getNetworkMark("visa", "Visa", { visa: "/visa.svg" })).toEqual({ src: "/visa.svg", name: "Visa" });
    expect(getNetworkMark("visa", "Visa", { visa: { src: "/_next/visa.svg" } })).toEqual({ src: "/_next/visa.svg", name: "Visa" });
  });

  it("falls back to the name for a network without a mark, or with none supplied at all", () => {
    expect(getNetworkMark("mastercard", "Mastercard", { visa: "/visa.svg" })).toEqual({ src: undefined, name: "Mastercard" });
    expect(getNetworkMark("mastercard", "Mastercard", undefined)).toEqual({ src: undefined, name: "Mastercard" });
    expect(getNetworkMark("visa", "Visa", { visa: "" })).toEqual({ src: undefined, name: "Visa" });
  });
});
