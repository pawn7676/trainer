# trainer

A web page for drilling chess openings and puzzles. You build your
repertoire as Lichess studies; two Python scripts turn those studies into
two trainer files (`.jsonl`); the data page (`data.html`) loads
them into the browser, and the trainer page quizzes you on them, with spaced repetition, a daily random set, puzzles,
an optional Stockfish engine and the Lichess opening explorer.

This README is the overview: what each file is, the everyday tasks, how
to use the page, how to write studies, and where to change things. How
each part works in detail is in the comments at the top of its own file.
Each file lists its sections there, numbered `[#1]`, `[#2]`, … A
reference to another file's section names the file (`board.js [#6]`); a
bare `[#6]` means a section of the file it's in. The index at the top of
`trainer.html` lists every file. When a file is reorganized, its
sections are renumbered 1, 2, 3… in order, and every reference to them -
in that file and in every other file - is updated in the same change.

No file has a version number: each new version simply replaces the
old one.

---

## How it fits together

```
build_opn_jsonl.py   (one run does both)
    Lichess studies ──download──► pgn_files/ ──build──► openings.jsonl

build_puz_jsonl.py
    pgn_files/Level*.pgn ──build──► puzzles.jsonl

    Both scripts check every chapter with pgn_error_check.py and
    write it with jsonl_writer.py.

data.html  (the data page)
    "Token"      ◄── your Lichess token (pasted once per browser)
    "Openings"   ◄── openings.jsonl
    "Puzzles"    ◄── puzzles.jsonl
    "Explorer"   ◄── explorer_data.jsonl  (only after a browser reset)
    "Start"      ──► the Lichess data for your lines
    "Save"       ──► explorer_data.jsonl ──► repertoire_report.py

trainer.html
    reads the token and all three files from the browser, and
    collects the Lichess data for the line you're studying in the
    background
```

All the work of reading Lichess's PGN - `ALT:` moves, the comma rule,
arrows and circles, move marks, how a game ends - happens in the Python
build. The trainer page never reads chess notation; it gets everything
as named fields (see **The trainer files** below). The data page keeps a
copy of each file you load in the browser, where the trainer reads it,
so you only load a file again after a rebuild (or a browser reset).

---

## The files

### The trainer page — keep all of these in one folder

| File | What it is |
|---|---|
| `trainer.html` | The trainer itself: the file index, the page markup, and the script - which chapter is open, the lists, reading the files from the browser, playing through a chapter, practice, the comment box, the move list, settings, buttons, keys, start-up. |
| `data.html` | The data page, opened on its own: takes your Lichess token, loads the three `.jsonl` files into the browser for the trainer, shows how old the Lichess data is, gathers what's missing or stale, and saves `explorer_data.jsonl`. |
| `trainer.css` | Every style on the page. All colors, fonts and sizes are settings near the top (`:root`). |
| `errors.js` | Error messages. Anything wrong with the page itself (a missing file, a script error, a mistyped CSS color) shows **in the comment box**, and the page **stops** until it's reloaded. (Stockfish not running, or Lichess not answering, isn't a page error.) |
| `rules.js` | Chess rules: legal moves, move names (SAN), check and mate, how the game ends at a position, and positions as FENs - by python-chess's own rules, so the trainer and the build always agree. |
| `filter.js` | Reads the two `.jsonl` files and builds the lists: spaced repetition, today's random openings and puzzles, and the Library's. |
| `pieces.js` | Piece artwork (the cburnett set). Swap the 12 drawings to change the piece set. |
| `board.js` | The chessboard: drawing it (pieces, badges, arrows and circles, coordinates), tapping and dragging pieces, piece slides, the resize grip. |
| `icons.js` | The small interface icons. |
| `NotoSans.ttf` | The page font. Without it the page falls back to system fonts. |
| `engine.js` | Stockfish analysis, behind the Engine and Threat buttons. Its settings are at the top of the file. |
| `explorer.js` | The trainer's Lichess side: the opening explorer, collecting the Lichess data for the line you're studying in the background, and keeping every answer in the browser. |
| `stockfish-19-lite-single.js` + `.wasm` | Stockfish, Lite (about 1 MB) - the one the engine uses. |
| `stockfish-19-single.js` + `.wasm` | Stockfish, Full (about 94 MB). Optional — only with `ENGINE_TYPE` set to `"full"` at the top of `engine.js`. |
| `LICENSE` | The GNU General Public License, version 3 - the license of the trainer's own code, and of Stockfish. |
| `CREDITS.md` | Who made what - Stockfish, the pieces, the font, the icons, Lichess, python-chess, chess.js - and their licenses. |
| `NotoSans-OFL.txt` | The font's license, which has to go wherever `NotoSans.ttf` goes. |

The trainer stops with an error if any of its files but the Stockfish
ones and the three license files is missing. The page is opened from
the Code app's local server (localhost); the engine saves its own copy
of the Stockfish files in the browser while that server is running, so
it keeps working afterwards.

