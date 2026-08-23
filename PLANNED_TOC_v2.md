# CS 227 Interactive Readings — proposed expansion to 18 (per-session)

Draft for review. Nothing below is built yet. The current 8 readings are
redistributed into 18 finer readings, each ≈ one class session, plus 4 genuinely
new ones. Same engine, same verification bar.

Legend for "Source": **NEW** = author from scratch · **split** = carved out of an
existing reading · **reuse** = existing content moves largely intact.

| # | Reading (filename) | ≈ S23 day(s) | Source material | Core interactive activities / widgets | Strand touch | Build |
|---|---|---|---|---|---|---|
| 1 | **Why prove?** — testing vs. verification (`reading-01-why-prove.html`) | 1/17 | intro of `book.tex`/`main.tex`; greedy-scheduling opener (from CS 452) | MC: what testing establishes vs. proof; pick the input where a greedy rule fails; “counterexample” concept; small **greedy-counterexample widget** (try a rule → see it break) | — | **NEW** |
| 2 | **Conditions and types** (`reading-02-conditions.html`) | 1/17–1/19 | `act_01` Model 2; `main.tex` §Predicate; `book.tex` “Anatomy of a condition” | type & arity classification; unary vs binary; “is this a sentence?” | strings/trees as typed objects | split (from cur. R1) |
| 3 | **Truth, entailment & complementation** (`reading-03-truth.html`) | 1/24 | `act_01` Models 3–4; `main.tex` §Tautology, §Complementation; `book.tex` Entailment/Tautologies; `classproblems_01` | satisfiable/falsifiable/tautological/contradictory; entailment; complement; select-all tautologies | — | split (from cur. R1) |
| 4 | **Sets and operations** (`reading-04-sets.html`) | 1/26–1/31 | `main.tex` §Sets/Operations/From sets to predicates; `book.tex` §Sets | union/intersection/difference; cardinality; sets ↔ conditions | — | split (from cur. R2) |
| 5 | **Functions and counting** (`reading-05-counting.html`) | 1/26–1/31 | `act_02`; `main.tex` §Functions/§Counting; `classproblems_02` | functions; product & sum rules; count functions & subsets; restricted-count transfer | a string is a function | split (from cur. R2) |
| 6 | **Predicate logic & formalization** (`reading-06-predicate-logic.html`) | 2/2–2/9 | `act_03`; `main.tex` §Universal/Existential properties, §Free & bound, §Statements; `classproblems_03` | ∀/∃; formalize English↔logic; ∀-with-→ / ∃-with-∧; free vs bound; **matching** | prefix / subtree predicates | reuse (cur. R3) |
| 7 | **Implication, up close** (`reading-07-implication.html`) | 2/9–2/14 | `main.tex` §Implication/§Bribery, §Hidden if-then, §Restricting scope; `book.tex` Implication | vacuous truth (the sticky point); truth conditions; converse ≠ implication; hidden “if-then” in English | — | **NEW** |
| 8 | **Proofs I: instantiation & detachment** (`reading-08-proofs-1.html`) | 2/14 | `classproblems_04` (draconical-sciurine); `main.tex` §Your first proof | Known/Goal method; universal instantiation; detachment; **guided proof** (reach a fact about Scrat) | — | split (from cur. R4) |
| 9 | **Proofs II: make-believe & generalization** (`reading-09-proofs-2.html`) | 2/16–2/21 | `main.tex` §Make-believe rule, §Universal generalization; `classproblems_04/05` | make-believe; universal generalization; **guided proof** (Fafnir fears all squirrels); **Parsons** chaining | — | split (from cur. R4) |
| 10 | **Algebra in proofs** (`reading-10-algebra.html`) | 2/21 | `main.tex` §Algebra in proofs; `classproblems_04` math part, `classproblems_05` | equational reasoning; prove “square of a positive is positive”; inequality manipulation; guided/Parsons proof | — | **NEW** (some reuse) |
| 11 | **Induction and recursion** (`reading-11-induction.html`) | 2/28–3/9 | `act_07` Models 1–2; `main.tex` §Hereditarity/§Proofs by induction; JMU puzzle, Hanoi | **recursion-unfolder widget**; base case & inductive step; hereditary properties; evaluate recursions; **Parsons** induction proof | ℕ as the first inductive type | split (from cur. R5) |
| 12 | **Structural induction on strings & trees** (`reading-12-structural-induction.html`) | 3/21–3/28 | `act_07` Model 3; `classproblems_induction_1`; `book.tex` §Trees; tiling; strand spec | string/tree constructors; **tree-grower widget**; the step’s conjunction-over-subtrees; leaves = internal + 1; tiling idea | **the strand’s home** | split (from cur. R5) |
| 13 | **Existentials & conjunction** (`reading-13-existentials.html`) | 3/30–4/6 | `main.tex` §Proofs with ∃ and ∧; `classproblems_06` (giraffe/gnu) | existential generalization; name-a-witness; ∧ rules; witnesses; **Parsons** “there is a mammal” | existence over structures | reuse (cur. R6) |
| 14 | **Eventuality** (`reading-14-eventuality.html`) | 4/13 | `main.tex` §Eventuality, “eventually greater than”; `act_04` Model 3 | ∃N ∀n≥N reasoning; transitivity of “eventually greater than”; nested-quantifier practice | sequences as functions ℕ→X | **NEW** |
| 15 | **Negation & refutation** (`reading-15-negation.html`) | 4/18 | `main.tex` §Refutation, §Negation; `act_05` | pushing ¬ through ∀/∃/→; refute by counterexample; **matching** statement↔negation | negating structural claims | split (from cur. R7) |
| 16 | **Disjunction, DeMorgan & cases** (`reading-16-disjunction.html`) | 4/20–4/27 | `main.tex` §Proof by cases; ∨ rules | DeMorgan; prove vs use ∨; proof by cases; a constructor is a disjunction | case split = constructors | split (from cur. R7) |
| 17 | **Proof by contradiction** (`reading-17-contradiction.html`) | 4/25 | `main.tex` §Negation and proof by contradiction; `classproblems_08` | contradiction setup; “if n² even then n even”; no-largest-integer; **Parsons** contradiction proof | no string is a strict prefix of itself | split (from cur. R8) |
| 18 | **Max, min & tree height** (`reading-18-minmax.html`) | 5/2–5/4 | `act_06` (maxima/minima); `classproblems_09` | min/max axioms; max<z ↔ ∧; min<z ↔ ∨; tree height = max | tree height is max | split (from cur. R8) |

