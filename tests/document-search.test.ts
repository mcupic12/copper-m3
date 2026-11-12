import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PAGES, searchDocuments } from "@/lib/copper/document-search";
import { DOCUMENTS } from "@/lib/copper/documents";

const top = (query: string) => {
  const result = searchDocuments(query);
  expect(result.status, query).toBe("found");
  return result.status === "found" ? result.matches : [];
};

describe("searchDocuments", () => {
  it("has every document's PDF and its pages", () => {
    for (const doc of DOCUMENTS) {
      expect(existsSync(`public${doc.file}`), doc.file).toBe(true);
      expect(
        PAGES.some((p) => p.documentId === doc.id),
        doc.id,
      ).toBe(true);
    }
  });

  it("finds the Copper Notes error table for C-31", () => {
    const table = top("What does C-31 mean on Copper Notes?").find(
      (m) => m.page === 8,
    );
    expect(table).toMatchObject({
      documentId: "copper-notes-user-guide",
      url: "/docs/copper-notes-user-guide.pdf#page=8",
    });
    expect(table?.text).toMatch(/C-31\s+Storage full/);
  });

  it("finds the annual Copper Plus refund rule", () => {
    const matches = top("Can I get a refund on an annual Copper Plus plan?");
    const pages = matches.map((m) => `${m.documentId}:${m.page}`);
    expect(pages).toEqual(
      expect.arrayContaining(["copper-terms-and-conditions:4"]),
    );
    expect(matches.some((m) => /within 14 days of purchase/.test(m.text))).toBe(
      true,
    );
  });

  it("finds nothing for a question the documents don't cover", () => {
    expect(searchDocuments("pizza delivery").status).toBe("not_found");
    expect(searchDocuments("the a of").status).toBe("not_found");
  });
});
