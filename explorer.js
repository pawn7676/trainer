/*==================================================================
 * explorer.js — LICHESS OPENING EXPLORER and BACKGROUND DATA
 * COLLECTION for the trainer page
 *
 * Kept out of the trainer's own script, like engine.js (trainer.html
 * [#22] describes how the two connect). Load it as a plain <script>
 * after engine.js and before the trainer's own script:
 *
 *   <script src="explorer.js"></script>
 *
 * Without it the trainer stops with an error, like for any missing
 * file (errors.js [#3]).
 *
 * Everything in here that talks to Lichess goes through ONE queue
 * ([#5]), so the two features never ask at the same time, and the
 * background one keeps to Lichess's pace (about one request every 3
 * seconds for your token). The two features are:
 *
 * THE OPENING EXPLORER ([#7]-[#9]) - browse mode only, in an opening
 * chapter only (never Puzzles: the button is dimmed there, so no
 * puzzle position is ever asked for or kept), behind the
 * explorer button under the board (or the "e" key). It shows under
 * the move list. For whatever is on the board (book line or analysis
 * line) it asks Lichess's opening explorer which moves players have
 * played from that position, and shows them as a table, like the
 * "Lichess database" tab on Lichess:
 *   - each move, its share of the games (59%), how many games (4.3B)
 *     and a bar of how those games ended: White wins / draws / Black
 *     wins, with the percentages on it where they fit
 *   - a total row (Σ) at the bottom for the position itself
 * Where the game is over - checkmate, stalemate, or too little
 * material to mate - it says so instead ("Checkmate", "Stalemate",
 * "Draw"), straight away: Lichess counts the moves played FROM a
 * position, so it has no games for one where nobody can move, and
 * isn't asked.
 * Tapping a move plays it, the same way tapping an engine line does
 * (playEngineLine, trainer.html [#14]): the book move just steps
 * along the book, anything else goes on the analysis line.
 * Like the engine, it's always off when the page opens, and turning
 * Practice on turns it off (trainer.html [#15]) - so does opening a
 * puzzle ([#7]) - so the explorer button is lit only while it's
 * really running. The trainer wires
 * the explorer button itself, so that tapping it in Practice mode
 * leaves Practice and turns the explorer on in one go, like the "e"
 * key (trainer.html [#23], [#24]).
 *
 * BACKGROUND DATA COLLECTION ([#10]) - the Lichess data for the
 * lines you study, kept fresh while you study them. When an opening
 * chapter opens (never a puzzle), every position of its line - both
 * sides, up to and including the one after the last move - whose
 * answer is missing, or older than COLLECT_REFRESH_DAYS (a month),
 * is asked for quietly in the background, one every 3 seconds or
 * so, behind anything the explorer is asking. Nothing is shown for
 * it - the board, the comment box and the explorer look just the
 * same - and there's no switch. So a line you study at least once a
 * month never goes stale, and a new line gets its data the first
 * time you open it.
 *
 * THE DATA PAGE - data.html does everything else with the
 * data: loading the files, gathering whole studies (with the lines
 * you don't open in the trainer), showing how old the data is, and
 * saving explorer_data.jsonl. It reads and writes the same answers
 * in the browser ([#4]), so the trainer has everything it gathered,
 * and everything the trainer gets - explorer and background alike -
 * goes into its next save.
 *
 * WHICH GAMES - fixed settings ([#1]): every time control except
 * ultrabullet, and players rated 1000 and up (EXPLORER_SPEEDS,
 * EXPLORER_RATINGS), the same as ticking those boxes on Lichess.
 * Lichess sends at most EXPLORER_MOVES moves (12, as on Lichess); the
 * table scrolls if they don't all fit. (data.html asks for
 * exactly the same games - keep its settings the same.)
 *
 * THE TOKEN - since 2026 Lichess answers explorer requests only with
 * a Lichess API token (a free personal one, no permissions ticked).
 * It's pasted on the data page - data.html's Token button
 * ([#6] there) - and saved in this browser with the trainer's other
 * settings (trainer.html [#21]), so it works wherever the page runs -
 * locally or on a website - and no file holds it. Each browser keeps
 * its own copy, so each one needs it pasted once. This file only
 * reads it ([#6]): when the page opens, and again whenever it comes
 * back into view - so a token pasted on the data page meanwhile is
 * used straight away, without reloading the trainer.
 *
 * TALKING TO LICHESS ([#5]) - one request at a time. The explorer's
 * position goes first, and straight away: it's asked for
 * EXPLORER_DELAY_MS (0.3 s) after the board stops on it, so stepping
 * quickly through a line asks only for where it stops. The positions
 * being collected wait behind it, and each one is only asked for
 * once nothing has gone to Lichess for COLLECT_WAIT_MS (3 s) - so
 * while you step through positions with the explorer on, collecting
 * keeps out of the way, and on its own it never asks faster than
 * Lichess allows. The same position reached by another move order
 * is the same answer - the explorer counts positions, not move
 * orders.
 *
 * KEEPING THE ANSWERS ([#4]) - every answer is kept in this browser
 * (IndexedDB), so a position is only asked for once: going back to
 * it, or opening it again another day, is instant. An answer is good
 * for EXPLORER_KEEP_DAYS (a year): an older one is still shown, but
 * asked for again, and the new answer replaces it.
 *
 * WHEN LICHESS CAN'T ANSWER - no internet, a refused token, Lichess
 * down or busy - the explorer says so on a line above its table
 * (shown only then), and the trainer carries on as normal. These are
 * NOT page errors: they're about Lichess, not the page, so they don't
 * go through pageWarn and don't stop the page. "Too many requests"
 * (HTTP 429) pauses everything for a minute, as Lichess asks. A
 * position that failed is asked for again once you come back to it
 * (the explorer), or the next time its chapter opens (collecting). A
 * real mistake in this file's own code still stops the page, like
 * any script error (errors.js [#2]).
 *
 * TALKING TO THE TRAINER - everything in here is private except one
 * global, EXPLORER, which is all the trainer ever calls ([#11]):
 *   EXPLORER.init() .............. once, from boot: wires the
 *                                  table, and reads the token and
 *                                  the answers saved in the browser
 *   EXPLORER.positionChanged() ... the board position changed - or,
 *                                  with a position, the one a step
 *                                  forward is sliding into (like
 *                                  ENGINE.positionChanged)
 *   EXPLORER.updateUI() .......... redraw (Practice on/off)
 *   EXPLORER.shutDown() .......... turns the explorer off: Practice
 *                                  on, or the page stopped by an
 *                                  error (which stops everything)
 *   EXPLORER.toggle() ............ on / off (the explorer button and
 *                                  the "e" key, trainer.html [#23],
 *                                  [#24])
 *   EXPLORER.chapterOpened(ch) ... a chapter opened: an opening
 *                                  chapter, or null (a puzzle, or
 *                                  nothing) (trainer.html [#4]) -
 *                                  its line is collected ([#10])
 * In the other direction, it uses these from the trainer (all read
 * when called, never at load):
 *   game.pos, mode .................. current position / mode
 *   el, loadSettings ................ trainer.html [#11], [#21]
 *   todayString ..................... today as "YYYY-MM-DD"
 *                                     (trainer.html [#3]): an answer's
 *                                     date
 *   TAP_SLOP ........................ how far a touch can move and
 *                                     still be a tap (trainer.html
 *                                     [#11])
 *   playEngineLine .................. plays a tapped move
 *                                     (trainer.html [#14])
 *   pageStopped ..................... errors.js [#1]
 *   RULES ........................... rules.js (positions, moves)
 * and the page markup: #btnExplorer (shows on / off), #explorerBox,
 * #explorerStatus and #explorerTable. The CSS is in trainer.css: the
 * table in [#12], with the move list it sits under (the explorer
 * button's is [#7]).
 *
 * INDEX
 *   [#1]  SETTINGS ............. which games, the pace
 *   [#2]  STATE ................ everything this file keeps track of
 *   [#3]  THE POSITION ......... fenKey; is the game over
 *   [#4]  SAVED ANSWERS ........ how an answer is kept; the browser's
 *                                copy; a year's freshness
 *   [#5]  THE QUEUE ............ asking Lichess, one request at a time
 *   [#6]  THE TOKEN ............ read from the browser (pasted on
 *                                data.html)
 *   [#7]  THE EXPLORER ......... the button; the open chapter; the
 *                                board's position
 *   [#8]  DRAWING THE TABLE .... the problem line, the table
 *   [#9]  TAPPING A MOVE ....... a move in the table played
 *   [#10] COLLECTING DATA ...... the open chapter's positions, in
 *                                the background
 *   [#11] WHAT THE TRAINER CALLS  the EXPLORER object
 *==================================================================*/
