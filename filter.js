/*==================================================================
 * FILTER.JS — reads the two trainer files (openings.jsonl and
 * puzzles.jsonl) and turns them into the short lists the trainer
 * shows: the spaced-repetition (SR) list, the daily 50 random
 * openings, the daily 50 random puzzles, and the Library's list (the
 * chapters of one study, picked by color and study).
 *==================================================================
 * Load it as a plain global <script>, AFTER errors.js (a line that
 * can't be read is reported through pageWarn) and BEFORE the
 * trainer's own script tag. From the trainer it uses todayString
 * (trainer.html [#3], today's date - read when called, never at
 * load, so the order doesn't matter to it):
 *
 *   <script src="errors.js"></script>
 *   <script src="filter.js"></script>
 *   <script> ...trainer code, calls FILTER.read() etc... </script>
 *
 * Exposes a single global: FILTER = { read, list, studies }
 *
 * THE FILES are written by the Python build scripts
 * (build_opn_jsonl.py, build_puz_jsonl.py) through jsonl_writer.py,
 * which also lists every field in them (its section [#2]; the README
 * has the same list). In short: line 1 is a header saying what the
 * file is; every other line is one chapter, already in exactly the
 * shape the trainer uses:
 *   { study, chapter, heading, id, side, date, fen, blindfold, info,
 *     preamble,
 *     moves: [{ uci, annotation, eval, comment, circles, arrows,
 *               altUci, end }] }
 * (A move is only its uci: the trainer names the moves of a chapter
 * when it opens - trainer.html [#4], nameMoves.)
 * A field at its default is left out of the file (no "blindfold":
 * false, no empty comment...), so anything that reads a chapter
 * treats a missing field as its default. All the work of reading
 * Lichess's PGN - ALT: moves, the comma rule, arrows and circles,
 * how a game ends - was done by the build, so nothing here reads
 * chess notation.
 *
 * INFO CHAPTERS ("info": true - build_opn_jsonl.py, INFO CHAPTERS)
 * are lines that aren't main lines. They're left out of the daily
 * random openings ([#4]) and nothing else: the SR list, the Library
 * and its Study dropdown have them like any chapter.
 *
 * THE CHAPTERS ARE TRUSTED. Before a file is written, the build reads
 * it back and replays every chapter with python-chess
 * (jsonl_writer.py [#8]): every field, every date, every move and ALT:
 * move legal, every game end right. So nothing here checks them
 * again. To check a file by hand:
 *   python3 jsonl_writer.py openings.jsonl puzzles.jsonl
 * What IS checked here is what the build can't know about: which
 * file was saved in which slot (the header, [#1]), and a line that
 * isn't JSON at all (a file cut off while it was copied) - that one
 * is reported through pageWarn (errors.js [#1]), which shows it and
 * stops the page until it's fixed.
 *
 * The work is done in two steps (plus one for the Library):
 *
 *   1. FILTER.read(text, kind) - when the trainer starts, for each
 *      file saved in the browser (data.html loads them).
 *      Reads the whole file: every chapter becomes an object, in
 *      file order (a few hundredths of a second for both files).
 *      kind is "openings" or "puzzles" - the slot it was saved in.
 *      Returns { chapters } - the file's POOL - or, when the file
 *      isn't a trainer file of that kind at all (an old .pgn left by
 *      an older trainer, say), { problem: "..." }, a sentence the
 *      trainer shows on the empty board (trainer.html [#9]).
 *
 *   2. FILTER.list(mode, pool, date, pick) - whenever a list is
 *      needed.
 *        "sr"      - the SR POOL (every chapter in `pool` whose date
 *                    is still inside the schedule on `date`), cut
 *                    down to the ones due on `date`.
 *        "random"  - today's 50 random chapters from `pool`, INFO
 *                    chapters left out.
 *        "puzzle"  - the same; kept as its own mode name so the
 *                    trainer can pass its mode straight through.
 *        "library" - the chapters of one study that you play with
 *                    one color, in file order. `pick` is
 *                    { side, study } - the Library's Color and Study
 *                    dropdowns ([#5]). Until both are picked, the
 *                    list is empty.
 *      Which file's pool goes with which mode is the trainer's
 *      choice (openings for "sr", "random" and "library", puzzles
 *      for "puzzle").
 *      `date` is the date shown in Settings, and only matters for
 *      "sr". The random lists always use the real calendar date.
 *      `pick` only matters for "library".
 *
 *   3. FILTER.studies(pool, side) - the Library's Study dropdown:
 *      the name of every study that has chapters you play with
 *      that color ("w" or "b"), A-Z ([#5]).
 *
 * INDEX
 *   [#1] READING A FILE ...... FILTER.read: the header line, then one
 *                              chapter per line
 *   [#2] DAILY SHUFFLE ....... date-seeded shuffle math
 *   [#3] SPACED REPETITION ... schedule, SR pool, what's due
 *   [#4] LISTS ............... FILTER.list, list size
 *   [#5] LIBRARY ............. the studies of a color; one study's
 *                              chapters of that color
 *==================================================================*/
