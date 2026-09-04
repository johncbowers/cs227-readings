# CS 227 Interactive Readings

ZyBooks-style interactive readings for CS 227 — short prose interleaved with
activities students work as they go. **18 readings, one per class session,**
built on a shared, reusable engine. 107 in-line activities total; every
multiple-choice distractor carries misconception-targeted feedback, and each
reading ends with an “Apply it” transfer item that requires reasoning to a new
case rather than recall.

Each reading also ends with an **Exam practice** section grouped Easy / Medium /
Challenge — **384 additional problems** in all. Easy and medium items are
auto-graded (they carry `practice:true`, so they do **not** affect the progress
bar); challenge items are static proof-style problems with a revealable worked
solution. Counts are scaled to each topic (e.g. Predicate Logic and the induction
readings get the full 10/15/10; Sets and Conditions fewer).

## Ordering note

The readings follow the semester in order, with one deliberate pedagogical
choice: **structural induction (Reading 11) comes before induction on the natural
numbers (Reading 12)**, framing ℕ as the simplest inductive structure — a special
case of the general constructors → recursion → induction pattern.

## What's here

```
interactive-readings/
├── index.html                              landing page (links all 18)
├── reading-01-why-prove.html               testing vs. verification (greedy explorer)
├── reading-02-conditions.html              conditions, types, arity
├── reading-03-truth.html                   satisfiable/…/contradictory; entailment; complement
├── reading-04-counting.html                tuples, Cartesian products, product/sum rules, functions, strings
├── reading-05-sets.html                    sets & operations; set-builder; counting subsets & unions
├── reading-06-predicate-logic.html         ∀/∃; formalization (matching)
├── reading-07-implication.html             truth conditions; vacuous truth; converse
├── reading-08-proofs-1.html                instantiation & detachment (guided proof)
├── reading-09-proofs-2.html                make-believe & generalization (Parsons)
├── reading-10-algebra.html                 algebra & equational reasoning (Parsons)
├── reading-11-structural-induction.html    strings & trees (tree widget + Parsons)
├── reading-12-induction-naturals.html      ℕ as simplest inductive structure (recursion widget + Parsons)
├── reading-13-existentials.html            ∃ and ∧ (Parsons)
├── reading-14-eventuality.html             “eventually greater than”; ∃-then-∀
├── reading-15-negation.html                negation & refutation (matching)
├── reading-16-disjunction.html             ∨, DeMorgan, proof by cases
├── reading-17-contradiction.html           proof by contradiction (Parsons)
├── reading-18-minmax.html                  max/min; tree height as max
├── assets/
│   ├── reading-engine.css                  shared theme (light + dark)
│   └── reading-engine.js                   engine: block renderers, progress, math
├── PLANNED_TOC_v2.md                       the expansion plan (design record)
└── README.md
```

## Running / deploying

Static files — no build step. Open `index.html`, or serve the folder
(`python3 -m http.server`). Math renders with KaTeX 0.16.9 from cdnjs (needs
internet; repoint the three KaTeX URLs to local copies to run offline). Progress
is saved per reading in the browser's `localStorage` — no gradebook, nothing sent
anywhere; a “reset” link is in each reading's top bar.

## Authoring / block types

Each reading is a list of blocks passed to `Reading.init({...})`. Copy an existing
reading and edit. Block types: `prose`, `def`, `mc` (opt. `choiceFeedback[]`),
`selectall` (opt. `hint`), `shortnum` (opt. `tol`, `hint`), `shorttext`
(opt. `accept[]`, `hint`), `matching` (keep `right` values plain text — they sit
in `<option>`s), `parsons` (opt. `hint`), `challenge` (`prompt` + revealable
`solution`; static, never graded), and `custom` (`render(el, api)`; set
`activity:true` and call `api.complete()` to count toward progress). Add
`practice:true` to any auto-graded block to keep it out of the progress bar
(used for the Exam-practice sections). Math uses
`$…$` / `$$…$$`; double LaTeX backslashes in JS strings. Reusable custom widgets:
greedy explorer (R1), guided proof (R8), tree grower (R11), recursion unfolder
(R12).

## How this fits the course

Readings are **consolidation and practice**, not a replacement for the in-class
POGIL activities or productive-struggle problem sets. Assign each reading *after*
its class activity so it doesn't pre-empt the discovery. Prose is adapted from
`book.tex` / `main.tex`; activities mirror the section quizzes and practice sets.
The strings/trees strand (see `inductive_structures_scaffolding_spec.md`) runs
through readings 2, 3, 5, 6, 9(structure predicates), 11, 13, 16, 17, and 18.

## Verification

An automated harness (jsdom + KaTeX) **auto-solves every activity** in all 18
readings using the answer keys and confirms:

- all readings load with no runtime error;
- every one of the 107 in-line activities completes, driving each reading's
  progress bar to 100% and turning on the completion banner;
- every one of the 259 auto-graded Exam-practice items solves to “complete,” and
  all 125 challenge problems reveal a (non-empty) worked solution;
- multiple-choice and select-all options are **shuffled at render time**, so the
  correct answer is not fixed in first position;
- **no connective or technique appears before it is introduced in class** — a
  scanner checks prose, questions, and challenge solutions: ∀/∃/∧/→ only from
  Reading 6, negation/¬ from 15, ∨/DeMorgan/proof-by-cases from 16, and
  proof-by-contradiction from 17;
- no duplicate block ids; no unbalanced `$`; and no `<` immediately before a
  letter inside math (which the browser would eat as a tag);
- every KaTeX snippet renders with no error;
- every nav `prev`/`next` link and asset path resolves.

All numeric, counting, set, tree, and threshold answer keys were additionally
re-computed independently in Python.

## Possible next steps

- Generalize the guided-proof widget into a reusable two-column engine (rule-picker
  updating Known/Goal for arbitrary proofs).
- More string/tree builder animations for the inductive-structures strand.
- Optional completion export or LMS/LTI integration if credit is needed.
- A 19th optional reading on divisibility (currently omitted).
