import assert from "node:assert/strict";
import { measureMobileViewport } from "../src/mobileViewport.js";

const normal = measureMobileViewport({
  baselineHeight: 844,
  innerHeight: 844,
  visualHeight: 844,
});
assert.equal(normal.keyboardOpen, false);
assert.equal(normal.appHeight, 844);

const iosKeyboard = measureMobileViewport({
  baselineHeight: 844,
  innerHeight: 844,
  visualHeight: 494,
  editable: true,
});
assert.equal(iosKeyboard.keyboardOpen, true);
assert.equal(iosKeyboard.appHeight, 844);
assert.equal(iosKeyboard.keyboardBottom, 350);

const androidKeyboard = measureMobileViewport({
  baselineHeight: 844,
  innerHeight: 494,
  visualHeight: 494,
  editable: true,
});
assert.equal(androidKeyboard.keyboardOpen, true);
assert.equal(androidKeyboard.appHeight, 844);

const addressBarResize = measureMobileViewport({
  baselineHeight: 844,
  innerHeight: 720,
  visualHeight: 720,
  editable: false,
});
assert.equal(addressBarResize.keyboardOpen, false);
assert.equal(addressBarResize.appHeight, 720);

console.log("Mobile viewport regression tests passed.");
