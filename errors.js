/*==================================================================
 * errors.js — ERROR MESSAGES for the trainer page
 *
 * There's no browser console on iPad, so anything that goes wrong
 * with the page itself - a missing file, a script error, a mistyped
 * CSS color - is shown on the page, through pageWarn() ([#1]).
 * (The two optional extras aren't page errors: Lichess not answering
 * the opening explorer, or Stockfish not being able to run - its
 * files missing, say. explorer.js and engine.js each say so on their
 * own line, and the page carries on.)
 *
 * EVERY ERROR STOPS THE PAGE. The messages take the comment box's
 * place (where you're already looking), a cover dims the rest of the
 * page and blocks every tap and key, and the game is halted. There's
 * no way to carry on: fix the cause and reload the page. If the cause
 * is still there, the message comes straight back. The look is in
 * trainer.css [#14].
 * (One browser message isn't an error at all, and is passed over:
 * the ResizeObserver note - see [#2].)
 *
 * Problems inside the two .jsonl files aren't checked here - the
 * build scripts check both files before they're written
 * (jsonl_writer.py [#8]), and the trainer uses the chapters as they
 * come. The one thing filter.js still reports through pageWarn, like
 * every error, is a line it can't read at all (filter.js [#1]).
 *
 * Load it as a plain <script> right after the page markup and
 * BEFORE every other script, so it's already listening when they
 * run and can catch an error in any of them ([#2]):
 *
 *   <script src="errors.js"></script>
 *
 * TALKING TO THE REST OF THE PAGE - three globals:
 *   pageWarn(msg) ......... report an error ([#1]); used by every
 *                           file
 *   pageStopped() ......... true once any error has come in. The
 *                           game's entry points (goToPly,
 *                           loadChapter, ...) check it and do nothing
 *   checkExternalFiles() .. called once from boot (trainer.html
 *                           [#25]); false if the trainer can't run
 *                           ([#3])
 * and it calls one thing back: stopGameplay() (trainer.html [#25]),
 * which halts the game's timers, slides, menus and engine.
 * (A missing engine.js or explorer.js file still stops the page -
 * that's a piece of the trainer itself missing, [#3].)
 *
 * INDEX
 *   [#1] ERROR LIST ........... pageWarn; stopping the page
 *   [#2] SCRIPT ERROR CATCHER . errors nothing else caught
 *   [#3] FILE CHECKS .......... is every file there?
 *==================================================================*/

/*==================================================================
 * [#1] ERROR LIST — pageWarn() shows a message in the comment box
 * (#pageWarnList, inside #commentBox) and stops the page. Each
 * message is shown once, and is also still sent to the console.
 * Stopping the page means:
 *   - the comment box gets .has-errors: the messages replace the
 *     comment (trainer.css [#14])
 *   - the page gets .page-stopped: a cover over everything but the
 *     comment box blocks every tap (trainer.css [#14])
 *   - keys are blocked (below)
 *   - stopGameplay() (trainer.html [#25]) halts timers, slides, menus,
 *     engine
 *   - pageStopped() is true from then on, so nothing in the game
 *     can start up again
 *==================================================================*/
var pageWarnings = []; // every message so far

function pageWarn(msg) {
  try { console.warn("trainer: " + msg); }
  catch (e) { /* no console */ }
  var text = "⚠ " + msg;
  if (pageWarnings.indexOf(text) !== -1) return;
  pageWarnings.push(text);
  renderPageWarnings();
  haltGame();
}

function pageStopped() { return pageWarnings.length > 0; }

// Puts the messages on the page and stops it. The first time, the
// comment box is scrolled into view, in case it's below the bottom
// of the screen (the narrow layout, trainer.css [#17]).
function renderPageWarnings() {
  var box = document.getElementById("commentBox");
  var list = document.getElementById("pageWarnList");
  if (!box || !list) return; // markup not there yet - see the end
  var first = !box.classList.contains("has-errors");
  list.textContent = "";
  pageWarnings.forEach(function (text) {
    var line = document.createElement("div");
    line.textContent = text;
    list.appendChild(line);
  });
  box.classList.add("has-errors");
  document.body.classList.add("page-stopped");
  if (first && box.scrollIntoView) box.scrollIntoView({ block: "nearest" });
}

