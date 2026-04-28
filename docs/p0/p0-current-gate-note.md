# P0 Current Gate Note

Date: 2026-04-24  
Project: Streaming UI Runtime for Long-Lived AI Surfaces  
Status: P0 close-out / prepare P1 strong baselines

## 0. Gate Decision

P0 has reached a controlled positive result on a narrowed workload shape.

The correct next step is:

> Proceed to P1 strong baselines after documentation and commit hygiene.

The wrong next step is:

> Jump directly into P2 runtime implementation.

P0 has not proven a final DOM / VDOM architectural mismatch claim yet. It has established a narrower and stronger controlled result:

> Click-triggered, microtask-dominant batch processing over a large segmented text surface can produce burst-like long tasks, and the burst appears only when boundary count and text mass are both high.

## 1. What P0 Established

### 1.1 Private-product attribution

Private-product traces show that long-session send-path lag is dominated by:

- processing
- scripting
- microtask / flush-like chains

It is not primarily explained by:

- input delay
- rendering
- paint

Private-product evidence also shows that turn count alone is not a sufficient explanatory variable. A better working model is:

> accumulated output / surface mass + message or block boundary structure, with richness and real-work state acting as amplifiers.

### 1.2 P0-D steady append controlled target

P0-D introduced a controlled target with mass and boundary knobs.

Result:

- steady append is boundary-sensitive
- increasing boundary count raises p95 and busy percentage
- but even C5 ultra-boundary does not produce burst-like long tasks

Conclusion:

> Steady append is not the controlled workload shape that best matches the private-product send-path burst.

### 1.3 P0-E click-triggered batch target

P0-E introduced a separate click-triggered batch-commit controlled target.

Result:

- high-high smoke produced a >50ms burst
- E1/E2/E3/E4 matrix showed only high-boundary × high-mass produced a long task
- E4 repeat reproduced the tail burst
- E4 internal breakdown showed the burst is microtask-dominant
- E4 read-only sensitivity showed DOM mutation is not required
- E4 read-only breakdown also showed a microtask-dominant burst

The strongest P0 controlled finding is:

> Burst risk appears when click-triggered batch processing operates over a large and highly segmented text surface.

## 2. Key P0-E Results

### 2.1 E1-E4 matrix

| Cell | block_count | chars/block | p95 ms | max ms | long tasks >50ms | Interpretation |
|---|---:|---:|---:|---:|---:|---|
| E1 low/low | 1000 | 80 | 3.870 | 3.870 | 0 | clean low baseline |
| E2 high-boundary / low-mass | 10000 | 80 | 28.168 | 29.546 | 0 | boundary alone increases cost but is subcritical |
| E3 low-boundary / high-mass | 1000 | 800 | 18.137 | 18.137 | 0 | mass alone increases cost but is subcritical |
| E4 high/high | 10000 | 800 | 24.684 | 97.724 | 1 | high-boundary × high-mass creates tail burst |

### 2.2 E4 repeat

| Run | p95 ms | max ms | long tasks >50ms | Mark check |
|---|---:|---:|---:|---|
| E4 repeat | 65.095 | 97.526 | 1 | PASS |

Interpretation:

> The E4 tail burst is reproducible and not a one-off spike.

### 2.3 E4 microtask breakdown

| Session | max p0eWindow ms | max RunTask ms | max RunMicrotasks ms | avg microtask share | rendering approx |
|---|---:|---:|---:|---:|---:|
| E4 matrix | 98.328 | 98.587 | 98.284 | 0.999 | 0 |
| E4 repeat | 100.666 | 100.915 | 100.635 | 1.000 | 0 |

Interpretation:

> E4 is not rendering-dominant. It is a click-triggered, microtask-dominant scripting burst.

### 2.4 E4 read-only sensitivity

| Run | mutation_mode | p95 ms | max ms | long tasks >50ms | Mark check |
|---|---|---:|---:|---:|---|
| E4 read-only | read-only | 64.385 | 71.930 | 1 | PASS |

Read-only breakdown:

| Session | max p0eWindow ms | max RunTask ms | max RunMicrotasks ms | avg microtask share | rendering approx |
|---|---:|---:|---:|---:|---:|
| E4 read-only | 95.795 | 96.227 | 95.743 | 0.999 | 0 |

Interpretation:

> DOM mutation is not required. Read-only traversal / text scan over a high-boundary × high-mass surface is sufficient to produce a microtask-dominant burst.

## 3. What P0 Does Not Prove

Do not claim:

1. DOM / VDOM mismatch is conclusively proven.
2. The private product internally uses the same implementation as P0-E.
3. P0-E explains all long-session UI bottlenecks.
4. The measured coefficients are universal.
5. Native pointer input dispatch was measured.

P0-E uses programmatic click to measure post-click batch / microtask processing. It reproduces the workload shape, not the exact private-product implementation.

## 4. Gate Interpretation

P0 should be treated as:

> controlled positive on a narrowed workload shape.

Not:

> final architecture proof.

The strongest safe claim is:

> P0 identifies click-triggered, microtask-dominant batch processing over a large segmented text surface as the controlled workload family that best matches the observed private-product send-path lag.

## 5. Decision

P0 can move into close-out.

The next project stage should be:

> P1 strong baselines.

P1 should not start with a new runtime implementation. It should first establish strong baselines so that later runtime claims are not attacked as beating only a weak target.

## 6. P1 Direction

P1 should define and run strong baselines such as:

- naive DOM
- optimized DOM
- DOM + virtualization
- editor-grade baseline if feasible

P1 should test whether strong conventional baselines can handle the P0-E-style workload family:

> click-triggered batch processing over a large segmented text surface.

## 7. Final P0 Gate Statement

P0 has identified the relevant controlled workload shape:

> The problem is not steady append alone. The controlled positive condition is click-triggered batch processing over a large segmented text surface.

Burst-like long tasks appear when:

- boundary count is high
- text mass is high
- batch processing is triggered by an interaction path

The burst is:

- microtask-dominant
- scripting-heavy
- not rendering-dominant
- not dependent on DOM mutation

Current recommendation:

> Close P0 after committing this note and proceed to P1 strong baselines.
