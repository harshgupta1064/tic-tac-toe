const fs = require("fs");

const outputPath = "build/main.js";
const source = fs.readFileSync(outputPath, "utf8");

const original = /initializer\.registerMatch\(MODULE_NAME, \{[\s\S]*?\}\);/;
const replacement = `initializer.registerMatch(MODULE_NAME, {
    matchInit: matchInit,
    matchJoinAttempt: matchJoinAttempt,
    matchJoin: matchJoin,
    matchLeave: matchLeave,
    matchLoop: matchLoop,
    matchTerminate: matchTerminate,
    matchSignal: matchSignal
  });`;

if (!original.test(source)) {
  throw new Error("Could not find registerMatch block to patch.");
}

const next = source.replace(original, replacement);
fs.writeFileSync(outputPath, next);