(function () {
"use strict";

/*==================================================================
 * [#1] SETTINGS
 *==================================================================*/
// Which games the explorer counts - Lichess's own names. Time
// controls: ultraBullet, bullet, blitz, rapid, classical,
// correspondence. Ratings: the bands 0, 1000, 1200, 1400, 1600, 1800,
// 2000, 2200, 2500 - each from its number up to the next (2500 = 2500
// and up), so leaving out 0 leaves out everyone under 1000.
// (data.html has its own copy of these three - change both.)
var EXPLORER_SPEEDS = ["bullet", "blitz", "rapid", "classical", "correspondence"];
var EXPLORER_RATINGS = [1000, 1200, 1400, 1600, 1800, 2000, 2200, 2500];
// How many moves Lichess sends per position (most played first).
var EXPLORER_MOVES = 12;
// Wait after the board stops on a new position before the explorer
// asks Lichess about it.
var EXPLORER_DELAY_MS = 300;
// Data collection ([#10]) asks for its next position only once
// nothing has gone to Lichess for this long (ms) - after the last
// request finished. Lichess allows about one request every 3 seconds
// when they come non-stop; any faster gets "too many requests" and a
// minute's pause.
var COLLECT_WAIT_MS = 3000;
// Data collection ([#10]) asks again for an answer older than this
// (days) - so a line you study at least this often stays this fresh.
// Lower asks Lichess more often; it can't be more than
// EXPLORER_KEEP_DAYS (below), which the explorer asks again after
// anyway.
var COLLECT_REFRESH_DAYS = 30;
// How long to wait after Lichess says "too many requests".
var EXPLORER_RATE_LIMIT_MS = 60000;
// The numbers on the results bar, as Lichess writes them: a share
// over EXPLORER_LABEL_MIN (%) shows its number, and only a share over
// EXPLORER_PERCENT_MIN also gets the "%" sign ("14", "63%") - narrower
// parts have no room for it.
var EXPLORER_LABEL_MIN = 12;
var EXPLORER_PERCENT_MIN = 20;
var EXPLORER_URL = "https://explorer.lichess.ovh/lichess";
// How long an answer is good for, in days: an older one is still
// shown, but asked for again the next time it's needed ([#4]).
var EXPLORER_KEEP_DAYS = 365;
// Where the answers are kept in the browser ([#4]): a database of
// their own, beside the trainer's file cache (trainer.html [#8]).
var SAVED_DB = "lichessExplorerDB";
var SAVED_STORE = "answers";

/*==================================================================
 * [#2] STATE
 *==================================================================*/
var explorerOn = false;   // the explorer button (off when the page opens)
var token = null;         // the Lichess token ([#6]), or null
// Every answer so far - from Lichess or the browser:
// position key -> the answer as a short line of text ([#4])
var memory = new Map();
var savedReady = false;   // the browser's answers are read in ([#4])
var savedDB = null;       // the opened database, or null: none kept
// The queue ([#5])
var inFlight = null;      // the position being asked for now
var lastDoneAt = 0;       // when the last request finished
var paceTimer = null;     // COLLECT_WAIT_MS
var pausedUntil = 0;      // "too many requests": not before then
var pauseTimer = null;
// Positions Lichess couldn't answer this time: key -> why
var failures = new Map();
// The explorer ([#7]-[#9])
var openChapter = null;  // the open opening chapter, or null
var viewKey = null;    // the position on the board, or null (off)
var viewPos = null;    // ...and the position itself
var slidePos = null;   // the position a step forward is sliding into
var waitTimer = null;  // EXPLORER_DELAY_MS
var shownKey = null;   // the position the table shows
var shownText = null;  // ...and the answer it was drawn from ([#8])
var rowPress = null;   // { row, x, y, id, mouse } while a move is pressed
// Data collection ([#10]): every position of the open chapter's line
// to collect, both sides, in move order - empty with no opening
// chapter open
var collectKeys = [];

/*==================================================================
 * [#3] THE POSITION
 *==================================================================*/
// The position as the explorer goes by it: the first four fields of
// its FEN (rules.js pos.toFen() - pieces, side to move, castling, en
// passant), without the two move counters, which don't change what
// can be played from it. It's the key every answer is remembered
// under, and the "fen" field in the data file (data.html).
function fenKey(pos) {
  return pos.toFen().split(" ").slice(0, 4).join(" ");
}

// How the game ends at this position, as the table words it -
// "Checkmate", "Stalemate" or "Draw" - or null if play goes on. The
// chess is rules.js's (Position.gameEnd: mate, stalemate, or a draw by
// insufficient material, by the same rule the build uses); this only
// names it. Lichess's explorer counts the moves played FROM a
// position, so a game-over position never has any games: the table
// says this instead ([#8]), and Lichess isn't asked about it ([#5]).
// (Draws by repetition or the 50-move rule depend on the moves
// before, which a position doesn't hold - and games can carry on
// from those - so those are asked about as usual.)
var GAME_END_TEXT = { mate: "Checkmate", stalemate: "Stalemate", draw: "Draw" };
function gameOverText(pos) {
  var end = pos.gameEnd();
  return end ? GAME_END_TEXT[end] : null;
}

/*==================================================================
 * [#4] SAVED ANSWERS — how an answer is kept, the browser's copy of
 * them, and how long one is good for.
 *
 * AN ANSWER is kept as one short line of text - in memory, in the
 * browser and in the data file alike:
 *   {"date":"2026-10-06","w":1520,"d":130,"b":1410,
 *    "moves":[["g8f6","Nf6",812,70,740],["d7d6","d6",...],...]}
 * - the day Lichess was asked, the games' results for the position
 * (White wins, draws, Black wins), and each move as [uci, san, White
 * wins, draws, Black wins], most played first. That's about half the
 * size of named fields, and it's only turned back into an object
 * (answerOf) when it's needed - on the board - so memory stays about
 * the size of the data file, even after a year of answers.
 *
 * THE BROWSER'S COPY (IndexedDB, SAVED_DB): every answer is put there
 * as { text, at }: the answer, and when it came in from Lichess (ms;
 * -1 for one from a data file, which is saved already). Each new one
 * from Lichess goes in straight away, with `at` now, so
 * data.html counts it as "not saved yet" and puts it in its
 * next save. data.html writes there too: everything it
 * gathers, and every answer in a data file it loads. At start-up
 * they're all read into `memory`, and nothing is asked of Lichess
 * until they're in, so nothing already kept is asked for again. If
 * the browser won't keep anything (a private window), answers are
 * only kept for the visit - nothing else changes.
 *
 * A YEAR'S FRESHNESS: an answer older than EXPLORER_KEEP_DAYS ([#1])
 * is still shown, but isFresh says no, so the queue ([#5]) asks for
 * it again, and the new answer replaces it. (Data collection asks
 * again sooner - after COLLECT_REFRESH_DAYS, [#10].)
 *==================================================================*/
// An answer (white, draws, black, moves: [{ uci, san, white, draws,
// black }]) as its line of text, dated `date`. The date always comes
// first, so dateOf can read it without reading the rest.
function packAnswer(a, date) {
  return JSON.stringify({
    date: date, w: a.white, d: a.draws, b: a.black,
    moves: a.moves.map(function (m) { return [m.uci, m.san, m.white, m.draws, m.black]; })
  });
}
// ...and back: { date, white, draws, black, moves: [...] }.
function unpackAnswer(text) {
  var o = JSON.parse(text);
  return {
    date: o.date, white: o.w, draws: o.d, black: o.b,
    moves: o.moves.map(function (m) { return { uci: m[0], san: m[1], white: m[2], draws: m[3], black: m[4] }; })
  };
}
// The answer for a position, as an object, or null if there's none.
function answerOf(key) {
  var text = memory.get(key);
  return text ? unpackAnswer(text) : null;
}
// The date of an answer's text: it starts {"date":"YYYY-MM-DD"
function dateOf(text) { return text.slice(9, 19); }

// True if there's an answer for the position, and it's no older
// than `days` (EXPLORER_KEEP_DAYS if left out).
function isFresh(key, days) {
  var text = memory.get(key);
  if (!text) return false;
  var p = dateOf(text).split("-");
  var asked = new Date(+p[0], +p[1] - 1, +p[2]).getTime();
  return (Date.now() - asked) / 86400000 <= (days || EXPLORER_KEEP_DAYS);
}

// An answer read from the browser, checked and written out again in
// the usual way: `o` is the parsed text ({ date, w, d, b, moves:
// [[...]] }). Its text, or null if it isn't an answer.
function repackAnswer(o) {
  if (!o || typeof o.date !== "string" || !/^\d{4}-\d\d-\d\d$/.test(o.date) ||
      !Array.isArray(o.moves)) return null;
  var moves = [];
  for (var i = 0; i < o.moves.length; i++) {
    var m = o.moves[i];
    if (!Array.isArray(m) || typeof m[0] !== "string" || typeof m[1] !== "string") return null;
    moves.push({ uci: m[0], san: m[1], white: +m[2] || 0, draws: +m[3] || 0, black: +m[4] || 0 });
  }
  return packAnswer({ white: +o.w || 0, draws: +o.d || 0, black: +o.b || 0, moves: moves }, o.date);
}

// Puts one answer in the browser's copy. If it fails (storage full),
// it's still in memory for this visit.
function keepInBrowser(key, text, at) {
  if (!savedDB) return;
  try {
    var tx = savedDB.transaction(SAVED_STORE, "readwrite");
    tx.objectStore(SAVED_STORE).put({ text: text, at: at }, key);
    tx.onerror = function (e) { e.preventDefault(); };
  } catch (e) { /* not kept - fine */ }
}

// The browser's answers are in: Lichess may be asked.
function loadDone() {
  savedReady = true;
  pump();
  render();
}

function loadSavedAnswers() {
  var req;
  try { req = indexedDB.open(SAVED_DB, 1); }
  catch (e) { loadDone(); return; }
  req.onupgradeneeded = function (e) {
    e.target.result.createObjectStore(SAVED_STORE);
  };
  req.onerror = function (e) { e.preventDefault(); loadDone(); };
  req.onsuccess = function (e) {
    savedDB = e.target.result;
    try {
      var store = savedDB.transaction(SAVED_STORE, "readonly").objectStore(SAVED_STORE);
      // (the keys and the answers come back in the same order)
      var keysReq = store.getAllKeys();
      var valuesReq = store.getAll();
      valuesReq.onsuccess = function () {
        var keys = keysReq.result || [], values = valuesReq.result || [];
        for (var i = 0; i < keys.length; i++) {
          var v = values[i];
          var text = v && typeof v.text === "string" ? parseAnswerText(v.text) : null;
          if (text) memory.set(keys[i], text);
        }
        loadDone();
      };
      valuesReq.onerror = function (ev) { ev.preventDefault(); loadDone(); };
    } catch (err) {
      loadDone();
    }
  };
}

// An answer's text, checked (repackAnswer), or null.
function parseAnswerText(text) {
  try { return repackAnswer(JSON.parse(text)); }
  catch (e) { return null; }
}

// A new answer from Lichess: dated today, remembered, and kept in the
// browser - `at` now, so data.html saves it next time.
function remember(key, result) {
  var text = packAnswer(result, todayString());
  memory.set(key, text);
  keepInBrowser(key, text, Date.now());
}

/*==================================================================
 * [#5] THE QUEUE — one request at a time. pump() is called whenever
 * something might be ready to ask (a new position on the board, a
 * chapter opened, an answer in, the pause over...) and asks for the
 * next position, if any:
 *   1. the explorer's position on the board ([#7]) - straight away
 *   2. the open chapter's positions, both sides, in move order
 *      ([#10]) - only once nothing has gone to Lichess for
 *      COLLECT_WAIT_MS, and not while the explorer is about to ask
 *      (its EXPLORER_DELAY_MS)
 * A position already answered (within the year for the explorer,
 * the month for collecting - [#4]), or that failed this time, is
 * skipped - and a game-over one (gameOverText, [#3]) is never asked
 * for.
 *==================================================================*/
// (an answer older than a year is asked for again - isFresh, [#4])
function needsAsking(key) { return !isFresh(key) && !failures.has(key); }

// The explorer's position, if it needs asking for now.
function explorerNext() {
  if (explorerActive() && viewKey && !waitTimer && needsAsking(viewKey) &&
      !gameOverText(viewPos)) return viewKey; // (game over: nothing to ask)
  return null;
}

// The open chapter's next position to ask for, in move order, if any.
function collectNext() {
  for (var i = 0; i < collectKeys.length; i++) {
    var key = collectKeys[i];
    if (!isFresh(key, COLLECT_REFRESH_DAYS) && !failures.has(key)) return key;
  }
  return null;
}

function pump() {
  clearTimeout(paceTimer);
  paceTimer = null;
  if (inFlight || !token || !savedReady || pageStopped()) return;
  if (Date.now() < pausedUntil) return; // pauseTimer pumps again
  var key = explorerNext();
  if (key) { ask(key); return; }
  // (the explorer is about to ask - its waitTimer pumps again)
  if (waitTimer) return;
  key = collectNext();
  if (!key) return;
  var wait = lastDoneAt + COLLECT_WAIT_MS - Date.now();
  if (wait > 0) { paceTimer = setTimeout(pump, wait); return; }
  ask(key);
}

function ask(key) {
  inFlight = key;
  var url = EXPLORER_URL +
    "?variant=standard" +
    // (Lichess wants a whole FEN: the key, plus counters it ignores)
    "&fen=" + encodeURIComponent(key + " 0 1") +
    "&speeds=" + EXPLORER_SPEEDS.join(",") +
    "&ratings=" + EXPLORER_RATINGS.join(",") +
    "&moves=" + EXPLORER_MOVES +
    "&topGames=0&recentGames=0";
  fetch(url, { headers: { "Authorization": "Bearer " + token, "Accept": "application/json" } })
    .then(function (r) {
      if (r.status === 429) throw { rateLimited: true };
      if (r.status === 401 || r.status === 403) {
        throw { msg: "Lichess turned down the token - make a new one (no permissions needed) and paste it with Token on data.html" };
      }
      if (!r.ok) throw { msg: "Lichess couldn't answer (HTTP " + r.status + ") - try again later" };
      return r.json().catch(function () {
        throw { msg: "Lichess sent something that isn't explorer data" };
      });
    })
    .then(function (data) {
      var result = readAnswer(data);
      if (!result) throw { msg: "Lichess sent something that isn't explorer data" };
      remember(key, result);
    })
    .catch(function (err) {
      if (err && err.rateLimited) {
        pausedUntil = Date.now() + EXPLORER_RATE_LIMIT_MS;
        clearTimeout(pauseTimer);
        pauseTimer = setTimeout(function () {
          pausedUntil = 0;
          pump();
          render();
        }, EXPLORER_RATE_LIMIT_MS);
        return;
      }
      // (a fetch that never reached Lichess has no msg)
      failures.set(key, (err && err.msg) || "Couldn't reach Lichess - no internet, or Lichess is down");
    })
    .then(function () {
      inFlight = null;
      lastDoneAt = Date.now();
      pump(); // the board may have moved on meanwhile
      render();
    });
}

// The parts of Lichess's answer that are used, or null if it isn't
// an explorer answer at all.
function readAnswer(data) {
  if (!data || !Array.isArray(data.moves)) return null;
  var moves = [];
  data.moves.forEach(function (m) {
    if (!m || typeof m.uci !== "string" || typeof m.san !== "string") return;
    moves.push({ uci: m.uci, san: m.san, white: m.white || 0, draws: m.draws || 0, black: m.black || 0 });
  });
  return {
    white: data.white || 0, draws: data.draws || 0, black: data.black || 0,
    moves: moves
  };
}

/*==================================================================
 * [#6] THE TOKEN — see THE TOKEN at the top. Read from the
 * trainer's settings ("explorerToken"), where data.html's
 * Token button saves it: once from init, and again each time the
 * page comes back into view (back from the data page, say). A token
 * that changed means everything that's needed is asked for again
 * straight away - also what failed with the old one.
 *==================================================================*/
function readToken() {
  var t = loadSettings().explorerToken || null;
  if (t === token) return;
  token = t;
  failures.clear();
  pump();
  render();
}

function wireTokenReading() {
  readToken();
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) readToken();
  });
}

