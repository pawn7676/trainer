/*==================================================================
 * overlay.js — WHAT'S DRAWN OVER THE BOARD, for the trainer page
 *
 * The chessboard itself - squares, letters and numbers, pieces,
 * the check glow - is drawn by the shared board.js, in the
 * "shared" folder next to the trainer's (one copy for every
 * project). This file tells it what to show on each paint, and
 * draws the trainer's own things over it: the badges (!!, ?, #...),
 * the chapter's arrows and circles, pieces sliding from square to
 * square, and a wrong move parked on its square before it slides
 * home. (Tapping and dragging pieces, the promotion picker and the
 * resize grip are touch.js.)
 *
 * Load it as a plain <script> after board.js and before the
 * trainer's own script:
 *
 *   <script src="overlay.js"></script>
 *
 * Keep it in the same folder as the trainer page - the trainer
 * can't run without it.
 *
 * TALKING TO THE TRAINER - the rest of the page (and engine.js) uses
 * this file only through the OVERLAY object at its end ([#6]), and
 * the board itself through BOARD (board.js [#9]). In the other
 * direction, it reads the trainer's state when it draws (never at
 * load, so load order doesn't matter to them):
 *   chapters, currentChapter,
 *   chapterMoves .......... the open chapter (trainer.html [#1])
 *   listMode .............. puzzle mode or not (trainer.html [#1])
 *   game, currentPly ...... the position (trainer.html [#12])
 *   showAnnotations, showMaterialCount,
 *   showLastMoveHighlight,
 *   showCheckHighlight .... the Show... switches (trainer.html [#21])
 *   annotationColor ....... the !!/?/etc. colors (trainer.html [#17])
 *   onAnalysisLine ........ on the analysis line or not
 *                           (trainer.html [#14])
 *   el .................... a small helper (trainer.html [#11])
 *   pageWarn .............. error messages (errors.js [#1])
 * and from touch.js: the tapped piece (selectedSquare), a promotion
 * waiting on the picker (promoPending) and the piece being dragged
 * (userDragOverlay). It also uses RULES (rules.js) and, while
 * drawing, ENGINE.drawArrows (engine.js).
 * Its colors are in trainer.css [#1], with every other color of the
 * trainer's own; the board's are in board.css, in "shared".
 *
 * INDEX
 *   [#1] WHAT THE BOARD SHOWS .. what to show on each paint, and
 *                                what's drawn over it
 *   [#2] CIRCLES & ARROWS ...... a move's circles and arrows -
 *                                settings, which, drawing
 *   [#3] THE MOVE ON THE BOARD . the last move, the king in check,
 *                                a move sliding in
 *   [#4] BADGES ................ !!/!/!?/?!/?/??/#/S/D/eval badges -
 *                                size, symbols, layer, drawing
 *   [#5] SLIDES & WRONG MOVES .. slide speed, wrong-move park
 *   [#6] OVERLAY ............... this file's one way in
 *==================================================================*/

/*==================================================================
 * [#1] WHAT THE BOARD SHOWS — the shared board (board.js) draws the
 * squares, the letters and numbers, and the pieces. This part tells
 * it what to show on each paint (describeBoard), and draws the
 * trainer's own things over it (drawOverBoard), in this order:
 *   - a promotion's pawn waiting on the picker (touch.js [#1])
 *   - the chapter's circles and arrows ([#2])
 *   - Stockfish's arrows (engine.js)
 *   - the piece(s) of a move sliding in, and a wrong move's piece
 *     ([#5])
 *   - the badges, on a canvas of their own above the board ([#4])
 * The piece you're dragging isn't drawn here - the drag ghost shows
 * it (touch.js [#2]) - only its square is left empty.
 * The board is started once, from boot (OVERLAY.init, [#6]); after
 * that, BOARD.render() paints it again, from anywhere.
 *==================================================================*/
// The board canvas's drawing context, for drawing over the board,
// in the board's own units (board.js [#1]).
var boardCtx = null;

// The two squares tinted as the last move on this paint, or null -
// kept for the badges, which go on that same move.
var paintTint = null;

// What the board shows (board.js, TALKING TO A PROJECT):
//   lastMove .... a promotion waiting on the picker tints its own
//                 two squares, as if already played (promoPending,
//                 touch.js [#1]); a move sliding in tints its
//                 squares from its first frame (animOverlayTintSqs,
//                 below), rather than once it lands; otherwise the
//                 last move played (lastMoveSquares, [#3])
//   selected .... the tapped piece (touch.js [#1])
//   check ....... the king in check, as the move on the board
//                 stands (checkSquare, [#3])
//   tints ....... a wrong move (red) or ALT: move (blue): the
//                 square the piece was dropped on - opaque while
//                 it's parked, then gone as it slides home ([#5])
//   hidden ...... the squares a sliding or parked piece has left,
//                 or covers (overlayHidesGrid, below)
// and the Show... switches (trainer.html [#21]).
function describeBoard() {
  paintTint = promoPendingSquares() ||
    (landingOverlay() ? animOverlayTintSqs() : lastMoveSquares());
  var tints = [];
  if (wrongMoveOverlay && wrongMoveOverlay.tintAlpha > 0) {
    var wc = BOARD.cssColor(wrongMoveOverlay.isAlt ? "--board-alt-move" : "--board-wrong-move");
    tints.push({ sq: BOARD.squareAt(wrongMoveOverlay.toGrid),
                 color: BOARD.hexA(wc, wrongMoveOverlay.tintAlpha) });
  }
  return {
    pos: game.pos,
    lastMove: paintTint,
    selected: selectedSquare(),
    check: checkSquare(),
    tints: tints,
    hidden: function (sq) { return overlayHidesGrid(BOARD.gridOf(sq)); },
    showLastMove: showLastMoveHighlight,
    showCheck: showCheckHighlight,
    showMaterial: showMaterialCount
  };
}

// Everything the trainer draws over the board, at the end of every
// paint (see the order at the top). ctx: the board canvas's drawing
// context, already in the board's units.
function drawOverBoard(ctx) {
  boardCtx = ctx;
  // A promotion waiting on the picker: the pawn on the promotion
  // square, under the picker (promoPending, touch.js [#1]).
  var promo = promoPendingSquares();
  if (promo && promoPending.art) {
    var pg = BOARD.gridOf(promo[1]);
    boardCtx.drawImage(promoPending.art, (pg % 8) * BOARD.CELL, Math.floor(pg / 8) * BOARD.CELL,
      BOARD.CELL, BOARD.CELL);
  }

  // The move's circles and arrows - see [#2]. On top of the board and
  // pieces, underneath whatever's actively animating or being
  // dragged right now. They're animation-aware, so they paint in
  // sync with the animation's start rather than lagging behind it.
  drawBoardShapes();
  // Stockfish's best-move arrows, on top of the chapter's own
  // drawings (browse mode with the engine on only - see
  // trainer.html [#22]).
  ENGINE.drawArrows();

  // The sliding piece(s). Normally one piece (animOverlay.pieces has
  // one entry); on a castling move it has two (king + rook), sliding
  // in lockstep.
  if (animOverlay && animOverlay.pieces) {
    for (var ai = 0; ai < animOverlay.pieces.length; ai++) {
      var apc = animOverlay.pieces[ai];
      drawFloatingPiece(apc.art, apc.x, apc.y);
    }
  }

  // The piece from a just-rejected move (wrong move, or one of the
  // ALT: moves) - drawn wherever it currently sits: parked on the
  // square the player dropped it on, then sliding back to its origin
  // square (see showWrongMoveOverlay/clearWrongMoveOverlay, [#5]).
  // Purely visual - game.pos itself was never touched by this move.
  // On a wrong castle the rook (an "extra") is drawn too, so the
  // whole castle shows, not just the king.
  if (wrongMoveOverlay) {
    for (var wi = 0; wi < wrongMoveOverlay.extras.length; wi++) {
      var wex = wrongMoveOverlay.extras[wi];
      drawFloatingPiece(wex.art, wex.x, wex.y);
    }
    drawFloatingPiece(wrongMoveOverlay.art, wrongMoveOverlay.x, wrongMoveOverlay.y);
  }

  // The !!/?/#/eval badges, on their own canvas above the board -
  // see [#4].
  drawBadges(paintTint);
}

