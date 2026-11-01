import { describe, expect, it } from "vitest";
import { backgroundImageUrls } from "./backdropCopy";

describe("backgroundImageUrls", () => {
  it("finds a URL however it's quoted", () => {
    expect(backgroundImageUrls("url(/a.jpg) center / cover")).toEqual(["/a.jpg"]);
    expect(backgroundImageUrls('url("/a b.jpg")')).toEqual(["/a b.jpg"]);
    expect(backgroundImageUrls("url('/a.jpg'), url(/b.png)")).toEqual(["/a.jpg", "/b.png"]);
  });

  it("finds nothing to wait for in a plain gradient or color", () => {
    expect(backgroundImageUrls("linear-gradient(#000, #fff)")).toEqual([]);
    expect(backgroundImageUrls("#123456")).toEqual([]);
  });
});
