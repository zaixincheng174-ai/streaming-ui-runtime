# Results Summary

This page summarizes the public evidence behind the resume-level claims for the Streaming UI Runtime project.

## Key claims

| Claim | Evidence location | Notes |
|---|---|---|
| 406 passing tests | `npm run test:runtime` | Runtime test suite covering protocol validation, scheduler policies, worker/main adapter contracts, and transaction lifecycle. |
| 17-module TypeScript runtime | `runtime/core/`, `runtime/main/`, `runtime/worker/`, `runtime/testing/` | Public runtime structure is included in this repository. |
| 68ms → 2.7ms worker offload result | `docs/portfolio/evidence-map.md` | Public portfolio evidence summary. |
| 22.9ms → 3.3ms urgent click-to-visible reduction | `docs/portfolio/evidence-map.md` | Public portfolio evidence summary. |
| Long-lived AI surface workload framing | `docs/portfolio/README.md` | Explains why AI chat and agent surfaces differ from traditional document pages. |

## How to verify locally

Run:

`npm install`

Then:

`npm run test:runtime`

Expected result: 406 passing tests.

## Public-release boundary

Raw trace-derived CSVs and trace-specific research notes are not included in this public portfolio repository. This repo contains sanitized portfolio evidence, public benchmark scaffolding, runtime code, and documentation.
