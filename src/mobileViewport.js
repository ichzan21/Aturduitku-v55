const KEYBOARD_THRESHOLD = 120;

export const isEditableElement = element => {
  if (!element) return false;
  const tag = String(element.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || element.isContentEditable === true;
};

export const measureMobileViewport = ({
  baselineHeight,
  innerHeight,
  visualHeight,
  offsetTop = 0,
  editable = false,
  wasKeyboardOpen = false,
}) => {
  const currentInnerHeight = Math.max(0, Number(innerHeight) || 0);
  const currentVisualHeight = Math.max(0, Number(visualHeight) || currentInnerHeight);
  const stableHeight = Math.max(
    currentInnerHeight,
    Math.max(0, Number(baselineHeight) || currentInnerHeight),
  );
  const viewportLoss = Math.max(0, stableHeight - currentVisualHeight);
  const keyboardOpen = viewportLoss >= KEYBOARD_THRESHOLD && (editable || wasKeyboardOpen);
  const keyboardBottom = keyboardOpen
    ? Math.max(0, stableHeight - currentVisualHeight - Math.max(0, Number(offsetTop) || 0))
    : 0;

  return {
    appHeight: keyboardOpen ? stableHeight : currentInnerHeight,
    keyboardBottom,
    keyboardOpen,
    visualHeight: currentVisualHeight,
    visualTop: Math.max(0, Number(offsetTop) || 0),
  };
};