// True for a square (its grid number on screen) whose piece the
// board leaves out of this paint: where a sliding piece started and
// what it's about to land on, a wrong move's piece and whatever it
// covers, a promotion's pawn waiting on the picker, and the piece
// you're dragging.
function overlayHidesGrid(i) {
  if (animOverlay && animOverlay.pieces) {
    for (var k = 0; k < animOverlay.pieces.length; k++) {
      var pc = animOverlay.pieces[k];
      if (pc.fromGrid === i || pc.hideGrid === i) return true;
    }
  }
  if (wrongMoveOverlay) {
    if (wrongMoveOverlay.fromGrid === i || wrongMoveOverlay.hideGrid === i) return true;
    // an en passant victim, hidden while the wrong move is parked
    if (wrongMoveOverlay.epGrid === i) return true;
    // a castling rook's own home square, and so on (see
    // showWrongMoveOverlay)
    for (var w = 0; w < wrongMoveOverlay.extras.length; w++) {
      var ex = wrongMoveOverlay.extras[w];
      if (ex.fromGrid === i || ex.hideGrid === i) return true;
    }
  }
  // a promotion waiting on the picker: the pawn's own square, and
  // whatever it captures (the pawn is drawn there instead - see
  // promoPending, touch.js [#1])
  var promo = promoPendingSquares();
  if (promo && (BOARD.gridOf(promo[0]) === i || BOARD.gridOf(promo[1]) === i)) return true;
  return !!(userDragOverlay && (userDragOverlay.fromGrid === i || userDragOverlay.hideGrid === i));
}

// Draws a piece image centered on (cx, cy) in board units, nudged
// in if needed so it never hangs off the board's edge - used for a
// move's sliding piece(s) and a wrong move's piece sliding back.
function drawFloatingPiece(art, cx, cy) {
  if (!art) return;
  var half = BOARD.CELL / 2;
  var px = Math.max(half, Math.min(BOARD.SIZE - half, cx));
  var py = Math.max(half, Math.min(BOARD.SIZE - half, cy));
  boardCtx.drawImage(art, px - half, py - half, BOARD.CELL, BOARD.CELL);
}

// The two squares of the main moving piece in animOverlay (the
// king, on a castling move - pieces[0] is always the piece the move
// itself is about; the rook is an appended visual companion) so only
// that gets the "just moved" tint, matching how a castle played on
// the board only tints the king's squares.
function animOverlayTintSqs() {
  if (animOverlay && animOverlay.pieces && animOverlay.pieces[0]) {
    var pc = animOverlay.pieces[0];
    return [BOARD.squareAt(pc.fromGrid), BOARD.squareAt(pc.toGrid)];
  }
  return null;
}

// A piece's FEN letter from its color and type ("w", "q" -> "Q") -
// how the board names its pictures (BOARD.pieceArt).
function pieceLetter(color, type) {
  return color === "w" ? type.toUpperCase() : type;
}

/*==================================================================
 * [#2] CIRCLES & ARROWS — everything about the circles and arrows
 * you drew on the Lichess board for a move, in one place. They come
 * from the move's "circles" and "arrows" in the file:
 *   circles: [{ color: "green", sq: "e4" }, ...]
 *   arrows:  [{ color: "red", from: "e2", to: "e4" }, ...]
 * with color one of "green", "red", "yellow", "blue".
 *
 * Outside this section the page only calls:
 *   drawBoardShapes() ..... once per paint ([#1])
 *   drawArrow() ........... also called by engine.js for the
 *                           Stockfish arrows (OVERLAY.drawArrow,
 *                           [#6]), with its own color and a size
 *                           scale - so ARROW's sizes apply to
 *                           those too
 * Circles and arrows follow the "Show move annotations" setting
 * (showAnnotations, trainer.html [#21]).
 *
 * Colors stay in CSS (trainer.css [#1]) with every other color on the
 * page: --shape-green, --shape-red, --shape-yellow, --shape-blue.
 *
 *   a. Settings ........ SHAPE_OPACITY, CIRCLE, ARROW
 *   b. Shared .......... SHAPE_COLOR, shapeRGBA, shapeGridCenter
 *   c. Which ones ...... currentDrawings
 *   d. Drawing ......... drawBoardShapes, drawCircle, drawArrow
 *==================================================================*/

// ---- a. Settings -------------------------------------------------
// Sizes are fractions of one square (BOARD.CELL), so the shapes keep
// their look at any board size.

// See-through-ness of the chapter's circles and arrows - both:
// 0 = invisible, 1 = fully solid. (The engine's arrows bring their
// own - engine.js ENGINE_ARROW_OPACITY.)
var SHAPE_OPACITY = 0.7;

// Circles.
var CIRCLE = {
  // Ring thickness. The radius is worked out from it so the ring's
  // outer edge always lands exactly on the square's edge.
  lineWidth: 0.07
};

// Arrows - and engine.js's Stockfish arrows too (scaled by their
// own width). All lengths are measured along the arrow's own
// direction, so they hold at any angle.
var ARROW = {
  // Shaft thickness - how chunky the arrow looks; doesn't move its
  // ends. engine.js's ARROW_WIDTH_UNIT (9) is based on this
  // (0.14 x 64 = ~9), so change that to match if you change this.
  shaft: 0.14,

  // Arrowhead - the two to turn for a bigger/smaller/blunter/
  // pointier head:
  //   headLength - how far back from the tip the head's base sits
  //   headWidth - how wide the head is at that base
  headLength: 0.45,
  headWidth: 0.5,

  // Where the arrow starts and stops:
  //   tailGap - how far from the source square's center, toward the
  //     target, the shaft starts. Raise it to start further from
  //     center (shorter arrow, more clearance from a piece on the
  //     source square); 0 = right at the source center.
  //   tipGap - how far short of the target square's center the
  //     arrowhead's point stops. Raise it for more clearance from a
  //     piece on the destination square; 0 = exactly on center. The
  //     head is measured back from the tip, so moving the tip moves
  //     the whole head with it.
  tailGap: 0,
  tipGap: 0,

  // Shaft ends: "butt" = square, "round" = curved.
  lineCap: "butt"
};

// ---- b. Shared ---------------------------------------------------
// A circle's or arrow's color (from the file) -> the CSS color it's
// drawn in. An unknown color is drawn green.
var SHAPE_COLOR = { green: "--shape-green", red: "--shape-red", yellow: "--shape-yellow", blue: "--shape-blue" };

function shapeRGBA(color, alpha) {
  var hex = BOARD.cssColor(SHAPE_COLOR[color] || "--shape-green");
  return BOARD.hexA(hex, alpha);
}

// A square's name ("e4") -> its center on the board canvas, with the
// board's current flip taken into account.
function shapeGridCenter(sqName) {
  var g = BOARD.gridOf(RULES.nameSq(sqName));
  return { x: (g % 8) * BOARD.CELL + BOARD.CELL / 2, y: Math.floor(g / 8) * BOARD.CELL + BOARD.CELL / 2 };
}

