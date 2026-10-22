/*==================================================================
 * touch.js — YOUR FINGER ON THE BOARD, for the trainer page
 *
 * Moving pieces by tapping or dragging them (premoves too), the
 * promotion picker, and the grip at the board's corner that resizes
 * it. The board itself is drawn by the shared board.js (in the
 * "shared" folder next to the trainer's), and what's drawn over it
 * by overlay.js.
 *
 * Load it as a plain <script> after board.js and overlay.js, and
 * before the trainer's own script:
 *
 *   <script src="touch.js"></script>
 *
 * Keep it in the same folder as the trainer page - the trainer
 * can't run without it.
 *
 * TALKING TO THE TRAINER - the rest of the page uses this file only
 * through the TOUCH object at its end ([#5]). In the other
 * direction, it reads the trainer's state when it takes input
 * (never at load, so load order doesn't matter to them):
 *   chapters, chapterMoves,
 *   side .................. the open chapter, and the side you play
 *                           in it (trainer.html [#1])
 *   game, currentPly, mode  the position and mode (trainer.html
 *                           [#12])
 *   pendingOpponentUci .... is the opponent's reply pending
 *                           (trainer.html [#16])
 *   isStackedLayout ....... phone layout or not (trainer.html [#20])
 *   el, bindTap ........... small helpers (trainer.html [#11])
 *   TAP_SLOP .............. how far a touch can move and still be a
 *                           tap - any further starts a drag
 *                           (trainer.html [#11])
 *   loadSettings,
 *   saveSetting ........... saved settings (trainer.html [#21])
 * and from overlay.js: a move still sliding in (landingOverlay) and
 * the badges' canvas, kept over the board as it's resized
 * (syncBadgeLayer). It hands every move the player makes to
 * tryPlayMove (trainer.html [#16]).
 * How big the board can get is measured from the page itself: the
 * page grid and the button row under the board and the boxes
 * (.layout, .controls-nav, .controls-tools - trainer.css [#3], [#6];
 * see [#4]).
 *
 * INDEX
 *   [#1] TAP TO MOVE ........ tap a piece, tap a square; premoves;
 *                             the promotion picker
 *   [#2] DRAG TO MOVE ....... when a press becomes a drag
 *                             (TAP_SLOP), drag ghost
 *   [#3] WIRING ............. attaches the handlers above
 *   [#4] RESIZE GRIP ........ drag-the-corner board resize; how big
 *                             and small it can get
 *   [#5] TOUCH .............. this file's one way in
 *==================================================================*/

/*==================================================================
 * [#1] TAP TO MOVE — tap a piece, then tap where it goes.
 * Practice mode: active on the practice player's turn (plus
 * premoves).
 * Browse mode: active for whichever side is to move, so you
 * can play both sides freely - see the analysis line in
 * trainer.html [#14]. A finished move (with the promotion picker
 * first, when it's a promotion) is handed to tryPlayMove
 * (trainer.html [#16]), which decides whether it's right.
 *==================================================================*/
var touchSelSq = -1;


// The cache is tied to the exact position object it was built
// from (game.pos - rebuildPosition makes a brand-new one on every
// move, chapter load, and restart) plus the pending reply, rather
// than just to the ply number. Keyed by ply alone, the post-reply
// position from one chapter was handed back in the NEXT chapter at
// the same ply (e.g. move 1 of puzzle 2 got puzzle 1's position), so
// your own pieces weren't where input expected them and couldn't be
// picked up until the opponent's reply actually landed.
var premovePosCache = { base: null, uci: null, pos: null };
function premovePosition() {
  var uci = pendingOpponentUci();
  if (!uci) return null;
  if (premovePosCache.base === game.pos && premovePosCache.uci === uci && premovePosCache.pos) {
    return premovePosCache.pos;
  }
  var pos = game.pos.clone();
  if (!pos.applyUci(uci)) return null;
  premovePosCache = { base: game.pos, uci: uci, pos: pos };
  return pos;
}

