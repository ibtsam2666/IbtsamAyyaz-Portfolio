# Sample failure report: surviving assertion mutation

**Source:** `mutation-testing/sample-output.txt`  
**Scenario:** NDA-safe public example from the portfolio repository  
**Result:** 1 of 2 mutations killed; 1 survived (50% mutation score)

## Finding

The cart item-count assertion failed when its expected value was mutated, so it detected the change. The total assertion survived a text mutation, which means the test did not reliably protect the checkout total.

```text
KILLED   line 13 (change number): cartItems has count 2
SURVIVED line 15 (change text): checkout total assertion
Mutation score: 50% (1/2 killed)
```

## Diagnosis and next step

The surviving assertion is the coverage gap. Strengthen it to verify the expected total and currency text, then rerun the mutation command. A killed mutant confirms that the test fails when the protected behavior changes.

Run the example from the repository root:

```bash
npm run mutate -- mutation-testing/examples/weak-assertions.spec.ts
```

This artifact is the mutation runner's captured output, not a production failure trace. Playwright traces for the public demo suite are available from the [latest CI report](report/) when a failed run has artifacts.
