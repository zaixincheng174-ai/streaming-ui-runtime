# Privacy And Data Policy For Public Release

This project should be public only with sanitized benchmark summaries, synthetic/controlled workloads, and documentation that preserves claim boundaries.

## Rules

Do not commit:

- `.env` or `.env.*`
- credentials, API keys, passwords, bearer tokens, or private keys
- raw private traces
- raw `.har` files
- raw `.trace` files
- local logs
- private result folders
- local Codex state
- user-specific screenshots or recordings
- private product/session context

## Public-Safe Data

Public data should be limited to:

- synthetic controlled benchmark scenarios;
- sanitized aggregate benchmark summaries;
- documentation that explains methodology and boundaries;
- figures that do not expose private session content;
- reproducible commands that write outputs to local or temporary paths.

## Private Data

Keep these out of the public repo:

- `traces/private/`
- `results/private/`
- `private/`
- `local/`
- raw capture folders under `/tmp`
- local-only result folders such as unreviewed `bench/p0/results/`

## Current Release-Safety Note

The public repo tracks sanitized trace-derived summaries under `docs/portfolio/results/`. Local trace-derived CSV source files may exist under ignored private/local paths such as `bench/p0/private-trace-derived/` or `bench/p0/results/`, but they are not part of the public evidence package.

Do not publish local source CSVs blindly. Preferred release path:

1. keep private originals locally;
2. create sanitized public summaries if needed;
3. document any transformations;
4. avoid publishing raw trace files entirely.

## Credential Scan Command

Before public release, run:

```bash
git grep -n "OPENAI_API_KEY\\|ANTHROPIC_API_KEY\\|api_key\\|secret\\|token\\|password\\|Bearer " || true
find . -maxdepth 4 \\( -iname "*.env*" -o -iname "*.har" -o -iname "*.trace" -o -iname "*.log" \\) -print || true
```

Review results manually. Some matches may be false positives, such as benchmark "token" fields.

## .gitignore Coverage

The root `.gitignore` excludes:

- environment files;
- private trace/result folders;
- local/private folders;
- `.trace`, `.har`, and `.log` files;
- dependency/build/test-output folders;
- local Codex auth/history files.

Remember: `.gitignore` does not remove already tracked files. Tracked sensitive files must be reviewed explicitly before publication.
