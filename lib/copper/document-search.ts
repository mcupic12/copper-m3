// Finds the pages of the customer documents (public/docs/) that best match a
// question, so Ask Copper can answer from them and cite the page. Each page's
// text was pulled out of the PDFs once (scripts/extract-document-pages.py)
// into lib/copper/data/document-pages.json.
import pageData from "@/lib/copper/data/document-pages.json";
import { DOCUMENTS } from "@/lib/copper/documents";

export interface DocumentPage {
  documentId: string;
  page: number;
  text: string;
}

export interface DocumentMatch {
  documentId: string;
  title: string;
  page: number;
  /** Opens the PDF at that page in the browser. */
  url: string;
  text: string;
}

export type DocumentSearchResult =
  | { status: "found"; matches: DocumentMatch[] }
  | { status: "not_found"; message: string };

export const PAGES: DocumentPage[] = pageData.pages;

const MAX_MATCHES = 3;
const MAX_TEXT = 1800;

// Words that say nothing about which page a question is about.
const STOPWORDS = new Set(
  `a an and are as at be but by can could do does did for from get got has have
  how i if in into is it its me my no not of on or our so than that the their
  them then there this to up us was we what when where which who why will with
  would you your yes about any all also been being after before just only
  copper`.split(/\s+/),
);

/** Lowercase words and error codes like "c-31", minus filler words. */
export function terms(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]-\d+|[a-z0-9]+/g) ?? [])
    .filter((word) => word.length > 1 && !STOPWORDS.has(word))
    .map(singular);
}

// "means" and "mean", "refunds" and "refund" should match each other.
const singular = (word: string) =>
  word.length > 3 && word.endsWith("s") && !word.endsWith("ss")
    ? word.slice(0, -1)
    : word;

// A page must cover at least this share of what makes the question specific,
// so "order me a pizza" doesn't match a page that only says "order".
const MIN_COVERAGE = 0.5;

// How rare each term is across all pages: a word on every page (like "app")
// counts for little, an error code on one page counts for a lot.
const pageTerms = PAGES.map((page) => new Set(terms(page.text)));
const pagesWith = new Map<string, number>();
for (const set of pageTerms)
  for (const term of set) pagesWith.set(term, (pagesWith.get(term) ?? 0) + 1);
const weight = (term: string) =>
  Math.log((PAGES.length + 1) / ((pagesWith.get(term) ?? 0) + 0.5));

/** The pages that best match `query`, best first, or "not_found". */
export function searchDocuments(query: string): DocumentSearchResult {
  const wanted = [...new Set(terms(query))];
  const possible = wanted.reduce((sum, term) => sum + weight(term), 0);
  const scored = PAGES.map((page, i) => ({
    page,
    score: wanted.reduce(
      (sum, term) => sum + (pageTerms[i].has(term) ? weight(term) : 0),
      0,
    ),
  }))
    .filter((s) => s.score > 0 && s.score >= possible * MIN_COVERAGE)
    .sort((a, b) => b.score - a.score || a.page.page - b.page.page)
    .slice(0, MAX_MATCHES);

  if (scored.length === 0)
    return {
      status: "not_found",
      message: "Nothing in the Copper support documents matches that question.",
    };

  return {
    status: "found",
    matches: scored.map(({ page }) => {
      const doc = DOCUMENTS.find((d) => d.id === page.documentId)!;
      return {
        documentId: doc.id,
        title: doc.title,
        page: page.page,
        url: `${doc.file}#page=${page.page}`,
        text: page.text.slice(0, MAX_TEXT),
      };
    }),
  };
}
