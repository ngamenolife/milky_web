import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("out");
const port = Number(process.env.PORT || 3000);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function resolveFile(urlPath) {
  let clean = decodeURIComponent(urlPath.split("?")[0]);
  if (clean === "/milky_web") clean = "/";
  else if (clean.startsWith("/milky_web/")) clean = clean.slice("/milky_web".length);
  const candidates = [
    path.join(root, clean),
    path.join(root, clean, "index.html"),
    path.join(root, clean + ".html"),
  ];
  for (const c of candidates) {
    if (c.startsWith(root) && fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

http.createServer((req, res) => {
  const file = resolveFile(req.url || "/");
  if (!file) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => {
  console.log("Static out server running at http://127.0.0.1:" + port);
});
