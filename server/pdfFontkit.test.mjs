import assert from "node:assert/strict";
import test from "node:test";
import { createPdfFontkitAdapter } from "./pdfFontkit.mjs";

test("PDF fontkit adapter selects a concrete font from a TTC collection", () => {
  const concreteFont = { postscriptName: "NotoSansCJKsc-Regular", layout() {} };
  const collection = { fonts: [{ postscriptName: "Other" }, concreteFont] };
  const adapter = createPdfFontkitAdapter({ create: () => collection });

  assert.equal(adapter.create(new Uint8Array([1, 2, 3])), concreteFont);
});

test("PDF fontkit adapter leaves a regular TTF font unchanged", () => {
  const regularFont = { postscriptName: "Regular", layout() {} };
  const adapter = createPdfFontkitAdapter({ create: () => regularFont });

  assert.equal(adapter.create(new Uint8Array([1, 2, 3])), regularFont);
});
