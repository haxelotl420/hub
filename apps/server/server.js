const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');

const target = path.join(__dirname, 'server-original.js');
let source = fs.readFileSync(target, 'utf8');
source = source.replace("const { createWordleCompetitiveRuntime } = require('../../games/wordle-competitivo/server');", "$&\nconst { createSnakeRuntime } = require('../../games/snake/server');");
source = source.replace("const runtimeFactories = { 'forza-4': createForza4Runtime, tris: createTrisRuntime, 'battaglia-navale': createBattleshipRuntime, uno: createUnoRuntime, bingo: createBingoRuntime, 'wordle-coop': createWordleCoopRuntime, 'wordle-competitivo': createWordleCompetitiveRuntime };", "const runtimeFactories = { 'forza-4': createForza4Runtime, tris: createTrisRuntime, 'battaglia-navale': createBattleshipRuntime, uno: createUnoRuntime, bingo: createBingoRuntime, 'wordle-coop': createWordleCoopRuntime, 'wordle-competitivo': createWordleCompetitiveRuntime, snake: createSnakeRuntime };");
source = source.replace("function normalizeGameSettings(gameId, input = {}) {", "function normalizeGameSettings(gameId, input = {}) {\n  if (gameId === 'snake') return { boardSize: Math.max(25, Math.min(60, Number(input.boardSize) || 30)), speedMs: [120, 160, 200, 240].includes(Number(input.speedMs)) ? Number(input.speedMs) : 180, growthEvery: Math.max(3, Math.min(8, Number(input.growthEvery) || 5)) };\n  if (gameId === 'wordle-coop' || gameId === 'wordle-competitivo') { const adaptive = input.guessMode === 'adaptive'; return { wordCount: Math.max(1, Math.min(5, Number(input.wordCount) || 1)), matchMode: input.matchMode === 'time' ? 'time' : 'first', durationSeconds: Math.max(30, Math.min(600, Number(input.durationSeconds) || 120)), guessMode: adaptive ? 'adaptive' : 'fixed', guesses: adaptive ? 5 : Math.max(5, Math.min(10, Number(input.guesses) || 6)) }; }");
const mod = new Module(target, module);
mod.filename = target;
mod.paths = Module._nodeModulePaths(path.dirname(target));
mod._compile(source, target);
