const pageWidthMm = 210;
const pageHeightMm = 297;
const pagePaddingMm = 10;

function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "-").slice(0, 60) || "简历";
}

export async function exportElementToPdf(element: HTMLElement, filename: string) {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf")
  ]);
  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: Math.min(2, window.devicePixelRatio || 1),
    useCORS: true
  });
  const imageData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const contentWidthMm = pageWidthMm - pagePaddingMm * 2;
  const imageHeightMm = (canvas.height * contentWidthMm) / canvas.width;
  const pageContentHeightMm = pageHeightMm - pagePaddingMm * 2;

  let remainingHeightMm = imageHeightMm;
  let imageTopMm = pagePaddingMm;

  pdf.addImage(imageData, "PNG", pagePaddingMm, imageTopMm, contentWidthMm, imageHeightMm);
  remainingHeightMm -= pageContentHeightMm;

  while (remainingHeightMm > 0) {
    pdf.addPage();
    imageTopMm = pagePaddingMm - (imageHeightMm - remainingHeightMm);
    pdf.addImage(imageData, "PNG", pagePaddingMm, imageTopMm, contentWidthMm, imageHeightMm);
    remainingHeightMm -= pageContentHeightMm;
  }

  pdf.save(`${safeFilename(filename)}.pdf`);
}