// ---- c. Which ones -----------------------------------------------
// The move whose circles and arrows are on the board right now: the
// just-played move (none at ply 0 - the preamble is text only),
// exactly mirroring updateComment() in trainer.html [#18]. While a
// move is animating, animOverlay.moveIndex points at it directly so
// its drawings show from the animation's first frame (see
// checkSquare, [#3], for the same pattern applied to the check
// glow).
// A move of your own on the analysis line sliding in (moveIndex
// null) has none, like the analysis line itself.
// Returns the move, or null.
function currentDrawings() {
  if (onAnalysisLine()) return null; // book drawings stay on book line
  var landing = landingOverlay();
  if (landing) return landing.moveIndex === null ? null : (chapterMoves[landing.moveIndex] || null);
  if (currentPly === 0) return null;
  return chapterMoves[currentPly - 1] || null;
}

// ---- d. Drawing --------------------------------------------------
// Draws this moment's circles and arrows - all the circles first, so
// arrows always sit on top of them. Called after the board and
// pieces are painted ([#1]), before anything animating or being
// dragged.
function drawBoardShapes() {
  if (!showAnnotations) return;
  var mv = currentDrawings();
  if (!mv) return;
  (mv.circles || []).forEach(drawCircle);
  (mv.arrows || []).forEach(function (a) { drawArrow(a); });
}

function drawCircle(circle) {
  var c = shapeGridCenter(circle.sq);
  var lineWidth = BOARD.CELL * CIRCLE.lineWidth;
  var radius = BOARD.CELL * 0.5 - lineWidth / 2;
  boardCtx.beginPath();
  boardCtx.arc(c.x, c.y, radius, 0, Math.PI * 2);
  boardCtx.lineWidth = lineWidth;
  boardCtx.strokeStyle = shapeRGBA(circle.color, SHAPE_OPACITY);
  boardCtx.stroke();
}

// arrow: { from, to, color }. opts (optional) overrides the look,
// for the engine's arrows (see drawEngineArrows in engine.js):
// opts.color is a ready-made "#rrggbbaa" color, opts.scale shrinks
// the shaft and head together (1 = the normal arrow size). The gaps
// aren't scaled.
function drawArrow(arrow, opts) {
  var scale = (opts && opts.scale) || 1;
  var from = shapeGridCenter(arrow.from), to = shapeGridCenter(arrow.to);
  var dx = to.x - from.x, dy = to.y - from.y;
  var len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;
  var ux = dx / len, uy = dy / len;
  var headLen = BOARD.CELL * ARROW.headLength * scale, headWidth = BOARD.CELL * ARROW.headWidth * scale;
  var tailX = from.x + ux * (BOARD.CELL * ARROW.tailGap), tailY = from.y + uy * (BOARD.CELL * ARROW.tailGap);
  var tipX = to.x - ux * (BOARD.CELL * ARROW.tipGap), tipY = to.y - uy * (BOARD.CELL * ARROW.tipGap);
  // Where the shaft ends and the head begins.
  var baseX = tipX - ux * headLen, baseY = tipY - uy * headLen;
  var col = (opts && opts.color) || shapeRGBA(arrow.color, SHAPE_OPACITY);
  boardCtx.strokeStyle = col;
  boardCtx.fillStyle = col;
  boardCtx.lineWidth = BOARD.CELL * ARROW.shaft * scale;
  boardCtx.lineCap = ARROW.lineCap;
  boardCtx.beginPath();
  boardCtx.moveTo(tailX, tailY);
  boardCtx.lineTo(baseX, baseY);
  boardCtx.stroke();
  var perpX = -uy, perpY = ux;
  boardCtx.beginPath();
  boardCtx.moveTo(tipX, tipY);
  boardCtx.lineTo(baseX + perpX * headWidth / 2, baseY + perpY * headWidth / 2);
  boardCtx.lineTo(baseX - perpX * headWidth / 2, baseY - perpY * headWidth / 2);
  boardCtx.closePath();
  boardCtx.fill();
}
/*==================================================================
 * [#3] THE MOVE ON THE BOARD — the last move's two squares, the
 * king in check, and a move still sliding in: what the board tints
 * and what the badges ([#4]) and drawings ([#2]) belong to.
 * Squares are rules.js's own numbers (0x88), like the board's
 * (board.js [#1]).
 *==================================================================*/
// The last move on the board - game.moves' last - as its two
// squares, [from, to], or null.
function lastMoveSquares() {
  if (!game.moves.length) return null;
  var uci = game.moves[game.moves.length - 1];
  if (!uci || uci.length < 4) return null;
  var out = [];
  [uci.slice(0, 2), uci.slice(2, 4)].forEach(function (s) {
    var f = s.charCodeAt(0) - 97, r = s.charCodeAt(1) - 49;
    if (f < 0 || f > 7 || r < 0 || r > 7) return;
    out.push(r * 16 + f);
  });
  return out.length === 2 ? out : null;
}

// The side NOT making the move that's on the board right now: while
// a move is landing (see landingOverlay), game.pos is still the
// position before it, whose side to move is the one moving - so it's
// the other side; once it has landed, it's the side to move now.
// Whatever a move does to a king (check, mate, stalemate), it does to
// this side's king - which never moves on that move, so its square is
// the same before and after.
function sideAfterMove() {
  if (!landingOverlay()) return game.pos.turn;
  return game.pos.turn === "w" ? "b" : "w";
}

