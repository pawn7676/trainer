/*==================================================================
 * board.js — THE BOARD for the trainer page
 *
 * Everything about the chessboard itself: drawing the squares,
 * pieces, coordinates, check glow, the chapter's arrows and circles
 * and the !!/?/# badges; tapping and dragging pieces, premoves and the
 * promotion picker; sliding pieces; and the resize grip. Load it as
 * a plain <script> before the trainer's own script, like rules.js:
 *
 *   <script src="board.js"></script>
 *
 * Keep it in the same folder as the trainer page - the trainer
 * can't run without it.
 *
 * TALKING TO THE TRAINER - the rest of the page (and engine.js) uses
 * the board only through the BOARD object at the end of this file
 * ([#15]). In the other direction, the board reads the trainer's
 * state when it draws or takes input (never at load, so load order
 * doesn't matter to them):
 *   chapters, currentChapter,
 *   chapterMoves,
 *   side .................. the open chapter, and the side you play
 *                           in it ([#1])
 *   listMode .............. puzzle mode or not ([#1])
 *   game, currentPly, mode  the position and mode (trainer.html [#12])
 *   showAnnotations, showMaterialCount,
 *   showLastMoveHighlight,
 *   showCheckHighlight .... the Show... switches (trainer.html [#21])
 *   pendingOpponentUci .... is the opponent's reply pending
 *                           (trainer.html [#16])
 *   annotationColor ....... the !!/?/etc. colors (trainer.html [#17])
 *   isStackedLayout ....... phone layout or not (trainer.html [#20])
 *   onAnalysisLine ........ on the analysis line or not
 *                           (trainer.html [#14])
 *   el, bindTap ........... small helpers (trainer.html [#11])
 *   TAP_SLOP .............. how far a touch can move and still be a
 *                           tap - any further starts a drag
 *                           (trainer.html [#11])
 *   loadSettings,
 *   saveSetting ........... saved settings (trainer.html [#21])
 *   pageWarn .............. error messages (errors.js [#1])
 * and it hands every move the player makes to tryPlayMove
 * (trainer.html [#16]). It also uses RULES (rules.js), PIECE_SVG
 * (pieces.js) and, while drawing, ENGINE.drawArrows (engine.js).
 * How big the board can get is measured from the page itself: the
 * page grid and the button row under the board and the boxes
 * (.layout, .controls-nav, .controls-tools - trainer.css [#4], [#7];
 * see [#13]).
 * The color helpers here (cssColor, hexA, ...) are shared: the
 * trainer and engine.js use them too.
 *
 * INDEX
 *   [#1]  BOARD RENDERER SETUP . cell size, sharpness, piece ids,
 *                                sqClass
 *   [#2]  CANVAS COLORS & FONTS  reads board colors/fonts from
 *                                trainer.css [#2]
 *   [#3]  CIRCLES & ARROWS ..... a move's circles and arrows -
 *                                settings, which, drawing
 *   [#4]  PIECE ART BAKING ..... SVG pieces -> canvas images
 *   [#5]  BOARD GEOMETRY HELPERS grid <-> 0x88, board flip
 *   [#6]  BADGES ............... !!/!/!?/?!/?/??/#/S/D/eval badges -
 *                                size, symbols, layer, drawing
 *   [#7]  COORDS & MATERIAL .... a-h/1-8 labels, material count
 *   [#8]  RENDER LOOP .......... renderMiniBoard, the main paint
 *   [#9]  MOVE ANIMATION ....... slide speed, wrong-move park
 *   [#10] CLICK-TO-MOVE ........ tap a piece, tap a square
 *   [#11] DRAG-TO-MOVE ......... when a press becomes a drag
 *                                (TAP_SLOP), drag ghost
 *   [#12] TOUCH EVENT WIRING ... attaches the handlers above
 *   [#13] BOARD RESIZE HANDLE .. drag-the-corner board resize; how
 *                                big and small it can get
 *   [#14] BOARD INIT ........... grabs canvases, bakes piece art
 *   [#15] BOARD ................ the board's one way in
 *==================================================================*/

/*==================================================================
 * [#1] BOARD RENDERER SETUP — Draws game.pos, tints the last
 * move's two squares, and puts a check halo under a checked king.
 *==================================================================*/
var mini = null, miniCtx = null;
// The board's own units: MINI_CELL to a square, MINI_PX across the
// whole board, whatever size it is on screen. Every size and
// position in this file is in these units (most of them as a
// fraction of MINI_CELL) - see SHARPNESS, below, for how they're
// turned into real pixels.
var MINI_CELL = 144, MINI_PX = MINI_CELL * 8;
var BOARD_FILES = "abcdefgh";

// ---- SHARPNESS ---------------------------------------------------
// A <canvas> is a picture with a set number of pixels. When the
// browser has to stretch it to fill its box on screen, everything on
// it goes soft - the pieces, the a-h / 1-8 labels, the arrows. So the
// board's canvas (and the badge layer over it, [#6]) always has
// exactly as many pixels as the screen shows it with: its size on
// screen, times the screen's pixels per CSS pixel (2 on an iPad),
// times the pinch-zoom (1 when not zoomed in).
// Everything is still drawn in the board's own units (above), scaled
// up to the real size (boardScale), so the drawing code never needs
// to know the real size. The pieces are pictures too, so they're
// drawn again from their SVG at exactly one square's real size
// (bakePieces, [#4]) - each one then lands on the board pixel for
// pixel.
// The size is worked out again (syncBoardResolution, below) whenever
// the board's size on screen changes - the resize grip let go
// ([#13]), the iPad turned round, a pinch-zoom finished - once it has
// stayed put for RESOLUTION_WAIT_MS, not on every step of a drag or a
// pinch. Until then the board just stretches, a little soft, for a
// moment.
// The board's size on screen is also snapped to a multiple of 8
// screen pixels (applyBoardSize, [#13]), so every square is a whole
// number of pixels - no soft seams between the squares.

// The most pixels across the board's canvas, however far you
// pinch-zoom in: past this a very zoomed-in board goes a little soft
// again. Each canvas takes 4 bytes a pixel of memory, and iPadOS
// closes a page that uses too much - keep it at 3200 or less, and a
// multiple of 8.
var BOARD_MAX_PX = 3200;
// How long (ms) the board's size on screen has to stay put before
// it's drawn again at the new size.
var RESOLUTION_WAIT_MS = 150;

// Canvas pixels per board unit.
function boardScale() { return mini ? mini.width / MINI_PX : 1; }

// One square's width in canvas pixels - always a whole number.
function cellPx() { return mini ? mini.width / 8 : MINI_CELL; }

// Screen pixels per CSS pixel, times the pinch-zoom.
function screenPixelRatio() {
  var zoom = (window.visualViewport && window.visualViewport.scale) || 1;
  return (window.devicePixelRatio || 1) * zoom;
}

// The canvas size (pixels across) that matches the board on screen
// right now - a multiple of 8, at most BOARD_MAX_PX - or 0 if the
// board isn't laid out yet.
function wantedBoardPx() {
  var w = mini.getBoundingClientRect().width;
  if (!w) return 0;
  var px = Math.round(w * screenPixelRatio() / 8) * 8;
  return Math.max(8, Math.min(BOARD_MAX_PX, px));
}

// Gives the board's canvas the size the board has on screen, draws
// the pieces again at that size and repaints - if it isn't that size
// already. True if it changed.
function syncBoardResolution() {
  clearTimeout(resolutionTimer);
  if (!mini) return false;
  var px = wantedBoardPx();
  if (!px || px === mini.width) return false;
  // (a new size clears the canvas - repainted below)
  mini.width = px;
  mini.height = px;
  syncBadgeLayer();
  bakePieces(); // (each piece is repainted as it arrives)
  renderMiniBoard();
  return true;
}

// syncBoardResolution, once the size has stayed put for
// RESOLUTION_WAIT_MS. Called on every change of size (applyBoardSize
// and reapplyBoardSize, [#13]).
var resolutionTimer = null;
function scheduleBoardResolution() {
  clearTimeout(resolutionTimer);
  resolutionTimer = setTimeout(syncBoardResolution, RESOLUTION_WAIT_MS);
}

var PIECE_ID = {
  w: { k: "white-king", q: "white-queen", r: "white-rook",
       b: "white-bishop", n: "white-knight", p: "white-pawn" },
  b: { k: "black-king", q: "black-queen", r: "black-rook",
       b: "black-bishop", n: "black-knight", p: "black-pawn" }
};

