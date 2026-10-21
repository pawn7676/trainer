/*==================================================================
 * engine.js — STOCKFISH ENGINE ANALYSIS for the trainer page
 *
 * Kept out of the trainer's own script so the trainer stays lighter
 * (trainer.html [#22] describes how the two connect). Load it as a
 * plain <script> before the trainer's own script, like rules.js:
 *
 *   <script src="engine.js"></script>
 *
 * Keep it in the same folder as the trainer page, together with the
 * Stockfish files it runs (names unchanged):
 *   stockfish-19-lite-single.js / stockfish-19-lite-single.wasm
 *     - Lite, about 1 MB (small network only)
 *   stockfish-19-single.js / stockfish-19-single.wasm
 *     - Full, about 94 MB (full-size network: better evals,
 *       slower per move). Optional - only needed with ENGINE_TYPE
 *       set to "full" (THE ENGINE'S SETTINGS, below).
 * Without engine.js the trainer stops with an error, like for any
 * missing file (errors.js [#3]).
 *
 * WHAT IT DOES - browse mode only, behind two buttons under the
 * board: Engine (the chip) and Threat (the crosshair). Only one of
 * them is ever on: turning one on turns the other off, and turning
 * the one that's on off leaves both off:
 *   Engine on ...... Stockfish's best lines (ENGINE_LINES of them)
 *                    under the move list, each with its eval
 *                    from White's point of view (+0.45 White is
 *                    better, -1.20 Black is better, #3 White mates in
 *                    3, #-3 Black mates in 3) - the best line's eval
 *                    in a blue pill (trainer.css [#11]) - and arrows on the board
 *                    for the best move and any other move that's
 *                    nearly as good (Lichess's rules and colors - see
 *                    "Engine arrows" below)
 *   Threat on ...... the same for the position as if the side to move
 *                    had passed - what the opponent is threatening -
 *                    in red, the top threat's eval in a red pill
 *                    (see "Threat mode" below)
 * Every move in the normal lines can be tapped: the board jumps
 * straight to the position after it, and the line up to there goes
 * into the move list (see "Tapping a move in a line" below).
 * When there's nothing to analyse, the lines give way to one row
 * with a message: "Checkmate", "Stalemate", "Draw" (too little
 * material to mate), or - Threat on, Engine off - "No threat while in
 * check". And, in magenta, why Stockfish
 * can't run, when it can't (see WHEN STOCKFISH CAN'T RUN below).
 * It analyses whatever is on the board - book line or analysis line -
 * restarting each time the position changes, and stops by itself at
 * ENGINE_DEPTH (20) to spare the battery. Evals show one decimal
 * place.
 * The engine's settings - which Stockfish, how many lines, the depth,
 * its memory - are in the code, not on the page: THE ENGINE'S
 * SETTINGS, just below this comment.
 *
 * STOCKFISH LOADS ONCE, the first time Engine or Threat is turned on,
 * and then stays loaded until the page closes (like Lichess). Turning
 * both off, turning Practice on, or having no chapter loaded only
 * stops the search and hides the lines and arrows - an idle Stockfish
 * uses no CPU or battery, just memory - so turning either back on is
 * instant. If one is turned back on in the same position after its
 * search had finished, that result shows straight away. Both are
 * always off when the page opens.
 *
 * WHEN STOCKFISH CAN'T RUN - its files aren't in the folder, the Code
 * app's server has stopped and this browser has no saved copy yet
 * (see below), or Stockfish fails or doesn't start - Engine and
 * Threat turn themselves off, and why shows in magenta under the
 * move list, where the lines go. The rest of the trainer
 * carries on, like the opening explorer when Lichess can't answer.
 * It's NOT a page error (errors.js), because the engine is optional.
 * The message stays until Engine or Threat is tapped again, which
 * tries again from scratch (see "When Stockfish can't run" below). A
 * real mistake in this file's own code still stops the page, like any
 * script error (errors.js [#2]).
 *
 * TALKING TO THE TRAINER - everything in here is private except one
 * global, ENGINE, which is all the trainer ever calls:
 *   ENGINE.init() ............ once, from boot: wires the taps on the
 *                              engine lines and brings the saved copy
 *                              of the Stockfish files up to date (see
 *                              below)
 *   ENGINE.positionChanged() . the board position changed - or,
 *                              with a position and the move to it,
 *                              the one a step forward is sliding
 *                              into (see "The position analysed"
 *                              below)
 *   ENGINE.drawArrows() ...... draws the arrows (from the
 *                              board's render loop, board.js [#8])
 *   ENGINE.shutDown() ........ turns Engine and Threat off (Practice
 *                              on / nothing loaded / the page stopped
 *                              by an error)
 *   ENGINE.updateUI() ........ refreshes the Engine and Threat buttons
 *                              and the lines
 *   ENGINE.toggle() .......... Engine on / off
 *   ENGINE.toggleThreat() .... Threat on / off
 *   ENGINE.toggleArrows() .... hides / shows the engine's arrows ("a"
 *                              key; see "Hiding the arrows" below)
 * The trainer wires the Engine and Threat buttons and the "l" and "x"
 * keys itself (trainer.html [#23], [#24]), so that a tap in Practice
 * mode leaves Practice first.
 * In the other direction, it uses these from the trainer (all read
 * when called, never at load, so load order doesn't matter to them):
 *   game.pos, mode, chapters ........ current position / mode / list
 *   game.moves, currentChapter ...... the moves that led to it, from
 *                                     the chapter's start (for
 *                                     repetitions - see "Repetitions")
 *   piecesHidden .................... a blindfold puzzle's hidden
 *                                     pieces (trainer.html [#12]) -
 *                                     the Threat button dims
 *   el, syncNotesHeight
 *   BOARD.render() .................. redraws the board (board.js)
 *   BOARD.drawArrow, hexA, cssColor . the arrows; their colors are
 *                                     asked for by their CSS names
 *                                     (--engine-arrow, -arrow-alt,
 *                                     --engine-threat-arrow,
 *                                     trainer.css [#2]). Needs
 *                                     board.js [#15]
 *   playEngineLine .................. plays a tapped line
 *                                     (trainer.html [#14])
 *   TAP_SLOP ........................ how far a touch can move and
 *                                     still be a tap (trainer.html
 *                                     [#11])
 *   pageWarn ........................ errors.js [#1] (a mistyped
 *                                     ENGINE_TYPE)
 *   RULES ........................... rules.js (positions as FENs -
 *                                     pos.toFen() - and notation)
 * and the page markup: #btnEngine and #btnThreat (under the board)
 * and #engineLines (a box of its own beside the board, under the move
 * list's and over the explorer's). The CSS for
 * them is in trainer.css - the buttons in [#7], the lines in [#11] -
 * with every other style.
 *
 * LOADING THE STOCKFISH FILES
 * The page fetches both files itself and hands the worker
 * in-memory copies (blob: URLs) labelled with the right file types.
 * Stockfish.js only starts if its .wasm arrives labelled
 * "application/wasm", and simple local servers (like the one the Code
 * app runs on localhost) often label it as a generic download, which
 * Safari then refuses to run. The .wasm's location is passed to the
 * worker after the "#" in its URL, which Stockfish.js reads for
 * exactly this purpose.
 *
 * The Code app's localhost server stops answering once the
 * Code app is in the background (e.g. with the page open in full
 * Safari). So a copy of the files is saved in this browser's own
 * storage (IndexedDB, like the trainer's file cache) while the server
 * is still up, and that copy is what Stockfish starts from. Each
 * browser keeps its own copy - the Code app's small window and full
 * Safari don't share storage - so each one needs to have loaded the
 * page once while the server was up.
 *
 * The page itself keeps no copy of the files in memory (with
 * Full that would be 94 MB held for nothing):
 *   - when the page opens, refreshEngineCache asks the server the
 *     size of each of ENGINE_TYPE's two files (without downloading
 *     them) and only downloads a file whose saved copy is missing or
 *     a different size, one file at a time. The other type's files
 *     are never downloaded, and any saved copy of them is deleted.
 *   - when Stockfish starts (loadEngine), the files are read from the
 *     saved copy (or the server, if there's none), handed to the
 *     worker, and let go as soon as Stockfish says it's ready.
 *
 * TALKING TO STOCKFISH - plain UCI text: "position fen ... moves ...", then
 * "go depth N" (or "go infinite" with no depth limit); it answers
 * with "info ... multipv K score cp X pv e2e4 ..." lines and finally
 * "bestmove". Only one search runs at a time: a new position sends
 * "stop" and waits for that bestmove before starting the next search,
 * so results from the old position can never be shown on the new one.
 *
 * Lines arrive from Stockfish one at a time, but the lines and arrows
 * change only once every line for a depth is in (see
 * parseEngineInfo), so they move in calm, whole-depth steps. The
 * search pauses while the page is hidden (see "Page hidden").
 *
 * POSITION MEMORY - every position's result is remembered (see
 * "Position memory" below), so stepping back and forth never searches
 * the same position twice: one already searched to ENGINE_DEPTH
 * shows at once with no search at all, and an unfinished one shows
 * what it had and carries on from there.
 *==================================================================*/