// The position input (taps/drags) should be evaluated against: the
// real position on the player's turn, or the post-opponent-move
// position while a premove can be queued. Null means no input at all.
// In browse mode it's always the position on the board, for
// either side (as long as a chapter is loaded). Either way, the side
// whose pieces can be picked up is this position's side to move.
// No input while a step forward is still sliding in - the position
// under it is the one before that move: in browse, any step; in
// Practice, one of your own moves brought in with > (the opponent's
// reply sliding in still takes a premove, against the position after
// it).
// No input either once the game is over on the board
// (gameOverOnBoard): checkmate and stalemate leave no moves anyway,
// and a draw by too little material ends the game too, though moves
// would still be legal - so the analysis line can't be played on past
// its "D" (and the engine says "Draw" instead of showing lines -
// engine.js). To play something else, step back.
function inputPosition() {
  if (mode === "browse") {
    return (chapters.length && game.pos && !landingOverlay() && !gameOverOnBoard()) ? game.pos : null;
  }
  if (mode !== "practice" || !chapterMoves || currentPly >= chapterMoves.length) return null;
  if (game.pos.turn === side) return landingOverlay() ? null : game.pos;
  return premovePosition();
}

// True once the game is over in the position on the board - rules.js
// gameEnd: mate, stalemate, or a draw by too little material.
// Remembered per position (game.pos is a new object after every
// move), as it's asked on every redraw.
var gameOverCache = { pos: null, over: false };
function gameOverOnBoard() {
  if (gameOverCache.pos !== game.pos) gameOverCache = { pos: game.pos, over: !!game.pos.gameEnd() };
  return gameOverCache.over;
}

function practiceActive() {
  return !!inputPosition();
}

// The tapped piece's square (touchSelSq), or -1 - and none any more
// if it no longer makes sense (the piece isn't one you can move now:
// the turn passed, a new chapter...). The board highlights it
// (overlay.js [#1]).
function selectedSquare() {
  if (touchSelSq < 0) return -1;
  var ip = practiceActive() ? inputPosition() : null;
  var p = ip ? ip.board[touchSelSq] : null;
  var mine = p && (ip.turn === "w") === (p === p.toUpperCase());
  if (!mine) { touchSelSq = -1; return -1; }
  return touchSelSq;
}

// A set of legal moves sharing a from/to only ever has more than one
// entry when it's a pawn promotion (one candidate per piece choice) -
// a single match just proceeds, several means the player needs to
// say which piece they want before the move can go ahead.
function pickMoveFromCandidates(found, onChosen) {
  if (!found.length) return;
  if (found.length === 1) { onChosen(found[0]); return; }
  showPromoPicker(found, onChosen);
}

// The promotion waiting on the picker, or null: { from, to, art }
// - the pawn's 0x88 squares and its art. Nothing has been played
// yet, but while the picker is up the board shows the pawn as moved,
// like Lichess: its own square empty, the pawn on the promotion
// square (under the picker, over whatever it captures), and those
// two squares tinted as the last move instead of the opponent's
// move before it (overlay.js [#1]). The opponent's badge is left off
// meanwhile, as for a parked wrong move (drawBadges, overlay.js
// [#4]). Picking a piece plays the move as normal; cancelling
// (pressing anywhere else - trainer.html [#23]) puts the pawn back at
// once.
var promoPending = null;

// The pending promotion's two squares, [from, to], or null.
function promoPendingSquares() {
  if (!promoPending) return null;
  return [promoPending.from, promoPending.to];
}

function showPromoPicker(candidates, onChosen) {
  var order = ["q", "r", "b", "n"];
  var picker = el("promoPicker");
  picker.innerHTML = "";

  // The pawn, shown as moved while the picker is up (promoPending).
  // Its art comes from the position input is played against (the
  // one after the opponent's reply, for a premove).
  var ip = inputPosition() || game.pos;
  var pawn = ip.board[candidates[0].from];
  promoPending = {
    from: candidates[0].from, to: candidates[0].to,
    art: pawn ? BOARD.pieceArt(pawn) : null
  };
  BOARD.render();

  // Anchor the choices to the promotion square itself, stacked toward
  // the center of the board (queen first, right at the square the
  // pawn landed on) rather than a generic centered popup.
  var toGrid = BOARD.gridOf(candidates[0].to);
  var col = toGrid % 8;
  var stackDown = Math.floor(toGrid / 8) === 0;
  order.map(function (pr) {
    return candidates.filter(function (c) { return c.promotion === pr; })[0];
  }).filter(Boolean).forEach(function (mv, i) {
    var row = stackDown ? i : 7 - i;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "promotion-piece";
    btn.style.left = (col * 12.5) + "%";
    btn.style.top = (row * 12.5) + "%";
    // mover's color (either side in browse mode)
    var art = BOARD.pieceArt(pieceLetter(mv.color, mv.promotion));
    if (art) {
      var cv = document.createElement("canvas");
      cv.width = art.width; cv.height = art.height;
      cv.getContext("2d").drawImage(art, 0, 0);
      btn.appendChild(cv);
    }
    bindTap(btn, function (e) {
      e.stopPropagation();
      hidePromoPicker();
      onChosen(mv);
    });
    picker.appendChild(btn);
  });
  picker.classList.remove("hidden");
}

