import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

type FetchState = {
  key: string;
  etag: string | null;
  last_modified: string | null;
  fail_count: number;
  backoff_until: string | null;
  last_fetch_at: string | null;
};

type NewsItem = {
  title: string;
  summary: string;
  url: string;
  source: string;
  published_at: string; // ISO string
  sentiment: string | null;
  url_norm?: string; // normalized URL for de-duplication
};

const DEFAULT_RSS_URL = "https://www.financialjuice.com/feed.ashx?xy=rss";

function getEnvNumber(key: string, fallback: number): number {
  const v = Deno.env.get(key);
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function stripHtml(html: string): string {
  try {
    return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  } catch {
    return html;
  }
}

function cleanTitle(raw: string): string {
  try {
    // Remove common "FinancialJuice:" / "Financial Juice:" prefixes (case-insensitive, flexible spaces)
    const cleaned = raw.replace(/^(\s*)(financial\s*juice\s*:|financialjuice\s*:)[\s]*/i, "");
    return cleaned.trim();
  } catch {
    return raw;
  }
}

function normalizeUrl(link: string): string {
  try {
    const u = new URL(link);
    // Lowercase host
    u.host = u.host.toLowerCase();
    // Remove tracking/query noise
    const toDelete = new Set([
      'utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid','mc_cid','mc_eid','ref','ref_src','igshid','utm_name','utm_id','utm_reader','spm','yclid','msclkid','_hsenc','_hsmi','vero_conv','vero_id','rb_clickid','oly_anon_id','oly_enc_id','xy'
    ]);
    for (const [k] of u.searchParams.entries()) {
      if (k.startsWith('utm_') || toDelete.has(k)) {
        u.searchParams.delete(k);
      }
    }
    // Drop fragment
    u.hash = '';
    // If query becomes empty, ensure no trailing '?'
    const pathname = u.pathname.replace(/\/+$/,'');
    const lowerPath = pathname.toLowerCase();
    u.pathname = lowerPath.length ? lowerPath : '/';
    return u.toString();
  } catch {
    return link;
  }
}

function parseRss(xml: string, limit = 20): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  const titleRegex = /<title>([\s\S]*?)<\/title>/i;
  const linkRegex = /<link>([\s\S]*?)<\/link>/i;
  const pubDateRegex = /<pubDate>([\s\S]*?)<\/pubDate>/i;
  const descRegex = /<description>([\s\S]*?)<\/description>/i;

  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) && items.length < limit) {
    const block = m[1];
    const titleRaw = (block.match(titleRegex)?.[1] ?? "Untitled").trim();
    const title = cleanTitle(titleRaw);
    const link = (block.match(linkRegex)?.[1] ?? "#").trim();
    const pubDate = (block.match(pubDateRegex)?.[1] ?? new Date().toUTCString()).trim();
    const descRaw = (block.match(descRegex)?.[1] ?? "").trim();
    const summary = stripHtml(descRaw);

    const publishedIso = new Date(pubDate).toISOString();

    items.push({
      title,
      summary,
      url: link,
      source: "Financial Juice",
      published_at: publishedIso,
      sentiment: null,
      url_norm: normalizeUrl(link),
    });
  }
  return items;
}

Deno.serve(async (req: Request) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: "Missing Supabase env (URL or SERVICE_ROLE_KEY)" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const RSS_URL = Deno.env.get("FJ_RSS_URL") || DEFAULT_RSS_URL;
  const MIN_INTERVAL_SEC = getEnvNumber("FJ_MIN_INTERVAL_SEC", 180);
  const JITTER_SEC = getEnvNumber("FJ_JITTER_SEC", 15);
  const MAX_BACKOFF_SEC = getEnvNumber("FJ_MAX_BACKOFF_SEC", 900);
  const LIMIT = getEnvNumber("FJ_LIMIT", 20);
  const USER_AGENT = Deno.env.get("FJ_USER_AGENT") ||
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  const now = new Date();

  // Load fetch state
  const { data: stateRow, error: stateErr } = await supabase
    .from("fetch_state")
    .select("*")
    .eq("key", "financialjuice")
    .maybeSingle();

  if (stateErr) {
    return new Response(JSON.stringify({ error: stateErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const state: FetchState | null = stateRow as any;

  // Backoff check
  if (state?.backoff_until) {
    const until = new Date(state.backoff_until);
    if (now < until) {
      return new Response(
        JSON.stringify({ status: "backoff", backoff_until: until.toISOString() }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  // Throttle check
  if (state?.last_fetch_at) {
    const last = new Date(state.last_fetch_at).getTime();
    const jitter = Math.random() * JITTER_SEC * 1000;
    const minNext = last + MIN_INTERVAL_SEC * 1000 + jitter;
    if (Date.now() < minNext) {
      return new Response(
        JSON.stringify({ status: "throttled", next_after_ms: minNext - Date.now() }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  // Conditional headers
  const headers: Record<string, string> = { "User-Agent": USER_AGENT };
  if (state?.etag) headers["If-None-Match"] = state.etag;
  if (state?.last_modified) headers["If-Modified-Since"] = state.last_modified;

  const resp = await fetch(RSS_URL, { headers });
  const status = resp.status;

  // 304 Not Modified
  if (status === 304) {
    await supabase.from("fetch_state").upsert({
      key: "financialjuice",
      last_fetch_at: now.toISOString(),
      etag: resp.headers.get("etag") ?? state?.etag ?? null,
      last_modified: resp.headers.get("last-modified") ?? state?.last_modified ?? null,
      fail_count: 0,
      backoff_until: null,
    });

    return new Response(JSON.stringify({ status: "not_modified" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 200 OK
  if (status === 200) {
    const body = await resp.text();
    const items = parseRss(body, LIMIT);

    // Upsert news items
    if (items.length > 0) {
      // De-dup within this batch by url_norm
      const seen = new Set<string>();
      const unique = items.filter((it) => {
        const key = it.url_norm || it.url;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const { data: upData, error: upErr } = await supabase
        .from("news_items")
        .upsert(unique, { onConflict: "url_norm", ignoreDuplicates: true })
        .select('id');
      if (upErr) {
        return new Response(JSON.stringify({ error: upErr.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      // Adjust items length to actual inserted count if available
      try {
        // Use returned rows length as ingested count
        (items as any)._ingested = Array.isArray(upData) ? upData.length : items.length;
      } catch {}
    }

    // Update state
    await supabase.from("fetch_state").upsert({
      key: "financialjuice",
      last_fetch_at: now.toISOString(),
      etag: resp.headers.get("etag") ?? state?.etag ?? null,
      last_modified: resp.headers.get("last-modified") ?? state?.last_modified ?? null,
      fail_count: 0,
      backoff_until: null,
    });

    const inserted = (items as any)._ingested ?? items.length;
    return new Response(JSON.stringify({ status: "ok", ingested: inserted }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 403/429 → backoff
  if (status === 403 || status === 429) {
    const nextFail = (state?.fail_count ?? 0) + 1;
    const backoff = Math.min(MAX_BACKOFF_SEC, Math.floor(30 * Math.pow(2, Math.min(nextFail, 6))));
    const until = new Date(Date.now() + backoff * 1000);
    await supabase.from("fetch_state").upsert({
      key: "financialjuice",
      fail_count: nextFail,
      backoff_until: until.toISOString(),
      last_fetch_at: now.toISOString(),
    });

    return new Response(JSON.stringify({ status: "backoff", seconds: backoff }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Other HTTP errors
  return new Response(JSON.stringify({ error: `HTTP ${status}` }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