(function () {
"use strict";

// ---- THE ENGINE'S SETTINGS ---------------------------------------
// Set here, in the code - there's no settings menu on the page.
// Change a value, save the file and reload the page.

// Which Stockfish runs, a key of ENGINE_TYPES just below:
//   "lite" - about 1 MB, Stockfish's small neural network only
//   "full" - about 94 MB, with the full-size network too: judges
//            quiet positions better, but is slower per move, so the
//            same depth takes longer. Its two files
//            (stockfish-19-single.js / .wasm) have to be in the
//            trainer's folder.
// Only this type's files are saved in the browser (see LOADING THE
// STOCKFISH FILES at the top).
var ENGINE_TYPE = "lite";
// How many of Stockfish's best lines are searched and listed, 1-5.
// Fewer lines = a slightly faster search. (Which of them get an
// arrow is up to drawEngineArrows - see "Engine arrows".)
var ENGINE_LINES = 5;
// Where the search stops: higher = better analysis, but slower and
// more battery. 0 = no limit: it keeps searching until the position
// changes or the engine is turned off.
var ENGINE_DEPTH = 20;
// Stockfish's working memory (its "hash table"), in MB, for
// remembering positions while it searches - more helps long searches.
// Keep it at 64 or less: iPadOS Safari closes pages that use much
// more, however big the iPad. (Not the same thing as the position
// memory below, which keeps finished results.)
var ENGINE_HASH = 16;

// The two Stockfish types: their label (in messages), their two files,
// and how long each may take to start before giving up (loadMs - Full
// has 94 MB to set up).
var ENGINE_TYPES = {
  lite: { label: "Lite (1MB)", js: "stockfish-19-lite-single.js", wasm: "stockfish-19-lite-single.wasm", loadMs: 20000 },
  full: { label: "Full (94MB)", js: "stockfish-19-single.js",      wasm: "stockfish-19-single.wasm",      loadMs: 60000 }
};

// ---- Engine arrows (copied from Lichess) --------------------------
// Which lines get an arrow, and how thick, follows Lichess's analysis
// board (lila ui/analyse autoShape.ts, ui/lib
// ceval/winningChances.ts):
//   - every eval is turned into "winning chances" (-1..+1), so "how
//     much worse" means the same whether the position is level or +8
//   - the best move always gets the thickest arrow, in pale blue
//   - another line gets a grey arrow only if it's within 20 points of
//     winning chances (0.2) of the best; the closer it is, the
//     thicker (Lichess: 12 down to 2, against 15 for the best);
//     beyond that, no arrow at all - the line is still listed, just
//     not drawn
//   - threat mode: the same rule in red; the top threat is always
//     pale red, like the best move is always pale blue (Lichess draws
//     a lone threat line in solid red - left out on purpose)
// Lichess's colors are used as-is (they live in trainer.css,
// trainer.css [#2]); the arrow shape is the trainer's own.
// How see-through the arrows are: one setting, ENGINE_ARROW_OPACITY,
// for every engine arrow - blue, grey and red alike. Set to 0.35, a
// little bolder than Lichess's 0.24: each arrow at 40%
// (paleBlue/paleGrey/paleRed), inside a whole arrow layer drawn at
// 60% (chessground CSS: .cg-shapes { opacity: 0.6 }) - 0.4 x 0.6.
// Widths are Lichess's, in 1/64ths of a square (best move 15 = about
// 0.23 of a square, 1.7x the trainer's normal 0.14-square arrow -
// ARROW.shaft in board.js [#3]); ARROW_WIDTH_UNIT converts them
// to the trainer's arrow size. The arrow's other sizes (head, gaps)
// come from the trainer's ARROW settings too.
// Lichess: alternatives shown only while shift < 0.2
var ARROW_SHIFT_LIMIT = 0.2;
// every engine arrow: 0 = invisible, 1 = solid (Lichess: 0.24)
var ENGINE_ARROW_OPACITY = 0.35;
var ARROW_BEST = { width: 15 };          // Lichess paleBlue
// Lichess paleGrey, 12 - shift * 50
var ARROW_ALT = { maxWidth: 12 };
var ARROW_THREAT = { width: 15 };        // Lichess paleRed
var ARROW_THREAT_ALT = { maxWidth: 11 }; // Lichess: 11 down to 2
// Lichess width of our normal arrow: ARROW.shaft 0.14 x 64 = ~9
var ARROW_WIDTH_UNIT = 9;

// ---- Hiding the arrows ("a" key) ----------------------------------
// With Engine or Threat on, "a" hides the engine's arrows (threat
// mode's red ones too) and shows them again; the lines stay as they
// are. Kept while the engine is turned off and on again, but not
// saved: arrows are on again when the page opens. Does nothing while
// both are off, where there are no arrows to hide.
var arrowsOn = true;

function toggleArrows() {
  if (!anyOn()) return;
  arrowsOn = !arrowsOn;
  BOARD.render();
}

// Lichess's winning chances, -1 (lost) .. +1 (won), from the point of
// view of the side the eval is for (here always the side to move in
// the searched position). Mates count as a big (but finite) edge, so
// mate in 3 beats mate in 8.
function winningChances(ln) {
  var cp;
  if (ln.mate !== null) {
    cp = (21 - Math.min(10, Math.abs(ln.mate))) * 100 * (ln.mate > 0 ? 1 : -1);
  } else {
    cp = Math.min(Math.max(-1000, ln.cp), 1000);
  }
  return 2 / (1 + Math.exp(-0.00368208 * cp)) - 1;
}

var engineOn = false;     // the Engine button
var threatOn = false;     // the Threat button (see "Threat mode")
// True while either is on - Stockfish has something to do.
function anyOn() { return engineOn || threatOn; }
var engine = newEngineState();

// One of these lasts as long as its Stockfish does - from the first
// time Engine or Threat is turned on until the page closes or
// Stockfish fails. Turning both off keeps it (see stopSearch).
function newEngineState() {
  return {
    type: ENGINE_TYPE, // which Stockfish this is
    worker: null,
    ready: false,      // answered "readyok"
    // a "go" is out and its "bestmove" hasn't come back
    searching: false,
    fen: null,         // position the current/last search is for
    // its "position ..." command for Stockfish - the FEN plus the
    // moves that led there (see "Repetitions"); what tells one search
    // from another
    cmd: null,
    // { fen, cmd } waiting to be searched next
    want: null,
    // [{ depth, cp, mate, pv }] for fen, best first
    lines: [],
    depth: 0,
    done: false,       // search for fen finished (reached max depth)
    // the remembered record for fen (see "Position memory"); its lines
    // ARE engine.lines, so it fills in as the search goes
    mem: null,
    // depth of the remembered result a search started from: results
    // up to it are skipped, so the shown lines never step back
    floor: 0,
    multiPV: 0,        // MultiPV value last sent to the engine
    hash: 16,          // Hash size (MB) Stockfish has now (its default)
    // the depth being collected: its lines, until all have arrived
    // (see parseEngineInfo)
    pending: null,
    // how many lines each depth brings: the most seen this search
    expectPvs: 1,
    loading: false,    // fetching the engine files
    blobUrls: [],      // in-memory copies of the engine files
    // last non-search line from the engine, for error messages
    lastMsg: "",
    viewFen: null,     // position on the board now
    // the message shown instead of the lines, when there's nothing to
    // analyse: "Checkmate", "Stalemate", "Draw", "No threat while in check"
    // (see engineSyncPosition) - or null
    viewMsg: null,
    loadTimer: null
  };
}

// ---- Threat mode -------------------------------------------------
// The Threat button (the crosshair) under the board. With it on, the
// engine analyses the position as if the side to move had passed
// ("what is my opponent threatening?"): same board, other side to
// move. Only that search runs, so the only arrows on the board are
// its red ones and the lines list shows the opponent's threat lines.
// Only one of Threat and Engine is on at a time: turning Threat on
// turns Engine off, and the other way round (setOn).
// A pass isn't allowed while in check (the king would be left in
// check): there the lines say "No threat while in check" and the
// board has no arrows, until the check is gone. The button is dimmed where
// there's no threat to show - but only while it's off, so it can
// always be turned off (updateThreatButton). It stays on while you
// move around; turning Practice on turns it off.

// The board position with the side to move passing, or null if a pass
// isn't possible there (in check, or it would leave no legal moves).
// Cached per position: game.pos is a new object after every move.
var threatCache = { base: null, pos: null };
function threatPosition(pos) {
  if (threatCache.base === pos) return threatCache.pos;
  var t = null;
  if (!pos.inCheck() && pos.legalMoves().length) {
    t = pos.clone();
    t.turn = pos.turn === "w" ? "b" : "w";
    t.ep = -1;                       // no en passant after a pass
    t.half = pos.half + 1;
    if (pos.turn === "b") t.full = pos.full + 1;
    if (!t.legalMoves().length) t = null;
  }
  threatCache = { base: pos, pos: t };
  return t;
}

// ---- The position analysed ---------------------------------------
// Normally the position on the board (game.pos). But while a step
// forward in browse mode is still sliding in, game.pos is the
// position BEFORE that move until the piece lands - so the trainer
// hands over the position after it the moment the step is taken
// (positionChanged(pos), trainer.html goToPly), and the lines and
// arrows switch straight away, like Lichess, rather than when the
// piece arrives. Going back already works that way: the board is at
// the earlier position before its slide starts. Cleared by the next
// plain positionChanged() (the slide landing, or any other move) and
// by shutDown. viewUci (see "Repetitions") is the move it slides.
var viewPos = null;
function boardPos() { return viewPos || game.pos; }

// True while the threat search (not the normal one) is what's
// showing.
function threatActive() {
  var pos = boardPos();
  return threatOn && !!pos && !!threatPosition(pos);
}

// The position the engine should be searching for the board right
// now: the board itself, or its "pass" version in threat mode.
function searchPosition() {
  return threatActive() ? threatPosition(boardPos()) : boardPos();
}

// ---- Repetitions ------------------------------------------------
// Stockfish only knows a position is being repeated (a threefold
// repetition draw - or a move that would repeat) if it's told the
// moves that led there, not just the position. So each search is
// sent as the position after the last capture or pawn move, plus the
// moves played since: nothing before that can ever repeat (a pawn
// can't move back, a capture can't be undone). The moves come from
// the trainer's game.moves (book and analysis line, from the
// chapter's start) - plus, during a step forward still sliding in,
// the move it's sliding (viewUci). Threat mode's "pass" position is
// sent on its own, like Lichess does.
//
// The command is what identifies a search (engine.cmd) and keys the
// position memory, so the same position reached by a different
// route has its own entry - its repetitions can differ.
var viewUci = null;
var jobCache = { pos: null, threat: null, job: null };

// { fen, cmd } for the position the engine should be analysing now.
function currentJob() {
  var pos = boardPos();
  var threat = threatActive();
  if (jobCache.pos === pos && jobCache.threat === threat && jobCache.job) return jobCache.job;
  var fen = (threat ? threatPosition(pos) : pos).toFen();
  var job = { fen: fen, cmd: threat ? "position fen " + fen : historyCommand(pos, fen) };
  jobCache = { pos: pos, threat: threat, job: job };
  return job;
}

// "position fen <after the last capture or pawn move> moves ..." for
// pos, replaying the chapter from its start (its fen, or the normal
// start). Just the FEN if the moves don't lead to pos (can't happen,
// but it costs nothing to check).
function historyCommand(pos, fen) {
  var ch = chapters[currentChapter];
  var ucis = (game.moves || []).slice();
  if (viewPos && viewUci) ucis.push(viewUci);
  var p = new RULES.Position((ch && ch.fen) || undefined);
  var base = p.toFen(), since = [];
  for (var i = 0; i < ucis.length; i++) {
    if (!p.applyUci(ucis[i])) return "position fen " + fen;
    if (p.half === 0) { base = p.toFen(); since = []; }
    else since.push(ucis[i]);
  }
  if (p.toFen() !== fen) return "position fen " + fen;
  return "position fen " + base + (since.length ? " moves " + since.join(" ") : "");
}

// ---- The Engine and Threat buttons --------------------------------
// The Engine button / the "l" key, and the Threat button / "x" (the
// trainer wires them - trainer.html [#23], [#24] - and leaves
// Practice first when they're tapped there). Only one of them is ever
// on: turning one on turns the other off (Engine on with Threat on
// switches straight to the normal analysis, and the other way round);
// turning the one that's on off leaves both off. Turning one on also
// tries Stockfish again from scratch if it couldn't run before (see
// "When Stockfish can't run").
function toggleEngine() { setOn(!engineOn, false); }
function toggleThreat() { setOn(false, !threatOn); }

// eng, thr: whether Engine and Threat should be on now. Either can
// only be turned ON in browse mode with a chapter open.
function setOn(eng, thr) {
  var turningOn = (eng && !engineOn) || (thr && !threatOn);
  if (turningOn && (mode !== "browse" || !chapters.length)) return;
  var wasOn = anyOn();
  engineOn = eng;
  threatOn = thr;
  if (anyOn()) {
    if (turningOn) engineProblem = null; // tries again from scratch
    if (!engine.worker && !engine.loading) loadEngine();
    engineSyncPosition();
  } else {
    stopSearch();
  }
  updateEngineUI();
  if (wasOn || anyOn()) BOARD.render();
}

// ---- Engine files: a saved copy, kept up to date -----------------
// Stockfish always starts from the copy saved in this browser's
// IndexedDB; the server is only asked when that copy might be out of
// date (page load) or there isn't one. See LOADING THE STOCKFISH
// FILES at the top. Each file is saved as { buf, savedAt } under its
// name, and its size under name + "|size", so checking whether the
// saved copy is current doesn't mean reading 94 MB back out.
var ENGINE_CACHE_DB = "trainerEngine";
var ENGINE_CACHE_STORE = "files";

function openEngineCacheDB() {
  return new Promise(function (resolve, reject) {
    if (typeof indexedDB === "undefined") { reject(new Error("no IndexedDB")); return; }
    var req = indexedDB.open(ENGINE_CACHE_DB, 1);
    req.onupgradeneeded = function (e) { e.target.result.createObjectStore(ENGINE_CACHE_STORE); };
    req.onsuccess = function (e) { resolve(e.target.result); };
    req.onerror = function (e) { reject(e.target.error); };
  });
}
function engineCacheRead(key) {
  return openEngineCacheDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var req = db.transaction(ENGINE_CACHE_STORE, "readonly").objectStore(ENGINE_CACHE_STORE).get(key);
      req.onsuccess = function () { resolve(req.result === undefined ? null : req.result); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  });
}
function engineCacheGet(name) {
  return engineCacheRead(name).then(function (rec) { return rec ? rec.buf : null; });
}
// The saved copy's size, or null if there's no saved copy (then the
// file is downloaded and saved, with its size).
function engineCacheSize(name) {
  return engineCacheRead(name + "|size").then(function (n) { return typeof n === "number" ? n : null; });
}
function engineCachePut(name, buf) {
  return openEngineCacheDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(ENGINE_CACHE_STORE, "readwrite");
      var store = tx.objectStore(ENGINE_CACHE_STORE);
      store.put({ buf: buf, savedAt: Date.now() }, name);
      store.put(buf.byteLength, name + "|size");
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function (e) { reject(e.target.error); };
    });
  });
}
// Forgets a file's saved copy (and its size). Nothing happens if
// there isn't one.
function engineCacheDelete(name) {
  return openEngineCacheDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(ENGINE_CACHE_STORE, "readwrite");
      var store = tx.objectStore(ENGINE_CACHE_STORE);
      store.delete(name);
      store.delete(name + "|size");
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function (e) { reject(e.target.error); };
    });
  });
}