// Closes the picker. A pending promotion's pawn goes back to its
// own square - drawn at once on a cancel; when a piece was picked,
// the move is played straight after, in the same go, so the pawn
// never shows back home.
function hidePromoPicker() {
  el("promoPicker").classList.add("hidden");
  if (!promoPending) return;
  promoPending = null;
  BOARD.render();
}

function onBoardTap(e) {
  if (!practiceActive()) return;
  var sq = BOARD.squareFromPoint(e.clientX, e.clientY);
  if (sq < 0) return;
  var legal = inputPosition().legalMoves();

  if (selectedSquare() >= 0 && sq !== touchSelSq) {
    var found = legal.filter(function (m) { return m.from === touchSelSq && m.to === sq; });
    if (found.length) {
      touchSelSq = -1;
      BOARD.render();
      pickMoveFromCandidates(found, tryPlayMove);
      return;
    }
  }

  var can = sq !== touchSelSq && legal.some(function (m) { return m.from === sq; });
  touchSelSq = can ? sq : -1;
  BOARD.render();
}

/*==================================================================
 * [#2] DRAG TO MOVE — layered on top of the tap logic above. A
 * pointerdown on a square with a movable piece arms a potential
 * drag; if the pointer moves more than TAP_SLOP (the trainer's one
 * setting for how far a tap can move, trainer.html [#11]) before
 * release, it becomes a drag (piece follows the cursor, dropped on
 * release). If it never does, it's treated as a plain tap and falls
 * through to the onBoardTap/tryPlayMove tap-to-move path, so
 * click-to-move works too.
 *==================================================================*/
var ptr = { id: null, downX: 0, downY: 0, dragging: false,
            canDrag: false, fromSq: -1, fromGrid: -1, art: null };

// The piece being dragged, while a drag is on: { fromGrid, x, y,
// art } - x and y in the board's units. The board leaves its square
// empty (overlay.js [#1]); the piece itself is shown by the drag
// ghost, below. It's kept apart from a move sliding across the board
// (animOverlay, overlay.js [#3]), so the two can be on screen at once
// without getting in each other's way.
var userDragOverlay = null;

// The floating drag-ghost piece (see #dragGhost CSS) - a separate,
// screen-space element that takes over showing the dragged piece
// once a drag actually starts, so it can visually go anywhere on the
// page rather than being confined to the board's canvas.
// dragGhostCtx draws the piece art into it once per drag (not per
// frame); after that, moving it is just a cheap CSS transform update.
// Assigned when the touches are wired ([#3]). It's given as many
// pixels as the piece has (one square's real size - board.js [#2],
// [#4]), so it's as sharp as the pieces on the board.
var dragGhost = null, dragGhostCtx = null;

function showDragGhost(art, clientX, clientY) {
  var size = art ? art.width : dragGhost.width;
  if (dragGhost.width !== size) { dragGhost.width = size; dragGhost.height = size; }
  dragGhostCtx.clearRect(0, 0, size, size);
  if (art) dragGhostCtx.drawImage(art, 0, 0, size, size);
  var rect = BOARD.canvas().getBoundingClientRect();
  var sq = rect.width / 8;
  dragGhost.style.width = sq + "px";
  dragGhost.style.height = sq + "px";
  dragGhost.style.display = "block";
  moveDragGhost(clientX, clientY);
}

function moveDragGhost(clientX, clientY) {
  var sq = dragGhost.offsetWidth;
  dragGhost.style.transform =
    "translate(" + (clientX - sq / 2) + "px, " + (clientY - sq / 2) + "px)";
}

function hideDragGhost() {
  dragGhost.style.display = "none";
}

function pointerToCanvasXY(e) {
  var rect = BOARD.canvas().getBoundingClientRect();
  if (!rect.width || !rect.height) return { x: 0, y: 0 };
  return {
    x: (e.clientX - rect.left) * (BOARD.SIZE / rect.width),
    y: (e.clientY - rect.top) * (BOARD.SIZE / rect.height)
  };
}