/*==================================================================
 * [#7] THE EXPLORER — the explorer button, the open chapter, and
 * the position on the board it shows.
 *==================================================================*/
function boardPos() { return slidePos || game.pos; }

// True while the explorer should be showing (and asking) anything:
// only with an opening chapter open - never in a puzzle, so no puzzle
// position is ever asked of Lichess or kept (the trainer dims the
// button there too, trainer.html [#13]).
function explorerActive() {
  return explorerOn && mode === "browse" && !!openChapter && !!boardPos() && !pageStopped();
}

function toggle() {
  explorerOn = !explorerOn;
  syncPosition();
}

// A chapter opened (trainer.html [#4]): an opening chapter, or null
// - a puzzle, or nothing - which turns the explorer off, like turning
// Practice on does. Its line is what's collected now ([#10]); what
// failed in the last chapter is asked for again.
function chapterOpened(ch) {
  openChapter = ch || null;
  if (!openChapter) shutDown();
  failures.clear();
  collectKeys = lineKeys(openChapter);
  pump();
  render();
}

// Called whenever the board position changes: shows what's
// remembered at once, or asks Lichess after EXPLORER_DELAY_MS.
function syncPosition() {
  if (!explorerActive()) {
    viewKey = viewPos = null;
    clearTimeout(waitTimer);
    waitTimer = null;
    render();
    return;
  }
  var pos = boardPos();
  var key = fenKey(pos);
  if (key === viewKey) { render(); return; }
  viewKey = key;
  viewPos = pos.clone();
  // A position that failed is asked for again once you come back.
  failures.delete(key);
  clearTimeout(waitTimer);
  waitTimer = null;
  // (a game-over position is never asked for - the table says how the
  // game ended straight away, [#8])
  if (!isFresh(key) && !gameOverText(viewPos)) {
    waitTimer = setTimeout(function () { waitTimer = null; pump(); }, EXPLORER_DELAY_MS);
  }
  render();
}