function sqClass(i) {
  var r = Math.floor(i / 8), f = i % 8;
  return (r + f) % 2 === 0 ? 0 : 1;
}

// All board colors are plain 6-digit hex (see [#2]). Where a color
// needs a variable/animated alpha (drawn shapes, the wrong-move
// square tint, etc.) rather than baking a fixed alpha into a
// CSS-style rgba() string, hexA() appends the alpha as hex digits 7-8
// (the standard #RRGGBBAA form Canvas and CSS both accept) so the
// color itself stays a single hex constant no matter what alpha is
// applied to it at draw time.
function hexA(hex, alpha) {
  var a = Math.max(0, Math.min(1, alpha));
  var byte = Math.round(a * 255);
  var hexByte = (byte < 16 ? "0" : "") + byte.toString(16).toLowerCase();
  return hex + hexByte;
}

// ------------------------------------------------------------
// [#2] CANVAS COLORS, FONTS & OPACITY
// The board is a <canvas>, which CSS can't style from the outside, so
// every color and font the board-drawing code uses is defined in CSS
// (trainer.css [#2], the "BOARD" block of :root). The CSS is the only
// place those values live - to change a board color or font, edit
// trainer.css [#2], not this section.
// The drawing code asks for each one by its CSS name, right
// where it's used - cssColor("--board-light"), or canvasFont() with
// the two font names - so each color and font has exactly one name.
// Each value is read from the CSS the first time it's asked for, and
// remembered after that - the CSS doesn't change while the page is
// open, and the board is redrawn many times a second.
//
// Colors come back normalized to plain #rrggbb whatever way they were
// written in CSS, which is what hexA() above needs. A missing or
// invalid CSS color is reported (pageWarn, errors.js [#1]) the first
// time it's drawn, and drawn in the --error color instead (ERROR
// below), so the mistake is obvious on the board. A missing font is
// reported the same way and falls back to the browser's generic
// sans-serif font (or normal weight).

// Raw value of a CSS custom property on :root, or fallback if unset.
function cssVar(name, fallback) {
  var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// Any CSS color string -> plain "#rrggbb", or null if it isn't a
// valid color (empty, or a typo).
var cssColorProbe = null;
function toHex(raw) {
  if (!raw) return null;
  if (!cssColorProbe) cssColorProbe = document.createElement("canvas").getContext("2d");
  // A canvas reports back any color it's given in a normalized form.
  // An invalid one is ignored, so setting two different starting
  // colors first and comparing tells a valid color from a typo.
  cssColorProbe.fillStyle = "#000000"; cssColorProbe.fillStyle = raw;
  var a = cssColorProbe.fillStyle;
  cssColorProbe.fillStyle = "#ffffff"; cssColorProbe.fillStyle = raw;
  if (a !== cssColorProbe.fillStyle) return null;
  if (a.charAt(0) === "#") return a;
  // "rgba(r, g, b, a)" - the value had transparency; keep r/g/b only.
  var n = a.match(/[\d.]+/g);
  return "#" + n.slice(0, 3).map(function (x) {
    var h = Number(x).toString(16);
    return h.length < 2 ? "0" + h : h;
  }).join("");
}

// The --error color from trainer.css [#2]. (Black only if --error
// itself is missing from the CSS.)
var ERROR = toHex(cssVar("--error", "")) || "#000000";

// A color from the CSS by its CSS name, as "#rrggbb" - or ERROR,
// with a warning, if it's missing or mistyped. Remembered after the
// first time.
var cssColorCache = {};
function cssColor(name) {
  if (name in cssColorCache) return cssColorCache[name];
  var raw = cssVar(name, "");
  var hex = toHex(raw);
  if (!hex) {
    pageWarn("CSS color " + name + (raw ? ' is not a valid color ("' + raw + '")' : " is missing") +
      " - drawing it in the --error color");
    hex = ERROR;
  }
  cssColorCache[name] = hex;
  return hex;
}

// One part of a font (family or weight) from the CSS by its CSS
// name, or the fallback (with a warning) if it's missing. Remembered
// after the first time.
var cssFontCache = {};
function cssFontPart(name, fallback) {
  if (name in cssFontCache) return cssFontCache[name];
  var v = cssVar(name, "");
  if (!v) {
    pageWarn("CSS font setting " + name + " is missing - using " + fallback);
    v = fallback;
  }
  cssFontCache[name] = v;
  return v;
}

// Canvas font shorthand from the CSS names of a weight and a family,
// e.g. canvasFont("--badge-font-weight", 30, "--badge-font-family")
// -> '700 30px "Noto Sans", ...'.
function canvasFont(weightName, px, familyName) {
  return cssFontPart(weightName, "normal") + " " + px + "px " + cssFontPart(familyName, "sans-serif");
}

/*==================================================================
 * [#3] CIRCLES & ARROWS — everything about the circles and arrows
 * you drew on the Lichess board for a move, in one place. They come
 * from the move's "circles" and "arrows" in the file:
 *   circles: [{ color: "green", sq: "e4" }, ...]
 *   arrows:  [{ color: "red", from: "e2", to: "e4" }, ...]
 * with color one of "green", "red", "yellow", "blue".
 *
 * Outside this section the page only calls:
 *   drawBoardShapes() ..... once per renderMiniBoard ([#8])
 *   drawArrow() ........... also called by engine.js for the
 *                           Stockfish arrows, with its own color and
 *                           a size scale - so ARROW's sizes apply to
 *                           those too. engine.js calls it by this
 *                           name, so renaming it means changing
 *                           engine.js as well
 * Circles and arrows follow the "Show move annotations" setting
 * (showAnnotations, trainer.html [#21]).
 *
 * Colors stay in CSS (trainer.css [#2]) with every other color on the
 * page: --shape-green, --shape-red, --shape-yellow, --shape-blue.
 *
 *   a. Settings ........ SHAPE_OPACITY, CIRCLE, ARROW
 *   b. Shared .......... SHAPE_COLOR, shapeRGBA, shapeGridCenter
 *   c. Which ones ...... currentDrawings
 *   d. Drawing ......... drawBoardShapes, drawCircle, drawArrow
 *==================================================================*/

// ---- a. Settings -------------------------------------------------
// Sizes are fractions of one square (MINI_CELL), so the shapes keep
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
  var hex = cssColor(SHAPE_COLOR[color] || "--shape-green");
  return hexA(hex, alpha);
}

// A square's name ("e4") -> its center on the board canvas, with the
// board's current flip taken into account.
function shapeGridCenter(sqName) {
  var g = sq0x88ToGridIdx(RULES.nameSq(sqName));
  return { x: (g % 8) * MINI_CELL + MINI_CELL / 2, y: Math.floor(g / 8) * MINI_CELL + MINI_CELL / 2 };
}

// ---- c. Which ones -----------------------------------------------
// The move whose circles and arrows are on the board right now: the
// just-played move (none at ply 0 - the preamble is text only),
// exactly mirroring updateComment() in trainer.html [#18]. While a
// move is animating, animOverlay.moveIndex points at it directly so
// its drawings show from the animation's first frame (see
// checkGridSq for the same pattern applied to the check glow).
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
// arrows always sit on top of them. Called from renderMiniBoard
// ([#8]) after the board and pieces, before anything animating or
// being dragged.
function drawBoardShapes() {
  if (!showAnnotations) return;
  var mv = currentDrawings();
  if (!mv) return;
  (mv.circles || []).forEach(drawCircle);
  (mv.arrows || []).forEach(function (a) { drawArrow(a); });
}

