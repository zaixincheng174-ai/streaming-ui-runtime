# React 18 Local Vendor Files

Version: React 18.3.1 / React DOM 18.3.1

Source:

- `https://unpkg.com/react@18.3.1/umd/react.production.min.js`
- `https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js`

License: MIT. React is distributed by Meta under the MIT license.

Vendored files:

| File | SHA-256 |
| --- | --- |
| `react.production.min.js` | `d949f1c3687aedadcedac85261865f29b17cd273997e7f6b2bfc53b2f9d4c4dd` |
| `react-dom.production.min.js` | `35f4f974f4b2bcd44da73963347f8952e341f83909e4498227d4e26b98f66f0d` |

Reason for local vendoring:

P1 measurement runs must not depend on runtime CDN or network fetches. These pinned production UMD bundles keep the `production-react-sanity` target deterministic and self-contained while avoiding a package-manager, bundler, Babel, or development-server workflow.