// Halts whatever the game has running. stopGameplay lives in the
// trainer's own script (trainer.html [#25]), which may not have loaded
// yet when an early error comes in - then it's called again once the
// page has loaded (see the end). An error inside it can't loop back
// here.
var haltingGame = false;
function haltGame() {
  if (haltingGame || typeof stopGameplay !== "function") return;
  haltingGame = true;
  try { stopGameplay(); }
  catch (e) { /* the page is stopped anyway */ }
  haltingGame = false;
}

// Keys: once the page is stopped, no key reaches the page's own
// handlers (the shortcuts in trainer.html [#24], the Chapter
// dropdown...). Only the page's handlers are skipped - the browser's
// own keys, like reload, still work.
function blockKeysWhenStopped(e) {
  if (pageStopped()) e.stopPropagation();
}
window.addEventListener("keydown", blockKeysWhenStopped, true);
window.addEventListener("keyup", blockKeysWhenStopped, true);

// This file loads straight after the markup, so the comment box is
// already there. (If the page ever changes so that an error comes in
// before it, the messages are shown once the page has loaded.)
document.addEventListener("DOMContentLoaded", function () {
  if (!pageStopped()) return;
  renderPageWarnings();
  haltGame();
});

/*==================================================================
 * [#2] SCRIPT ERROR CATCHER — any script error that nothing else
 * handles would otherwise just vanish into the console (and the
 * page would quietly stop working). Show it, and stop the page.
 *
 * Except one message that isn't an error: "ResizeObserver loop
 * completed with undelivered notifications". The column beside the
 * board is fitted to the board by a ResizeObserver (trainer.html
 * [#20], [#25]); when fitting it shows or hides one of the boxes it
 * watches, the browser checks that box again a frame later instead
 * of straight away - and says so with this message. Nothing is lost
 * (the check still happens, and finds the column already fitted), so
 * it's passed over.
 *==================================================================*/
var NOT_AN_ERROR = /ResizeObserver loop/;

window.addEventListener("error", function (e) {
  if (NOT_AN_ERROR.test(e.message || "")) return;
  var where = e.filename ? " (" + e.filename.split("/").pop() + " line " + e.lineno + ")" : "";
  pageWarn("Script error: " + (e.message || "unknown error") + where);
});
window.addEventListener("unhandledrejection", function (e) {
  var r = e.reason;
  pageWarn("Script error: " + ((r && r.message) || String(r)));
});

/*==================================================================
 * [#3] FILE CHECKS — the files this page needs (see EXTERNAL FILES
 * in trainer.html's INDEX), checked at boot (trainer.html [#25]) so a
 * missing one says so on screen. icons.js reports a missing icon name
 * only to the console, so that check is repeated here too. pieces.js is
 * checked where the piece art is baked (board.js [#4]).
 * Returns false if the trainer can't run at all (it's stopped either
 * way, like for every error).
 *==================================================================*/
function checkExternalFiles() {
  // Every color lives in trainer.css [#2]; without it, --bg is
  // unset.
  if (!getComputedStyle(document.documentElement).getPropertyValue("--bg").trim()) {
    pageWarn("trainer.css is missing - the page has no styling (keep it in the same folder as this page)");
  }
  if (typeof RULES === "undefined") {
    pageWarn("rules.js is missing - the trainer can't run without it (keep it in the same folder as this page)");
    return false;
  }
  if (typeof FILTER === "undefined") {
    pageWarn("filter.js is missing - the trainer can't run without it (keep it in the same folder as this page)");
    return false;
  }
  if (typeof BOARD === "undefined") {
    pageWarn("board.js is missing - the trainer can't run without it (keep it in the same folder as this page)");
    return false;
  }
  // .missing = the stand-in in trainer.html [#22]
  if (typeof ENGINE === "undefined" || ENGINE.missing) {
    pageWarn("engine.js is missing - no engine analysis (keep it in the same folder as this page)");
  }
  if (typeof EXPLORER === "undefined" || EXPLORER.missing) {
    pageWarn("explorer.js is missing - no opening explorer (keep it in the same folder as this page)");
  }
  if (typeof ICONS === "undefined") {
    pageWarn("icons.js is missing - the trainer can't run without it (keep it in the same folder as this page)");
    return false;
  } else {
    var els = document.querySelectorAll("[data-icon]");
    for (var i = 0; i < els.length; i++) {
      var name = els[i].getAttribute("data-icon");
      if (!ICONS[name]) pageWarn('icons.js has no icon named "' + name + '"');
    }
  }
  return true;
}
