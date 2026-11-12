# Brief 04: copying-fidelity figure specification

Date: 2026-11-12. Status: Internal design draft; not a public article or early-Earth reconstruction.

Question: How does the probability of an error-free copy change with length under a simple independent-error model?

Define q as the per-site probability of a correct copy and L as the number of copied sites. Assume a fixed q at every site and independent errors. The probability of an error-free whole copy is q^L. This is an elementary probability calculation; it is not an estimate of functional survival, an Eigen threshold, or the maximum possible genome size. Contextual sources: dossier S04 (theory), S03 (designed catalytic evolution), S05 (compartment feasibility). Their full claim records are still required before brief 04 is drafted.

Use a code-native interactive figure with three labeled curves (q = 0.9, 0.99, 0.999) and a native, labeled length control. Horizontal axis: L in sites, 1–1,000. Vertical axis: probability, 0–1. Show numeric q and q^L in an accessible exact-value table alongside the plot. Do not plot a labeled “life threshold” or silently swap probability for retained functional information.

Independent expected values, rounded to six decimals for display:

| q | L = 10 | L = 100 | L = 1,000 |
| --- | --- | --- | --- |
| 0.9 | 0.348678 | 0.000027 | 0.000000 |
| 0.99 | 0.904382 | 0.366032 | 0.000043 |
| 0.999 | 0.990045 | 0.904792 | 0.367695 |

The small nonzero value at q = 0.9, L = 1,000 must use scientific notation in the interactive display rather than appear as exact zero. General properties to verify: q = 1 gives 1; q = 0 gives 0 for positive L; at fixed 0 < q < 1, increasing L decreases q^L; increasing q increases q^L. Restrict L to positive integers and q to [0,1]. L = 0 is outside the proposed UI.

Caption: “Illustrative independent-error copying model. Probability of an error-free sequence, not probability of a functional descendant. Parameters are chosen for teaching and are not measured early-Earth values.”

Article follow-up must distinguish imperfect functional copies, selection, neutral networks, parasites, complementation, compartments, and assistance in laboratory amplification. Keep the visualization calculation separate from those biological and historical inferences. No widget is implemented in batch 0 because the corresponding origins article and evidence record are not ready.