function onPointerDown(e) {
  if (!practiceActive()) return;
  var sq = BOARD.squareFromPoint(e.clientX, e.clientY);
  if (sq < 0) return;
  // Pick-up doesn't require the piece to have a legal move -
  // matches Lichess, where you can lift any of your own pieces and
  // wave it around even if it's pinned/boxed in, and dropping it
  // anywhere (including back on its own square) just fails to find a
  // legal target and snaps back, exactly like any other illegal drop.
  var ip = inputPosition();
  var p = ip.board[sq];
  var mine = p && (ip.turn === "w") === (p === p.toUpperCase());
  // Every press on the board is tracked, so that releasing it always
  // reaches the tap-to-move logic in onPointerUp - including a tap on
  // an empty square or an opponent's piece, which is how a selected
  // piece gets moved there. Only a press on one of your own pieces
  // can turn into a drag.
  ptr.id = e.pointerId;
  ptr.downX = e.clientX;
  ptr.downY = e.clientY;
  ptr.dragging = false;
  ptr.fromSq = sq;
  ptr.canDrag = !!mine;
  ptr.fromGrid = BOARD.gridOf(sq);
  ptr.art = mine ? BOARD.pieceArt(p) : null;
  if (BOARD.canvas().setPointerCapture) { try { BOARD.canvas().setPointerCapture(e.pointerId); } catch (err) {} }
}

function onPointerMove(e) {
  if (ptr.id === null || e.pointerId !== ptr.id || !ptr.canDrag) return;
  if (!ptr.dragging) {
    var dx = e.clientX - ptr.downX, dy = e.clientY - ptr.downY;
    if (Math.abs(dx) <= TAP_SLOP && Math.abs(dy) <= TAP_SLOP) return; // still a tap
    ptr.dragging = true;
    touchSelSq = ptr.fromSq;
    BOARD.canvas().classList.add("dragging");
    showDragGhost(ptr.art, e.clientX, e.clientY);
  }
  e.preventDefault();
  // xy (canvas-local, scaled to the internal BOARD.SIZE space) still
  // drives hit-testing/highlighting via userDragOverlay.fromGrid, but
  // doesn't position anything visually - the ghost above uses raw
  // clientX/clientY instead, which is what lets it travel past the
  // board's own edge.
  var xy = pointerToCanvasXY(e);
  userDragOverlay = { fromGrid: ptr.fromGrid, x: xy.x, y: xy.y, art: ptr.art };
  moveDragGhost(e.clientX, e.clientY);
  BOARD.render();
}

function endDrag() {
  ptr.id = null;
  ptr.dragging = false;
  ptr.canDrag = false;
  userDragOverlay = null;
  BOARD.canvas().classList.remove("dragging");
  hideDragGhost();
}

function onPointerUp(e) {
  if (ptr.id === null || e.pointerId !== ptr.id) return;
  var wasDragging = ptr.dragging;
  var fromSq = ptr.fromSq;
  if (BOARD.canvas().releasePointerCapture) { try { BOARD.canvas().releasePointerCapture(e.pointerId); } catch (err) {} }
  endDrag();

  if (!wasDragging) { onBoardTap(e); return; }

  var toSq = BOARD.squareFromPoint(e.clientX, e.clientY);
  // (Input can switch off mid-drag - a browse step starting to slide
  // in - so there may be no position to drop on: it just snaps back.)
  var ip = inputPosition();
  var legal = ip ? ip.legalMoves() : [];
  var found = toSq >= 0 ? legal.filter(function (m) { return m.from === fromSq && m.to === toSq; }) : [];
  touchSelSq = -1;
  if (found.length) {
    BOARD.render();
    pickMoveFromCandidates(found, tryPlayMove);
  } else {
    BOARD.render();
  }
}

function onPointerCancel(e) {
  if (ptr.id === null || e.pointerId !== ptr.id) return;
  endDrag();
  touchSelSq = -1;
  BOARD.render();
}

/*==================================================================
 * [#3] WIRING — attaches the tap and drag handlers above to the
 * board's canvas, once, and finds the drag ghost.
 *==================================================================*/
var touchWired = false;
function initTouch() {
  var cv = BOARD.canvas();
  if (!cv || touchWired) return;
  touchWired = true;
  dragGhost = document.getElementById("dragGhost");
  dragGhostCtx = dragGhost.getContext("2d");
  cv.addEventListener("pointerdown", onPointerDown);
  cv.addEventListener("pointermove", onPointerMove);
  cv.addEventListener("pointerup", onPointerUp);
  cv.addEventListener("pointercancel", onPointerCancel);
  blockTouchGestures(cv);
}

