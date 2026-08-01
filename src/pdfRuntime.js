import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

export const loadPdfRuntime = async () => {
  const runtime = await import("pdfjs-dist/legacy/build/pdf.mjs");
  runtime.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  return runtime;
};