// Brings one file's saved copy up to date from the server, if the
// server is answering and has the file. Asks only for the file's size
// first (a HEAD request) and downloads it only if the saved copy is
// missing or a different size. Never fails - if anything goes wrong
// the saved copy just stays as it was.
function refreshEngineFile(name) {
  return fetch(name, { method: "HEAD" }).then(function (r) {
    if (!r.ok) return; // not on the server
    var len = parseInt(r.headers.get("Content-Length"), 10);
    return engineCacheSize(name).catch(function () { return null; }).then(function (saved) {
      // saved copy is current
      if (saved !== null && saved === len) return;
      return fetch(name).then(function (r2) {
        if (!r2.ok) return null;
        return r2.arrayBuffer();
      }).then(function (buf) {
        // (the size check again, for a server that doesn't say the
        // size)
        if (!buf || !buf.byteLength || buf.byteLength === saved) return;
        return engineCachePut(name, buf);
      });
    });
  }).catch(function () { /* server down, or no storage */ });
}

// Run once, from init: ENGINE_TYPE's two files, one at a time, and
// then any saved copy of the other type's files is deleted (left
// from when the engine type could be switched on the page - Full's
// would be 94 MB of storage for nothing).
// engineCacheRefresh[name] settles once that file has been checked,
// so a Stockfish start waits for its own files only.
var engineCacheRefresh = {};
function refreshEngineCache() {
  var t = ENGINE_TYPES[ENGINE_TYPE];
  var chain = Promise.resolve();
  [t.js, t.wasm].forEach(function (name) {
    chain = chain.then(function () { return refreshEngineFile(name); });
    engineCacheRefresh[name] = chain;
  });
  Object.keys(ENGINE_TYPES).forEach(function (type) {
    if (type === ENGINE_TYPE) return;
    [ENGINE_TYPES[type].js, ENGINE_TYPES[type].wasm].forEach(function (name) {
      chain = chain.then(function () {
        return engineCacheDelete(name).catch(function () { /* no storage */ });
      });
    });
  });
}

