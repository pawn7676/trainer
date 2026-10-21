# Credits and licenses

The trainer's own code is free software under the GNU General Public
License, version 3 or later (GPL-3.0-or-later; the full text is in
`LICENSE`). It's built with other people's work, listed here with
their licenses. Wherever the trainer's files are published, keep this
file, `LICENSE` and `NotoSans-OFL.txt` with them.

The trainer is not affiliated with or endorsed by Lichess
(lichess.org).

---

## The trainer's own code

Every file not listed below - the two pages (`trainer.html`,
`data.html`) and their scripts and CSS.

Copyright (C) 2026 pawn7676

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at
your option) any later version.

This program is distributed in the hope that it will be useful, but
WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
General Public License (`LICENSE`) for more details.

---

## Stockfish - the engine

`stockfish-19-lite-single.js` / `.wasm` and `stockfish-19-single.js` /
`.wasm`, unchanged from the stockfish.js release they came from.

- **Stockfish** - Copyright (C) 2004-2026 The Stockfish developers.
  GPL-3.0-or-later. The neural networks built into the `.wasm` files
  are part of Stockfish, under the same license.
  [stockfishchess.org](https://stockfishchess.org) - source:
  [github.com/official-stockfish/Stockfish](https://github.com/official-stockfish/Stockfish)
- **stockfish.js** - the web build of Stockfish 19 these files are, by
  Nathan Rugg. Stockfish.js (c) 2026, Chess.com, LLC. GPL-3.0. Source:
  [github.com/nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js)

The license text is `LICENSE`; the source code for these files is at
the two links above.

---

## Piece artwork - cburnett

The chess pieces in `pieces.js` (in the `shared` folder next to the
trainer's, one copy for every project; its top comment gives this
credit too): the cburnett set, by Colin M.L. Burnett
([Cburnett](https://commons.wikimedia.org/wiki/User:Cburnett) on
Wikimedia Commons) - the same set Lichess uses. He offers it under
four licenses, any one of which may be chosen: GFDL 1.2 or later,
CC BY-SA 3.0, BSD (3-clause) and GPL-2.0-or-later. It's used here under
GPL-2.0-or-later, as GPL-3.0 with the rest of the trainer (`LICENSE`,
and the copy of it in `shared`, beside `pieces.js`).
Source:
[Wikimedia Commons, SVG chess pieces](https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces)

---

## Font - Noto Sans

`NotoSans.ttf`: Noto Sans, Copyright 2022 The Noto Project Authors.
SIL Open Font License 1.1 - the full text, with its copyright notice,
is in `NotoSans-OFL.txt`.
[fonts.google.com/noto/specimen/Noto+Sans](https://fonts.google.com/noto/specimen/Noto+Sans)

---

## Icons

In `icons.js`, except the checkmark, which is in `board.js`. Each one
says where it's from in its comment there. Icons not listed are the
trainer's own.

| Icon | Where it's from | License |
|---|---|---|
| gear (Settings button) | [Feather](https://feathericons.com) "settings" | MIT - Copyright (c) 2013-2023 Cole Bemis |
| chain link (Link button) | [Lucide](https://lucide.dev) "link" (a Feather icon, carried into Lucide) | ISC, and MIT for its Feather part - see below |
| speech bubble (comments button) | Lucide "message-square", mirrored, with two lines added | ISC - Copyright (c) 2026 Lucide Icons and Contributors |
| folder (Settings menu) | Lucide "folder" | ISC - as above |
| jigsaw piece (puzzles) | Lucide "puzzle" | ISC - as above |
| computer chip (Engine button) | [Tabler Icons](https://tabler.io/icons) "cpu", enlarged | MIT - Copyright (c) 2020-2026 Paweł Kuna |
| shuffle arrows (random openings) | Tabler Icons "arrows-shuffle" | MIT - as above |
| checkmark (a solved puzzle, `board.js`) | Tabler Icons "check" | MIT - as above |

The license texts, as the MIT and ISC licenses ask:

### MIT License (Feather, Tabler Icons)

Copyright (c) 2013-2023 Cole Bemis (Feather)
Copyright (c) 2020-2026 Paweł Kuna (Tabler Icons)

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

### ISC License (Lucide)

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for
any purpose with or without fee is hereby granted, provided that the
above copyright notice and this permission notice appear in all
copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL
WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR
BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES
OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS,
WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION,
ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS
SOFTWARE.

---

## Lichess

Thanks to [lichess.org](https://lichess.org), free and open source:

- **The opening explorer.** `explorer.js` and `data.html` ask
  Lichess's opening explorer (explorer.lichess.ovh) how often each move
  was played and how it scored. Its numbers come from Lichess's game
  database, which Lichess releases under CC0
  ([database.lichess.org](https://database.lichess.org)).
- **The engine arrows.** Which engine lines get an arrow, how thick,
  and the "winning chances" formula behind them (`engine.js`) follow
  Lichess's analysis board -
  [lila](https://github.com/lichess-org/lila) `ui/analyse`
  autoShape.ts and `ui/lib` ceval/winningChances.ts. lila is copyright
  (c) 2012-2026 the lila authors, under the GNU Affero General Public
  License, version 3 or later; section 13 of GPL-3.0 allows combining
  the two, and this project's source is public, as the AGPL asks.
- **The look.** The board's colors, the coordinate and arrow colors
  and the badge style follow Lichess's own.

---

## python-chess

`rules.js` is the trainer's own code, written to give the same answers
as [python-chess](https://github.com/niklasf/python-chess) (Niklas
Fiekas and contributors, GPL-3.0-or-later) - the same rule for a draw
by insufficient material, and moves and positions written the same
way - so the trainer agrees with the scripts that build its files. No
python-chess code is included.

---

## chess.js

`rules.js` records each move with the same fields and flag letters as
[chess.js](https://github.com/jhlywa/chess.js) (Copyright (c) 2025,
Jeff Hlywa, BSD-2-Clause): `{from, to, piece, color, captured,
promotion, flags}`, with flags c, e, b, p, k and q. No chess.js code
is included: the board, the move generator and the notation are
written separately.
