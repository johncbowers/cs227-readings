# Canvas export — runbook

This turns the interactive readings into Canvas artifacts: a **Page** per reading
(the reading itself) and a short **graded reading-check quiz** per reading. The
readings under `interactive-readings/` remain the single source of truth; this
folder only *generates* Canvas files from them.

## What gets produced

Run the exporter (below) and everything lands in `canvas-export/out/`:

```
out/
├── pages/
│   ├── reading-NN-<slug>.page.html    # prose-only Canvas Page (paste into a Page)
│   └── reading-NN-<slug>.embed.html   # iframe embed of the LIVE interactive reading
└── quizzes/
    ├── reading-NN-<slug>-check/       # the unzipped QTI package (for inspection)
    └── reading-NN-<slug>-check.zip    # <-- import THIS into Canvas
```

The reading-check quiz uses the reading's in-line activities, capped at the first
**4** import-safe questions (multiple-choice, multiple-answers, numeric,
short-answer). Change `CHECK_CAP` at the top of `build-canvas.js` to make checks
longer or shorter. Parsons, matching, and the interactive widgets are deliberately
**not** in the quiz — they live in the reading Page.

## Re-exporting (do this after any edit)

```
bash export.sh                     # regenerates out/ and zips the quizzes
bash export.sh https://your.host/path/to/interactive-readings   # also fills in the embed iframes
```

Requires Node.js and the `zip` command. Re-running is safe and idempotent — it
overwrites `out/`.

## Fastest path: import the whole course at once

`export.sh` also builds **`out/cs227-course.imscc`** — a **Canvas course export
package** that, in a single import, creates all 18 reading **Pages**, all 18
**check quizzes**, and 18 **Modules** (each module holds that reading's Page then
its Quiz), numbered and in order (Reading 01 … Reading 18).

1. In the target course → **Settings → Import Course Content**.
2. Content Type → **Canvas Course Export Package**.
3. Choose `out/cs227-course.imscc` → **Import** → wait for **Completed**.
4. Check **Modules** (should read Reading 01 … 18 in order), **Pages**, and
   **Quizzes**. Quizzes import as Classic; migrate to New Quizzes per the notes
   below if you want.

> This uses Canvas's *native* export format (not a plain Common Cartridge) — that's
> what makes the reading HTML come in as real **Pages** (a generic cartridge would
> import them as Files) and what carries the module numbering/order.

Use this once to stand the course up. After that, for ongoing edits you'll normally
re-import **one quiz at a time** using the per-quiz zips in `out/quizzes/` (next
section) rather than re-importing the whole cartridge, which would create duplicates.

> Do the first cartridge import into a **sandbox course** and confirm Modules,
> Pages, and quiz grading all look right before importing into your live section.

## Interactive pages (host on GitHub Pages, embed via iframe)

Canvas strips `<script>` from Page HTML, so the reading widgets can't run *inside* a
Page. To keep them, host the readings publicly and embed each one in its Page with an
iframe. Free option: GitHub Pages.

**1. Publish the readings (one time).**
- Create a new GitHub repo, e.g. `cs227-readings` (Public).
- Upload the **contents** of the `interactive-readings/` folder to the repo root:
  `index.html`, every `reading-*.html`, and the `assets/` folder. (The
  `canvas-export/` folder doesn't need to be uploaded.) On github.com you can use
  **Add file → Upload files** and drag them in; keep `assets/` as a folder.
- Repo **Settings → Pages** → Source: **Deploy from a branch** → Branch **main**,
  folder **/ (root)** → Save. After a minute your site is at
  `https://<username>.github.io/cs227-readings`.
- Open `https://<username>.github.io/cs227-readings/reading-01-why-prove.html` to
  confirm it loads and is interactive.

**2. Rebuild the package pointed at that URL.**
```
bash export.sh https://<username>.github.io/cs227-readings
```
Passing a URL switches the pages to the **embedded live reading** (iframe) instead of
static prose, and rebuilds `out/cs227-course.imscc`. Re-import that (Settings → Import
Course Content → **Canvas Course Export Package**). Now each Page shows the full
interactive reading, with the graded check quiz still beside it.

> **If the embedded reading shows blank after import:** your Canvas may restrict which
> domains can be iframed. Ask the JMU Canvas admins to add `<username>.github.io` to
> the allowed embed/iframe domains, or host on a JMU domain instead. Test one page
> before rolling out all 18.

**Updating content later:** edit the reading HTML here → push the changed file(s) to
the repo (the live pages update automatically) → for quiz changes, re-export and
re-import just that quiz. You don't need to re-import the whole cartridge for reading
edits, because the Page just points at the always-current hosted file.

## One-time Canvas setup, per reading (manual / per-quiz alternative)

1. **Import the quiz.** Course → **Settings → Import Course Content** → Content
   Type **“QTI .zip file”** → choose `out/quizzes/reading-NN-<slug>-check.zip` →
   **Import**. This creates a quiz titled “… — Reading Check.”
   - This creates a **Classic** quiz. To use **New Quizzes**: open the quiz →
     ⋮ menu → **Migrate to New Quizzes** (multiple-choice/answers, numeric, and
     short-answer all migrate cleanly). Or, if your course defaults new quizzes to
     New Quizzes, the importer may route it there automatically.
   - Math renders from the `\( … \)` delimiters via Canvas’s built-in MathJax.
2. **Create the reading Page.** Pages → **+ Page** → in the editor toolbar click
   the **`</>`** (HTML editor) → paste the contents of
   `out/pages/reading-NN-<slug>.page.html` → **Save**.
   - *To keep the interactive widgets instead:* host the `interactive-readings`
     folder somewhere public (JMU web space, GitHub Pages, Netlify…), re-run
     `bash export.sh <that URL>`, and paste `…​.embed.html` instead. It embeds the
     live reading (recursion unfolder, tree grower, guided proof, etc.) in an
     iframe. Canvas must allow the iframe’s domain — test one first.
3. **Put them side by side.** Modules → add the **Page** then the **Quiz** under
   that reading’s module, so students read, then take the check.
4. **Quiz settings.** The package sets unlimited attempts, keep-highest, shuffled
   answers, and show-correct-answers. Adjust points, due date, and attempts in the
   quiz’s settings as you like.

**Tip:** do the very first import into a throwaway **sandbox course** to confirm it
lands the way you expect before importing into your live section.

## Editing through the semester

- **Source of truth = the reading HTML** in `interactive-readings/`. Edit there
  (with me or yourself), then re-export.
- **Pages** carry no student data — regenerate and replace them anytime.
- **Quizzes** are sticky once students attempt them. Prefer to get a quiz right
  before it opens. For a fix *before* anyone attempts: delete the old quiz and
  re-import the new zip. For a fix *after* attempts exist: make the small edit
  directly in Canvas, and mirror it back into the reading source so the two don’t
  drift.
- **Each new semester:** edit here, re-export, import fresh into that term’s
  course.
- **Avoid drift:** if you must hand-edit an item in Canvas, note it so it gets
  folded back into the source; otherwise the next re-export won’t know about it.

## Known limitations

- QTI import creates Classic quizzes (migrate to New Quizzes if desired).
- The prose-only Page omits the in-line questions (those are the quiz), so a couple
  of “Apply it” lead-in sentences read as pointers to the quiz. The `.embed.html`
  interactive Page does not have this (it shows the full reading with its
  activities).
- This exporter was validated for XML well-formedness and Canvas QTI structure,
  but could not be test-imported against your specific Canvas — do the sandbox
  import once and tell me if anything needs adjusting.
