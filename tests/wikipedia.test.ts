import { describe, expect, it } from "vitest";
import { selectArtistPage } from "../lib/wikipedia";

describe("Wikipedia artist biography selection", () => {
  it("prefers the matching musician over an ambiguous name page", () => {
    const result = selectArtistPage("Jaden", [
      {
        title: "Jaden",
        extract: "Jaden is a given name.",
        fullurl: "https://en.wikipedia.org/wiki/Jaden",
        pageprops: { "wikibase-shortdesc": "Given name" },
      },
      {
        title: "Jaden Smith",
        extract: "Jaden Smith is an American rapper, singer, and actor.",
        fullurl: "https://en.wikipedia.org/wiki/Jaden_Smith",
        pageprops: { "wikibase-shortdesc": "American rapper and actor" },
      },
    ]);

    expect(result?.title).toBe("Jaden Smith");
  });

  it("rejects unrelated articles", () => {
    expect(
      selectArtistPage("Jaden", [
        {
          title: "Jaden",
          extract: "Jaden is a given name.",
          fullurl: "https://en.wikipedia.org/wiki/Jaden",
          pageprops: { "wikibase-shortdesc": "Given name" },
        },
      ])
    ).toBeNull();
  });
});