// One engine file's bytes, for starting Stockfish: the saved copy
// (once the page-load check of it is done), or straight from the
// server if there's no saved copy (saving one on the way).
function readEngineFile(name) {
  return Promise.resolve(engineCacheRefresh[name]).then(function () {
    return engineCacheGet(name).catch(function () { return null; });
  }).then(function (saved) {
    if (saved) return saved;
    var status = 0;
    return fetch(name).then(function (r) {
      status = r.status;
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.arrayBuffer();
    }).then(function (buf) {
      if (!buf.byteLength) throw new Error("empty");
      // No storage - it just won't be saved.
      engineCachePut(name, buf).catch(function () {});
      return buf;
    }).catch(function () {
      throw new Error(status
        ? name + " isn't in the trainer's folder (HTTP " + status + ") - keep it there, name unchanged"
        : "couldn't reach " + name + " - it isn't in the trainer's folder, or the Code app's server has " +
          "stopped (open the trainer from the Code app again)");
    });
  });
}

// Both of an Engine type's files, checked. Not kept anywhere -
// the caller turns them into the worker's in-memory copies and lets
// them go.
function readEngineFiles(type) {
  var t = ENGINE_TYPES[type];
  return readEngineFile(t.js).then(function (js) {
    return readEngineFile(t.wasm).then(function (wasm) {
      if (typeof WebAssembly !== "object") throw new Error("this browser can't run WebAssembly");
      if (!WebAssembly.validate(wasm)) {
        throw new Error("this browser can't run " + t.wasm + " (or the file is damaged - try downloading it again)");
      }
      return { js: js, wasm: wasm };
    });
  });
}

// Loads Stockfish (the type in engine.type) into a new worker.
// Carries on even if Engine and Threat are turned off meanwhile, so
// it's ready for next time.
function loadEngine() {
  // killEngine() swaps in a new state object, which cancels this load
  var st = engine;
  st.loading = true;
  readEngineFiles(st.type).then(function (files) {
    if (engine !== st) return;
    st.loading = false;
    // In-memory copies labelled with the right file types, freed
    // again once Stockfish is ready (see onEngineLine).
    st.blobUrls = [
      URL.createObjectURL(new Blob([files.js], { type: "text/javascript" })),
      URL.createObjectURL(new Blob([files.wasm], { type: "application/wasm" }))
    ];
    files = null; // the page's own copy isn't needed any more
    try {
      st.worker = new Worker(st.blobUrls[0] + "#" + encodeURIComponent(st.blobUrls[1]));
    } catch (err) {
      engineFailed("couldn't start (" + (err && err.message || err) + ")");
      return;
    }
    st.worker.onmessage = function (e) { onEngineLine(String(e.data)); };
    st.worker.onerror = function (e) {
      if (e && e.preventDefault) e.preventDefault();
      if (engine !== st) return;
      engineFailed("stopped with an error" + (e && e.message ? " (" + e.message + ")" : ""));
    };
    st.loadTimer = setTimeout(function () {
      if (engine === st && !st.ready) {
        engineFailed("didn't start" + (st.lastMsg ? " (" + st.lastMsg + ")" : ""));
      }
    }, ENGINE_TYPES[st.type].loadMs);
    st.worker.postMessage("uci");
  }).catch(function (err) {
    if (engine === st) engineFailed(String(err && err.message || err));
  });
}