function drawCircle(circle) {
  var c = shapeGridCenter(circle.sq);
  var lineWidth = MINI_CELL * CIRCLE.lineWidth;
  var radius = MINI_CELL * 0.5 - lineWidth / 2;
  miniCtx.beginPath();
  miniCtx.arc(c.x, c.y, radius, 0, Math.PI * 2);
  miniCtx.lineWidth = lineWidth;
  miniCtx.strokeStyle = shapeRGBA(circle.color, SHAPE_OPACITY);
  miniCtx.stroke();
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
  var headLen = MINI_CELL * ARROW.headLength * scale, headWidth = MINI_CELL * ARROW.headWidth * scale;
  var tailX = from.x + ux * (MINI_CELL * ARROW.tailGap), tailY = from.y + uy * (MINI_CELL * ARROW.tailGap);
  var tipX = to.x - ux * (MINI_CELL * ARROW.tipGap), tipY = to.y - uy * (MINI_CELL * ARROW.tipGap);
  // Where the shaft ends and the head begins.
  var baseX = tipX - ux * headLen, baseY = tipY - uy * headLen;
  var col = (opts && opts.color) || shapeRGBA(arrow.color, SHAPE_OPACITY);
  miniCtx.strokeStyle = col;
  miniCtx.fillStyle = col;
  miniCtx.lineWidth = MINI_CELL * ARROW.shaft * scale;
  miniCtx.lineCap = ARROW.lineCap;
  miniCtx.beginPath();
  miniCtx.moveTo(tailX, tailY);
  miniCtx.lineTo(baseX, baseY);
  miniCtx.stroke();
  var perpX = -uy, perpY = ux;
  miniCtx.beginPath();
  miniCtx.moveTo(tipX, tipY);
  miniCtx.lineTo(baseX + perpX * headWidth / 2, baseY + perpY * headWidth / 2);
  miniCtx.lineTo(baseX - perpX * headWidth / 2, baseY - perpY * headWidth / 2);
  miniCtx.closePath();
  miniCtx.fill();
}

/*==================================================================
 * [#4] PIECE ART BAKING — rasterizes the SVG piece art from
 * pieces.js (PIECE_SVG) to <canvas> at one square's real size on
 * screen (cellPx, SHARPNESS in [#1]) - and again whenever that
 * changes - so renderMiniBoard can drawImage() instead of re-parsing
 * SVG, and each piece lands on the board pixel for pixel.
 * A piece is always drawn into one square in the board's units
 * (MINI_CELL), so a piece from an earlier size still fits its square
 * while the new ones are on their way.
 *==================================================================*/
