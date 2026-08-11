export function createPdfFontkitAdapter(baseFontkit, preferredPostscriptName = "NotoSansCJKsc-Regular") {
  return {
    ...baseFontkit,
    create(fontData, postscriptName) {
      const parsed = baseFontkit.create(fontData, postscriptName);
      if (typeof parsed?.layout === "function") return parsed;
      if (typeof parsed?.getFont === "function") {
        try {
          const selected = parsed.getFont(postscriptName || preferredPostscriptName);
          if (typeof selected?.layout === "function") return selected;
        } catch {
          // Fall through to the collection's concrete font list.
        }
      }
      const selected = parsed?.fonts?.find((font) => font?.postscriptName === preferredPostscriptName)
        || parsed?.fonts?.find((font) => typeof font?.layout === "function");
      if (selected) return selected;
      throw new Error("字体集合中没有可用于 PDF 的具体字体。");
    }
  };
}