// The square of the king in check, for the glow - or -1.
// While a move is sliding in, game.pos and currentPly still
// reflect the pre-move state (neither updates until the animation
// finishes - see finishGoToPly), so anything that wants to react to
// the move as it lands - not once it's already landed - needs to
// read the in-flight move directly instead. animOverlay.moveIndex
// (set by animateMove, cleared when it finishes) is exactly that: it
// already drives the from/to square tint and the !!/!? badge, and
// checkSquare() and currentDrawings() ([#2]) use it the same way.
function checkSquare() {
  if (!game.pos) return -1;
  // A wrong or ALT: move parked on the board: the glow is the parked
  // move's - on the king it gives check to, if it does (see
  // showWrongMoveOverlay, [#5]). It goes back to the real position
  // the moment the piece starts sliding home - same as Lichess.
  if (wrongMoveOverlay && wrongMoveOverlay.parked) return wrongMoveOverlay.checkSq;
  var landing = landingOverlay();
  if (landing) {
    if (!/[+#]$/.test(landingSan(landing))) return -1;
    return game.pos.kingSq(sideAfterMove());
  }
  if (!game.pos.inCheck(game.pos.turn)) return -1;
  return game.pos.kingSq(game.pos.turn);
}

// Two independent floating-piece overlays can be on screen at once:
// animOverlay is a move sliding across the board - the opponent's
// reply, or a step forward or back with the < > buttons, for either
// side, in Practice or browse (driven by animateMove's own rAF loop,
// [#5]); userDragOverlay (touch.js [#2]) is whatever the player is
// physically holding under their finger/cursor (driven by pointer
// events). They're tracked as separate globals rather than a single
// "drag" argument specifically so the two loops - one tied to
// animation frames, one tied to pointer events - never have to take
// turns owning the same paint and stomp on each other's overlay;
// every paint just draws whichever of the two happen to be set at
// that moment. hideGrid (on either overlay) hides whatever's on that
// square, used to hide a captured piece under an in-flight attacker
// until it lands.
var animOverlay = null;

// The slide of a move that's still landing (forward). A backward
// slide (a back step, in Practice or browse - see animateMove's
// reverse, [#5]) is only for the eye: the board is already at the
// earlier position under it, so the tint, badges, drawings and check
// glow ignore it and just follow the position, the same as when
// nothing is sliding.
function landingOverlay() { return animOverlay && !animOverlay.reverse ? animOverlay : null; }

// The SAN of the move a landing slide brings in: a book move's, from
// the chapter (animOverlay.moveIndex) - or, for one of your own moves
// on the analysis line (moveIndex null), the SAN the slide carries
// itself (animOverlay.san, from animateMove; its uci comes along too,
// animOverlay.uci, for the game-ending badge - ownMoveEnd, [#4]).
// "" if there's none.
function landingSan(landing) {
  if (landing.moveIndex === null) return landing.san || "";
  var mv = chapterMoves[landing.moveIndex];
  return (mv && mv.san) || "";
}

/*==================================================================
 * [#4] BADGES — everything about the on-board annotation badges, in
 * one place: the !!/!/!?/?!/?/?? or eval-symbol disc drawn on the
 * last move's destination square, the "#" or "S" disc drawn on a
 * mated or stalemated king, the "D" disc for a draw, and the
 * checkmark on a solved puzzle.
 *
 * How a game ends, on the book line, comes from the move's "end" in
 * the file - "mate", "stalemate" or "draw", only ever on a chapter's
 * last move. The build works it out by the rules (jsonl_writer.py
 * [#5]): checkmate, stalemate, insufficient material, threefold
 * repetition, the 50-move rule.
 * On the analysis line (your own moves - trainer.html [#14]) there's
 * no file to say, so the board works it out itself, from the position
 * after the move (rules.js gameEnd): checkmate, stalemate, or a draw
 * by insufficient material. (Repetition and the 50-move rule are
 * left out there - they depend on the moves before.) Your own moves
 * get no other badge - the !!/? marks are the book's.
 * A wrong or ALT: move of yours in Practice, parked on its square
 * before it slides home ([#5]), is worked out the same way, by the
 * rules - not from the ALT: moves - a parked move that mates gets its
 * "#", one that stalemates its "S", one that leaves too little
 * material its "D" - for as long as it's parked.
 *
 * Outside this section the page only calls three things:
 *   initBadgeLayer() ..... once, from OVERLAY.init ([#6])
 *   drawBadges(tint) ..... end of every paint ([#1])
 *   syncBadgeLayer() ..... a new canvas size ([#1]), and
 *                          applyBoardSize (touch.js [#4]),
 *                          mid-resize-drag
 * and badges follow the "Show move annotations" setting
 * (showAnnotations, trainer.html [#21]).
 *
 * Colors and fonts stay in CSS (trainer.css [#1]) with every other
 * color and font on the page. The ones read here:
 *   --badge-text, --badge-shadow ........ glyph, drop shadow
 *   --game-end .......................... the game-ending "#", "S"
 *                                         and "D" discs (one color
 *                                         for all three - the glyph
 *                                         says how the game ended)
 *   --brilliant, --good ... --blunder ... move-quality discs (through
 *                                         annotationColor,
 *                                         trainer.html [#17])
 *   --eval-white, -black, -equal ........ eval-symbol discs
 *   --badge-font-family, -weight ........ the glyph's font
 *
 *   a. Settings ........ BADGE
 *   b. Symbols ......... NAG_EVAL, BADGE.glyph
 *   c. Which badges .... badgeSpecFor, ownMoveEnd
 *   d. Layer ........... initBadgeLayer, syncBadgeLayer
 *   e. Drawing ......... drawBadges, drawBadge
 *==================================================================*/

// ---- a. Settings -------------------------------------------------
// Everything except radius is measured in badge radii (br), so the
// badge keeps its look at any board size.
var BADGE = {
  // Circle size, as a fraction of one square (BOARD.CELL). Bump it to
  // make the whole badge bigger.
  radius: 0.21,

  // Where the circle's center sits, in radii in from the square's
  // right edge (insetX) and top edge (insetY). At 0.5 the disc pokes
  // half a radius past the square's top-right corner. Lower = further
  // toward that edge; below 0 the center itself leaves the square
  // (and, on an edge square, the board - see BADGE.margin below).
  insetX: 0.5,
  insetY: 0.5,

  // Glyph size, as a multiple of the radius - bigger glyph within
  // the same circle.
  fontScale: 1.6,

  // The two-line stacked eval symbols (see NAG_EVAL below for why
  // they're stacked):
  //   fontScale - each line's size relative to a normal one-line
  //     glyph (smaller, since two lines share the same circle)
  //   lineGap - distance between the two lines' centers, in radii;
  //     raise it to spread the lines apart, lower it to pull them
  //     together
  stack: { fontScale: 0.95, lineGap: 0.65 },

  // Drop shadow on the disc, as if lit from the top-left (Lichess's
  // floating-glyph look), so it falls to the lower-right. Its color
  // is --badge-shadow in CSS.
  //   opacity - 0-1; lower is fainter, higher is darker
  //   blur - softness, in radii; ~0.2 is tight and crisp, ~0.5+ is
  //     soft and diffuse
  //   offsetX / offsetY - how far it's thrown right / down, in
  //     radii. Raise both to push it further out; change their ratio
  //     to move the light source (more X than Y = light coming more
  //     from the left than from above)
  shadow: { opacity: 0.5, blur: 0.35, offsetX: 0.3, offsetY: 0.3 }
};

// Extra room (in BOARD.SIZE units) on every side of the badge canvas,
// so a badge on the board's top or right edge can hang past it
// without being cut off. With the insets at 0.5 a disc only pokes
// out half a radius, so a full radius leaves room for the shadow
// too. Push the insets below 0 and this needs to grow to match.
// Set when the badge layer is made (initBadgeLayer, d. below), not
// here: this file loads before the board is checked for, so with
// board.js missing that's said once, by errors.js, rather than as a
// script error here.
BADGE.margin = 0;

// ---- b. Symbols --------------------------------------------------
// Eval marks (a move's "eval" in the file: "$10", "$14"... - an
// engine-style verdict on the resulting position, as opposed to
// ANNOTATION_CLASS in trainer.html [#17], which judges the move
// itself) -> the symbol drawn and which --eval-* color its disc uses.
// Slight and moderate advantage would normally use the single
// combined Unicode glyphs "⩲"/"±"/"⩱"/"∓"
// (U+2A72/U+00B1/U+2A71/U+2213) - one character that already looks
// like a "+" stacked over a "-" or "=". In practice that combined
// glyph renders inconsistently (missing entirely in some fonts,
// oversized/lopsided in others), so instead each symbol here is two
// plain characters joined by "\n" and drawn as two separate stacked
// lines by drawBadge (sized by BADGE.stack above) - same idea as the
// decisive-advantage symbols below, just stacked instead of
// side-by-side.
var NAG_EVAL = {
  "$10": { symbol: "=",    cls: "equal" },
  "$14": { symbol: "+\n=", cls: "white" }, // white slight adv
  "$16": { symbol: "+\n−", cls: "white" }, // white mod adv
  "$18": { symbol: "+−",   cls: "white" }, // white large adv
  "$15": { symbol: "=\n+", cls: "black" }, // black slight adv
  "$17": { symbol: "−\n+", cls: "black" }, // black mod adv
  "$19": { symbol: "−+",   cls: "black" }  // black large adv
};

// Per-symbol nudge for the glyph, since textAlign/textBaseline
// "center"/"middle" centers by font metrics, not by the glyph's own
// shape, so some symbols land slightly off - tune to taste. All in
// radii, so the nudge scales with the board:
//   dx - negative = left, positive = right
//   dy - negative = down, positive = up
//   spacing - two-character side-by-side symbols only: extra gap
//     between the characters (0 = normal, higher = more spread out);
//     useful for symbols like "!?" that otherwise sit flush together
// Symbols not listed here get no adjustment.
BADGE.glyph = {
  "!!": { dx: 0.03, dy: 0.01, spacing: 0.1 },
  "!?": { dx: 0.05, dy: 0.02, spacing: 0.05 },
  "?!": { dx: 0.02, dy: -0.01, spacing: 0.05 },
  "??": { dx: 0.03, dy: 0, spacing: 0.005 },
  "#":  { dx: 0, dy: 0 },
  "S":  { dx: 0.03, dy: 0.06 },       // stalemate
  "D":  { dx: 0.07, dy: 0.06 },       // draw
  "!":  { dx: 0, dy: 0.02 },
  "?":  { dx: 0.02, dy: 0 },
  "=":  { dx: 0, dy: 0 },
  "+\n=": { dx: 0, dy: 0 },           // white slight adv (+ over =)
  "+\n−": { dx: 0, dy: 0 },           // white mod adv (+ over -)
  "+−": { dx: 0, dy: 0, spacing: 0 }, // white large adv (+-)
  "=\n+": { dx: 0, dy: 0.1 },         // black slight adv (= over +)
  "−\n+": { dx: 0, dy: 0.15 },        // black mod adv (- over +)
  "−+": { dx: 0, dy: 0, spacing: 0 }  // black large adv (-+)
};

// ---- c. Which badges ---------------------------------------------
// The move's own badge, drawn on the square the piece landed on
// (a mate or stalemate gets a separate "#"/"S" badge on the king -
// see gameEndKingGridSq below), as { symbol, color }, or null for
// none. Only one of these is shown per move: an eval mark ($10/$18/
// etc, an objective verdict on the resulting position) takes priority
// over a move-quality glyph (!!/?!/etc) when a move has both.
function badgeSpecFor(mv) {
  if (!mv) return null;
  var ev = NAG_EVAL[mv.eval];
  if (ev) return { symbol: ev.symbol, color: BOARD.cssColor("--eval-" + ev.cls) };
  var c = annotationColor(mv.annotation);
  return c ? { symbol: mv.annotation, color: c } : null;
}

// How the game ends after a move of your own on the analysis line -
// "mate", "stalemate", "draw" or null (rules.js gameEnd) - worked out
// from the position after it: game.pos once it has landed, or, while
// it's still sliding in (landing), game.pos with the slide's move
// played on a copy. Remembered for the position and move it was
// worked out for, as the board is redrawn every frame of a slide.
var ownEndCache = { pos: null, uci: null, end: null };
function ownMoveEnd(landing) {
  var uci = landing ? landing.uci || "" : "";
  if (ownEndCache.pos === game.pos && ownEndCache.uci === uci) return ownEndCache.end;
  var after = game.pos;
  if (landing) {
    after = game.pos.clone();
    if (!after.applyUci(uci)) after = null;
  }
  ownEndCache = { pos: game.pos, uci: uci, end: after ? after.gameEnd() : null };
  return ownEndCache.end;
}

// ---- d. Layer ----------------------------------------------------
// The badges get their own canvas, laid over the board's canvas
// (#mini) with BADGE.margin of extra room on every side: the board
// can never draw past its own
// edge, and a badge tucked into the board's top-right corner needs
// to. It's created here in the script - there's no <canvas> tag or
// CSS rule for it.
var badgeLayer = null, badgeLayerCtx = null;

function initBadgeLayer() {
  BADGE.margin = BOARD.CELL * BADGE.radius;
  badgeLayer = document.createElement("canvas");
  badgeLayer.id = "badgeLayer";
  // Placed by syncBadgeLayer; taps go straight through to the board.
  badgeLayer.style.position = "absolute";
  badgeLayer.style.pointerEvents = "none";
  // Same spot in #boardFrame as the old <canvas> tag: after the board
  // and the promotion picker, before the resize handle. The picker
  // (z-index 5) and the handle (z-index 3) both still sit on top.
  BOARD.canvas().parentNode.insertBefore(badgeLayer, document.getElementById("boardResizeHandle"));
  badgeLayerCtx = badgeLayer.getContext("2d");
  syncBadgeLayer();

  // The badge is drawn on a <canvas>, which - unlike regular DOM
  // text - doesn't wait for web fonts to finish loading before it
  // paints. If it paints before "Noto Sans" is ready, the canvas
  // silently falls back to Arial (visibly thinner) and, unlike DOM
  // text, never repaints itself once the real font arrives. Asking
  // for the exact face the badges use starts the download of the
  // font file (loaded by theme.css) right away, and forces one
  // redraw once it's in. The face is built from the same two CSS
  // settings drawBadge uses, so changing either in CSS can't leave
  // this asking for the wrong one.
  //
  // First noticed after updating to iPadOS 27, alongside the
  // ctx.letterSpacing bug in drawBadge below - likely the same WebKit
  // update changed canvas/font-loading timing enough to make this
  // latent bug visible.
  // (The board's a-h / 1-8 labels are canvas text too: the shared
  // board asks for their font the same way - board.js [#8].)
  if (document.fonts && document.fonts.load) {
    try {
      document.fonts.load(BOARD.canvasFont("--badge-font-weight", 16, "--badge-font-family")).then(
        function () { BOARD.render(); },
        function () { /* load error: keeps the fallback font */ }
      );
    } catch (err) { /* bad font setting: same, fallback font */ }
  }
}

// Keeps #badgeLayer's on-screen box centered over the board's
// canvas with a margin of BADGE.margin (scaled to whatever size the
// board is actually shown at) on every side, and its internal
// resolution at BOARD.SIZE + 2 * BADGE.margin board units, in the
// board canvas's own pixels (BOARD.scale, board.js [#2]) - so it's
// as sharp as the
// board, and badge-drawing coordinates (which add that same margin
// as an offset - see drawBadge) land in the right place regardless
// of the board's current CSS size. Cheap enough to just call on
// every render rather than only on resize.
function syncBadgeLayer() {
  if (!badgeLayer || !BOARD.canvas()) return;
  var rect = BOARD.canvas().getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  // Rounded to a whole pixel count: canvas.width/.height silently
  // round any fractional value you assign them, so comparing this
  // float directly against the already-rounded badgeLayer.width
  // below would never match - re-triggering the assignment (and the
  // canvas-clearing reset that comes with it, per spec) on every
  // single call instead of only when the resolution actually needs
  // to change. Harmless when syncBadgeLayer() only ever ran right
  // before a fresh redraw (inside drawBadges), but it's also called
  // mid-resize-drag with no redraw after it, which is what was
  // wiping the badges out until the next full render.
  var res = Math.round((BOARD.SIZE + BADGE.margin * 2) * BOARD.scale());
  if (badgeLayer.width !== res) badgeLayer.width = res;
  if (badgeLayer.height !== res) badgeLayer.height = res;
  var marginCss = BADGE.margin * (rect.width / BOARD.SIZE);
  badgeLayer.style.left = (-marginCss) + "px";
  badgeLayer.style.top = (-marginCss) + "px";
  badgeLayer.style.width = (rect.width + marginCss * 2) + "px";
  badgeLayer.style.height = (rect.height + marginCss * 2) + "px";
}

// ---- e. Drawing --------------------------------------------------
// Repaints the badge layer. Called at the end of every paint ([#1])
// with that paint's tinted squares - the last move's [from, to] (as
// squares), or null. Up to two badges per move:
//   - the move's own badge (!!, ?, an eval symbol...) on the square
//     the moving piece landed on - book moves only
//   - the game-ending badge, if the move ends the game (a book
//     move's "end", or for one of your own on the analysis line,
//     ownMoveEnd):
//     "#" on the mated king, "S" on the stalemated king, or "D" on
//     the landing square for a draw. "D" shares the landing square
//     with the move's own badge, so it takes that badge's place.
// A solved puzzle's last move also gets a checkmark on the landing
// square, unless a game-ending badge already marks the end.
// While a move is still sliding in, animOverlay.moveIndex
// points at that move directly (chapterMoves[currentPly - 1] would
// still be the PRIOR move, since currentPly only advances once the
// animation finishes) - so the badges appear at the same moment as
// the from/to square tinting, instead of popping in once the piece
// lands.
function drawBadges(tint) {
  syncBadgeLayer();
  if (!badgeLayerCtx) return;
  badgeLayerCtx.setTransform(1, 0, 0, 1, 0, 0);
  badgeLayerCtx.clearRect(0, 0, badgeLayer.width, badgeLayer.height);
  // drawn in board units, scaled to the layer's real pixels
  // (board.js [#2])
  var s = BOARD.scale();
  badgeLayerCtx.setTransform(s, 0, 0, s, 0, 0);
  if (!showAnnotations) return;
  // A wrong or ALT: move of yours parked on the board: it's the last
  // move shown then, so the opponent's badge (a "?" on their mistake,
  // say) would look like it was about your move - it's left off, and
  // comes back as your piece starts sliding home, like Lichess and
  // like the check halo (checkSquare, [#3]). In its place: the
  // parked move's own game-ending badge, if it ends the game ("#",
  // "S" or "D" - worked out by the rules in showWrongMoveOverlay,
  // [#5]).
  // Before the tint check: a puzzle's first move has no last move
  // to tint, and can still mate.
  // A promotion waiting on the picker: the same - its squares are
  // tinted as the last move (promoPending, touch.js [#1]), so the
  // opponent's
  // badge is left off until it's played or cancelled.
  if (promoPending) return;
  var parked = wrongMoveOverlay && wrongMoveOverlay.parked ? wrongMoveOverlay : null;
  if (parked) {
    drawGameEndBadge(parked.end, parked.toGrid, parked.endKingSq);
    return;
  }
  if (!tint) return;
  // the square the move landed on, on screen
  var to = BOARD.gridOf(tint[1]);
  var landing = landingOverlay();
  // A move of your own on the analysis line - on the board, or
  // sliding in (moveIndex null): only how the game ends, worked out
  // by the board itself (ownMoveEnd); the book's badges belong to the
  // book's moves.
  if (landing ? landing.moveIndex === null : onAnalysisLine()) {
    drawGameEndBadge(ownMoveEnd(landing), to);
    return;
  }
  var moveIdx = landing ? landing.moveIndex : currentPly - 1;
  if (moveIdx < 0) return;
  var mv = chapterMoves[moveIdx];
  var spec = badgeSpecFor(mv);
  if (spec && !(mv && mv.end === "draw")) drawBadge(to, spec);
  drawGameEndBadge(mv && mv.end, to);
  // A solved puzzle: a checkmark on its last move - unless that move
  // mated, stalemated or drew, whose badge already marks the end.
  if (listMode === "puzzle" && moveIdx === chapterMoves.length - 1 && !(mv && mv.end)) {
    drawBadge(to, { symbol: "checkmark", color: BOARD.cssColor("--good") });
  }
}

// The game-ending badge for `end` ("mate", "stalemate", "draw", or
// nothing): "#" or "S" on the king of the side that didn't make the
// move - found on the board itself (sideAfterMove, [#3]), so it's
// right even while the move is still sliding in - or "D" on the
// move's landing square (landingGrid).
// kingSq (0x88, optional): the king to put "#" or "S" on, for a
// parked wrong or ALT: move ([#5]) - game.pos doesn't hold that move,
// so the side to move there is still yours, not the mated side.
function drawGameEndBadge(end, landingGrid, kingSq) {
  if (!end) return;
  var color = BOARD.cssColor("--game-end");
  if (end === "draw") { drawBadge(landingGrid, { symbol: "D", color: color }); return; }
  var k = kingSq !== undefined ? kingSq : game.pos.kingSq(sideAfterMove());
  if (k >= 0) drawBadge(BOARD.gridOf(k), { symbol: end === "mate" ? "#" : "S", color: color });
}

// Draws one badge - a colored disc with a glyph on it, per the
// settings in section a - tucked into the top-right corner of the
// given on-screen grid square (0-63).
function drawBadge(gridSq, spec) {
  var ctx = badgeLayerCtx;
  var br = BOARD.CELL * BADGE.radius;
  var bx = (gridSq % 8) * BOARD.CELL, by = Math.floor(gridSq / 8) * BOARD.CELL;
  // Disc center. BADGE.margin shifts everything into the layer's
  // extra room (see syncBadgeLayer).
  var bcx = BADGE.margin + bx + BOARD.CELL - br * BADGE.insetX;
  var bcy = BADGE.margin + by + br * BADGE.insetY;

  ctx.save(); // everything set below is undone at the end

  // The disc, with its drop shadow. The shadow is set only inside
  // this inner save/restore so it doesn't also land under the glyph.
  // A shadow's sizes are in real canvas pixels - the canvas doesn't
  // scale them with everything else - so they're scaled here
  // (BOARD.scale, board.js [#2]).
  var px = BOARD.scale();
  ctx.save();
  ctx.shadowColor = BOARD.hexA(BOARD.cssColor("--badge-shadow"), BADGE.shadow.opacity);
  ctx.shadowBlur = br * BADGE.shadow.blur * px;
  ctx.shadowOffsetX = br * BADGE.shadow.offsetX * px;
  ctx.shadowOffsetY = br * BADGE.shadow.offsetY * px;
  ctx.beginPath();
  ctx.arc(bcx, bcy, br, 0, Math.PI * 2);
  ctx.fillStyle = spec.color;
  ctx.fill();
  ctx.restore();

  // The solved-puzzle checkmark: Tabler's "check" icon (24x24 grid,
  // MIT license), stroked - Noto Sans has no checkmark character.
  if (spec.symbol === "checkmark") {
    var s = br * 0.06; // icon units -> px; checkmark is 0.9 radii wide
    ctx.translate(bcx, bcy);
    ctx.scale(s, s);
    ctx.translate(-12.5, -12); // the checkmark's own center
    ctx.strokeStyle = BOARD.cssColor("--badge-text");
    ctx.lineWidth = 5;
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.stroke(new Path2D("M5 12l5 5l10 -10"));
    ctx.restore();
    return;
  }

  // The glyph.
  var fontPx = Math.round(br * BADGE.fontScale);
  ctx.font = BOARD.canvasFont("--badge-font-weight", fontPx, "--badge-font-family");
  ctx.textBaseline = "middle";
  ctx.fillStyle = BOARD.cssColor("--badge-text");
  var symbol = spec.symbol;
  var off = BADGE.glyph[symbol] || { dx: 0, dy: 0 };
  var symCx = bcx + off.dx * br, symCy = bcy - off.dy * br;
  var spacing = off.spacing ? off.spacing * br : 0;
  if (symbol.indexOf("\n") !== -1) {
    // Two-line stacked symbols (slight/moderate advantage, e.g. "+"
    // over "-") - see NAG_EVAL for why these are built from two
    // plain characters instead of one combined Unicode glyph. Each
    // line is drawn smaller than a normal single-glyph symbol and
    // offset up/down from center by half the line gap, so the pair
    // sits compact and centered inside the circle.
    var vLines = symbol.split("\n");
    ctx.font = BOARD.canvasFont("--badge-font-weight", Math.round(fontPx * BADGE.stack.fontScale), "--badge-font-family");
    ctx.textAlign = "center";
    var vGap = br * BADGE.stack.lineGap;
    ctx.fillText(vLines[0], symCx, symCy - vGap / 2);
    ctx.fillText(vLines[1], symCx, symCy + vGap / 2);
  } else if (symbol.length > 1 && spacing) {
    // Multi-character symbols (e.g. "!!", "!?") don't use
    // ctx.letterSpacing for the gap: it shifts each glyph to a
    // fractional-pixel x-position, which makes identical characters
    // (both "!" in "!!") get antialiased/hinted differently and end
    // up looking like different weights. Drawing each character
    // with its own whole-pixel-rounded fillText call keeps every
    // glyph crisp and identical to its twin. (Whole pixels of the
    // canvas, not board units - snap() - since the two only match
    // at one board size.)
    //
    // First noticed right after updating to iPadOS 27 - WebKit
    // updated how canvas ctx.letterSpacing sub-pixel-positions
    // glyphs, which is what surfaced this - the bug was latent in
    // this code before that, just not visibly so on the WebKit
    // version in use then.
    var chars = symbol.split("");
    ctx.textAlign = "left";
    var widths = chars.map(function (c) { return ctx.measureText(c).width; });
    var totalWidth = widths.reduce(function (a, b) { return a + b; }, 0) + spacing * (chars.length - 1);
    var snap = function (v) { return Math.round(v * px) / px; };
    var gx = snap(symCx - totalWidth / 2);
    for (var ci = 0; ci < chars.length; ci++) {
      ctx.fillText(chars[ci], gx, symCy);
      gx += snap(widths[ci] + spacing);
    }
  } else {
    ctx.textAlign = "center";
    ctx.fillText(symbol, symCx, symCy);
  }

  ctx.restore();
}
/*==================================================================
 * [#5] SLIDES & WRONG MOVES — slides a piece between two squares,
 * and the "parked then returns" animation for a wrong or ALT:
 * move.
 *==================================================================*/
// Moves slide from square to square instead of popping in: the
// opponent's reply in Practice, and every single step forward or back
// with the < > buttons (or arrow keys), for either side, in Practice
// and browse alike (trainer.html goToPly, goToAnalysis). A move you
// play on the board yourself doesn't slide - the piece is already
// where you dropped it. Tune the duration (ms) here, or set
// ANIMATE_MOVES = false to go back to instant placement everywhere.
var ANIMATE_MOVES = true;
var MOVE_ANIM_MS = 220;

// Slides the piece on move.from to move.to (using the CURRENT,
// pre-move game.pos for its art/position), then calls onDone. Runs
// as its own independent rAF loop writing to the animOverlay global
// (see drawOverBoard, [#1]) so it keeps animating even while the
// player is simultaneously dragging their own piece around - the two
// no longer have to take turns owning a single "drag" render
// argument.
var animFrame = null;
// Builds the static (pre-animation) geometry for one sliding piece:
// its art, its from/to grid squares, and the pixel start/end points
// it travels between. Returns null if there's no art for the square
// (shouldn't normally happen for a real move).
function animPieceSpec(from, to) {
  var p = game.pos.board[from];
  var art = p && BOARD.pieceArt(p);
  if (!art) return null;
  var fromGrid = BOARD.gridOf(from);
  var toGrid = BOARD.gridOf(to);
  return {
    art: art, fromGrid: fromGrid, toGrid: toGrid,
    fx: (fromGrid % 8) * BOARD.CELL + BOARD.CELL / 2, fy: Math.floor(fromGrid / 8) * BOARD.CELL + BOARD.CELL / 2,
    tx: (toGrid % 8) * BOARD.CELL + BOARD.CELL / 2, ty: Math.floor(toGrid / 8) * BOARD.CELL + BOARD.CELL / 2,
    x: 0, y: 0, hideGrid: -1
  };
}

// The rook's from/to squares (0x88) if from -> to is a castling move
// in the CURRENT game.pos - the king moving two files along its own
// rank - or null otherwise. Used by both slides that move pieces
// for real (animateMove) and the wrong-move park
// (showWrongMoveOverlay), so a castle always moves its rook too.
function castleRookSquares(from, to) {
  var mover = game.pos.board[from];
  var fileFrom = from & 15, fileTo = to & 15;
  if (!mover || mover.toLowerCase() !== "k") return null;
  if ((from >> 4) !== (to >> 4) || Math.abs(fileTo - fileFrom) !== 2) return null;
  var rank = from >> 4;
  var kingside = fileTo > fileFrom;
  return { from: rank * 16 + (kingside ? 7 : 0), to: rank * 16 + (kingside ? 5 : 3) };
}

// A wrong or ALT: move the player just played: rather than snapping
// straight back to the origin square the instant tryPlayMove rejects
// it, the piece stays parked on the square it was dropped on for as
// long as the Retry/Alternative message is up, then returns to its
// origin - animated if the browser supports rAF (it always does
// here; the check just mirrors animateMove's own defensiveness),
// otherwise an instant snap. game.pos is never touched by any of
// this - it's a purely visual stand-in drawn by drawOverBoard ([#1]),
// exactly like animOverlay/userDragOverlay are.
//
// The parked position shows the WHOLE move, the way Lichess does:
//   - castling: the rook is parked on its castled square too (in
//     .extras) and slides home alongside the king
//   - en passant: the captured pawn (on .epGrid) is hidden while
//     parked and comes back when the slide home starts
//   - promotion: the piece is parked as the promoted piece (a queen,
//     say) and turns back into a pawn for the slide home
//   - check: the king the move gives check to glows while it's
//     parked (checkSquare, [#3])
//   - game over: a move that mates, stalemates or leaves too little
//     material to mate gets its "#", "S" or "D" while it's parked
//     (drawBadges, [#4]) - worked out by the rules, wrong move or
//     ALT: move alike
var wrongMoveOverlay = null;
var wrongMoveAnimFrame = null;

function showWrongMoveOverlay(m, isAlt) {
  var spec = animPieceSpec(m.from, m.to);
  if (!spec) return;
  if (wrongMoveAnimFrame) { cancelAnimationFrame(wrongMoveAnimFrame); wrongMoveAnimFrame = null; }
  spec.x = spec.tx;
  spec.y = spec.ty;
  // whatever real piece sits under it stays hidden while parked here
  spec.hideGrid = spec.toGrid;

  // Castling: park the rook on its castled square as well.
  spec.extras = [];
  var rook = castleRookSquares(m.from, m.to);
  if (rook) {
    var rookSpec = animPieceSpec(rook.from, rook.to);
    if (rookSpec) {
      rookSpec.x = rookSpec.tx;
      rookSpec.y = rookSpec.ty;
      spec.extras.push(rookSpec);
    }
  }

  // En passant: the pawn being taken sits beside the square the
  // capturing pawn lands on (one rank back toward its own side), so
  // it's hidden separately.
  spec.epGrid = -1;
  if (m.flags && m.flags.indexOf("e") >= 0) {
    var victim = m.to + (m.color === "w" ? -16 : 16);
    spec.epGrid = BOARD.gridOf(victim);
  }

  // Promotion: parked as the promoted piece, slides home as a pawn.
  spec.homeArt = spec.art;
  if (m.promotion) {
    var promoArt = BOARD.pieceArt(pieceLetter(m.color, m.promotion));
    if (promoArt) spec.art = promoArt;
  }

  spec.isAlt = !!isAlt;
  // full-strength square tint while parked; fades in
  // clearWrongMoveOverlay
  spec.tintAlpha = 1;
  // true while the piece sits on the wrong square, false once it
  // starts sliding home - while it's parked, the check glow follows
  // the parked move, not the real position (see checkSquare, [#3])
  spec.parked = true;

  // Check: the king the parked move gives check to (0x88 square), or
  // -1 - worked out on a copy of the position with the move made, so
  // the glow shows the whole move too, like Lichess. (The move is
  // legal, so it never leaves your own king in check.)
  var after = game.pos.clone();
  after.apply(m);
  spec.checkSq = after.inCheck(after.turn) ? after.kingSq(after.turn) : -1;
  // Game over: how the move ends the game, on the same copy -
  // "mate", "stalemate", "draw" (too little material to mate) or
  // null (rules.js gameEnd, as for the analysis line - ownMoveEnd,
  // [#4]). Worked out by the rules, never read from the ALT: moves,
  // and for wrong moves too. endKingSq: the king of the side that
  // didn't move - where "#" or "S" goes (drawBadges, [#4]).
  spec.end = after.gameEnd();
  spec.endKingSq = after.kingSq(after.turn);
  wrongMoveOverlay = spec;
}

// animate: true slides the piece back to its origin square over
// MOVE_ANIM_MS; false (used when navigating away mid-park, e.g. the
// player retries successfully or steps back/forward) removes it
// instantly since a full board re-render is about to happen anyway.
function clearWrongMoveOverlay(animate) {
  if (wrongMoveAnimFrame) { cancelAnimationFrame(wrongMoveAnimFrame); wrongMoveAnimFrame = null; }
  if (!wrongMoveOverlay) return;
  if (!animate) { wrongMoveOverlay = null; BOARD.render(); return; }
  var ov = wrongMoveOverlay;
  // The slide home starts now: a checked king's halo comes back on
  // its real square straight away, before the king gets there.
  ov.parked = false;
  // A promoted piece turns back into the pawn for the trip home, and
  // an en passant victim reappears at once.
  ov.art = ov.homeArt;
  ov.epGrid = -1;
  // Every piece slides from where it's parked back to its own
  // square: the moved piece, plus the rook on a castle.
  var sliders = [ov].concat(ov.extras);
  sliders.forEach(function (pc) { pc.sx = pc.x; pc.sy = pc.y; });
  var start = null;
  function step(ts) {
    if (start === null) start = ts;
    var t = Math.min(1, (ts - start) / MOVE_ANIM_MS);
    var eased = 1 - Math.pow(1 - t, 3);
    sliders.forEach(function (pc) {
      pc.x = pc.sx + (pc.fx - pc.sx) * eased;
      pc.y = pc.sy + (pc.fy - pc.sy) * eased;
    });

    // COLOR FADE after wrong move (red) / ALT: move (blue).
    // Instant (0): tint disappears the moment the return-slide
    // starts.
    // Linear (1 - t): tint fades out gradually, in step with the
    // piece's slide back (same duration, MOVE_ANIM_MS).
    ov.tintAlpha = 0;

    // Reveal whatever's really on the destination square again as
    // soon as the piece has visibly lifted off it, rather than
    // waiting for the full return trip to finish.
    ov.hideGrid = t < 0.08 ? ov.toGrid : -1;
    BOARD.render();
    if (t < 1) {
      wrongMoveAnimFrame = requestAnimationFrame(step);
    } else {
      wrongMoveAnimFrame = null;
      wrongMoveOverlay = null;
      BOARD.render();
    }
  }
  wrongMoveAnimFrame = requestAnimationFrame(step);
}

// reverse (a back step, in Practice or browse - trainer.html goToPly,
// goToAnalysis): the board is ALREADY at the position before the
// move, and the piece slides from move.to back to move.from - the
// same slide played backwards.
// Whatever it had captured is uncovered on move.to as it lifts off.
// moveIndex: the book move's index in chapterMoves - or null for a
// move of your own on the analysis line (trainer.html [#14]), which
// has no book move behind it; its SAN and uci then come in move.san
// and move.uci, for the check glow and the game-ending badge while it
// lands (landingSan, [#3]; ownMoveEnd, [#4]).
function animateMove(move, moveIndex, onDone, reverse) {
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
  var kingSpec = animPieceSpec(move.from, move.to);
  if (!kingSpec) { animOverlay = null; onDone(); return; }
  var pieces = [kingSpec];

  // Castling: the king moves two files along its home rank. Slide the
  // rook into its post-castling square in lockstep with the king,
  // rather than popping it over once the king lands - both travel for
  // the same MOVE_ANIM_MS, so the rook (which covers more squares on
  // the queenside) simply moves faster to cover the distance in that
  // same time. (castleRookSquares is next to animPieceSpec, above.)
  var rook = castleRookSquares(move.from, move.to);
  if (rook) {
    var rookSpec = animPieceSpec(rook.from, rook.to);
    if (rookSpec) pieces.push(rookSpec);
  }

  if (reverse) {
    pieces.forEach(function (pc) {
      var fx = pc.fx, fy = pc.fy;
      pc.fx = pc.tx; pc.fy = pc.ty; pc.tx = fx; pc.ty = fy;
    });
  }

  // Puts every sliding piece where it is at time t (0-1) and paints.
  function place(t) {
    var eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    for (var i = 0; i < pieces.length; i++) {
      var pc = pieces[i];
      pc.x = pc.fx + (pc.tx - pc.fx) * eased;
      pc.y = pc.fy + (pc.ty - pc.fy) * eased;
      // Forward: only hide whatever's on the destination square once
      // the attacker has actually arrived (visually covering it),
      // rather than for the whole flight - otherwise a captured piece
      // vanishes the instant the animation starts, long before the
      // capturing piece gets there.
      // Backward: the captured piece on move.to stays hidden only
      // until the mover has visibly lifted off it.
      pc.hideGrid = reverse ? (eased < 0.08 ? pc.toGrid : -1)
                            : (eased >= 0.98 ? pc.toGrid : -1);
    }
    animOverlay = { pieces: pieces, moveIndex: moveIndex, reverse: !!reverse,
                    san: move.san || "", uci: move.uci || "" };
    BOARD.render();
  }

  var start = null;
  function step(ts) {
    if (start === null) start = ts;
    var t = Math.min(1, (ts - start) / MOVE_ANIM_MS);
    place(t);
    if (t < 1) {
      animFrame = requestAnimationFrame(step);
    } else {
      animFrame = null;
      animOverlay = null;
      onDone();
    }
  }
  // First frame right now, in the same task as the caller's own
  // repaint - so a back step never flashes the piece already home
  // for a frame before the slide starts.
  place(0);
  animFrame = requestAnimationFrame(step);
}

/*==================================================================
 * [#6] OVERLAY — this file's one way in. The rest of the page (and
 * engine.js) uses it only through these. Everything else in this
 * file is its own business.
 *==================================================================*/
var OVERLAY = {
  // Once, at start-up, after the saved settings are loaded and the
  // board's size is restored (TOUCH.restoreSize, touch.js [#5]):
  // starts the shared board on #mini - with what to show and what to
  // draw over it ([#1]) - then the badges' canvas over it ([#4]). A
  // problem the board finds (a missing file or color) stops the
  // page, like every error (errors.js [#1]).
  init: function () {
    BOARD.init(el("mini"), {
      describe: describeBoard,
      afterDraw: drawOverBoard,
      onResolution: syncBadgeLayer,
      report: pageWarn
    });
    initBadgeLayer();
    BOARD.render();
  },
  // Slide a move (the opponent's reply in practice, or any single
  // step forward or back, for either side, in practice or browse - on
  // the book line or the analysis line), then call onDone - or, with
  // sliding turned off (ANIMATE_MOVES, [#5]), call onDone at once.
  // moveIndex is the book move's index in chapterMoves, or null for a
  // move on the analysis line (its SAN and uci then in move.san and
  // move.uci - see animateMove, [#5]). reverse = true slides it
  // backwards over the position before it.
  animateMove: function (move, moveIndex, onDone, reverse) {
    if (!ANIMATE_MOVES) { onDone(); return; }
    animateMove(move, moveIndex, onDone, reverse);
  },
  // Cut any slide short, leaving no sliding piece on the board.
  stopAnimation: function () {
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    animOverlay = null;
  },
  // True while a move is still sliding in to land (currentPly hasn't
  // caught up with it yet). A backward slide doesn't count: the
  // board is already at its position.
  isAnimating: function () { return !!landingOverlay(); },
  // Park a wrong or ALT: move on its square / send it back home
  // (animate = true slides it back, false removes it at once).
  showWrongMove: function (m, isAlt) { showWrongMoveOverlay(m, isAlt); },
  clearWrongMove: function (animate) { clearWrongMoveOverlay(animate); },
  // One arrow on the board - engine.js draws its arrows with this.
  drawArrow: function (arrow, opts) { drawArrow(arrow, opts); }
};
