/*==================================================================
 * icons.js — UI ICONS for the trainer page
 *
 * Every small interface icon, as inline SVG markup. Two ways in:
 *  - Page markup: any element with data-icon="name" gets that icon
 *    put inside it as soon as this file runs (see the bottom). That
 *    is why the <script src="icons.js"> tag sits AFTER the page
 *    markup - the elements have to exist already.
 *  - Code: the trainer reads some icons directly to swap a button's
 *    icon: ICONS.play / ICONS.stop (practice button), ICONS.next
 *    (>> at the end of a line: the next chapter), and
 *    ICONS.calendar / ICONS.shuffle / ICONS.puzzle / ICONS.library
 *    (the mode button and the rows of its menu: spaced repetition /
 *    random openings / puzzles / the Library).
 *  The buttons under the board use data-icon: "settings" (gear),
 *  "link" (Link), "comment" (speech bubble), "chart" (explorer),
 *  "threat" (crosshair) and "engine" (chip) - and the Settings
 *  menu's data-page button, "folder".
 *
 * The icons on the buttons under the board are all drawn to fill
 * about the same share of their 24x24 box, with the same 2px line
 * width, so they look the same size side by side.
 *
 * Icons drawn with "currentColor" take their color from the CSS of
 * whatever they sit in (hover/active colors, theme tokens), just as
 * they did when they were written straight into the page. Sizes come
 * from the page CSS too (e.g. button.ctrl svg.icon).
 *
 * Icons from Feather, Lucide and Tabler say so in their comments;
 * their licenses are in CREDITS.md. The rest are the trainer's own.
 *
 * To change an icon, replace its string with another 24x24 SVG.
 * Keep this file in the same folder as the trainer page.
 *==================================================================*/
var ICONS = {
  // diagonal grip, bottom-right corner of the board
  resize:
    '<svg viewBox="0 0 24 24"><path d="M4 20L20 4M11 20L20 11" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  // gear - the Settings button, under the board. Feather "settings"
  // (feathericons.com, MIT license), unchanged.
  settings:
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  // crosshair - the Threat button, under the board. Lit blue while
  // threat mode is on, like the other "on" buttons (the page CSS).
  threat:
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.3" fill="currentColor" stroke="none"/><path d="M12 1.5v4.5M12 18v4.5M1.5 12h4.5M18 12h4.5"/></svg>',
  // computer chip - the Engine button (Stockfish), under the board.
  // Based on Tabler Icons "cpu" (tabler.io/icons, MIT license),
  // enlarged to fill the box like the other buttons' icons.
  engine:
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5a1.5 1.5 0 0 1 1.5 -1.5h13a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1 -1.5 1.5h-13a1.5 1.5 0 0 1 -1.5 -1.5z"/><path d="M8.5 8.5h7v7h-7z"/><path d="M1.5 9.5h2.5M1.5 14.5h2.5M20 9.5h2.5M20 14.5h2.5M9.5 1.5v2.5M14.5 1.5v2.5M9.5 20v2.5M14.5 20v2.5"/></svg>',
  // calendar - mode button: spaced-repetition list
  calendar:
    '<svg class="icon" viewBox="0 0 24 24" fill="none"><rect x="2.5" y="4" width="19" height="17.5" rx="2" stroke="currentColor" stroke-width="2"/><path d="M2.5 9h19" stroke="currentColor" stroke-width="2"/><path d="M7.5 1.75v4.5M16.5 1.75v4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="7.5" cy="14.75" r="1.35" fill="currentColor"/><circle cx="12" cy="14.75" r="1.35" fill="currentColor"/><circle cx="16.5" cy="14.75" r="1.35" fill="currentColor"/></svg>',
  // shuffle arrows - mode button: random openings. Tabler Icons
  // "arrows-shuffle" (tabler.io/icons, MIT license), unchanged.
  shuffle:
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 4l3 3l-3 3M18 20l3 -3l-3 -3M3 7h3a5 5 0 0 1 5 5a5 5 0 0 0 5 5h5M21 7h-5a4.978 4.978 0 0 0 -3 1m-4 8a4.984 4.984 0 0 1 -3 1h-3"/></svg>',
  // jigsaw piece, tilted - mode button: puzzles. Lucide "puzzle"
  // (lucide.dev, ISC license), unchanged.
  puzzle:
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z"/></svg>',
  // Settings > Date: previous day
  chevronLeft:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 5 8.5 12 15 19"/></svg>',
  // Settings > Date: next day
  chevronRight:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 5 15.5 12 9 19"/></svg>',
  // "more text below" cue under the comment
  scrollDown:
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--bright)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  // chain link - the Link button (the open chapter on Lichess),
  // under the board. Lucide "link" (lucide.dev, ISC license),
  // unchanged.
  link:
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  // speech bubble - the comments button, under the board (the move
  // comments on / off - trainer.html [#18]). Lit blue while they're
  // on, like the other "on" buttons. Lucide "message-square"
  // (lucide.dev, ISC license), mirrored left to right, so its tail
  // is at the bottom right, like a message you've sent - with two
  // lines of "text" inside, so it reads as written notes.
  comment:
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 15a2 2 0 0 0 2 2h12l4 4V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"/><path d="M7 8h10M7 12h6"/></svg>',
  // bar chart on its side - opening explorer button, under the board.
  // Three solid bars lying down, longest in the middle, like the bars
  // in the explorer's table.
  chart:
    '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="2" width="13" height="5.5" rx="1"/><rect x="2" y="9.25" width="20" height="5.5" rx="1"/><rect x="2" y="16.5" width="9" height="5.5" rx="1"/></svg>',
  // folder - the Settings menu's data-page button, on its title row
  // (trainer.html [#21]): opens data.html. Lucide "folder"
  // (lucide.dev, ISC license), unchanged.
  folder:
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
  // open book - mode button and mode menu: the Library
  library:
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6C10.1 4.6 7.1 3.8 2.5 3.8v15c4.6 0 7.6.8 9.5 2.2 1.9-1.4 4.9-2.2 9.5-2.2v-15c-4.6 0-7.6.8-9.5 2.2z"/><path d="M12 6v15"/></svg>',
  // practice button in browse mode (tap to start practice)
  play:
    '<svg class="icon" viewBox="0 0 24 24" fill="none"><path d="M6.5 4.5v15l13.5-7.5-13.5-7.5z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/></svg>',
  // next chapter - the >> button at the end of a line (trainer.html
  // [#6]): two triangles and a bar, like "next track". Drawn like
  // play (filled, with a 1px rounded edge), the same height.
  next:
    '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"><path d="M2 4.5v15l8.5-7.5z"/><path d="M10.5 4.5v15l8.5-7.5z"/><rect x="19.5" y="4.5" width="2.5" height="15" rx="0.5"/></svg>',
  // practice button while practicing (tap to stop)
  stop:
    '<svg class="icon" viewBox="0 0 24 24" fill="none"><rect x="4.5" y="4.5" width="15" height="15" rx="2" fill="currentColor"/></svg>'
};

// Fill every data-icon="..." placeholder in the page.
(function () {
  var els = document.querySelectorAll("[data-icon]");
  for (var i = 0; i < els.length; i++) {
    var name = els[i].getAttribute("data-icon");
    if (ICONS[name]) els[i].innerHTML = ICONS[name];
    else console.warn("icons.js: no icon named", name);
  }
})();