// Frees the in-memory copies of the engine files (once Stockfish is
// ready, it has its own).
function freeEngineBlobs(st) {
  st.blobUrls.forEach(function (u) { URL.revokeObjectURL(u); });
  st.blobUrls = [];
}

// Stops the search and clears the arrows and lines (neither Engine nor
// Threat is on any more). Stockfish itself stays loaded (or carries
// on loading), idle, so turning either back on is instant. A finished
// search is kept, so turning one back on in the same position shows
// it again at once; an unfinished one is thrown away.
function stopSearch() {
  if (engine.searching) {
    // What it found so far is kept in the position memory; the
    // stopped search's last few results aren't.
    engine.worker.postMessage("stop");
    engine.fen = null;
    engine.cmd = null;
    engine.lines = [];
    engine.mem = null;
  }
  engine.want = null;
  engine.viewFen = null;
  engine.viewMsg = null;
}

// Turns both Engine and Threat off (Practice on, nothing loaded,
// Stockfish failing...).
function stopEngine() {
  var wasOn = anyOn();
  engineOn = false;
  threatOn = false;
  stopSearch();
  updateEngineUI();
  if (wasOn) BOARD.render();
}

// Unloads Stockfish completely (it failed). Engine and Threat stay on
// or off as they were.
function killEngine() {
  clearTimeout(engine.loadTimer);
  if (engine.worker) { try { engine.worker.terminate(); } catch (err) {} }
  freeEngineBlobs(engine);
  engine = newEngineState();
  // A new Stockfish: its evals start afresh.
  evalMemory.clear();
}

// ---- When Stockfish can't run -------------------------------------
// See WHEN STOCKFISH CAN'T RUN at the top. engineProblem is the
// sentence shown in magenta under the move list, where the
// lines go (renderEngineLines), or null. Set by engineFailed; cleared
// by turning Engine or Threat on (setOn), which tries again from
// scratch.
var engineProblem = null;

// Stockfish couldn't start, or stopped with an error: it's unloaded,
// Engine and Threat turn off, and the reason shows where the lines
// go. The rest of the trainer carries on.
function engineFailed(why) {
  var type = engine.type;
  stopEngine();
  killEngine();
  engineProblem = "Stockfish " + ENGINE_TYPES[type].label + " can't run: " + why + "." +
    (type === "full" ? " Or set ENGINE_TYPE to \"lite\" at the top of engine.js." : "");
  updateEngineUI();
  BOARD.render();
}

// ---- Position memory ----------------------------------------------
// Every position the engine has looked at keeps its result here, keyed
// by its search command (see "Repetitions"; threat mode's "pass"
// positions have their own), so going back to one never starts over:
//   - searched to ENGINE_DEPTH (or deeper) already: its lines show at
//     once, and Stockfish isn't asked at all
//   - not that deep yet (left part-way): its lines show at once, and
//     the search carries on. A new search always starts again at
//     depth 1, but Stockfish's own memory of recent positions (its
//     hash table, kept between searches) gets it back up to where it
//     was quickly, and until it passes that depth the remembered lines
//     stay on screen (engine.floor).
// A record is { lines, depth, finishedAt, multiPV }: the lines (as
// engine.lines - the same array, so it fills in as the search runs),
// the depth reached, the depth setting a search of it last ran all
// the way to (0 if none), and how many lines it has. One searched
// with fewer lines than ENGINE_LINES doesn't count. Kept for the last
// EVAL_MEMORY_MAX positions (oldest dropped first - each is a few
// hundred bytes); emptied when Stockfish fails and when the page
// reloads.
var EVAL_MEMORY_MAX = 500;
var evalMemory = new Map();

// The usable record for a search command, or null. Marks it as just
// used.
function recallEval(cmd) {
  var mem = evalMemory.get(cmd);
  if (!mem || mem.multiPV < ENGINE_LINES || !mem.lines.length) return null;
  evalMemory.delete(cmd);
  evalMemory.set(cmd, mem);
  return mem;
}

function storeEval(cmd, mem) {
  evalMemory.delete(cmd);
  evalMemory.set(cmd, mem);
  if (evalMemory.size > EVAL_MEMORY_MAX) evalMemory.delete(evalMemory.keys().next().value);
}

// A record already as deep as ENGINE_DEPTH asks for. (With no limit,
// 0, nothing ever is - the search always carries on.)
function evalDeepEnough(mem) {
  return !!ENGINE_DEPTH && (mem.depth >= ENGINE_DEPTH || mem.finishedAt >= ENGINE_DEPTH);
}

// Called whenever the board position changes (finishGoToPly,
// goToAnalysis) or Engine or Threat is switched (setOn): queues the
// position for analysis - or, when there's nothing to analyse, sets
// the message shown in place of the lines (engine.viewMsg):
//   "Checkmate" / "Stalemate" / "Draw"
//                                    the game is over on the board -
//                                    "Draw": too little material to
//                                    mate (rules.js gameEnd), where
//                                    the board takes no more moves
//                                    either (board.js inputPosition)
//   "No threat while in check" ..... Threat on, Engine off, and the
//                                    side to move is in check, so it
//                                    can't pass ("No threat to show"
//                                    in the rare position where a
//                                    pass would leave the opponent no
//                                    moves)
var GAME_END_MESSAGE = { mate: "Checkmate", stalemate: "Stalemate", draw: "Draw" };
function engineSyncPosition() {
  var pos = boardPos();
  if (!anyOn() || mode !== "browse" || !pos) return;
  var job = currentJob();
  engine.viewFen = job.fen;
  engine.viewMsg = null;
  var end = pos.gameEnd(); // (rules.js: mate, stalemate, too little material)
  if (end) {
    engine.viewMsg = GAME_END_MESSAGE[end];
  } else if (!engineOn && !threatActive()) {
    engine.viewMsg = pos.inCheck() ? "No threat while in check" : "No threat to show";
  }
  if (engine.viewMsg) {
    // Nothing to search - just say so.
    engine.want = null;
    if (engine.searching) engine.worker.postMessage("stop");
    scheduleEngineRender();
    return;
  }
  if (job.cmd === engine.cmd && !engine.want) { scheduleEngineRender(); return; }
  if (engine.want && job.cmd === engine.want.cmd) return;
  engine.want = job;
  if (engine.searching) engine.worker.postMessage("stop");
  else engineKick();
  scheduleEngineRender();
}