## What this changes

- **4 genuinely new readings**: #1 Why prove?, #7 Implication up close, #10 Algebra in proofs, #14 Eventuality. The rest are splits/reallocations of the existing 8, so most content and all widgets are reused.
- **Widgets reused**: recursion unfolder & tree grower (#11–#12), guided proof (#8–#10), matching (#6, #15), Parsons (several). One possible new widget: the greedy-counterexample demo in #1 (optional — could be static instead).
- **Filenames change** (everything gets a descriptive, numbered name) and the current 8 files would be replaced. Because progress is keyed by reading `id`, renumbering just starts everyone fresh — no migration needed.
- Each reading keeps the same shape: prose + ~6–10 activities, per-distractor feedback, one “Apply it” transfer item, and it must auto-solve to 100% in the review harness before it ships.

## Decisions (locked 2026)

- **#14 Eventuality**: stays a separate reading.
- **#1 greedy demo**: build it interactive.
- **Divisibility**: omitted for now.
- **Induction order — structural first**: readings 11 and 12 swap. #11 becomes
  **Structural induction on strings & trees** (inductively-defined objects,
  constructors → recursion → structural induction, `leaves = internal + 1`), and
  #12 becomes **Induction on the natural numbers**, framing ℕ as the *simplest*
  inductive structure (0 / successor) — a special case of what students just saw.
  Calendar-day mapping becomes nominal for this pair.

## Open questions for you

1. **Eventuality (#14)** — worth its own reading, or fold into #13 Existentials? It was ~1 day in S23 and is conceptually distinctive, so I lean toward keeping it separate.
2. **#1 greedy widget** — build the interactive “try-a-rule-see-a-counterexample” demo, or keep #1 lighter (static example + MCs)?
3. **Divisibility** — present in `main.tex` but dropped from the S23 schedule. Omit (my default), or add a 19th optional reading?
4. **Split points** — comfortable with cutting Proofs into I/II/Algebra (three), and Induction into numeric/structural (two)? That’s where the density was.