var pieceArt = {};
var bakeRepaint = null;
// Which baking is the latest: a piece from an earlier one (an older
// size) that arrives late is thrown away.
var pieceBakeGen = 0;
function bakePieces() {
  if (typeof PIECE_SVG === "undefined") {
    pageWarn("pieces.js is missing - no piece art (keep it in the same folder as this page)");
    return;
  }
  var gen = ++pieceBakeGen;
  var size = cellPx();
  ["w", "b"].forEach(function (c) {
    ["k", "q", "r", "b", "n", "p"].forEach(function (t) {
      var id = PIECE_ID[c][t], art = PIECE_SVG[id];
      if (!art) return;
      // xmlns is a namespace label, not a download - a standalone SVG
      // image won't render without it.
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" ' +
        'viewBox="' + PIECE_VIEWBOX + '" width="' + size + '" height="' +
        size + '">' + art + "</svg>";
      var img = new Image();
      img.onerror = function () {
        if (gen === pieceBakeGen) pageWarn("Piece art failed to load: " + id);
      };
      img.onload = function () {
        if (gen !== pieceBakeGen) return; // (an older size)
        var cv = document.createElement("canvas");
        cv.width = size; cv.height = size;
        cv.getContext("2d").drawImage(img, 0, 0, size, size);
        pieceArt[id] = cv;
        clearTimeout(bakeRepaint);
        bakeRepaint = setTimeout(renderMiniBoard, 0);
      };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
  });
}

/*==================================================================
 * [#5] BOARD GEOMETRY HELPERS — 0x88 square <-> on-screen grid
 * index conversion (handles board-flip orientation), plus which
 * squares are tinted/highlighted for the current position.
 *==================================================================*/
var boardOrientation = "w";     // which color sits at the bottom
function boardFlipped() { return boardOrientation === "b"; }

function gridTo0x88(i) {
  var r = Math.floor(i / 8), f = i % 8;
  if (boardFlipped()) { r = 7 - r; f = 7 - f; }
  return (7 - r) * 16 + f;
}

// inverse of gridTo0x88: a 0x88 square
// -> its on-screen grid index (0-63)
function sq0x88ToGridIdx(sq) {
  var r = 7 - (sq >> 4), f = sq & 15;
  if (boardFlipped()) { r = 7 - r; f = 7 - f; }
  return r * 8 + f;
}

function lastMoveGridSqs() {
  if (!game.moves.length) return null;
  var uci = game.moves[game.moves.length - 1];
  if (!uci || uci.length < 4) return null;
  var out = [];
  [uci.slice(0, 2), uci.slice(2, 4)].forEach(function (s) {
    var f = s.charCodeAt(0) - 97, r = s.charCodeAt(1) - 49;
    if (f < 0 || f > 7 || r < 0 || r > 7) return;
    var gr = 7 - r, gf = f;
    if (boardFlipped()) { gr = 7 - gr; gf = 7 - gf; }
    out.push(gr * 8 + gf);
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

// While a move is sliding in, game.pos and currentPly still
// reflect the pre-move state (neither updates until the animation
// finishes - see finishGoToPly), so anything that wants to react to
// the move as it lands - not once it's already landed - needs to
// read the in-flight move directly instead. animOverlay.moveIndex
// (set by animateMove, cleared when it finishes) is exactly that: it
// already drives the from/to square tint and the !!/!? badge below,
// and checkGridSq() and currentDrawings() use it the same way.
function checkGridSq() {
  if (!game.pos) return -1;
  // A wrong or ALT: move parked on the board: the glow is the parked
  // move's - on the king it gives check to, if it does (see
  // showWrongMoveOverlay, [#9]). It goes back to the real position
  // the moment the piece starts sliding home - same as Lichess.
  if (wrongMoveOverlay && wrongMoveOverlay.parked) {
    return wrongMoveOverlay.checkSq >= 0 ? sq0x88ToGridIdx(wrongMoveOverlay.checkSq) : -1;
  }
  var landing = landingOverlay();
  if (landing) {
    if (!/[+#]$/.test(landingSan(landing))) return -1;
    var pk = game.pos.kingSq(sideAfterMove());
    return pk >= 0 ? sq0x88ToGridIdx(pk) : -1;
  }
  if (!game.pos.inCheck(game.pos.turn)) return -1;
  var k = game.pos.kingSq(game.pos.turn);
  return k >= 0 ? sq0x88ToGridIdx(k) : -1;
}

// The red glow drawn on the checked king's square (follows the
// "check highlight" setting, showCheckHighlight trainer.html [#21]).
// It's a round gradient from the square's center; its four colors are
// the --check-halo-* settings in CSS (trainer.css [#2]).
var CHECK_HALO = {
  // How far the gradient reaches, as a fraction of one square. Half
  // a square's diagonal is ~0.707, so 0.708 just reaches the corners
  // and the glow fills the whole square.
  radius: 0.708,
  // Points along that reach (0 = center, 1 = the very end):
  //   midStop - where --check-halo-core has blended into -mid
  //   fadeStop - where it has faded out to fully see-through
  midStop: 0.25,
  fadeStop: 0.89
};

// Paints the glow over the square whose top-left corner is (x, y).
function drawCheckHalo(x, y) {
  var cx = x + MINI_CELL / 2, cy = y + MINI_CELL / 2;
  var halo = miniCtx.createRadialGradient(cx, cy, 0, cx, cy, MINI_CELL * CHECK_HALO.radius);
  halo.addColorStop(0, cssColor("--check-halo-core"));
  halo.addColorStop(CHECK_HALO.midStop, cssColor("--check-halo-mid"));
  halo.addColorStop(CHECK_HALO.fadeStop, hexA(cssColor("--check-halo-fade-start"), 0));
  halo.addColorStop(1, hexA(cssColor("--check-halo-fade-end"), 0));
  miniCtx.fillStyle = halo;
  miniCtx.fillRect(x, y, MINI_CELL, MINI_CELL);
}

// Two independent floating-piece overlays can be on screen at once:
// animOverlay is a move sliding across the board - the opponent's
// reply, or a step forward or back with the < > buttons, for either
// side, in Practice or browse (driven by animateMove's own rAF loop);
// userDragOverlay is whatever the player is physically holding under
// their finger/cursor (driven by pointer events). They're tracked as
// separate globals rather than a single "drag" argument specifically
// so the two loops - one tied to animation frames, one tied to
// pointer events - never have to take turns owning the same render
// call and stomp on each other's overlay; every render just draws
// whichever of the two happen to be set at that moment. hideGrid (on
// either overlay) hides whatever's on that square, used to hide a
// captured piece under an in-flight attacker until it lands.
var animOverlay = null;
var userDragOverlay = null;

// The slide of a move that's still landing (forward). A backward
// slide (a back step, in Practice or browse - see animateMove's
// reverse, [#9]) is only for the eye: the board is already at the
// earlier position under it, so the tint, badges, drawings and check
// glow ignore it and just follow the position, the same as when
// nothing is sliding.
function landingOverlay() { return animOverlay && !animOverlay.reverse ? animOverlay : null; }

// The SAN of the move a landing slide brings in: a book move's, from
// the chapter (animOverlay.moveIndex) - or, for one of your own moves
// on the analysis line (moveIndex null), the SAN the slide carries
// itself (animOverlay.san, from animateMove; its uci comes along too,
// animOverlay.uci, for the game-ending badge - ownMoveEnd, [#6]).
// "" if there's none.
function landingSan(landing) {
  if (landing.moveIndex === null) return landing.san || "";
  var mv = chapterMoves[landing.moveIndex];
  return (mv && mv.san) || "";
}

/*==================================================================
 * [#6] BADGES — everything about the on-board annotation badges, in
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
 * before it slides home ([#9]), is worked out the same way, by the
 * rules - not from the ALT: moves - a parked move that mates gets its
 * "#", one that stalemates its "S", one that leaves too little
 * material its "D" - for as long as it's parked.
 *
 * Outside this section the page only calls three things:
 *   initBadgeLayer() ..... once, from initBoard ([#14])
 *   drawBadges(tint) ..... end of every renderMiniBoard ([#8])
 *   syncBadgeLayer() ..... applyBoardSize ([#13]), mid-resize-drag
 * and badges follow the "Show move annotations" setting
 * (showAnnotations, trainer.html [#21]).
 *
 * Colors and fonts stay in CSS (trainer.css [#2]) with every other
 * color and font on the page. The ones read here:
 *   --badge-text, --badge-shadow ........ glyph, drop shadow
 *   --game-end .......................... the game-ending "#", "S" and
 *                                         "D" discs (one color for
 *                                         all three - the glyph says
 *                                         how the game ended)
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
  // Circle size, as a fraction of one square (MINI_CELL). Bump it to
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

// Extra room (in MINI_PX units) on every side of the badge canvas,
// so a badge on the board's top or right edge can hang past it
// without being cut off. With the insets at 0.5 a disc only pokes
// out half a radius, so a full radius leaves room for the shadow
// too. Push the insets below 0 and this needs to grow to match.
BADGE.margin = MINI_CELL * BADGE.radius;

// ---- b. Symbols --------------------------------------------------
// Eval marks (a move's "eval" in the file: "$10", "$14"... - an
// engine-style verdict on the resulting position, as opposed to
// ANNOTATION_CLASS in trainer.html [#17], which judges the move itself)
// -> the symbol drawn and which --eval-* color its disc uses. Slight
// and moderate advantage would normally use the single combined Unicode
// glyphs "⩲"/"±"/"⩱"/"∓" (U+2A72/U+00B1/U+2A71/U+2213) - one
// character that already looks like a "+" stacked over a "-" or
// "=". In practice that combined glyph renders inconsistently
// (missing entirely in some fonts, oversized/lopsided in others), so
// instead each symbol here is two plain characters joined by "\n"
// and drawn as two separate stacked lines by drawBadge (sized by
// BADGE.stack above) - same idea as the decisive-advantage symbols
// below, just stacked instead of side-by-side.
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
  if (ev) return { symbol: ev.symbol, color: cssColor("--eval-" + ev.cls) };
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
// The badges get their own canvas, laid over #mini with BADGE.margin
// of extra room on every side: #mini can never draw past its own
// edge, and a badge tucked into the board's top-right corner needs
// to. It's created here in the script - there's no <canvas> tag or
// CSS rule for it.
var badgeLayer = null, badgeLayerCtx = null;

function initBadgeLayer() {
  badgeLayer = document.createElement("canvas");
  badgeLayer.id = "badgeLayer";
  // Placed by syncBadgeLayer; taps go straight through to the board.
  badgeLayer.style.position = "absolute";
  badgeLayer.style.pointerEvents = "none";
  // Same spot in #boardFrame as the old <canvas> tag: after the board
  // and the promotion picker, before the resize handle. The picker
  // (z-index 5) and the handle (z-index 3) both still sit on top.
  mini.parentNode.insertBefore(badgeLayer, document.getElementById("boardResizeHandle"));
  badgeLayerCtx = badgeLayer.getContext("2d");
  syncBadgeLayer();

  // The badge is drawn on a <canvas>, which - unlike regular DOM
  // text - doesn't wait for web fonts to finish loading before it
  // paints. If it paints before "Noto Sans" is ready, the canvas
  // silently falls back to Arial (visibly thinner) and, unlike DOM
  // text, never repaints itself once the real font arrives. Asking
  // for the exact face the badges use starts the download of the
  // local font file in trainer.css [#1] right away, and forces one
  // redraw once it's in. The face is built from the same two CSS
  // settings drawBadge uses, so changing either in CSS can't leave this
  // asking for the wrong one.
  //
  // First noticed after updating to iPadOS 27, alongside the
  // ctx.letterSpacing bug in drawBadge below - likely the same WebKit
  // update changed canvas/font-loading timing enough to make this
  // latent bug visible.
  // The board's a-h / 1-8 labels ([#7]) are canvas text too, in Noto
  // Sans by default - so their face is asked for the same way, and
  // the one redraw waits for both.
  if (document.fonts && document.fonts.load) {
    try {
      Promise.all([
        document.fonts.load(canvasFont("--badge-font-weight", 16, "--badge-font-family")),
        document.fonts.load(canvasFont("--board-coord-font-weight", 16, "--board-coord-font-family"))
      ]).then(
        function () { renderMiniBoard(); },
        function () { /* load error: keeps the fallback font */ }
      );
    } catch (err) { /* bad font setting: same, fallback font */ }
  }
}

// Keeps #badgeLayer's on-screen box centered over #mini with a
// margin of BADGE.margin (scaled to whatever size #mini is actually
// rendered at) on every side, and its internal resolution at
// MINI_PX + 2 * BADGE.margin board units, in #mini's own canvas
// pixels (boardScale, SHARPNESS in [#1]) - so it's as sharp as the
// board, and badge-drawing coordinates (which add that same margin
// as an offset - see drawBadge) land in the right place regardless
// of the board's current CSS size. Cheap enough to just call on
// every render rather than only on resize.
function syncBadgeLayer() {
  if (!badgeLayer || !mini) return;
  var rect = mini.getBoundingClientRect();
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
  var res = Math.round((MINI_PX + BADGE.margin * 2) * boardScale());
  if (badgeLayer.width !== res) badgeLayer.width = res;
  if (badgeLayer.height !== res) badgeLayer.height = res;
  var marginCss = BADGE.margin * (rect.width / MINI_PX);
  badgeLayer.style.left = (-marginCss) + "px";
  badgeLayer.style.top = (-marginCss) + "px";
  badgeLayer.style.width = (rect.width + marginCss * 2) + "px";
  badgeLayer.style.height = (rect.height + marginCss * 2) + "px";
}

// ---- e. Drawing --------------------------------------------------
// Repaints the badge layer. Called at the end of every
// renderMiniBoard ([#8]) with that render's tint squares - the last
// move's [from, to] on screen, or null. Up to two badges per move:
//   - the move's own badge (!!, ?, an eval symbol...) on the square
//     the moving piece landed on - book moves only
//   - the game-ending badge, if the move ends the game (a book move's
//     "end", or for one of your own on the analysis line, ownMoveEnd):
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
  // (SHARPNESS, [#1])
  var s = boardScale();
  badgeLayerCtx.setTransform(s, 0, 0, s, 0, 0);
  if (!showAnnotations) return;
  // A wrong or ALT: move of yours parked on the board: it's the last
  // move shown then, so the opponent's badge (a "?" on their mistake,
  // say) would look like it was about your move - it's left off, and
  // comes back as your piece starts sliding home, like Lichess and
  // like the check halo (checkGridSq). In its place: the parked
  // move's own game-ending badge, if it ends the game ("#", "S" or
  // "D" - worked out by the rules in showWrongMoveOverlay, [#9]).
  // Before the tint check: a puzzle's first move has no last move
  // to tint, and can still mate.
  // A promotion waiting on the picker: the same - its squares are
  // tinted as the last move (promoPending, [#10]), so the opponent's
  // badge is left off until it's played or cancelled.
  if (promoPending) return;
  var parked = wrongMoveOverlay && wrongMoveOverlay.parked ? wrongMoveOverlay : null;
  if (parked) {
    drawGameEndBadge(parked.end, parked.toGrid, parked.endKingSq);
    return;
  }
  if (!tint) return;
  var landing = landingOverlay();
  // A move of your own on the analysis line - on the board, or
  // sliding in (moveIndex null): only how the game ends, worked out
  // by the board itself (ownMoveEnd); the book's badges belong to the
  // book's moves.
  if (landing ? landing.moveIndex === null : onAnalysisLine()) {
    drawGameEndBadge(ownMoveEnd(landing), tint[1]);
    return;
  }
  var moveIdx = landing ? landing.moveIndex : currentPly - 1;
  if (moveIdx < 0) return;
  var mv = chapterMoves[moveIdx];
  var spec = badgeSpecFor(mv);
  if (spec && !(mv && mv.end === "draw")) drawBadge(tint[1], spec);
  drawGameEndBadge(mv && mv.end, tint[1]);
  // A solved puzzle: a checkmark on its last move - unless that move
  // mated, stalemated or drew, whose badge already marks the end.
  if (listMode === "puzzle" && moveIdx === chapterMoves.length - 1 && !(mv && mv.end)) {
    drawBadge(tint[1], { symbol: "checkmark", color: cssColor("--good") });
  }
}

// The game-ending badge for `end` ("mate", "stalemate", "draw", or
// nothing): "#" or "S" on the king of the side that didn't make the
// move - found on the board itself (sideAfterMove, [#5]), so it's
// right even while the move is still sliding in - or "D" on the
// move's landing square (landingGrid).
// kingSq (0x88, optional): the king to put "#" or "S" on, for a
// parked wrong or ALT: move ([#9]) - game.pos doesn't hold that move,
// so the side to move there is still yours, not the mated side.
function drawGameEndBadge(end, landingGrid, kingSq) {
  if (!end) return;
  var color = cssColor("--game-end");
  if (end === "draw") { drawBadge(landingGrid, { symbol: "D", color: color }); return; }
  var k = kingSq !== undefined ? kingSq : game.pos.kingSq(sideAfterMove());
  if (k >= 0) drawBadge(sq0x88ToGridIdx(k), { symbol: end === "mate" ? "#" : "S", color: color });
}

// Draws one badge - a colored disc with a glyph on it, per the
// settings in section a - tucked into the top-right corner of the
// given on-screen grid square (0-63).
function drawBadge(gridSq, spec) {
  var ctx = badgeLayerCtx;
  var br = MINI_CELL * BADGE.radius;
  var bx = (gridSq % 8) * MINI_CELL, by = Math.floor(gridSq / 8) * MINI_CELL;
  // Disc center. BADGE.margin shifts everything into the layer's
  // extra room (see syncBadgeLayer).
  var bcx = BADGE.margin + bx + MINI_CELL - br * BADGE.insetX;
  var bcy = BADGE.margin + by + br * BADGE.insetY;

  ctx.save(); // everything set below is undone at the end

  // The disc, with its drop shadow. The shadow is set only inside
  // this inner save/restore so it doesn't also land under the glyph.
  // A shadow's sizes are in real canvas pixels - the canvas doesn't
  // scale them with everything else - so they're scaled here
  // (boardScale, SHARPNESS in [#1]).
  var px = boardScale();
  ctx.save();
  ctx.shadowColor = hexA(cssColor("--badge-shadow"), BADGE.shadow.opacity);
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
    ctx.strokeStyle = cssColor("--badge-text");
    ctx.lineWidth = 5;
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.stroke(new Path2D("M5 12l5 5l10 -10"));
    ctx.restore();
    return;
  }

  // The glyph.
  var fontPx = Math.round(br * BADGE.fontScale);
  ctx.font = canvasFont("--badge-font-weight", fontPx, "--badge-font-family");
  ctx.textBaseline = "middle";
  ctx.fillStyle = cssColor("--badge-text");
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
    ctx.font = canvasFont("--badge-font-weight", Math.round(fontPx * BADGE.stack.fontScale), "--badge-font-family");
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
 * [#7] COORDINATES & MATERIAL COUNT — the a-h / 1-8 labels along the
 * board's bottom and right edges, and the material-difference number
 * in a corner square. Both are plain text in the same small font
 * (--board-coord-font-family, the page's own Noto Sans, at
 * --board-coord-font-weight - trainer.css [#2]), each in a color that
 * shows up against the square it's on: --board-coord-on-light on a
 * light square, --board-coord-on-dark on a dark one (trainer.css
 * [#2]; coordColor, below).
 * renderMiniBoard ([#8]) draws them on the squares, under the
 * pieces, as Lichess does - a piece standing on one covers it.
 *==================================================================*/

// Sizes and gaps, as fractions of one square (MINI_CELL). The gaps
// are measured to the letters and numbers themselves - not to the
// space the font leaves around them - so they stay as set here in
// any font (fillCoordText, below).
var COORDS = {
  fontSize: 0.21,
  // Gap from a square's left edge: the file letters (a-h) and the
  // material count.
  padX: 0.0625,
  // Gap from the board's right edge: the rank numbers (1-8). The
  // numbers line up on their right, so a narrow "1" sits as far
  // right as an "8".
  padRight: 0.06,
  // Gap from a square's top edge: the rank numbers and the material
  // count.
  padTop: 0.09,
  // Gap from the board's bottom edge up to the letters' baseline -
  // the bottom of every letter but the "g", which hangs below it.
  padBottom: 0.065
};

// The label color for the square with grid index i (0-63): the
// lighter one on a dark square, the darker one on a light square -
// Lichess's colors by default (trainer.css [#2]).
function coordColor(i) {
  return sqClass(i) === 0 ? cssColor("--board-coord-on-light") : cssColor("--board-coord-on-dark");
}

// The coordinate font, set on the board canvas - shared by both.
function setCoordFont() {
  miniCtx.font = canvasFont("--board-coord-font-weight", Math.round(MINI_CELL * COORDS.fontSize),
    "--board-coord-font-family");
  miniCtx.textBaseline = "alphabetic";
  miniCtx.textAlign = "left";
}

// Draws `text` with its baseline at y and the glyph itself starting
// at x - or, with alignRight, ending at x - leaving out the bit of
// space a font puts either side of a character.
function fillCoordText(text, x, y, alignRight) {
  var m = miniCtx.measureText(text);
  miniCtx.fillText(text, alignRight ? x - m.actualBoundingBoxRight : x + m.actualBoundingBoxLeft, y);
}

// How far the tops of the numbers sit above their baseline, in the
// coordinate font (setCoordFont first) - so a number can be placed
// by its top.
function digitAscent() {
  return miniCtx.measureText("12345678").actualBoundingBoxAscent;
}

// Files along the bottom row, ranks down the right-hand column -
// reversed when the board is flipped.
function drawCoordinates(flip) {
  setCoordFont();
  var letterY = MINI_PX - MINI_CELL * COORDS.padBottom;
  var numberX = MINI_PX - MINI_CELL * COORDS.padRight;
  var numberY = MINI_CELL * COORDS.padTop + digitAscent();
  for (var f = 0; f < 8; f++) {
    miniCtx.fillStyle = coordColor(56 + f);
    fillCoordText(BOARD_FILES[flip ? 7 - f : f], f * MINI_CELL + MINI_CELL * COORDS.padX, letterY);
  }
  for (var r = 0; r < 8; r++) {
    miniCtx.fillStyle = coordColor(r * 8 + 7);
    fillCoordText(String(flip ? r + 1 : 8 - r), numberX, r * MINI_CELL + numberY, true);
  }
}

// Material count - a plain number (no +/- sign, so it can't crowd
// into a corner piece's silhouette) tucked into the upper-left
// corner of the LEADING side's own home-rank square on the left
// edge of the board: White's number sits in a1 (screen bottom-left
// unflipped, top-left flipped), Black's in a8 (top-left unflipped,
// bottom-left flipped) - i.e. always that side's own back-rank
// corner, wherever it currently is on screen. Same corner gaps
// (COORDS.padX / padTop) as the coordinate labels, and under the
// pieces like them. Nothing drawn at material equality. Follows the
// "material count" setting (showMaterialCount, trainer.html [#21]).
function drawMaterialCount(board, flip) {
  if (!showMaterialCount) return;
  var matDiff = materialDiff(board);
  if (matDiff === 0) return;
  setCoordFont();
  // White's home rank (1) sits at screen row 0 when flipped, row
  // 7 otherwise; Black's home rank (8) is whichever row White's
  // isn't. Both are always in the leftmost column (file a or h).
  var matRow = ((matDiff > 0) === flip) ? 0 : 7;
  miniCtx.fillStyle = coordColor(matRow * 8);
  fillCoordText(String(Math.abs(matDiff)), MINI_CELL * COORDS.padX,
    matRow * MINI_CELL + MINI_CELL * COORDS.padTop + digitAscent());
}

// The material difference on the board right now, in standard point
// values (king excluded). A pure snapshot of the current position
// rather than a running tally of captures, so it stays correct
// through promotions and undos the same way Lichess's own material
// count does - no separate bookkeeping needed anywhere a move gets
// made, retried, or premoved.

var MATERIAL_PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
function materialDiff(board) {
  var diff = 0;
  for (var i = 0; i < 128; i++) {
    if (i & 0x88) continue; // off-board half of the 0x88 array
    var c = board[i];
    if (!c) continue;
    var val = MATERIAL_PIECE_VALUE[c.toLowerCase()] || 0;
    diff += (c === c.toUpperCase()) ? val : -val;
  }
  return diff;
}

/*==================================================================
 * [#8] RENDER LOOP — what's hidden this frame (mid-animation
 * pieces), which squares are tinted, and the main paint routine.
 *==================================================================*/
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
    // a castling rook's own home square, and so on (see showWrongMoveOverlay)
    for (var w = 0; w < wrongMoveOverlay.extras.length; w++) {
      var ex = wrongMoveOverlay.extras[w];
      if (ex.fromGrid === i || ex.hideGrid === i) return true;
    }
  }
  // a promotion waiting on the picker: the pawn's own square, and
  // whatever it captures (the pawn is drawn there instead - see
  // promoPending, [#10])
  var promo = promoPendingGridSqs();
  if (promo && promo.indexOf(i) >= 0) return true;
  return !!(userDragOverlay && (userDragOverlay.fromGrid === i || userDragOverlay.hideGrid === i));
}
// Draws a piece image centered on (cx, cy) in board pixels, nudged
// in if needed so it never hangs off the board's edge - used for a
// move's sliding piece(s) and a wrong move's piece sliding back.
function drawFloatingPiece(art, cx, cy) {
  var half = MINI_CELL / 2;
  var px = Math.max(half, Math.min(MINI_PX - half, cx));
  var py = Math.max(half, Math.min(MINI_PX - half, cy));
  miniCtx.drawImage(art, px - half, py - half, MINI_CELL, MINI_CELL);
}

// From/to squares of the primary moving piece in animOverlay (the
// king, on a castling move - pieces[0] is always the piece the move
// itself is about; the rook is an appended visual companion) so only
// that gets the "just moved" tint, matching how a manually-played
// castle only tints the king's squares.
function animOverlayTintSqs() {
  if (animOverlay && animOverlay.pieces && animOverlay.pieces[0]) {
    return [animOverlay.pieces[0].fromGrid, animOverlay.pieces[0].toGrid];
  }
  return [];
}
function renderMiniBoard() {
  if (!miniCtx) return;
  var board = game.pos.board;
  // Everything below is in board units, scaled to the canvas's real
  // pixels (SHARPNESS, [#1]). Set on every paint: a new canvas size
  // resets it.
  var s = boardScale();
  miniCtx.setTransform(s, 0, 0, s, 0, 0);

  // While a move is sliding in, tint its from/to squares
  // immediately (from the first frame) rather than waiting for
  // lastMoveGridSqs(), which only reflects game.moves once the move
  // has actually landed at the end of the animation.
  // A promotion waiting on the picker tints its own two squares
  // instead, as if already played (promoPending, [#10]).
  var tint = promoPendingGridSqs() ||
    (landingOverlay() ? animOverlayTintSqs() : lastMoveGridSqs());
  var checkSq = checkGridSq();
  var selSq = touchSelGridSq();
  for (var i = 0; i < 64; i++) {
    var x = (i % 8) * MINI_CELL, y = Math.floor(i / 8) * MINI_CELL;
    var moved = showLastMoveHighlight && tint && tint.indexOf(i) >= 0;
    var chosen = i === selSq;
    miniCtx.fillStyle = sqClass(i) === 0
      ? (chosen ? cssColor("--board-light-selected") : moved ? cssColor("--board-light-last-move") : cssColor("--board-light"))
      : (chosen ? cssColor("--board-dark-selected") : moved ? cssColor("--board-dark-last-move") : cssColor("--board-dark"));
    miniCtx.fillRect(x, y, MINI_CELL, MINI_CELL);
    // Wrong move (red) / ALT: move (blue):
    // tint the square the piece was just dropped on,
    // in place of the old Retry/Alternative pill. wrongMoveOverlay.
    // tintAlpha starts at 1 while parked and fades to 0 in step with
    // the piece's slide back to origin (see clearWrongMoveOverlay) -
    // opaque here, painted straight over the base square color.
    if (wrongMoveOverlay && i === wrongMoveOverlay.toGrid && wrongMoveOverlay.tintAlpha > 0) {
      var wc = wrongMoveOverlay.isAlt ? cssColor("--board-alt-move") : cssColor("--board-wrong-move");
      miniCtx.fillStyle = hexA(wc, wrongMoveOverlay.tintAlpha);
      miniCtx.fillRect(x, y, MINI_CELL, MINI_CELL);
    }
    // see checkGridSq
    if (showCheckHighlight && i === checkSq) drawCheckHalo(x, y);
  }

  // a-h / 1-8 labels and the material count - see [#7]. On the
  // squares but under the pieces, as on Lichess: a piece standing on
  // one covers it.
  var flip = boardFlipped();
  drawCoordinates(flip);
  drawMaterialCount(board, flip);

  // The pieces, over all of that.
  for (var j = 0; j < 64; j++) {
    var p = board[gridTo0x88(j)];
    if (!p || overlayHidesGrid(j)) continue;
    var art = pieceArt[PIECE_ID[p === p.toUpperCase() ? "w" : "b"][p.toLowerCase()]];
    if (art) miniCtx.drawImage(art, (j % 8) * MINI_CELL, Math.floor(j / 8) * MINI_CELL, MINI_CELL, MINI_CELL);
  }
  // A promotion waiting on the picker: the pawn on the promotion
  // square, under the picker (promoPending, [#10]).
  var promo = promoPendingGridSqs();
  if (promo && promoPending.art) {
    miniCtx.drawImage(promoPending.art, (promo[1] % 8) * MINI_CELL, Math.floor(promo[1] / 8) * MINI_CELL,
      MINI_CELL, MINI_CELL);
  }

  // The move's circles and arrows - see [#3]. On top of the board and
  // pieces, underneath whatever's actively animating or being
  // dragged right now. They're animation-aware, so they paint in
  // sync with the animation's start rather than lagging behind it.
  drawBoardShapes();
  // Stockfish's best-move arrows, on top of the chapter's own
  // drawings (browse mode with the engine on only - see
  // trainer.html [#22]).
  ENGINE.drawArrows();

  // The sliding piece(s) first, the player's held piece on top -
  // if both happen to overlap in flight, the piece the player is
  // actively controlling should stay the visually dominant one.
  // Normally one piece (animOverlay.pieces has one entry); on a
  // castling move it has two (king + rook), sliding in lockstep.
  if (animOverlay && animOverlay.pieces) {
    for (var ai = 0; ai < animOverlay.pieces.length; ai++) {
      var apc = animOverlay.pieces[ai];
      drawFloatingPiece(apc.art, apc.x, apc.y);
    }
  }

  // The piece from a just-rejected move (wrong move, or one of the
  // ALT: moves) - drawn wherever it currently sits: parked on the
  // square the player dropped it on while the Retry/Alternative
  // message shows, then sliding back to its origin square once that
  // clears (see showWrongMoveOverlay/clearWrongMoveOverlay). Purely
  // visual - game.pos itself was never touched by this move.
  // On a wrong castle the rook (an "extra") is drawn too, so the
  // whole castle shows, not just the king.
  if (wrongMoveOverlay) {
    for (var wi = 0; wi < wrongMoveOverlay.extras.length; wi++) {
      var wex = wrongMoveOverlay.extras[wi];
      drawFloatingPiece(wex.art, wex.x, wex.y);
    }
    drawFloatingPiece(wrongMoveOverlay.art, wrongMoveOverlay.x, wrongMoveOverlay.y);
  }

  // The player's own held piece isn't drawn here - it's shown
  // by the floating #dragGhost element instead (see showDragGhost/
  // moveDragGhost), which can follow the pointer past the board's
  // edge. userDragOverlay itself still exists and still drives
  // overlayHidesGrid() above, so the origin square stays empty while
  // dragging.

  // The !!/?/#/eval badges, on their own canvas above the board -
  // see [#6].
  drawBadges(tint);
}

/*==================================================================
 * [#9] MOVE ANIMATION — slides a piece between two squares, and
 * the "parked then returns" animation for a wrong or ALT: move.
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
// (see renderMiniBoard) so it keeps animating even while the player
// is simultaneously dragging their own piece around - the two no
// longer have to take turns owning a single "drag" render argument.
var animFrame = null;
// Builds the static (pre-animation) geometry for one sliding piece:
// its art, its from/to grid squares, and the pixel start/end points
// it travels between. Returns null if there's no art for the square
// (shouldn't normally happen for a real move).
function animPieceSpec(from, to) {
  var p = game.pos.board[from];
  var art = p && pieceArt[PIECE_ID[p === p.toUpperCase() ? "w" : "b"][p.toLowerCase()]];
  if (!art) return null;
  var fromGrid = sq0x88ToGridIdx(from);
  var toGrid = sq0x88ToGridIdx(to);
  return {
    art: art, fromGrid: fromGrid, toGrid: toGrid,
    fx: (fromGrid % 8) * MINI_CELL + MINI_CELL / 2, fy: Math.floor(fromGrid / 8) * MINI_CELL + MINI_CELL / 2,
    tx: (toGrid % 8) * MINI_CELL + MINI_CELL / 2, ty: Math.floor(toGrid / 8) * MINI_CELL + MINI_CELL / 2,
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
// this - it's a purely visual stand-in drawn by renderMiniBoard,
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
//     parked (checkGridSq, [#5])
//   - game over: a move that mates, stalemates or leaves too little
//     material to mate gets its "#", "S" or "D" while it's parked
//     (drawBadges, [#6]) - worked out by the rules, wrong move or
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
    spec.epGrid = sq0x88ToGridIdx(victim);
  }

  // Promotion: parked as the promoted piece, slides home as a pawn.
  spec.homeArt = spec.art;
  if (m.promotion) {
    var promoArt = pieceArt[PIECE_ID[m.color][m.promotion]];
    if (promoArt) spec.art = promoArt;
  }

  spec.isAlt = !!isAlt;
  // full-strength square tint while parked; fades in
  // clearWrongMoveOverlay
  spec.tintAlpha = 1;
  // true while the piece sits on the wrong square, false once it
  // starts sliding home - while it's parked, the check glow follows
  // the parked move, not the real position (see checkGridSq)
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
  // [#6]). Worked out by the rules, never read from the ALT: moves,
  // and for wrong moves too. endKingSq: the king of the side that
  // didn't move - where "#" or "S" goes (drawBadges, [#6]).
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
  if (!animate) { wrongMoveOverlay = null; renderMiniBoard(); return; }
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
    renderMiniBoard();
    if (t < 1) {
      wrongMoveAnimFrame = requestAnimationFrame(step);
    } else {
      wrongMoveAnimFrame = null;
      wrongMoveOverlay = null;
      renderMiniBoard();
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
// lands (landingSan, [#5]; ownMoveEnd, [#6]).
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
    renderMiniBoard();
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
 * [#10] CLICK-TO-MOVE — tap a piece, then tap where it goes.
 * Practice mode: active on the practice player's turn (plus
 * premoves).
 * Browse mode: active for whichever side is to move, so you
 * can play both sides freely - see the analysis line in
 * trainer.html [#14]. A finished move (with the promotion picker first,
 * when it's a promotion) is handed to tryPlayMove (trainer.html [#16]),
 * which decides whether it's right.
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
// No input either once the game is over on the board (gameOverOnBoard):
// checkmate and stalemate leave no moves anyway, and a draw by too
// little material ends the game too, though moves would still be
// legal - so the analysis line can't be played on past its "D" (and
// the engine says "Draw" instead of showing lines - engine.js). To
// play something else, step back.
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
// Remembered per position (game.pos is a new object after every move),
// as it's asked on every redraw.
var gameOverCache = { pos: null, over: false };
function gameOverOnBoard() {
  if (gameOverCache.pos !== game.pos) gameOverCache = { pos: game.pos, over: !!game.pos.gameEnd() };
  return gameOverCache.over;
}

function practiceActive() {
  return !!inputPosition();
}

function touchSelGridSq() {
  if (touchSelSq < 0) return -1;
  var ip = practiceActive() ? inputPosition() : null;
  var p = ip ? ip.board[touchSelSq] : null;
  var mine = p && (ip.turn === "w") === (p === p.toUpperCase());
  if (!mine) { touchSelSq = -1; return -1; }
  var r = 7 - (touchSelSq >> 4), f = touchSelSq & 15;
  if (boardFlipped()) { r = 7 - r; f = 7 - f; }
  return r * 8 + f;
}

function tapTo0x88(e) {
  var rect = mini.getBoundingClientRect();
  if (!rect.width || !rect.height) return -1;
  var f = Math.floor((e.clientX - rect.left) * 8 / rect.width);
  var r = Math.floor((e.clientY - rect.top) * 8 / rect.height);
  if (f < 0 || f > 7 || r < 0 || r > 7) return -1;
  return gridTo0x88(r * 8 + f);
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
// move before it (renderMiniBoard, [#8]). The opponent's badge is
// left off meanwhile, as for a parked wrong move (drawBadges, [#6]).
// Picking a piece plays the move as normal; cancelling (pressing
// anywhere else - trainer.html [#23]) puts the pawn back at once.
var promoPending = null;

// The pending promotion's [from, to] on screen, or null.
function promoPendingGridSqs() {
  if (!promoPending) return null;
  return [sq0x88ToGridIdx(promoPending.from), sq0x88ToGridIdx(promoPending.to)];
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
    art: pawn ? pieceArt[PIECE_ID[candidates[0].color][pawn.toLowerCase()]] : null
  };
  renderMiniBoard();

  // Anchor the choices to the promotion square itself, stacked toward
  // the center of the board (queen first, right at the square the
  // pawn landed on) rather than a generic centered popup.
  var toGrid = sq0x88ToGridIdx(candidates[0].to);
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
    var art = pieceArt[PIECE_ID[mv.color][mv.promotion]];
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
  renderMiniBoard();
}

function onBoardTap(e) {
  if (!practiceActive()) return;
  var sq = tapTo0x88(e);
  if (sq < 0) return;
  var legal = inputPosition().legalMoves();

  if (touchSelGridSq() >= 0 && sq !== touchSelSq) {
    var found = legal.filter(function (m) { return m.from === touchSelSq && m.to === sq; });
    if (found.length) {
      touchSelSq = -1;
      renderMiniBoard();
      pickMoveFromCandidates(found, tryPlayMove);
      return;
    }
  }

  var can = sq !== touchSelSq && legal.some(function (m) { return m.from === sq; });
  touchSelSq = can ? sq : -1;
  renderMiniBoard();
}

/*==================================================================
 * [#11] DRAG-TO-MOVE — layered on top of the tap logic above. A
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

// The floating drag-ghost piece (see #dragGhost CSS) - a separate,
// screen-space element that takes over showing the dragged piece
// once a drag actually starts, so it can visually go anywhere on the
// page rather than being confined to the #mini canvas. dragGhostCtx
// draws the piece art into it once per drag (not per frame); after
// that, moving it is just a cheap CSS transform update. Assigned in
// initBoard(), same as mini/miniCtx. It's given as many pixels as the
// piece has (one square's real size - SHARPNESS, [#1]), so it's as
// sharp as the pieces on the board.
var dragGhost = null, dragGhostCtx = null;

function showDragGhost(art, clientX, clientY) {
  var size = art ? art.width : dragGhost.width;
  if (dragGhost.width !== size) { dragGhost.width = size; dragGhost.height = size; }
  dragGhostCtx.clearRect(0, 0, size, size);
  if (art) dragGhostCtx.drawImage(art, 0, 0, size, size);
  var rect = mini.getBoundingClientRect();
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
  var rect = mini.getBoundingClientRect();
  if (!rect.width || !rect.height) return { x: 0, y: 0 };
  return {
    x: (e.clientX - rect.left) * (MINI_PX / rect.width),
    y: (e.clientY - rect.top) * (MINI_PX / rect.height)
  };
}

function onPointerDown(e) {
  if (!practiceActive()) return;
  var sq = tapTo0x88(e);
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
  ptr.fromGrid = sq0x88ToGridIdx(sq);
  ptr.art = mine ? pieceArt[PIECE_ID[p === p.toUpperCase() ? "w" : "b"][p.toLowerCase()]] : null;
  if (mini.setPointerCapture) { try { mini.setPointerCapture(e.pointerId); } catch (err) {} }
}

function onPointerMove(e) {
  if (ptr.id === null || e.pointerId !== ptr.id || !ptr.canDrag) return;
  if (!ptr.dragging) {
    var dx = e.clientX - ptr.downX, dy = e.clientY - ptr.downY;
    if (Math.abs(dx) <= TAP_SLOP && Math.abs(dy) <= TAP_SLOP) return; // still a tap
    ptr.dragging = true;
    touchSelSq = ptr.fromSq;
    mini.classList.add("dragging");
    showDragGhost(ptr.art, e.clientX, e.clientY);
  }
  e.preventDefault();
  // xy (canvas-local, scaled to the internal MINI_PX space) still
  // drives hit-testing/highlighting via userDragOverlay.fromGrid, but
  // doesn't position anything visually - the ghost above uses raw
  // clientX/clientY instead, which is what lets it travel past the
  // board's own edge.
  var xy = pointerToCanvasXY(e);
  userDragOverlay = { fromGrid: ptr.fromGrid, x: xy.x, y: xy.y, art: ptr.art };
  moveDragGhost(e.clientX, e.clientY);
  renderMiniBoard();
}

function endDrag() {
  ptr.id = null;
  ptr.dragging = false;
  ptr.canDrag = false;
  userDragOverlay = null;
  mini.classList.remove("dragging");
  hideDragGhost();
}

function onPointerUp(e) {
  if (ptr.id === null || e.pointerId !== ptr.id) return;
  var wasDragging = ptr.dragging;
  var fromSq = ptr.fromSq;
  if (mini.releasePointerCapture) { try { mini.releasePointerCapture(e.pointerId); } catch (err) {} }
  endDrag();

  if (!wasDragging) { onBoardTap(e); return; }

  var toSq = tapTo0x88(e);
  // (Input can switch off mid-drag - a browse step starting to slide
  // in - so there may be no position to drop on: it just snaps back.)
  var ip = inputPosition();
  var legal = ip ? ip.legalMoves() : [];
  var found = toSq >= 0 ? legal.filter(function (m) { return m.from === fromSq && m.to === toSq; }) : [];
  touchSelSq = -1;
  if (found.length) {
    renderMiniBoard();
    pickMoveFromCandidates(found, tryPlayMove);
  } else {
    renderMiniBoard();
  }
}

function onPointerCancel(e) {
  if (ptr.id === null || e.pointerId !== ptr.id) return;
  endDrag();
  touchSelSq = -1;
  renderMiniBoard();
}

/*==================================================================
 * [#12] TOUCH EVENT WIRING — attaches the tap/drag handlers above
 * to the board canvas, once.
 *==================================================================*/
var touchWired = false;
function initTouch() {
  if (!mini || touchWired) return;
  touchWired = true;
  mini.addEventListener("pointerdown", onPointerDown);
  mini.addEventListener("pointermove", onPointerMove);
  mini.addEventListener("pointerup", onPointerUp);
  mini.addEventListener("pointercancel", onPointerCancel);
  blockTouchGestures(mini);
}

// iPadOS's own long-press gestures - the magnifying loupe, the
// copy / look-up callout, text selection - start from a finger held
// still, and CSS (touch-action, user-select) doesn't reliably stop
// them: holding a piece before dragging it could bring up the loupe.
// Cancelling each touch as it starts (touchstart) keeps them from ever
// starting. The board only listens to pointer events, which still all
// come through; what's lost is the browser's own click after a tap,
// which nothing here uses. (Used on the board and its resize handle,
// [#13].)
function blockTouchGestures(node) {
  node.addEventListener("touchstart", function (e) { e.preventDefault(); }, { passive: false });
}

/*==================================================================
 * [#13] BOARD RESIZE HANDLE — lets the user drag the board to
 * whatever size they want (like Lichess's own bottom-right grip),
 * by writing directly to the --board-size CSS variable that drives
 * the page grid's first column (trainer.css [#4]) and canvas#mini's
 * max-width. While the grip is dragged, the board's canvas is only
 * stretched with CSS (and the badge layer moved to match #mini's
 * on-screen box); once the size stays put, the board is drawn again
 * at its new real size so it's sharp (SHARPNESS, [#1]). The size is
 * snapped to a multiple of 8 screen pixels for that (4 CSS pixels on
 * an iPad), so every square is a whole number of pixels.
 *
 * HOW BIG AND HOW SMALL - set by the button row (trainer.css [#7]),
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
 * layout (one column, trainer.css [#16]) the board can grow to the
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
// The board size is saved with the other settings (trainer.html [#21]),
// as "boardSize".
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
// of them (SHARPNESS, [#1]). Then the board is drawn again at that
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
  scheduleBoardResolution();
  return snapped;
}

// Re-derives the on-screen size from the saved preference using a
// fresh measurement. Call this whenever the viewport may have
// changed (window resize, orientation change, page load settling,
// a pinch-zoom) - it can never compound into a permanent shrink
// since it always starts from boardSizeDesired, not from the
// currently-applied size. A pinch-zoom doesn't change the size, only
// how many screen pixels it covers - so the board's sharpness is
// checked again either way (SHARPNESS, [#1]).
function reapplyBoardSize() {
  if (boardSizeDesired != null) applyBoardSize(boardSizeDesired);
  scheduleBoardResolution();
}

// Restores a previously-saved board size - or, with none saved yet,
// the starting size from the CSS (--board-size, trainer.css [#2]) -
// and applies it, kept within what fits. Called before the first
// render so there's no flash of the wrong size.
function restoreBoardSize() {
  var saved = parseInt(loadSettings().boardSize, 10);
  boardSizeDesired = saved > 0 ? saved : (parseFloat(cssVar("--board-size", "")) || null);
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
  // (no loupe while the grip is held - see blockTouchGestures, [#12])
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
 * [#14] BOARD INIT — grabs the canvas elements, sizes them for the
 * screen and bakes piece art.
 *==================================================================*/
function initBoard() {
  mini = document.getElementById("mini");
  miniCtx = mini.getContext("2d");
  dragGhost = document.getElementById("dragGhost");
  dragGhostCtx = dragGhost.getContext("2d");
  initBadgeLayer();
  // The board's canvas at its real size on screen straight away, so
  // the first paint is sharp (SHARPNESS, [#1]) - that bakes the
  // pieces too. If it's that size already, they're baked here.
  if (!syncBoardResolution()) bakePieces();
  renderMiniBoard();
  initTouch();
}

/*==================================================================
 * [#15] BOARD — the board's one way in. The rest of the page (and
 * engine.js) uses the board only through these. Everything else in
 * this file is the board's own business.
 * The board in turn reads the page's state (the position, the
 * current move, the mode, the Show... switches) and hands every move
 * the player makes to tryPlayMove (trainer.html [#16]).
 *==================================================================*/
var BOARD = {
  // Once, at start-up, after the saved settings are loaded: the
  // saved board size, the canvases and piece art, the resize grip.
  init: function () {
    restoreBoardSize();
    initBoard();
    initBoardResize();
  },
  // Repaint the board (and its badge layer).
  render: function () { renderMiniBoard(); },
  // Which color sits at the bottom: "w" or "b".
  setOrientation: function (color) { boardOrientation = color; },
  // Slide a move (the opponent's reply in practice, or any single
  // step forward or back, for either side, in practice or browse - on
  // the book line or the analysis line), then call onDone - or, with
  // sliding turned off (ANIMATE_MOVES, [#9]), call onDone at once.
  // moveIndex is the book move's index in chapterMoves, or null for a
  // move on the analysis line (its SAN and uci then in move.san and
  // move.uci - see animateMove, [#9]). reverse = true slides it
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
  // Forget the tapped (selected) square.
  clearSelection: function () { touchSelSq = -1; },
  // Close the promotion picker, if it's open.
  closePromoPicker: function () { hidePromoPicker(); },
  // One arrow on the board - engine.js draws its arrows with this.
  drawArrow: function (arrow, opts) { drawArrow(arrow, opts); }
};