/*==================================================================
 * [#8] DRAWING THE TABLE — the explorer button's on/off, the problem
 * line (only when Lichess can't answer) and the table, for the
 * position on the board. While a new position is on its way, the old
 * table stays, dimmed (and can't be tapped), so the box doesn't jump
 * about. A game-over position never waits: its table is just the
 * heading and "Checkmate", "Stalemate" or "Draw" (gameOverText, [#3]).
 * A position with an answer kept shows it straight away, however old
 * it is. If a newer answer for it comes in while it's on the board -
 * data collection's month ([#10]) or the explorer's year ([#4]) -
 * the table is drawn again with the new numbers, where it was
 * scrolled to (shownText: the answer the table was drawn from).
 *==================================================================*/
function render() {
  var btn = el("btnExplorer");
  if (!btn) return;
  btn.classList.toggle("active", explorerOn);
  btn.title = explorerOn ? "Hide the opening explorer" : "Show the opening explorer";
  var box = el("explorerBox");
  var status = el("explorerStatus");
  var table = el("explorerTable");
  if (!explorerActive() || !viewKey) {
    box.classList.add("hidden");
    return;
  }
  box.classList.remove("hidden");
  // Not while a move is pressed - it has to stay put until it's let
  // go (endRowPress draws again straight after).
  if (rowPress) return;
  // A game-over position: how the game ended, straight away - nothing
  // to wait for, since Lichess is never asked about it.
  var over = gameOverText(viewPos);
  if (over) {
    status.classList.add("hidden");
    if (shownKey !== viewKey || table.classList.contains("stale")) fillTable(table, null, over);
    shownKey = viewKey;
    shownText = null;
    table.classList.remove("stale");
    table.classList.remove("hidden");
    return;
  }
  // (an answer older than a year still shows while it's asked for
  // again)
  var data = answerOf(viewKey);
  var problem = "";
  if (data) {
    problem = "";
  } else if (!token) {
    problem = "Explorer needs a Lichess token. Paste one with Token on data.html.";
  } else if (failures.has(viewKey)) {
    problem = failures.get(viewKey);
  } else if (Date.now() < pausedUntil) {
    problem = "Lichess asked for a pause. Trying again in a minute.";
  }
  status.textContent = problem;
  status.classList.toggle("hidden", !problem);

  if (data) {
    var text = memory.get(viewKey);
    if (shownKey !== viewKey || table.classList.contains("stale")) {
      fillTable(table, data);
    } else if (shownText !== text) {
      // a newer answer for the same position: the new numbers, with
      // the table left where it was scrolled to
      var scrolled = table.scrollTop;
      fillTable(table, data);
      table.scrollTop = scrolled;
    }
    shownKey = viewKey;
    shownText = text;
    table.classList.remove("stale");
    table.classList.remove("hidden");
  } else if (shownKey && !problem && table.children.length) {
    // the old position's table, dimmed, until the new one arrives
    table.classList.add("stale");
    table.classList.remove("hidden");
  } else {
    table.classList.add("hidden");
    shownKey = null;
    shownText = null;
  }
}

