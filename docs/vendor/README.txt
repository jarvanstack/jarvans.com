Vendored browser dependencies
=============================

These files are served from the site origin so the first render does not
depend on jsDelivr or Google Fonts being reachable from mainland China.

Versions:
- docsify 4.13.1 (core, search, zoom-image, and Vue theme)
- docsify-copy-code 3.0.2
- docsify-count 1.1.0
- docsify-pagination 2.10.1
- prismjs 1.30.0 (Bash and Go components)
- docsify-sidebar-collapse 1.3.5
- jarvanstack/website-view 0.0.3

The packages were downloaded from their version-pinned jsDelivr URLs. The
Google Fonts import was removed from the Docsify theme so it uses the existing
system-font fallbacks. The website-view endpoint was changed to the equivalent
same-origin /dc3 route to avoid an extra DNS and TLS connection.