// Starts the queued search, if the engine is free.
function engineKick() {
  if (!engine.worker || !engine.ready || engine.searching || !engine.want) return;
  // (not while the page is hidden - see "Page hidden")
  if (document.hidden) return;
  var job = engine.want;
  engine.fen = job.fen;
  engine.cmd = job.cmd;
  engine.want = null;
  engine.pending = null;
  engine.expectPvs = 1;
  var mem = recallEval(job.cmd);
  engine.mem = mem;
  if (mem && evalDeepEnough(mem)) {
    // Searched deep enough before: show it, no search at all.
    engine.lines = mem.lines;
    engine.depth = mem.depth;
    engine.done = true;
    engine.floor = 0;
    scheduleEngineRender();
    return;
  }
  if (mem) {
    // Part-way before: show that, and carry on deeper.
    mem.multiPV = ENGINE_LINES;
    if (mem.lines.length > ENGINE_LINES) mem.lines.length = ENGINE_LINES;
  } else {
    mem = engine.mem = { lines: [], depth: 0, finishedAt: 0, multiPV: ENGINE_LINES };
    storeEval(job.cmd, mem);
  }
  engine.lines = mem.lines;
  engine.depth = mem.depth;
  engine.floor = mem.depth;
  engine.done = false;
  if (engine.multiPV !== ENGINE_LINES) {
    engine.worker.postMessage("setoption name MultiPV value " + ENGINE_LINES);
    engine.multiPV = ENGINE_LINES;
  }
  if (engine.hash !== ENGINE_HASH) {
    engine.worker.postMessage("setoption name Hash value " + ENGINE_HASH);
    engine.hash = ENGINE_HASH;
  }
  engine.worker.postMessage(engine.cmd);
  engine.worker.postMessage(ENGINE_DEPTH ? "go depth " + ENGINE_DEPTH : "go infinite");
  engine.searching = true;
  scheduleEngineRender();
}

function onEngineLine(line) {
  if (!engine.worker) return;
  if (line === "uciok") { engine.worker.postMessage("isready"); return; }
  if (line === "readyok") {
    if (engine.ready) return;
    engine.ready = true;
    clearTimeout(engine.loadTimer);
    freeEngineBlobs(engine); // Stockfish has its own copy now
    engineKick();
    scheduleEngineRender();
    return;
  }
  if (line.indexOf("bestmove") === 0) {
    engine.searching = false;
    engine.pending = null;
    // (stopped because the page was hidden: paused, not finished)
    if (!engine.want && !hiddenStop) {
      engine.done = true;
      // ran all the way to the depth setting (not stopped part-way)
      if (engine.mem && engine.fen) engine.mem.finishedAt = Math.max(engine.mem.finishedAt, ENGINE_DEPTH);
    }
    engineKick();
    scheduleEngineRender();
    return;
  }
  if (line.indexOf("info ") === 0 && line.indexOf(" pv ") > 0) { parseEngineInfo(line); return; }
  // Anything else (a startup error, say) is kept for the error
  // message.
  if (line.indexOf("info ") !== 0 && line.indexOf("id ") !== 0 && line.indexOf("option ") !== 0) {
    engine.lastMsg = line.slice(0, 160);
  }
}

function parseEngineInfo(line) {
  var t = line.split(" ");
  var mpv = 1, depth = 0, cp = null, mate = null, pv = null, bound = false;
  for (var i = 1; i < t.length; i++) {
    switch (t[i]) {
      case "depth": depth = parseInt(t[++i], 10); break;
      case "multipv": mpv = parseInt(t[++i], 10); break;
      case "score":
        var kind = t[++i], val = parseInt(t[++i], 10);
        if (kind === "cp") cp = val;
        else if (kind === "mate") mate = val;
        if (t[i + 1] === "lowerbound" || t[i + 1] === "upperbound") bound = true;
        break;
      case "pv": pv = t.slice(i + 1); i = t.length; break;
    }
  }
  if (!pv || !pv.length || (cp === null && mate === null) || !(mpv >= 1)) return;
  // "mate 0" (already mated) turns up now and then - nothing to show
  if (mate === 0) return;
  // Skip in-between "bound" results for the best line - they flicker
  // and aren't final. The other lines often only ever come with one,
  // so theirs are kept.
  if (bound && mpv === 1) return;
  // (left over from a search the engine was turned off during)
  if (!engine.mem) return;
  // How many lines each depth brings: the most seen so far. (Fewer
  // than ENGINE_LINES when there are fewer legal moves.)
  if (mpv > engine.expectPvs) engine.expectPvs = mpv;
  // Collect one depth's lines - line 1 starts a new depth - and show
  // them only once the last has arrived, all together, so the lines
  // and arrows never mix two depths (which made the grey arrows pop in
  // and out and change thickness).
  var ln = { depth: depth, cp: cp, mate: mate, pv: pv };
  if (mpv === 1) engine.pending = { depth: depth, lines: [ln] };
  else if (engine.pending) engine.pending.lines[mpv - 1] = ln;
  else return;
  if (mpv < engine.expectPvs) return;
  var done = engine.pending;
  engine.pending = null;
  // Still catching up with a remembered result: keep showing that
  // until the new search gets deeper than it.
  if (done.depth <= engine.floor) return;
  // Best first, by winning chances - at the end of a depth Stockfish
  // usually has them in order already, but not always.
  var got = done.lines.filter(Boolean);
  got.sort(function (a, b) { return winningChances(b) - winningChances(a); });
  // engine.lines is the position memory's own array (see engineKick),
  // so it's refilled in place rather than replaced.
  engine.lines.length = 0;
  Array.prototype.push.apply(engine.lines, got);
  engine.depth = done.depth;
  engine.mem.depth = Math.max(engine.mem.depth, done.depth);
  scheduleEngineRender();
}

// Engine output arrives many times a second; redraw at most once per
// frame.
var engineRenderPending = false;
function scheduleEngineRender() {
  if (engineRenderPending) return;
  engineRenderPending = true;
  requestAnimationFrame(function () {
    engineRenderPending = false;
    BOARD.render();
    updateEngineUI();
  });
}

// True when the engine's current results belong to the board position
// (in threat mode: to its "pass" version).
function engineResultsShowing() {
  return anyOn() && mode === "browse" && !!engine.cmd && !!boardPos() &&
    !engine.viewMsg && currentJob().cmd === engine.cmd && engine.lines.length > 0;
}

// Draws the arrows (from the board's render, board.js [#8]) by the
// Lichess rules above. Other lines first, so the best move's arrow ends
// up on top. In threat mode they're the opponent's threats, in red, and
// nothing else.
function drawEngineArrows() {
  if (!arrowsOn || !engineResultsShowing()) return;
  var threat = threatActive();
  var best = engine.lines[0];
  if (!best || !best.pv[0]) return;
  var bestChances = winningChances(best);
  var arrows = [];
  var seen = {};
  seen[best.pv[0].slice(0, 4)] = true;
  for (var k = 1; k < ENGINE_LINES; k++) {
    var ln = engine.lines[k];
    if (!ln || !ln.pv[0]) continue;
    var u = ln.pv[0].slice(0, 4);
    // mid-update, two lines can briefly share a first move
    if (seen[u]) continue;
    seen[u] = true;
    var shift = (bestChances - winningChances(ln)) / 2;
    if (shift < 0 || shift >= ARROW_SHIFT_LIMIT) continue;
    var alt = threat ? ARROW_THREAT_ALT : ARROW_ALT;
    // Lichess: 12 - shift * 50 (threats 11 -> 2 over the same range)
    var width = threat
      ? alt.maxWidth - shift * (alt.maxWidth - 2) / ARROW_SHIFT_LIMIT
      : alt.maxWidth - shift * 50;
    arrows.push({ uci: u, width: Math.round(width),
                  color: threat ? cssColor("--engine-threat-arrow") : cssColor("--engine-arrow-alt") });
  }
  var top = threat ? ARROW_THREAT : ARROW_BEST;
  arrows.push({ uci: best.pv[0].slice(0, 4), width: top.width,
                color: threat ? cssColor("--engine-threat-arrow") : cssColor("--engine-arrow") });
  arrows.forEach(function (a) {
    BOARD.drawArrow({ from: a.uci.slice(0, 2), to: a.uci.slice(2, 4) },
      { color: hexA(a.color, ENGINE_ARROW_OPACITY), scale: a.width / ARROW_WIDTH_UNIT });
  });
}