// iPadOS's own long-press gestures - the magnifying loupe, the
// copy / look-up callout, text selection - start from a finger held
// still, and CSS (touch-action, user-select) doesn't reliably stop
// them: holding a piece before dragging it could bring up the loupe.
// Cancelling each touch as it starts (touchstart) keeps them from
// ever starting. The board only listens to pointer events, which
// still all come through; what's lost is the browser's own click
// after a tap, which nothing here uses. (Used on the board and its
// resize handle, [#4].)
function blockTouchGestures(node) {
  node.addEventListener("touchstart", function (e) { e.preventDefault(); }, { passive: false });
}

/*==================================================================
 * [#4] RESIZE GRIP — lets the user drag the board to
 * whatever size they want (like Lichess's own bottom-right grip),
 * by writing directly to the --board-size CSS variable that drives
 * the page grid's first column (trainer.css [#3]) and canvas#mini's
 * max-width. While the grip is dragged, the board's canvas is only
 * stretched with CSS (and the badge layer moved to match #mini's
 * on-screen box); once the size stays put, the board is drawn again
 * at its new real size so it's sharp (board.js [#2]). The size is
 * snapped to a multiple of 8 screen pixels for that (4 CSS pixels on
 * an iPad), so every square is a whole number of pixels.
 *
 * HOW BIG AND HOW SMALL - set by the button row (trainer.css [#6]),
 * not by any setting of its own: no button may get narrower than its
 * icon.
 *   largest ... the tool buttons under the boxes beside the board are
 *               at their icons' width (the boxes' column gets what's
 *               left of the page once the board has its width)
 *   smallest .. the buttons under the board - Settings, mode,
 *               << < > >> - are at their icons' width
 * Everything is measured from the page at the time: an icon's width,
 * a button's border, the gaps, and how many buttons each group has -
 * so nothing here needs changing when the CSS does. In the stacked
 * layout (one column, trainer.css [#15]) the board can grow to the
 * page's full width. There's no vertical cap - if the board ends up
 * taller than the screen the page just scrolls, same as it would for
 * any other tall content.
 *
 * boardSizeDesired holds the user's actual saved preference, kept
 * separate from whatever size is currently applied on screen. Right
 * after a fresh page load (e.g. a pull-to-refresh reload), mobile
 * Safari can briefly report a smaller window.innerHeight/wrap width
 * while its toolbar is still animating away - if we clamped against
 * that transient measurement and then treated the clamped result as
 * the new source of truth, the board would shrink and never recover
 * once the real viewport became available. Keeping "desired" and
 * "applied" separate means a later re-measurement (resize, load,
 * viewport settling) always re-derives from the true preference
 * instead of compounding an earlier bad measurement.
 *==================================================================*/
// The board size is saved with the other settings (trainer.html
// [#21]), as "boardSize".
var boardSizeDesired = null;

