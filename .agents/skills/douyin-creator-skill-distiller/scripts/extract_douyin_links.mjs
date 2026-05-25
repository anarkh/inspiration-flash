#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

function usage() {
  return `Usage:
node extract_douyin_links.mjs --url <douyin-user-url> [--out-dir ./outputs] [--name creator] [--chrome /path/to/chrome] [--headless true|false] [--max-pages 120] [--max-items 300] [--include-copy-columns true|false]

Outputs:
  douyin_video_links.json
  douyin_video_links.csv

For blogger distillation, pass --max-items 300 --include-copy-columns true.
That CSV layout keeps D=分享链接 and E=视频文案 for transcript backfill.`;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function toDateString(seconds) {
  if (!seconds || Number.isNaN(Number(seconds))) return '';
  const d = new Date(Number(seconds) * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function safeName(value) {
  return normalizeText(value)
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'douyin_creator';
}

function getSecUid(profileUrl) {
  const match = String(profileUrl).match(/douyin\.com\/user\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function normalizeAweme(item, sourceProfileUrl, source = 'post-api') {
  if (!item || typeof item !== 'object') return null;
  const id = String(item.aweme_id || item.group_id || item.item_id || item.id || '');
  if (!/^\d{8,}$/.test(id)) return null;
  const createTime = Number(item.create_time || 0) || null;
  return {
    id,
    published_at: toDateString(createTime),
    create_time: createTime,
    desc: normalizeText(item.desc || item.item_title || item.share_info?.share_title),
    author: normalizeText(item.author?.nickname),
    video_url: `https://www.douyin.com/video/${id}`,
    source_profile_url: sourceProfileUrl,
    source,
  };
}

async function importPlaywright() {
  try {
    return await import('playwright-core');
  } catch (error) {
    console.error('Missing dependency: playwright-core');
    console.error('Install it first, for example: npm install playwright-core');
    console.error(error.message);
    process.exit(2);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.url) {
    console.log(usage());
    process.exit(args.help ? 0 : 1);
  }

  const profileUrl = args.url;
  const secUid = getSecUid(profileUrl);
  if (!secUid) {
    throw new Error('Expected a Douyin profile URL like https://www.douyin.com/user/<sec_uid>');
  }

  const outDir = path.resolve(args['out-dir'] || './outputs/douyin_links');
  const chromePath = args.chrome || process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const headless = String(args.headless || 'false') === 'true';
  const maxPages = Number(args['max-pages'] || 120);
  const maxItems = Number(args['max-items'] || 0);
  const includeCopyColumns = String(args['include-copy-columns'] || 'false') === 'true';
  const requestedName = args.name || '';

  const { chromium } = await importPlaywright();
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless,
    args: ['--no-first-run', '--no-default-browser-check'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  });
  const page = await context.newPage();

  let firstPostUrl = '';
  const responseLog = [];
  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('/aweme/v1/web/aweme/post/')) {
      if (!firstPostUrl) firstPostUrl = url;
      responseLog.push({ status: response.status(), url: url.slice(0, 800) });
    }
  });

  await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);

  for (let i = 0; i < 8 && !firstPostUrl; i += 1) {
    await page.mouse.wheel(0, 4500);
    await page.waitForTimeout(1800);
  }

  const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  if (/验证码|验证|安全校验|captcha/i.test(bodyText) && !firstPostUrl) {
    throw new Error('Douyin appears to require manual verification. Complete it in the visible browser, then rerun the script.');
  }
  if (!firstPostUrl) {
    throw new Error('Could not capture Douyin post-list API. Check that the profile is public and accessible.');
  }

  async function fetchPostPage(cursor, pageNo) {
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        return await page.evaluate(async ({ firstPostUrl, secUid, cursor, pageNo }) => {
          const url = new URL(firstPostUrl);
          url.searchParams.set('sec_user_id', secUid);
          url.searchParams.set('max_cursor', cursor);
          url.searchParams.set('count', '18');
          url.searchParams.set('need_time_list', pageNo === 1 ? '1' : '0');
          url.searchParams.delete('a_bogus');
          url.searchParams.delete('x-secsdk-web-signature');
          url.searchParams.delete('msToken');
          const response = await fetch(url.toString(), {
            method: 'GET',
            credentials: 'include',
            headers: { accept: 'application/json, text/plain, */*' },
          });
          const text = await response.text();
          let json = null;
          try { json = JSON.parse(text); } catch {}
          return {
            ok: response.ok && Array.isArray(json?.aweme_list),
            page: {
              page_no: pageNo,
              status: response.status,
              cursor,
              has_more: json?.has_more,
              max_cursor: json?.max_cursor,
              item_count: Array.isArray(json?.aweme_list) ? json.aweme_list.length : null,
              text_start: text.slice(0, 240),
            },
            items: Array.isArray(json?.aweme_list) ? json.aweme_list : [],
          };
        }, { firstPostUrl, secUid, cursor, pageNo });
      } catch (error) {
        if (attempt === 4) throw error;
        await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(2000 * attempt);
      }
    }
    return { ok: false, page: { page_no: pageNo, cursor }, items: [] };
  }

  const pages = [];
  const rowsById = new Map();
  let cursor = '0';
  let hasMore = 1;
  let completed = false;
  let limitReached = false;

  for (let pageNo = 1; pageNo <= maxPages && hasMore; pageNo += 1) {
    const result = await fetchPostPage(cursor, pageNo);
    pages.push(result.page);
    if (!result.ok) break;
    for (const item of result.items) {
      const row = normalizeAweme(item, profileUrl);
      if (row) rowsById.set(row.id, row);
    }
    hasMore = Number(result.page.has_more || 0);
    completed = hasMore === 0;
    if (maxItems > 0 && rowsById.size >= maxItems) {
      limitReached = hasMore !== 0 || rowsById.size > maxItems;
      break;
    }
    const nextCursor = String(result.page.max_cursor ?? '');
    if (!nextCursor || nextCursor === cursor) break;
    cursor = nextCursor;
    await page.waitForTimeout(700);
  }

  const pageTitle = await page.title().catch(() => '');
  const creatorName = requestedName || Array.from(rowsById.values()).find((row) => row.author)?.author || pageTitle.replace(/的抖音.*/, '') || 'douyin_creator';
  await browser.close();

  const allRows = Array.from(rowsById.values()).sort((a, b) => (b.create_time || 0) - (a.create_time || 0) || a.id.localeCompare(b.id));
  const rows = maxItems > 0 ? allRows.slice(0, maxItems) : allRows;
  const result = {
    scraped_at: new Date().toISOString(),
    creator_name: creatorName,
    profile_url: profileUrl,
    sec_uid: secUid,
    completed: completed && !limitReached,
    requested_max_items: maxItems || null,
    limit_reached: limitReached,
    count: rows.length,
    fetched_count_before_limit: allRows.length,
    page_count: pages.length,
    last_page: pages.at(-1) || null,
    pages,
    response_log: responseLog,
    rows,
  };

  const finalDir = path.join(outDir, safeName(creatorName));
  await fs.mkdir(finalDir, { recursive: true });
  const jsonPath = path.join(finalDir, 'douyin_video_links.json');
  const csvPath = path.join(finalDir, 'douyin_video_links.csv');

  const headers = includeCopyColumns
    ? ['序号', '发布时间', '标题/列表摘要', '分享链接', '视频文案', '视频ID', '作者', '来源主页', '文案状态', '备注']
    : ['序号', '发布时间', '视频ID', '标题/文案', '分享链接', '作者', '来源主页'];
  const csvRows = rows.map((row, index) => includeCopyColumns
    ? [
      index + 1,
      row.published_at,
      row.desc,
      row.video_url,
      '',
      row.id,
      row.author,
      row.source_profile_url,
      '',
      '',
    ]
    : [
      index + 1,
      row.published_at,
      row.id,
      row.desc,
      row.video_url,
      row.author,
      row.source_profile_url,
    ]);
  const csv = [headers, ...csvRows].map((line) => line.map(csvEscape).join(',')).join('\n');

  await fs.writeFile(jsonPath, JSON.stringify(result, null, 2), 'utf8');
  await fs.writeFile(csvPath, csv, 'utf8');

  console.log(JSON.stringify({
    ok: true,
    creator_name: creatorName,
    completed: result.completed,
    requested_max_items: result.requested_max_items,
    limit_reached: result.limit_reached,
    count: rows.length,
    page_count: pages.length,
    json_path: jsonPath,
    csv_path: csvPath,
    last_page: result.last_page,
  }, null, 2));
}

main().catch(async (error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
