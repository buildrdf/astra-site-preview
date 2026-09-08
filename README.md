# Astra — landing page (review copy)

A byte-for-byte copy of `website/` from the Astra repo, published so it can be
reviewed in an ordinary browser. Pure static: no build, no server, no keys.

Serve it locally with any static server, e.g.
    python3 -m http.server 4330 --bind 127.0.0.1
then open http://127.0.0.1:4330/

The birth chart, the sky and every number on the page are computed in the browser
by the engine modules in `vendor/astro/`.