// An engine score (from the side to move's point of view) as text
// from White's point of view, one decimal place: "+0.3",
// "-1.2", "0.0", "#3", "#-3".
function formatEngineScore(ln, turn) {
  var sign = turn === "b" ? -1 : 1;
  if (ln.mate !== null) {
    var m = ln.mate * sign;
    return m > 0 ? "#" + m : "#-" + (-m);
  }
  var v = Math.round(ln.cp * sign / 10) / 10; // pawns, to one decimal
  if (v === 0) return "0.0";
  return (v > 0 ? "+" : "−") + Math.abs(v).toFixed(1);
}

// The Engine and Threat buttons under the board (lit blue while on,
// like the explorer button - trainer.css [#7]), and the lines.
function updateEngineUI() {
  var btn = el("btnEngine");
  if (!btn) return;
  btn.classList.toggle("active", engineOn);
  btn.title = engineOn ? "Stop Stockfish" : "Start Stockfish";
  updateThreatButton();
  scheduleEngineLines();
}

// The Threat button: lit while on. While it's off it's dimmed where
// there's no threat to show - in check, no chapter loaded, a blindfold
// puzzle's hidden pieces ([#12] in trainer.html) - but never while
// it's on, so it can always be turned off. Also run on every position
// change (ENGINE.positionChanged), engine on or off, so the dimming
// follows the board.
function updateThreatButton() {
  var tb = el("btnThreat");
  if (!tb) return;
  tb.classList.toggle("active", threatOn);
  tb.title = threatOn ? "Hide threat" : "Show threat";
  var pos = boardPos();
  tb.disabled = !threatOn && (!chapters.length || piecesHidden || !pos || !threatPosition(pos));
}

// ---- The engine lines ----------------------------------------------
// Under the move list (and over the explorer), in browse mode (in
// Practice the whole box is hidden). One of three things:
//   - why Stockfish can't run, in magenta, when it can't - even with
//     Engine and Threat off (they turned themselves off), until one of
//     them is tapped again (see "When Stockfish can't run")
//   - a message, when there's nothing to analyse: "Checkmate",
//     "Stalemate", "Draw", "No threat while in check"
//     (engineSyncPosition)
//   - otherwise, with Engine or Threat on, ENGINE_LINES rows: each
//     line's eval, then as many of its moves as fit
// A message is one row, with no empty rows under it, and wraps onto
// more lines if it's long. Nothing at all while both are off.
// Turning each line's moves into chess notation takes a little work,
// and results arrive many times a second, so the list is redrawn at
// most every ENGINE_LINES_MS (straight away when the position, the
// message or on/off changes).
// moves worked out per line (the row just stops at its edge)
var ENGINE_LINE_PLIES = 12;
var ENGINE_LINES_MS = 250;
var engineLinesTimer = null, engineLinesLast = 0, engineLinesKey = "";

function scheduleEngineLines() {
  var key = anyOn() + "|" + mode + "|" + engine.viewMsg + "|" + engineProblem + "|" +
    engine.viewFen + "|" + engineResultsShowing();
  var now = Date.now();
  if (key !== engineLinesKey || now - engineLinesLast >= ENGINE_LINES_MS) {
    clearTimeout(engineLinesTimer);
    engineLinesTimer = null;
    engineLinesKey = key;
    engineLinesLast = now;
    renderEngineLines();
  } else if (!engineLinesTimer) {
    engineLinesTimer = setTimeout(function () {
      engineLinesTimer = null;
      engineLinesLast = Date.now();
      renderEngineLines();
    }, ENGINE_LINES_MS - (now - engineLinesLast));
  }
}

function renderEngineLines() {
  var box = el("engineLines");
  if (!box) return;
  // Not while a move in a line is pressed - it has to stay put
  // until it's let go (endLinePress redraws straight after).
  if (linePress) return;
  var browse = mode === "browse";
  var msg = "", isError = false;
  if (browse && engineProblem) { msg = engineProblem; isError = true; }
  else if (browse && anyOn() && engine.viewMsg) msg = engine.viewMsg;
  var showLines = browse && anyOn() && !msg;
  // what the box holds: "msg" (one message row), "lines" or "none"
  var layout = msg ? "msg" : showLines ? "lines" : "none";
  var oldLayout = box.dataset.layout || "none";
  if (layout !== oldLayout) {
    box.innerHTML = "";
    if (layout === "msg") {
      var msgRow = document.createElement("div");
      msgRow.className = "engine-msg";
      box.appendChild(msgRow);
    } else if (layout === "lines") {
      for (var r = 0; r < ENGINE_LINES; r++) {
        var row = document.createElement("div");
        row.className = "engine-line";
        // (the eval's own inner span is what the best line's pill is
        // drawn on - trainer.css [#11])
        row.innerHTML = '<span class="el-eval"><span class="el-pill"></span></span><span class="el-moves"></span>';
        box.appendChild(row);
      }
    }
    box.dataset.layout = layout;
  }
  box.classList.toggle("hidden", layout === "none");
  // Threat lines start with the opponent moving out of turn, so
  // they can't be played - their moves stay plain text.
  box.classList.toggle("el-static", showLines && threatActive());
  if (layout === "msg") {
    var m = box.firstChild;
    if (m.textContent !== msg) m.textContent = msg;
    m.classList.toggle("el-error", isError);
  } else if (layout === "lines") {
    var have = engineResultsShowing();
    var turn = have ? engine.fen.split(" ")[1] : "w";
    for (var k = 0; k < ENGINE_LINES; k++) {
      var ln = have ? engine.lines[k] : null;
      // (a row still waiting for its line stays empty - while
      // Stockfish loads, the rows are blank for a second or two)
      box.children[k].children[0].firstChild.textContent = ln ? formatEngineScore(ln, turn) : "";
      setLineMoves(box.children[k], ln ? engine.fen : null, ln ? ln.pv : null);
    }
  }
  // The box changed height - let the comment box below re-fit.
  if (layout !== oldLayout) syncNotesHeight();
}

// Fills one row's moves: each move number as plain text, each
// move as its own tappable span. The row remembers the position and
// moves it shows (engineFen, engineUcis), so a tap plays exactly what
// was on screen. Left untouched while its moves haven't changed, so
// the spans aren't rebuilt under the pointer every 250ms.
function setLineMoves(row, fen, pv) {
  var moves = fen ? engineLineMoves(fen, pv) : [];
  var ucis = moves.map(function (mv) { return mv.uci; });
  var key = fen ? fen + "|" + ucis.join(" ") : "";
  if (row.engineKey === key) return;
  row.engineKey = key;
  row.engineFen = fen;
  row.engineUcis = ucis;
  var box = row.children[1];
  box.textContent = "";
  moves.forEach(function (mv, i) {
    if (i) box.appendChild(document.createTextNode(" "));
    if (mv.num) {
      var num = document.createElement("span");
      num.className = "el-num";
      num.textContent = mv.num;
      box.appendChild(num);
      box.appendChild(document.createTextNode(" "));
    }
    var span = document.createElement("span");
    span.className = "el-mv";
    span.textContent = mv.san;
    span.dataset.i = i;
    box.appendChild(span);
  });
}