// 4300000000 -> "4.3B", 260000000 -> "260M", 12345 -> "12k", 830 -> "830"
function formatCount(n) {
  function cut(v, unit) { return (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10) + unit; }
  if (n >= 1e9) return cut(n / 1e9, "B");
  if (n >= 1e6) return cut(n / 1e6, "M");
  if (n >= 1e3) return cut(n / 1e3, "k");
  return String(n);
}

// A share as a whole percentage, rounded, as Lichess shows it (so
// "0%" means under 0.5%).
function formatShare(part, total) {
  if (!total) return "";
  return Math.round(part / total * 100) + "%";
}

// One row: move, share, games, results bar. With no uci it's the
// total row (Σ), which can't be tapped.
function makeRow(label, uci, games, total, w, d, b) {
  var row = document.createElement("div");
  row.className = "ex-row" + (uci ? "" : " ex-sum");
  if (uci) row.dataset.uci = uci;
  var mv = document.createElement("span");
  mv.className = "ex-move";
  mv.textContent = label;
  var share = document.createElement("span");
  share.className = "ex-share";
  share.textContent = uci ? formatShare(games, total) : "100%";
  var count = document.createElement("span");
  count.className = "ex-games";
  count.textContent = formatCount(games);
  row.appendChild(mv);
  row.appendChild(share);
  row.appendChild(count);
  row.appendChild(makeBar(w, d, b));
  return row;
}

