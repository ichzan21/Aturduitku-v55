import assert from "node:assert/strict";
import { classifyRuntimeFailure, getRuntimeErrorMessage, isRecoverableStorageFailure } from "../src/runtimeRecovery.js";

assert.equal(classifyRuntimeFailure(new Error("Failed to connect to MetaMask")).kind, "ignored");
assert.equal(classifyRuntimeFailure(new Error("Connection to Indexed Database server lost. Refresh the page to try again")).kind, "storage_disconnect");
assert.equal(classifyRuntimeFailure(new Error("Database connection is closing")).kind, "storage_disconnect");
assert.equal(classifyRuntimeFailure(new Error("Unexpected application failure")).kind, "incident");
assert.equal(isRecoverableStorageFailure("IndexedDB database connection closed"), true);
assert.equal(getRuntimeErrorMessage({ message:"Pesan aman" }), "Pesan aman");

console.log("Runtime recovery tests passed");
