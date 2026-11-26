import fs from "node:fs";
import path from "node:path";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ 缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const TABLES = ["songs", "schedules", "games", "featured_videos", "social_posts", "site_counters"];
const outDir = path.resolve(process.cwd(), "backups");
fs.mkdirSync(outDir, { recursive: true });

async function fetchAllRows(table) {
  const pageSize = 1000;
  let offset = 0;
  const all = [];
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=${pageSize}&offset=${offset}`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`${table} HTTP ${res.status}: ${await res.text()}`);
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    all.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

const summary = { backedUpAt: new Date().toISOString(), counts: {} };

for (const table of TABLES) {
  const rows = await fetchAllRows(table);
  fs.writeFileSync(path.join(outDir, `${table}.json`), JSON.stringify(rows, null, 2) + "\n", "utf8");
  summary.counts[table] = rows.length;
  console.log(`✅ 备份 ${table}: ${rows.length} 条`);
}

fs.writeFileSync(path.join(outDir, "backup-meta.json"), JSON.stringify(summary, null, 2) + "\n", "utf8");
console.log("🎉 全部 5 张表备份完成！");