var FILTER = (function () {
  "use strict";

  // Reports a line that can't be read and stops the page (see THE
  // CHAPTERS ARE TRUSTED above).
  function fileProblem(what) {
    pageWarn("File problem: " + what + " - rebuild the file with the build scripts");
  }

  /*================================================================
   * [#1] READING A FILE — line 1 is the header, every other line is
   * one chapter (blank lines are skipped). The header says what the
   * file is:
   *   {"format":"trainer","kind":"openings","built":"2026-10-06"}
   * (An older file's header also has "version": 1 - it's simply not
   * looked at.)
   *================================================================*/
  var FORMAT_NAME = "trainer";

  function read(text, kind) {
    var lines = String(text).replace(/^﻿/, "").split(/\r?\n/);
    var header = null;
    try { header = JSON.parse(lines[0]); } catch (e) { /* not JSON */ }

    // A file that isn't a trainer file of this kind at all: said on
    // the empty board, not a page error. (data.html checks a
    // file before it saves it, so only an older trainer's copy can
    // get here.)
    var fix = " - load " + kind + ".jsonl on data.html";
    if (!header || typeof header !== "object" || header.format !== FORMAT_NAME) {
      return { problem: (/^\s*\[/.test(lines[0])
        ? "is an old .pgn file" : "isn't a trainer file") + fix };
    }
    if (header.kind !== kind) {
      return { problem: "is the " + header.kind + " file, not the " + kind + " file" + fix };
    }

    var chapters = [];
    for (var i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      var ch;
      try { ch = JSON.parse(lines[i]); }
      catch (e) { fileProblem("line " + (i + 1) + " can't be read (" + e.message + ")"); continue; }
      chapters.push(ch);
    }
    return { chapters: chapters };
  }

  /*================================================================
   * [#2] DAILY SHUFFLE
   *================================================================*/
  /* ______ How the daily shuffle works _________
  A computer "random" shuffle isn't truly random —
  it's a formula that only LOOKS random. Give the formula a
  starting number (a "seed") and it always produces the exact
  same order for that seed. The trick here: the seed is the
  DATE. The date doesn't change during the day, so the order is
  locked in all day; tomorrow's date produces a fresh order on
  its own. And because the date can always be recomputed, the
  order never has to be saved anywhere — nothing is stored to
  lose; it just gets regenerated identically from the date.
  */

  // Step 1: Turn the date text into one big number: the "seed".
  function hashString(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // Step 2: The formula. Given a seed number, return a stream
  // of pseudo-random values between 0 and 1.
  // The same seed always yields the same stream.
  function mulberry32(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Step 3: An ordinary shuffle, but powered by the seeded stream
  // above instead of true randomness — so the same seed reproduces
  // the same shuffle order every time.
  function seededShuffle(arr, seed) {
    var a = arr.slice();
    var rand = mulberry32(seed);
    for (var i = a.length - 1; i > 0; i--) {
      var r = Math.floor(rand() * (i + 1));
      var tmp = a[i]; a[i] = a[r]; a[r] = tmp;
    }
    return a;
  }

  // The seed for the daily shuffle is today's date as text,
  // "YYYY-MM-DD" - the trainer's todayString() (trainer.html [#3]).
  // Always the real calendar date, never the date picked in Settings:
  // the random lists are a per-calendar-day thing, and shouldn't
  // shift while you're browsing SR dates.

  /*================================================================
   * [#3] SPACED REPETITION (SR)
   * The schedule is a list of INTERVALS - the gap, in days, between
   * one review and the next. A chapter's review days are the
   * RUNNING TOTALS of those intervals, counted from its date (the
   * day its spaced repetition starts - the Round field on Lichess).
   * With 0,1,2,4,8,16,24,32:
   *   +0  -> 2026-09-13 (day 0)
   *   +1  -> 2026-09-14 (running total 1)
   *   +2  -> 2026-09-16 (running total 3)
   *   +4  -> 2026-09-20 (running total 7)
   *   +8  -> 2026-09-28 (running total 15)
   *   +16 -> 2026-10-14 (running total 31)
   *   +24 -> 2026-11-07 (running total 55)
   *   +32 -> 2026-12-09 (running total 87 - the last review)
   *
   * A chapter's AGE on a date is that date minus its date.
   * SR POOL: every chapter with a date whose age is from 0 up to and
   * including the sum of all the intervals (87 with the schedule
   * above). Older ones have finished the schedule and drop out; ones
   * dated after the date haven't started yet.
   * DUE: the chapters in the SR pool whose age is one of the running
   * totals. Change SR_INTERVALS and everything else follows.
   *================================================================*/
  var SR_INTERVALS = [0, 1, 2, 4, 8, 16, 24, 32];

  // The intervals as running totals - the ages a review falls on.
  var SR_OFFSETS = (function () {
    var cum = 0, out = [];
    SR_INTERVALS.forEach(function (delta) { cum += delta; out.push(cum); });
    return out;
  })();

  // The whole schedule's length: the sum of the intervals.
  var SR_WINDOW = SR_OFFSETS[SR_OFFSETS.length - 1];

  var MS_PER_DAY = 86400000;

  // A calendar date as a whole day count, so two dates can be
  // subtracted. Uses UTC so daylight-saving changes can't make a
  // day 23 or 25 hours long.
  function dayNumberOfDate(d) {
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / MS_PER_DAY;
  }

  // A chapter's "YYYY-MM-DD" date as a day count. (The build has
  // already made sure it's a real date in exactly that form.)
  function dayNumberOfTag(s) {
    var p = s.split("-");
    return Date.UTC(+p[0], +p[1] - 1, +p[2]) / MS_PER_DAY;
  }

  // The SR pool on `date` - each entry carries its age that day.
  function srPool(pool, date) {
    var day = dayNumberOfDate(date), out = [];
    pool.forEach(function (ch) {
      if (!ch.date) return;
      var age = day - dayNumberOfTag(ch.date);
      if (age >= 0 && age <= SR_WINDOW) out.push({ chapter: ch, age: age });
    });
    return out;
  }

  // The SR list for `date`: the SR pool's chapters that are due,
  // sorted by study name only. Chapters within the same study keep
  // their order in the file (a stable sort preserves it).
  function srList(pool, date) {
    var due = srPool(pool, date)
      .filter(function (e) { return SR_OFFSETS.indexOf(e.age) !== -1; })
      .map(function (e) { return e.chapter; });
    due.sort(function (a, b) {
      return a.study.localeCompare(b.study);
    });
    return due;
  }

  /*================================================================
   * [#4] LISTS
   *================================================================*/
  // How many chapters the random lists hold.
  var LIST_SIZE = 50;

  // Today's random list: the whole pool shuffled with today's seed,
  // trimmed to LIST_SIZE.
  function dailyList(pool) {
    var seed = hashString(todayString());
    return seededShuffle(pool, seed).slice(0, LIST_SIZE);
  }

  // mode: "sr" (uses `date` - the date shown in Settings),
  // "random" / "puzzle" (today's 50; `date` isn't used), or
  // "library" (uses `pick` - the color and study picked in the
  // Library's dropdowns, [#5]).
  // The random openings leave out the INFO chapters (see INFO
  // CHAPTERS at the top) - the only list that does. (Puzzles never
  // have "info", so this changes nothing for them.)
  function list(mode, pool, date, pick) {
    pool = pool || [];
    if (!pool.length) return [];
    if (mode === "sr") return srList(pool, date);
    if (mode === "random" || mode === "puzzle") {
      return dailyList(pool.filter(function (ch) { return !ch.info; }));
    }
    if (mode === "library") return libraryList(pool, pick);
    return [];
  }

  /*================================================================
   * [#5] LIBRARY — the Library mode picks its chapters with three
   * dropdowns, left to right: Color, then Study, then Chapter.
   *   Color ... "w" or "b" - the chapter's side, the side you play
   *   Study ... studies(): every study with chapters of that color
   *   Chapter . libraryList(): that study's chapters of that color -
   *             the trainer's chapter list, so Next chapter goes on
   *             to the next one of them
   * (In the openings file each study is one color - the build puts
   * each study in WHITE_OPENINGS or BLACK_OPENINGS - but nothing here
   * counts on that.)
   *================================================================*/
  // The study names for the Study dropdown: each study that has at
  // least one chapter of this color, once, sorted A-Z (the same
  // comparison the SR list sorts by, [#3]).
  function studies(pool, side) {
    var seen = {}, out = [];
    (pool || []).forEach(function (ch) {
      if (ch.side !== side || seen[ch.study]) return;
      seen[ch.study] = true;
      out.push(ch.study);
    });
    out.sort(function (a, b) { return a.localeCompare(b); });
    return out;
  }

  // The Library's chapter list: the chapters of pick.study that you
  // play with pick.side, in file order. Empty until both a color and
  // a study are picked.
  function libraryList(pool, pick) {
    if (!pick || !pick.side || !pick.study) return [];
    return pool.filter(function (ch) {
      return ch.side === pick.side && ch.study === pick.study;
    });
  }

  return { read: read, list: list, studies: studies };
})();