// The White / Draw / Black bar, each part as wide as its share.
function makeBar(w, d, b) {
  var bar = document.createElement("span");
  bar.className = "ex-bar";
  var sum = w + d + b;
  [["ex-w", w], ["ex-d", d], ["ex-b", b]].forEach(function (part) {
    if (!sum || !part[1]) return;
    var pct = part[1] / sum * 100;
    var seg = document.createElement("span");
    seg.className = part[0];
    seg.style.width = pct + "%";
    if (pct > EXPLORER_LABEL_MIN) {
      seg.textContent = Math.round(pct) + (pct > EXPLORER_PERCENT_MIN ? "%" : "");
    }
    bar.appendChild(seg);
  });
  return bar;
}

// The table for an answer - or, with `over` ("Checkmate", "Stalemate",
// "Draw"; gameOverText, [#3]) and no answer, the heading and that one
// word in place of the moves.
function fillTable(table, data, over) {
  table.textContent = "";
  var head = document.createElement("div");
  head.className = "ex-row ex-head";
  // "Games" heads both the share and the count (trainer.css [#12])
  ["Move", "Games", "White / Draw / Black"].forEach(function (t) {
    var s = document.createElement("span");
    s.textContent = t;
    head.appendChild(s);
  });
  table.appendChild(head);
  if (over || !data.moves.length) {
    var none = document.createElement("div");
    none.className = "ex-none";
    none.textContent = over || "No games from this position";
    table.appendChild(none);
    return;
  }
  var total = data.white + data.draws + data.black;
  data.moves.forEach(function (m) {
    var games = m.white + m.draws + m.black;
    table.appendChild(makeRow(m.san, m.uci, games, total, m.white, m.draws, m.black));
  });
  table.appendChild(makeRow("Σ", null, total, total, data.white, data.draws, data.black));
  table.scrollTop = 0;
}

