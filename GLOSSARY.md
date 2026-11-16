# Glossary

Shared vocabulary for the Mentingo domain. Terms only — no implementation detail.

## Quiz questions

- **Blank** — a gap in a fill-in-the-blanks question that the learner must fill with one word. Blanks are numbered for the learner ("Blank 2 of 5").
- **Word** — a single token the learner places into a **blank**. Each word can occupy at most one blank at a time.
- **Word bank** — the pool of **words** not currently placed in any **blank**.
- **Fill-in-the-blanks** — a question made of a sentence with one or more **blanks**. Two kinds:
  - **Text fill-in-the-blanks** — the learner types the answer into each blank.
  - **Drag fill-in-the-blanks** — the learner takes **words** from the **word bank** and places them into **blanks**.
- **Matching** — a question that pairs each **item** with its **target**.
- **Item** — the fixed left-hand side of a **matching** pair; the thing the learner must find a **target** for.
- **Target** — the value the learner assigns to an **item** in a **matching** question. Each target can be assigned to at most one item at a time.
- **Swap** — the rule for reusing an already-placed **word** or **target**: assigning it to a new **blank**/**item** moves it there and sends whatever was in the destination back to the source. A word/target is never duplicated and is never blocked from being reused.
- **Answer method** — how a learner records an answer. For drag fill-in-the-blanks and matching there are two: selecting from a list (by click or keyboard) is the default; dragging is the secondary alternative.