### The scripts (Python 3 + python-chess: `pip install chess`)

| File | What it is |
|---|---|
| `build_opn_jsonl.py` | Syncs your studies from Lichess into `pgn_files/` (with `pgn_sync.py`), then builds `openings.jsonl`. |
| `build_puz_jsonl.py` | Builds `puzzles.jsonl` from the `pgn_files/Level*.pgn` studies already downloaded. Doesn't sync. |
| `pgn_sync.py` | Downloads the studies you changed on Lichess. Run by `build_opn_jsonl.py`; can be run on its own. |
| `pgn_error_check.py` | Every check on the Lichess PGNs, and the build report - shared by both build scripts. |
| `jsonl_writer.py` | Turns each checked chapter into one line of a `.jsonl` file, and re-checks the finished file. Its top comment is **the one list** of every Lichess convention and every field in the file. |
| `repertoire_report.py` | Writes the two reports on your repertoire: `gap_report.txt` (every coverage gap, biggest first) and `better_moves.txt` (every place another move wins more often than yours). |
| `prune_explorer_data.py` | Writes `explorer_data_pruned.jsonl`: `explorer_data.jsonl` with only the positions in your studies. Uses `pgn_error_check.py`'s code. |

Keep them all in one folder.

### Files the scripts read and write

| File | What it is |
|---|---|
| `tokens.json` | Your Lichess username and API token (needs permission to read your studies). Read by `pgn_sync.py` only. Keep it private. |
| `pgn_files/` | One `.pgn` per Lichess study — the sync's local copy. |
| `pgn_sync_timestamp.txt` | When the last sync happened, so only changed studies are downloaded. Delete it to download everything again. |
| `openings.jsonl`, `puzzles.jsonl` | The built trainer files — **Openings** / **Puzzles** on the data page. |
| `explorer_data.jsonl` | Every answer from Lichess's explorer kept in the browser, written by the data page's **Save** button. |
| `explorer_data_pruned.jsonl` | Written by `prune_explorer_data.py`. |
| `gap_report.txt`, `better_moves.txt` | The two reports, written by `repertoire_report.py`. |

`tokens.json` looks like:

```json
{ "lichess_username": "your-name", "lichess_study_token": "lip_..." }
```

---

## Everyday tasks

**Refresh the openings after editing studies on Lichess**

```
python3 build_opn_jsonl.py
```

Then on the data page, **Openings** › `openings.jsonl`, and
open (or reload) the trainer. The build prints a report of anything to
fix on Lichess.

**Rebuild the puzzles**

```
python3 build_puz_jsonl.py
```

Then on the data page, **Puzzles** › `puzzles.jsonl`. Run
`build_opn_jsonl.py` first if the Level studies changed on Lichess.

**Check a finished file by hand** (changes nothing; lists any problems)

```
python3 jsonl_writer.py openings.jsonl puzzles.jsonl
```

The trainer doesn't re-check what's inside a file, so do this if you
ever edit a `.jsonl` file yourself instead of rebuilding it.

**The Lichess data: the data page**

`data.html`, opened on its own (from the same app and address as
the trainer - each browser keeps its own data). Best done before you open
the trainer, as the trainer reads everything when it opens.

- **Token** (top left) - your Lichess token (see **The opening
  explorer** below for making one). Tap it and paste the token into
  the pop-up; under it, "Saved …k3Ft" (its last 4 characters) or
  "None yet". Tap it again to replace the token, or leave the pop-up
  empty to remove it. Start needs it, and so do the trainer's
  explorer and background collection - they read it from here.
- **Openings / Puzzles / Explorer** - the three load buttons, each
  with its file under it: the name, when it was loaded, and what's in
  it. Under **Explorer** that's the file last loaded *or saved*,
  whichever came last. Only needed for a file that's changed;
  **Explorer** (`explorer_data.jsonl`) only after the browser's data
  has been cleared. A file picked with the wrong button is refused.
- **The age table** - for the chapters picked (everything, or one
  study): how many positions have no answer yet (**Missing**), and how
  old the others are - 0–90, 90–180, 180–270, 270–365 days, and **over
  365** (stale, asked for again).
- **Start** - asks Lichess for every missing or stale position, about one
  every 3 seconds, then **Refresh early** more of the oldest ones (a
  number you pick: none, 10 … 500), so a whole year's data never goes
  stale at once. Stop and Start again whenever you like - nothing is lost.
- **Save** - `explorer_data.jsonl` with every answer in the browser.
  On the iPad it opens the share sheet: **Save to Files** and pick the
  folder (replacing the old file). Under it: how many positions
  aren't saved yet, or "all saved". It asks before saving when that
  could replace a good file with a poorer one (the browser's data was
  cleared, or it has fewer positions than your last save).

