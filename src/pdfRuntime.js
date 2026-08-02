import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

export const loadPdfRuntime = async () => {
  const runtime = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (typeof runtime?.getDocument !== "function" || !runtime?.GlobalWorkerOptions) {
    throw new Error("PDF_RUNTIME_UNAVAILABLE");
  }
  runtime.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  return runtime;
};