/*==================================================================
 * [#9] TAPPING A MOVE — like a move in an engine line (engine.js
 * "Tapping a move in a line"): it acts on pointerup; a touch that
 * moves more than TAP_SLOP (a scroll - trainer.html [#11]) does
 * nothing, and so does a mouse let go somewhere other than the row
 * pressed. Only a fresh table for the position on the board can be
 * tapped (not a dimmed one).
 *==================================================================*/
function wireRowTaps() {
  var table = el("explorerTable");
  table.addEventListener("pointerdown", function (e) {
    if (rowPress || e.button !== 0 || !e.isPrimary) return;
    if (table.classList.contains("stale")) return;
    var row = e.target.closest ? e.target.closest(".ex-row") : null;
    if (!row || !row.dataset.uci || !table.contains(row)) return;
    rowPress = { row: row, x: e.clientX, y: e.clientY, id: e.pointerId, mouse: e.pointerType === "mouse" };
    row.classList.add("pressed");
  });
  window.addEventListener("pointermove", function (e) {
    if (!rowPress || e.pointerId !== rowPress.id || rowPress.mouse) return;
    if (Math.abs(e.clientX - rowPress.x) > TAP_SLOP ||
        Math.abs(e.clientY - rowPress.y) > TAP_SLOP) endRowPress(false);
  });
  window.addEventListener("pointerup", function (e) {
    if (!rowPress || e.pointerId !== rowPress.id) return;
    endRowPress(!rowPress.mouse || rowPress.row.contains(e.target));
  });
  window.addEventListener("pointercancel", function (e) {
    if (rowPress && e.pointerId === rowPress.id) endRowPress(false);
  });
}