The trainer collects in the background too: when an opening chapter opens,
every position of its line with no answer, or one more than a month old
(`COLLECT_REFRESH_DAYS`), is asked for quietly - nothing on the page shows
it. So the lines you study stay fresh by themselves, and the data page's
early refreshes are for the rest. Everything the trainer gets goes into the
data page's next Save.

**The repertoire reports**

```
python3 repertoire_report.py
```

With `openings.jsonl` and `explorer_data.jsonl` in the same
folder, one run writes two reports, each its own list, biggest first.
Each has a switch at the script's top - `GAP_REPORT` and
`BETTER_REPORT`: set one to `False` and that report isn't worked out
at all, and its file is left as it was.

- **`gap_report.txt` - the coverage gaps:** every reply the opponent
  plays often (`GAP_MIN_SHARE` % of games and `GAP_MIN_GAMES` games, at
  the script's top) that none of your chapters answers, biggest
  **Reach** first - the share of your games with that color that reach
  the gap. Each one has its opening, chapter, move, Reach, Share, Games
  and a link to it on Lichess. A reply that transposes - that leads to
  a position one of your chapters of that color reaches by another move
  order (4...e6 5.Nf3 Nc6 and 4...Nc6 5.Nf3 e6, say) - isn't a gap.
- **`better_moves.txt` - the better moves:** every position where it's
  your move and another move's **win %** (the share of its games your
  color won) is at least `BETTER_MIN_GAIN` points higher than yours,
  both with at least `BETTER_MIN_GAMES` games (at the script's top):

```
#1   Charlick Gambit #1 (Main Line)
     Yours:   8...Nf6   58%   85,412 games
     Better:  8...Bxf3  74%   28,104 games   (+16)
     https://lichess.org/study/…#15
```

- **A gap you don't want to cover yet:** add an `INFO` chapter on
  Lichess - the line to that move, ending on it, named like
  `INFO 3.Bb5 (Ruy Lopez)` (see **Writing studies on Lichess**). Rebuild
  and the move counts as answered.
- **Positions missing from the data** (a line added since your last
  save) are skipped, and both reports end with the chapters
  they're in. On the data page, load the new `openings.jsonl`,
  tap Start, then Save, and run the reports again.

**Prune the Lichess data**

```
python3 prune_explorer_data.py
```

The browser keeps every position the explorer is asked about, including
the ones you only tried out. This writes `explorer_data_pruned.jsonl`
with only the positions in the main lines of your studies (every `.pgn`
in `pgn_files/`, so a study commented out of `build_opn_jsonl.py` keeps
its data). It changes neither the data file nor the studies. The browser
still keeps everything, so the next save writes it all again - the
pruned copy is a smaller backup.

**The trainer shows an error and won't do anything**

That's on purpose: every error stops the page. The message in the
comment box says what's wrong - usually a file missing from the folder,
or a line of a `.jsonl` file that can't be read (rebuild the file). Fix
it, then reload the page.

---

## Using the trainer

**The page**

The board, with the boxes beside it. Under both, one row of buttons:
Settings, Mode and `<<` `<` `>` `>>` under the board, and the five tools
under the boxes. Under that, the chapter row - the **Link** button
(opens the chapter on Lichess, at the move on the board) and the Chapter
dropdown. (There are no load buttons: the files are loaded on the data
page.) Drag the grip at the board's
corner to resize it: how big or small it can get is set by the buttons
(none may get narrower than its icon). On a narrow screen (under 820px -
the iPad held upright) everything stacks.

**The buttons under the board**

- **Settings** (gear) — the Date (for spaced repetition), the Show…
  switches and Auto practice mode. Tap anywhere on a switch's row to
  flip it. The **folder** button, at the menu's top right, opens the
  data page in the same tab (where the Lichess token is pasted); Back
  returns to the trainer as you left it - reload it to pick up files
  you loaded there. It only works where the pages are hosted (GitHub
  Pages, say): Safari can't load a page from the Code app's server a
  second time.
- **Mode** — the four list modes (see **Choose what to study** below).
- **`<<` `<` `>` `>>`** — the start, one move back, one forward, the
  end. At the end of a line, `>>` turns blue and becomes **Next**: the
  next chapter in the list (greyed out on the last). It ignores taps for
  half a second after it appears, so a double tap can't skip past the
  end. To play a line again, tap `<<`.
- **The tools** (under the boxes), lit blue while they're on:
  - **Comments** (speech bubble) — the move comments on or off; saved,
    and it doesn't leave Practice. Off, the opponent replies after the
    usual short pause instead of waiting for a tap. The text before the
    first move and errors still show.
  - **Explorer** (bar chart), **Threat** (crosshair), **Engine** (chip)
    — see below. In Practice, tapping one switches to browse mode
    first; turning Practice on turns them all off.
  - **Play/Stop** — Practice on or off.

**Keyboard shortcuts**

With a keyboard on the iPad, these keys do the same as the buttons
and switches. This is the one list of them - every key is wired in
`trainer.html` [#24], whose comment lists them too; a new key goes in
both places.

| Key | What it does |
|---|---|
| `←` `→` | One move back / forward - on an analysis line, through your own moves. They repeat while held. |
| `p` `n` | Previous / next chapter in the list, as on Lichess. No wraparound: `p` on the first chapter and `n` on the last do nothing. |
| `Space` | Carry on past a comment that's waiting for a tap - the same as tapping the comment box. Also shows a blindfold puzzle's hidden pieces. |
| `t` | Practice on / off - the Play/Stop button. Turning Practice on deletes the analysis line and turns the engine and explorer off. |
| `l` | Engine on / off - the chip button. Turns Threat off. In Practice, leaves Practice first. |
| `x` | Threat on / off - the crosshair button. Turns the engine off. In Practice, leaves Practice first. Nothing while the side to move is in check. |
| `a` | The engine's arrows (and the threat arrows) off / on; the lines stay. Only while Engine or Threat is on. Not saved: the arrows are back when the page opens. |
| `e` | Opening explorer on / off - the bar chart button. In Practice, leaves Practice first. Nothing in Puzzles mode. |
| `c` | Comments on / off - the speech bubble button (saved, and the button lights up while they're on). Turned off while a comment is waiting for a tap, the opponent's reply is played at once. Doesn't leave Practice. |
| `m` | **Settings › Show material count** on / off - the same as tapping its switch. With equal material there's no number to show, so nothing changes until there is. |
| `b` | **Settings › Show move annotations** on / off (`b` for badges) - the badges, and the chapter's arrows and circles with them. Not the engine's arrows - that's `a`. |
| `i` | **Settings › Show chapter name** on / off (`i` for ID) - the names in the Chapter dropdown, or just `#N`. (The Library always shows names.) |
| `o` | **Settings › Show ALT box** on / off (`o` for other moves). |

The keys that flip a Settings switch (`m`, `b`, `i`, `o`)
are shown in the Settings menu as `[m]`, in muted grey, just left of their
switch - all in one column. That's made from the same list the keys
are wired from (`SETTING_KEYS` in `trainer.html` [#24]), so the menu
always matches the keys.

- The letter keys and Space act once when held down; only the arrow
  keys repeat. With Shift or Caps Lock on, the letter keys do nothing.
- While a blindfold puzzle's pieces are hidden, `l`, `x` and `e` do
  nothing (their buttons are dimmed too). The Settings keys still
  work.
- No key does anything while a text field or one of the chapter
  row's dropdowns has focus, while Cmd, Ctrl or Option is held (so
  browser shortcuts like Cmd+P still work), while the Settings menu,
  the Mode menu or the promotion picker is open, or before any
  chapters are loaded. The one exception: a key that flips a Settings
  switch works with the Settings menu open too, and the switch moves
  as you press it.

**The boxes beside the board**

From the top: the move list (browse mode), the engine's lines and the
explorer (each only while it's on), then the comment box and the ALT box
(the move's other accepted moves). The column never runs past the
board's bottom edge: when they don't all fit, the ALT box is hidden
first, then the comment box, the explorer, the engine's lines and the
move list. Make the board bigger, or turn something off, and they come
back. In the narrow, stacked layout nothing is hidden. Scrolling the
comment box never counts as tapping it.

**Choose what to study: the mode button**

- **Spaced repetition** (calendar) — the opening chapters due today
  (the date can be changed in Settings).
- **Random openings** (shuffle) — today's 50 random opening chapters
  (never an `INFO` chapter).
- **Library** (open book) — any opening chapter you choose: the
  **color square** (the side you play - tap to switch), **Study** and
  **Chapter** in the chapter row. Chapters are grouped under the
  study's headings; Next goes through that study's chapters. Each color
  keeps its own study and chapter. Picking Library from Spaced
  repetition or Random openings opens it on the chapter you're on,
  without changing anything on the board - handy for seeing its
  neighbours in the study.
- **Puzzles** (jigsaw) — today's 50 random puzzles.

**The engine**

Two buttons (or `l` and `x`); only one is on at a time.

- **Engine** (chip) — Stockfish's best lines beside the board, each
  with its eval (the best line's in a blue pill), and arrows for the
  best move (blue) and any other move nearly as good (grey). Tap a move
  in a line to play the line up to there.
- **Threat** (crosshair) — what the opponent is threatening: the
  position as if the side to move had passed, in red. Greyed out while
  the side to move is in check.

When there's nothing to analyse, the lines give way to **Checkmate**,
**Stalemate**, **Draw** or **No threat while in check**. If Stockfish
can't run, why shows there in magenta and both buttons turn off; tap one
again to try again. The settings (`ENGINE_TYPE`, `ENGINE_LINES`,
`ENGINE_DEPTH`, `ENGINE_HASH`) are at the top of `engine.js`.

**The opening explorer**

The **Explorer** button (or `e`): for the position on the board, the
moves played on Lichess, most played first - each move's share of the
games, how many games, and how they ended. Tap a move to play it. It's
for openings only (greyed out in Puzzles), and off when the page opens.
Where the game is over it just says **Checkmate**, **Stalemate** or
**Draw** - Lichess has no games from such a position.

- **The token:** Lichess only answers with a personal API token. Make
  one at lichess.org › Preferences › API access tokens with **no boxes
  ticked**, and paste it on the data page with **Token**. It's saved
  in that browser only (the Code app's window and full Safari each
  need it once), and the trainer picks it up as soon as you come back
  to it - no reload needed.
- **Which games:** every time control except ultrabullet, players rated
  1000 and up (`EXPLORER_SPEEDS`, `EXPLORER_RATINGS` in `explorer.js`).
- **When Lichess can't answer** (no internet, a bad token, too many
  requests), the explorer says why above its table, and the rest of the
  trainer carries on.

**Collecting the Lichess data**

`repertoire_report.py` works from the Lichess data for the lines you
study. The trainer collects it as you go: when an opening chapter opens
(not a puzzle), every position of its line - both sides - with no answer,
or one more than a month old, is asked of Lichess quietly in the
background, about one every 3 seconds, behind anything the explorer is
asking. Nothing shows for it, and there's no switch. Whole studies, and
the lines you don't open, are gathered on the data page (see **The
Lichess data: the data page** above), which also saves it all.

The trainer doesn't show coverage gaps itself - that's
`repertoire_report.py`.

---

## Writing studies on Lichess

These conventions are what the build scripts look for. The trainer
never sees them: the build turns each one into a named field in the
`.jsonl` file. (The same list, in more detail, is at the top of
`jsonl_writer.py`.)

**Openings** (`build_opn_jsonl.py`)

- **Which studies are used:** only those named in `WHITE_OPENINGS`
  (you play White) and `BLACK_OPENINGS` (you play Black) at the top of
  `build_opn_jsonl.py`. Comment a line out with `#` to leave a study out.
- **Chapter names:**
  - starting with `_` — a **heading**, like `_____ THE AGGRESSIVE AMATEUR _____`.
    Every chapter after it in the study, up to the next heading, goes
    under it, and in the trainer's Library the Chapter list shows them
    grouped under that title. The heading chapter itself isn't a
    chapter in the trainer. Its name loses every `_` and space at both
    ends, however many you type; underscores in the middle stay.
    Headings are worked out again on every build, so reorder or rename
    them freely on Lichess. With several headings in a row the last
    one counts (handy for a section title followed by its first
    sub-section), and a heading with nothing after it (say, over the
    INFO chapters at the end of a study) is fine too. The report only
    lists a heading chapter that has moves or is nothing but
    underscores.
  - starting with `INFO` — a line that isn't a main line: an
    alternative to your normal move, or an opponent move you don't
    actively study (`INFO 3.Bb5 (Ruy Lopez)`). Written like any
    chapter - comments, inheritance, heading, Round date and every
    check - with `"info": true`. The trainer leaves it out of
    **Random openings** and nothing else: it's in the Library, and in
    Spaced repetition if it has a Round date. Its opponent moves count
    as answered, like any chapter's, so the gap report never lists
    them as gaps.
- **Comment inheritance:** each chapter takes the comments and move marks
  (!, ?…) of the chapter before it for as long as the two play the same
  moves. Edit a shared comment in the *earlier* chapter — the report lists
  any of a chapter's own comments that get replaced this way.
- **Spaced repetition:** put the start date in the chapter's **Round**
  field on Lichess as `YYYY-MM-DD` (dots are fine). A future date schedules
  it in advance. The review days follow `SR_INTERVALS` in `filter.js`.
- **Arrows and circles** you draw on the board (green, red, yellow, blue)
  are shown on the trainer's board after that move.
- **Move marks:** `!`, `?`, `!!`, `??`, `!?`, `?!` and the eval marks
  (`=`, `+=`, `+/-`, `+-` …) show as badges. "Only move" (□) is removed;
  any other mark is left out and listed in the report.
- Every chapter must start from the normal starting position.

**Puzzles** (`build_puz_jsonl.py`)

- **Which studies are used:** `pgn_files/Level*.pgn` whose number is
  between `LEVEL_MIN` and `LEVEL_MAX` at the top of `build_puz_jsonl.py`.
- The comment before the first move is kept (the instructions); in other
  comments only the `ALT:` moves are used. Move marks and arrows are
  removed so they don't give the answer away.
- You play whichever side moves first in the puzzle's position.
- **Blindfold puzzles:** a chapter with `Answer` in its name, and the
  chapter right before it, are one blindfold puzzle. The first chapter
  holds only the instructions (an empty board, no moves); the Answer
  chapter holds the real position and the solution. The build merges
  them into one puzzle with the instructions as its preamble, the first
  chapter's name and link, and `blindfold: true`.
  - In the trainer it starts with the board empty and the instructions
    showing. `>`, a tap on the comment box or Space shows the pieces,
    and you solve it like any other puzzle. `<` at the start, or `<<`,
    hides them again.
  - Keep the Answer chapter's opening comment empty - anything there is
    left out, since it would give the answer away.
  - A pair is skipped (only counted) when its Answer chapter has no
    moves, or isn't a legal position (e.g. no kings).

**Both**

- **`ALT:` moves** — other moves the trainer also accepts. Start a line
  of a move's comment with `ALT:` and list the moves, separated by `,` or
  `;` (e.g. `ALT: Nf3, Bc4`). Illegal ones are removed by the build and
  listed in the report. They show in the ALT box, not in the comment.
- **Line breaks in comments (the comma rule)** — a new line in a comment
  becomes a blank line (a new paragraph). End a line with `,` to get a
  plain line break instead (no blank line); the comma itself isn't shown.
- **How a game ends is worked out by the build** — you don't write
  anything. If a line's last move is checkmate, stalemate, or a draw by
  the rules (insufficient material, threefold repetition, the 50-move
  rule), the trainer shows **#** on the mated king, **S** on the
  stalemated king, or **D** on the square the move lands on (in place of
  any other badge on that move, and of the puzzle-solved checkmark).
  A draw the rules don't call one (king + two knights against a lone
  king, say) gets no badge. End a line at the move that draws: the
  report lists any line that goes on after a draw.
  On an analysis line of your own, the trainer works it out itself:
  **#**, **S**, and **D** for too little material to mate. (Not a
  draw by repetition or the 50-move rule there - the engine still
  knows about those.) Once the game is over - mate, stalemate or that
  draw - the board takes no more moves (step back to play something
  else), on the analysis line and the book line alike.
- Only the main line is used; side lines are ignored. In openings the
  report lists them, so they can be deleted on Lichess; in puzzles it
  doesn't - most puzzles have side lines (other tries and their
  refutations), and they stay.
- The report at the end of each build lists everything to fix on Lichess,
  with links for puzzles. `build_puz_jsonl.py` prints just two lines of
  totals (puzzles, blindfold puzzles, blindfold pairs skipped), and the
  report only when there's something in it to fix.

---

## The trainer files (`.jsonl`)

What `openings.jsonl` and `puzzles.jsonl` hold, for when you
need to look inside one (`explorer_data.jsonl` is at the end). Each is plain text, **one line per chapter**,
written by `jsonl_writer.py`. The trainer's code uses these same names.
A field is left out when it's at its default (no `"blindfold": false`,
no empty comment…).

**Line 1, the header** — what the file is:

| Field | Meaning |
|---|---|
| `format` | always `"trainer"` |
| `kind` | `"openings"` or `"puzzles"` — the data page refuses a file loaded with the wrong button |
| `built` | the day the file was built, `"YYYY-MM-DD"` |

**Every other line, one chapter:**

| Field | Meaning |
|---|---|
| `study` | the Lichess study's name (`"Alekhine Defense"`, `"Level 201"`) |
| `chapter` | the Lichess chapter's name |
| `heading` | the heading the chapter is under in its study — the trimmed name of the `_` chapter before it (openings only; left out when there's none). The Library groups chapters by it. |
| `id` | the Lichess study's and chapter's IDs, `"FjELOsQl/HBcwXFLi"` — the chapter's link without `https://lichess.org/study/` in front. The trainer puts that back for the Link button (`LICHESS_STUDY_URL` in `trainer.html`), and remembers the last chapter you opened by it. |
| `side` | `"w"` or `"b"` — the side you play |
| `date` | `"YYYY-MM-DD"` — the day spaced repetition starts for this chapter (the Round field on Lichess). Only if it has one. |
| `fen` | the starting position. Left out = the normal start. |
| `blindfold` | `true` for a blindfold puzzle |
| `info` | `true` for an `INFO` chapter - left out of the trainer's Random openings, and nothing else. |
| `preamble` | text shown before move 1 (a puzzle's instructions) |
| `moves` | the main line, one entry per move (below) |

**Each move:**

| Field | Meaning |
|---|---|
| `uci` | the move as from-square + to-square (+ promotion piece): `"g1f3"`, `"e4d5"`, `"e1g1"`, `"e7e8q"` — used to move the pieces and check your answer. It's the only form a move is written in: when a chapter opens, the trainer works out each move's name (`"Nf3"`, `"O-O"`, `"Qh2#"`) for the move list itself, with `rules.js` - the same names python-chess gives. |
| `annotation` | `"!"`, `"?"`, `"!!"`, `"??"`, `"!?"` or `"?!"` |
| `eval` | `"$10"`…`"$19"` — the eval mark on the position after the move |
| `comment` | the comment shown after the move — the comma rule already applied, no `ALT:` moves |
| `circles` | `[{"color": "green", "sq": "e4"}, …]` |
| `arrows` | `[{"color": "red", "from": "e2", "to": "e4"}, …]` |
| `altUci` | other accepted moves (the `ALT:` moves), as `uci`: `["c2c4", "g1f3"]` — named by the trainer for the ALT box, like the moves |
| `end` | `"mate"`, `"stalemate"` or `"draw"` — only ever on the last move, when it ends the game |

### `explorer_data.jsonl`

Written by the data page's **Save** button (`data.html`
[#11]), not by the build scripts. One line per position, sorted by `fen`.

**Line 1, the header:**

| Field | Meaning |
|---|---|
| `format` | always `"trainer"` |
| `kind` | always `"explorer"` |
| `saved` | the day the file was saved, `"YYYY-MM-DD"` |
| `database` | `"lichess"` (Lichess players' games, not the masters') |
| `speeds` | the time controls counted: `["bullet", "blitz", …]` |
| `ratings` | the rating bands counted: `[1000, 1200, …]` (each from its number up to the next) |
| `maxMoves` | the most moves Lichess sends per position (12) |

**Every other line, one position:**

```json
{"fen":"1B1r2k1/1pNb1ppp/4pn2/8/1b6/2N2P2/PPP2P1P/R3K2R b KQ -","date":"2026-10-07","w":31,"d":3,"b":15,"moves":[["d8b8","Rxb8",29,2,15],["b4c3","Bxc3+",2,1,0]]}
```

| Field | Meaning |
|---|---|
| `fen` | the position: its FEN's first four fields (pieces, side to move, castling, en passant), without the two move counters - they don't change what can be played from it. Castling only while king and rook are at home; the en passant square only when an en passant capture can really be played (`rules.js` `toFen()`, the same as python-chess). |
| `date` | the day Lichess was asked, `"YYYY-MM-DD"` — asked again after a year |
| `w`, `d`, `b` | games from this position: White wins, draws, Black wins. Can be more than the moves' sums: with more than `maxMoves` moves, the ones left out still count here. |
| `moves` | the moves played, most played first, each `[uci, san, White wins, draws, Black wins]`. Empty: no games. |

---

## Where to change things

| To change… | Look in |
|---|---|
| Colors, fonts, board size, layout spacing | `trainer.css` — the settings in `:root` (all colors live there) |
| Height of the buttons and dropdowns | Worked out, not set: one line of the text font plus the boxes' padding and border (`--one-line-height` in `trainer.css` `:root`) - change those and it follows |
| Size of the << < > >> symbols (they stay centered at any size) | `trainer.css` — `--nav-glyph-size` (3rem) in `:root` |
| The space between everything: the board, the boxes, the buttons, the chapter row - and around the page at the screen's edges, where the Settings and Mode menus stop too | `trainer.css` — `--gap` (10px) in `:root` - one size for all of them (the web-app version adds `--top-inset` at the top) |
| The boxes: the five beside the board, the chapter row's dropdowns and color square - the space inside them, their border, their rounded corners (the buttons share the border and corners) | `trainer.css` — `--box-pad-y` (above and below, 8px), `--box-pad-x` (either side, 16px), `--box-border-width` (1px), `--box-radius` (4px) in `:root` - one set for all of them |
| The text font - the comment box, the ALT box, the dropdowns, the Settings and Mode menus, and the error messages | `trainer.css` — `--font-family` (Noto Sans), `--text-font-size` (1.35rem), `--text-font-weight`, `--text-line-height` in `:root` |
| How big and small the board can get | Nothing to set: no button under it may get narrower than its icon (`board.js` [#13]) |
| The layout on narrow screens (under 820px) | `trainer.css` — the `@media (max-width: 820px)` block at the end |
| How error messages look | `trainer.css` — `#pageWarnings`, `#pageStopCover` |
| On-board badges (!!, ?, #, S, D, eval symbols) | `board.js` — the `BADGE` settings (`BADGE.glyph` nudges each symbol inside its disc) |
| Color of the game-ending badges (# checkmate, S stalemate, D draw) | `trainer.css` — `--game-end` in `:root` |
| Arrows and circles (size, see-through-ness) | `board.js` — `ARROW` and `CIRCLE` (sizes) and `SHAPE_OPACITY` (both); their colors are `--shape-*` in `trainer.css` |
| The font of the move list, the engine's lines and the explorer, their messages included | `trainer.css` — `--mono-font-family`, `--list-font-size`, `--list-line-height` in `:root` |
| How dim a disabled button or dropdown is | `trainer.css` — `--disabled-opacity` in `:root` |
| Coordinates and material count | `board.js` — `COORDS` (their size, and the gaps to the squares' edges); their font is `--board-coord-font-family` (Noto Sans, like Lichess) and `--board-coord-font-weight`, and their colors `--board-coord-on-light` (on a light square, #946f51) and `--board-coord-on-dark` (on a dark square, the light squares' color), all in `trainer.css` `:root` - Lichess's own. They're drawn under the pieces, as on Lichess. |
| How sharp the board stays when you pinch-zoom far in, and how soon it sharpens again after a resize or a zoom | `board.js` — `BOARD_MAX_PX` (3200) and `RESOLUTION_WAIT_MS` (150 ms), under SHARPNESS in [#1] |
| Red glow on a king in check | `board.js` — `CHECK_HALO` |
| Pause before the opponent's move, and how long a wrong move stays on the board | `trainer.html` — `PAUSE_MS` (one setting for both) |
| How far a touch can move and still be a tap: on the board (any further starts dragging the piece), and on an engine line's move, an explorer move or the comment box (any further is a scroll) | `trainer.html` — `TAP_SLOP` (4px, one setting for all of them) |
| How quick two taps must be to count as a double tap (which is then stopped from zooming) | `trainer.html` — `DOUBLE_TAP_MS` (350 ms) |
| How long Next (`>>` at the end of a line) ignores taps after it appears | `trainer.html` — `NEXT_LOCK_MS` (half a second) |
| How fast pieces slide (the opponent's reply, and every step with `<` / `>` in Practice and browse), or turning the slides off | `board.js` — `MOVE_ANIM_MS`; `ANIMATE_MOVES = false` for no slides at all |
| Keyboard shortcuts - a new key, or a different one | `trainer.html` [#24] — its **TO ADD A KEY** steps. A key for a Settings switch is one line in `SETTING_KEYS` (it then works with the Settings menu open too, and shows as `[x]` next to its switch); any other key is a `case` in `wireKeyboardShortcuts`. Either way, a line in [#24]'s list and a row in the **Keyboard shortcuts** table above. |
| The Settings switches' defaults | `trainer.html` — `showAnnotations`, `showComments`, `autoPractice` and the others, under SETTINGS |
| The engine: Lite or Full, how many lines, the depth, its memory | `engine.js` — `ENGINE_TYPE`, `ENGINE_LINES`, `ENGINE_DEPTH`, `ENGINE_HASH` at the top |
| Engine arrows' see-through-ness | `engine.js` — `ENGINE_ARROW_OPACITY` |
| Which games the opening explorer counts (time controls, ratings) | `explorer.js` — `EXPLORER_SPEEDS`, `EXPLORER_RATINGS`; and the same in `data.html` [#1] - change both |
| How often the trainer's data collection asks Lichess (after 3 s with nothing asked), and how old an answer it asks for again (a month) | `explorer.js` — `COLLECT_WAIT_MS`, `COLLECT_REFRESH_DAYS` |
| How long a Lichess answer is good for (a year) | `explorer.js` — `EXPLORER_KEEP_DAYS`; and the same in `data.html` [#1] |
| The data page's pace, its age table's pools, and its Refresh early choices | `data.html` [#1] — `DELAY_MS`, `AGE_POOLS`, `EARLY_CHOICES`, `EARLY_DEFAULT` |
| Which of the two repertoire reports are written | `repertoire_report.py` — `GAP_REPORT`, `BETTER_REPORT` (`True` / `False`) at the top |
| What counts as a coverage gap (a share and a number of games) | `repertoire_report.py` — `GAP_MIN_SHARE`, `GAP_MIN_GAMES` at the top |
| What goes in the better moves report (how many points better, how many games) | `repertoire_report.py` — `BETTER_MIN_GAIN`, `BETTER_MIN_GAMES` at the top |
| The color of the keys (`[m]`) in the Settings menu | `trainer.css` — `--key-hint` in `:root` (the muted text grey, `--text-muted`) |
| How many lines the move list shows before it scrolls (3) | `trainer.css` — `--move-list-rows` in `:root` |
| How many moves the explorer shows before it scrolls, and its bar colors | `trainer.css` — `--explorer-rows`, `--explorer-*` in `:root` |
| Spaced-repetition review days | `filter.js` — `SR_INTERVALS` |
| How many random openings / puzzles a day | `filter.js` — `LIST_SIZE` |
| Which studies become openings | `build_opn_jsonl.py` — `WHITE_OPENINGS`, `BLACK_OPENINGS` |
| Which Level studies become puzzles | `build_puz_jsonl.py` — `LEVEL_MIN`, `LEVEL_MAX` |
| The word that marks a blindfold Answer chapter | `build_puz_jsonl.py` — `ANSWER_WORD` |
| What counts as a broken chapter | `pgn_error_check.py` (its top comment lists every check) |
| What's in the trainer files, and every Lichess convention | `jsonl_writer.py` — its top comment |

---

## Credits and license

The trainer's own code is free software under the GNU General Public
License, version 3 or later (`LICENSE`). Stockfish, the cburnett
pieces, Noto Sans, the Feather, Lucide and Tabler icons, Lichess,
python-chess and chess.js are credited in `CREDITS.md`, with their
licenses. Keep `LICENSE`, `CREDITS.md` and `NotoSans-OFL.txt` with
the trainer's files wherever they're published.

The trainer is not affiliated with or endorsed by Lichess.