// The narrowest a button may get: its icon's width, plus its border
// (measured on the first button of the button row that already has
// its icon in - the gear).
function buttonMinWidth() {
  var icon = document.querySelector(".controls-nav button.ctrl svg, .controls-tools button.ctrl svg");
  if (!icon) return 0;
  var btn = icon.closest("button");
  var cs = getComputedStyle(btn);
  return icon.getBoundingClientRect().width +
    (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
}

// The narrowest a group of buttons can be: all its buttons at their
// narrowest, and the gaps between them.
function groupMinWidth(selector) {
  var group = document.querySelector(selector);
  if (!group) return 0;
  var n = group.children.length;
  var gap = parseFloat(getComputedStyle(group).columnGap) || 0;
  return n * buttonMinWidth() + Math.max(0, n - 1) * gap;
}

// Smallest the board may get: the buttons under it (Settings, mode,
// << < > >>) at their narrowest.
function boardSizeMin() {
  return groupMinWidth(".controls-nav");
}

// Largest the board may get right now: the page grid's width, less
// the gap and the tool buttons beside it at their narrowest - or, in
// the stacked layout, the page grid's whole width.
function boardSizeMax() {
  var layout = document.querySelector(".layout");
  if (!layout) return Infinity;
  var width = layout.getBoundingClientRect().width;
  if (isStackedLayout()) return width;
  var gap = parseFloat(getComputedStyle(layout).columnGap) || 0;
  return width - gap - groupMinWidth(".controls-tools");
}

// Renders a size on screen, kept between the smallest and largest it
// may be right now, and snapped down to a multiple of 8 screen pixels
// (so it never goes past the largest) - every square a whole number
// of them (board.js [#2]). Then the board is drawn again at that
// size, once it stays put. Does not touch the saved preference - safe
// to call as often as needed.
function applyBoardSize(px) {
  var min = boardSizeMin();
  var size = Math.max(min, Math.min(px, boardSizeMax()));
  // 8 screen pixels in CSS pixels: 4 on an iPad
  var step = 8 / (window.devicePixelRatio || 1);
  var snapped = Math.floor(size / step) * step;
  if (snapped < min) snapped += step;
  document.documentElement.style.setProperty("--board-size", snapped + "px");
  syncBadgeLayer();
  BOARD.resized();
  return snapped;
}

// Re-derives the on-screen size from the saved preference using a
// fresh measurement. Call this whenever the viewport may have
// changed (window resize, orientation change, page load settling,
// a pinch-zoom) - it can never compound into a permanent shrink
// since it always starts from boardSizeDesired, not from the
// currently-applied size. A pinch-zoom doesn't change the size, only
// how many screen pixels it covers - so the board's sharpness is
// checked again either way (board.js [#2]).
function reapplyBoardSize() {
  if (boardSizeDesired != null) applyBoardSize(boardSizeDesired);
  BOARD.resized();
}

// Restores a previously-saved board size - or, with none saved yet,
// the starting size from the CSS (--board-size, trainer.css [#1]) -
// and applies it, kept within what fits. Called before the first
// render so there's no flash of the wrong size.
function restoreBoardSize() {
  var saved = parseInt(loadSettings().boardSize, 10);
  boardSizeDesired = saved > 0 ? saved : (parseFloat(BOARD.cssVar("--board-size", "")) || null);
  reapplyBoardSize();
}

function initBoardResize() {
  var handle = document.getElementById("boardResizeHandle");
  var frame = document.getElementById("boardFrame");
  if (!handle || !frame) return;

  var dragging = false, startX = 0, startY = 0, startSize = 0, pointerId = null;

  function onPointerMove(e) {
    if (!dragging) return;
    var dx = e.clientX - startX;
    var dy = e.clientY - startY;
    // Either dragging right or down grows the board; use whichever
    // axis moved the board size the most, so the diagonal grip feels
    // natural to pull from any angle. Track the clamped/applied
    // result as the desired size so it's what gets saved on release.
    boardSizeDesired = applyBoardSize(startSize + Math.max(dx, dy));
  }
  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove("dragging");
    document.body.style.cursor = "";
    if (pointerId != null && handle.releasePointerCapture) {
      try { handle.releasePointerCapture(pointerId); } catch (e2) {}
    }
    if (boardSizeDesired != null) saveSetting("boardSize", boardSizeDesired);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
  }
  handle.addEventListener("pointerdown", function (e) {
    dragging = true;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    startSize = frame.getBoundingClientRect().width;
    handle.classList.add("dragging");
    document.body.style.cursor = "nwse-resize";
    e.preventDefault();
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  });
  // (no loupe while the grip is held - see blockTouchGestures, [#3])
  blockTouchGestures(handle);

  // Re-derive from the saved preference (never from whatever's
  // currently on screen) whenever the viewport changes size - a
  // tablet rotating, crossing the narrow-layout breakpoint, or
  // mobile Safari's toolbar animating in/out. (visualViewport's
  // resize also comes with every pinch-zoom.)
  window.addEventListener("resize", reapplyBoardSize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", reapplyBoardSize);
  }
  window.addEventListener("load", reapplyBoardSize);
  // One more pass shortly after boot to catch any layout settling
  // (webfonts, Safari toolbar) that finishes just after load.
  setTimeout(reapplyBoardSize, 300);
}

/*==================================================================
 * [#5] TOUCH — this file's one way in. The rest of the page uses it
 * only through these. Everything else in this file is its own
 * business.
 *==================================================================*/
var TOUCH = {
  // Once, at start-up, after the saved settings are loaded and
  // before the board is started (OVERLAY.init, overlay.js [#6]): the
  // saved board size, so the first paint is already that size
  // ([#4]).
  restoreSize: function () { restoreBoardSize(); },
  // Once, after the board is started: taps and drags on it ([#3]),
  // and the resize grip ([#4]).
  init: function () {
    initTouch();
    initBoardResize();
  },
  // Forget the tapped (selected) square.
  clearSelection: function () { touchSelSq = -1; },
  // Close the promotion picker, if it's open.
  closePromoPicker: function () { hidePromoPicker(); }
};