function endRowPress(play) {
  var p = rowPress;
  rowPress = null;
  p.row.classList.remove("pressed");
  if (play && explorerActive() && shownKey === viewKey &&
      viewKey === fenKey(boardPos())) {
    playEngineLine([p.row.dataset.uci]);
  }
  render(); // catch up on anything held back while pressed
}

/*==================================================================
 * [#10] COLLECTING DATA — when a chapter opens (chapterOpened, [#7]),
 * every position of its line becomes `collectKeys`, in move order,
 * and the queue ([#5]) asks for the ones with no answer, or one
 * older than COLLECT_REFRESH_DAYS ([#1]). Opening another chapter
 * replaces them (the old chapter's are no longer asked for). A
 * puzzle, or no chapter at all, collects nothing.
 * EVERY position of the line is collected - both sides, from the
 * start to the position after the last move - so repertoire_report.py
 * has the whole line: the opponent's moves for the gap report, your
 * own for the better moves. (Except where the game is over - a line
 * ending in mate: Lichess has no games for that position.)
 * Nothing on the page shows it. data.html shows how old the
 * data is, and saves it.
 *==================================================================*/
// Every position of a chapter's line, both sides, in move order,
// each once - the last one too, unless the game is over there
// (Lichess has no games for it, gameOverText [#3]). [] for none.
function lineKeys(ch) {
  if (!ch) return [];
  var pos = new RULES.Position(ch.fen || undefined);
  var keys = [], seen = {};
  for (var i = 0; i <= ch.moves.length; i++) {
    var key = fenKey(pos);
    if (!seen[key]) {
      seen[key] = true;
      if (!gameOverText(pos)) keys.push(key);
    }
    if (i < ch.moves.length) {
      var m = pos.findUci(ch.moves[i].uci);
      if (!m) break; // (can't happen - the build checked every move)
      pos.apply(m);
    }
  }
  return keys;
}

/*==================================================================
 * [#11] WHAT THE TRAINER CALLS — the EXPLORER object (see TALKING TO
 * THE TRAINER at the top).
 *==================================================================*/
function init() {
  wireRowTaps();
  wireTokenReading();
  // the browser's answers ([#4]) - Lichess waits for them
  loadSavedAnswers();
  render();
}

// Turns the explorer off (Practice on, a puzzle, nothing open). Data
// collection carries on - Practice is when lines are studied. With
// the page stopped by an error, everything stops (pump checks
// pageStopped too).
function shutDown() {
  explorerOn = false;
  clearTimeout(waitTimer);
  waitTimer = null;
  viewKey = viewPos = null;
  if (pageStopped()) {
    clearTimeout(paceTimer);
    clearTimeout(pauseTimer);
  }
  render();
}

window.EXPLORER = {
  init: init,
  // pos: the position a step forward is sliding into; none = the
  // board's own position, game.pos.
  positionChanged: function (pos) {
    slidePos = pos || null;
    syncPosition();
  },
  updateUI: syncPosition,
  shutDown: shutDown,
  toggle: toggle, // "e" key
  chapterOpened: chapterOpened
};

})();