// A line's moves (UCI from the engine) in notation, numbered from the
// position it starts in: "1. e4 e5 2. Nf3" or "5... Nf6 6. Bg5".
// As a list of { num, san, uci } - num is "1." / "5..." where a
// number goes before the move, "" where it doesn't; uci is the move
// as the trainer writes it. Cached per position, since the same line
// comes back again and again.
var engineLineCache = { fen: null, moves: {} };
function engineLineMoves(fen, pv) {
  if (engineLineCache.fen !== fen) engineLineCache = { fen: fen, moves: {} };
  var key = pv.slice(0, ENGINE_LINE_PLIES).join(" ");
  if (engineLineCache.moves[key] !== undefined) return engineLineCache.moves[key];
  var pos = new RULES.Position(fen), out = [];
  for (var i = 0; i < pv.length && i < ENGINE_LINE_PLIES; i++) {
    var legal = pos.legalMoves();
    var m = pos.findUci(pv[i], legal);
    if (!m) break;
    var num = pos.turn === "w" ? pos.full + "." : (i === 0 ? pos.full + "..." : "");
    out.push({ num: num, san: pos.sanOf(m, legal), uci: pos.uciOf(m) });
    pos.apply(m);
  }
  engineLineCache.moves[key] = out;
  return out;
}

// ---- Tapping a move in a line -------------------------------------
// Tapping (or clicking) a move in one of the engine lines plays the
// line up to and including that move, straight away (no animation).
// The trainer's playEngineLine (trainer.html [#14]) does the playing,
// by the same rules as moving the pieces on the board: moves that match
// the book just step along it, and the rest go on the analysis line in
// the move list. The engine then carries on from the new position.
// Only for the lines of the position on the board (not threat mode's
// "pass" position - see el-static in renderEngineLines).
// While a move is pressed the lines don't redraw, so what's under the
// finger can't change before it's lifted. It acts on pointerup, like
// the trainer's own buttons (trainer.html [#11] bindTap). A touch that
// moves more than TAP_SLOP px (a scroll, a drag - the trainer's one
// setting for it, trainer.html [#11]) does nothing, and so does a
// mouse button let go somewhere other than the move pressed.
// { span, row, x, y, id, mouse } while a move is pressed
var linePress = null;

function wireLineTaps() {
  var box = el("engineLines");
  if (!box) return;
  box.addEventListener("pointerdown", function (e) {
    if (linePress || e.button !== 0 || !e.isPrimary) return;
    if (box.classList.contains("el-static")) return;
    var span = e.target.closest ? e.target.closest(".el-mv") : null;
    if (!span || !box.contains(span)) return;
    linePress = { span: span, row: span.parentNode.parentNode, x: e.clientX, y: e.clientY,
                  id: e.pointerId, mouse: e.pointerType === "mouse" };
    span.classList.add("pressed");
  });
  window.addEventListener("pointermove", function (e) {
    if (!linePress || e.pointerId !== linePress.id || linePress.mouse) return;
    if (Math.abs(e.clientX - linePress.x) > TAP_SLOP ||
        Math.abs(e.clientY - linePress.y) > TAP_SLOP) endLinePress(false);
  });
  window.addEventListener("pointerup", function (e) {
    if (!linePress || e.pointerId !== linePress.id) return;
    // A touch's pointerup always lands on the pressed span (touches
    // stay with where they started), so only a mouse needs this
    // check.
    endLinePress(!linePress.mouse || linePress.span.contains(e.target));
  });
  window.addEventListener("pointercancel", function (e) {
    if (linePress && e.pointerId === linePress.id) endLinePress(false);
  });
}

function endLinePress(play) {
  var p = linePress;
  linePress = null;
  p.span.classList.remove("pressed");
  if (play) playLineTo(p.row, parseInt(p.span.dataset.i, 10));
  renderEngineLines(); // catch up on anything held back while pressed
}

// Plays row's line up to and including its move number i (0 = first).
function playLineTo(row, i) {
  var ucis = row.engineUcis;
  if (!ucis || !(i >= 0) || i >= ucis.length) return;
  // Only if the line is still for the position on the board - not an
  // old one, and not threat mode's "pass" version. (Mid-slide that's
  // the position the step forward is sliding into; playEngineLine
  // lands the slide first.)
  if (mode !== "browse" || !boardPos() || threatActive() || row.engineFen !== boardPos().toFen()) return;
  playEngineLine(ucis.slice(0, i + 1));
}

// ---- Page hidden --------------------------------------------------
// The browser says when the page is hidden - another app or tab in
// front, or the iPad's screen off. A search still running then is
// paused (stopped, with what it found so far kept in the position
// memory), and picks up again from there when the page is back. A
// finished search needs nothing - it's already stopped by itself.
var hiddenStop = false; // a search was stopped because of it
function onVisibilityChange() {
  if (document.hidden) {
    if (engine.searching && !hiddenStop) {
      hiddenStop = true;
      engine.worker.postMessage("stop");
    }
    return;
  }
  var wasPaused = hiddenStop;
  hiddenStop = false;
  if (!anyOn()) return;
  // Carry on with the paused search - unless something else is
  // already queued (the position changed meanwhile).
  if (!engine.want && engine.cmd && !engine.done && (wasPaused || !engine.searching)) {
    engine.want = { fen: engine.fen, cmd: engine.cmd };
  }
  engineKick();
}

// ---- What the trainer calls ---------------------------------------
function init() {
  // A mistyped ENGINE_TYPE is a mistake in this file, so it stops the
  // page like any other (errors.js [#1]).
  if (!ENGINE_TYPES.hasOwnProperty(ENGINE_TYPE)) {
    pageWarn('engine.js: ENGINE_TYPE is "' + ENGINE_TYPE + '" - set it to "lite" or "full" (at the top of engine.js)');
    return;
  }
  // Pausing while the page is hidden.
  document.addEventListener("visibilitychange", onVisibilityChange);
  // Tapping a move in an engine line.
  wireLineTaps();
  updateEngineUI();
  // Bring the saved copy of the Stockfish files up to date right
  // away, while the Code app's server is sure to be answering
  // (without keeping them in memory, and without loading Stockfish -
  // that waits for Engine or Threat to be turned on). Nothing is shown
  // if this fails; turning one on tries again and says what went
  // wrong.
  refreshEngineCache();
}

function shutDown() {
  viewPos = null;
  viewUci = null;
  stopEngine();
}

window.ENGINE = {
  init: init,
  // pos, uci: the position a step forward is sliding into and the
  // move it slides (see "The position analysed"); none = the board's
  // own position, game.pos. The Threat button's dimming follows the
  // board too, engine on or off (updateThreatButton).
  positionChanged: function (pos, uci) {
    viewPos = pos || null;
    viewUci = pos ? uci : null;
    engineSyncPosition();
    updateThreatButton();
  },
  drawArrows: drawEngineArrows,
  shutDown: shutDown,
  updateUI: updateEngineUI,
  toggle: toggleEngine,       // the Engine button, "l" key
  toggleThreat: toggleThreat, // the Threat button, "x" key
  toggleArrows: toggleArrows  // "a" key
};

})();
