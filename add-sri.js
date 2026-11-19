// Adds Subresource Integrity (SRI) to the CDN scripts of the mini app.
// Run from the project root (the folder that contains index.html), needs Node 18+ and internet:
//   node add-sri.mjs
// Safe to run again: it replaces hashes it added before.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const FAKE = process.env.SRI_FAKE === "1"; // offline self-test only
const URLS = {
  three: "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
  geo: "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/BufferGeometryUtils.js",
  supa: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js",
};
async function sri(url) {
  if (FAKE) return "sha384-FAKEFAKEFAKE";
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + " -> HTTP " + r.status);
  return "sha384-" + createHash("sha384").update(Buffer.from(await r.arrayBuffer())).digest("base64");
}
const H = {};
for (const [k, u] of Object.entries(URLS)) { H[k] = await sri(u); console.log(k, H[k]); }

// index.html: <script defer src="URL"> -> add integrity + crossorigin
let html = readFileSync("index.html", "utf8");
for (const k of ["three", "geo"]) {
  const re = new RegExp(`<script defer src="${URLS[k].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*></script>`);
  if (!re.test(html)) throw new Error("script tag not found in index.html: " + URLS[k]);
  html = html.replace(re, `<script defer src="${URLS[k]}" integrity="${H[k]}" crossorigin="anonymous"></script>`);
}
writeFileSync("index.html", html);

// js/conclave.js: dynamic supabase-js loader
let js = readFileSync("js/conclave.js", "utf8");
const re2 = /e\.src=SB\.lib;(e\.integrity="[^"]*";e\.crossOrigin="anonymous";)?/;
if (!re2.test(js)) throw new Error("loader not found in js/conclave.js");
js = js.replace(re2, `e.src=SB.lib;e.integrity="${H.supa}";e.crossOrigin="anonymous";`);
writeFileSync("js/conclave.js", js);
console.log("Done: index.html and js/conclave.js updated.");
