/* One door for every image the page loads.

   Served normally, this returns the path unchanged. The single-file build
   (website/dist/astra-landing.html) has no files beside it, so it defines
   globalThis.__ASTRA_ASSETS — a map of path to data URI — and every image
   resolves through that instead. Because all art goes through this one
   function, the build never has to pattern-match minified code. */
export const asset = p => globalThis.__ASTRA_ASSETS?.[p] ?? p;
