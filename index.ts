const DEFAULT_ITEM_URL =
  'https://store.ui.com/us/en/category/cameras-doorbells/collections/pro-store-doorbells-chimes/products/uacc-chime-poe';
const DEFAULT_CHECK_INTERVAL_MINUTES = 10;

const FINDMY_URL = process.env.FINDMY_URL ?? 'http://localhost:1919/findmy';
const DEFAULT_DEVICE_NAME = process.env.TARGET_DEVICE_NAME ?? 'My iPhone';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getCheckIntervalMinutes(): number {
  const raw = process.env.CHECK_INTERVAL_MINUTES;
  if (!raw) return DEFAULT_CHECK_INTERVAL_MINUTES;

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) {
    console.warn(
      `Invalid CHECK_INTERVAL_MINUTES="${raw}", falling back to ${DEFAULT_CHECK_INTERVAL_MINUTES} minutes`
    );
    return DEFAULT_CHECK_INTERVAL_MINUTES;
  }

  return parsed;
}

/** Fetch the page raw HTML using custom UA */
async function fetchRawPage(url: string): Promise<string> {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent':
        'ChatGPTBrowser Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
    }
  });

  if (!res.ok) {
    throw new Error(
      `Fetch failed with ${res.status} ${res.statusText}`
    );
  }

  return await res.text();
}

/** True = in stock, false = out of stock */
async function checkStockOnce(url: string): Promise<boolean> {
  const html = await fetchRawPage(url);

  const outOfStock = html.includes('To subscribe to back in stock emails');
  const inStock = !outOfStock;

  console.log(`[${new Date().toISOString()}] In stock:`, inStock);

  return inStock;
}

function getAppleCredentials() {
  const username = process.env.APPLE_USERNAME ?? '';
  const password = process.env.APPLE_PASSWORD ?? '';

  if (!username || !password) {
    console.error(
      'Apple credentials missing. Please set APPLE_USERNAME/APPLE_PASSWORD in env'
    );
    return null;
  }

  return { username, password };
}

async function callFindMy(): Promise<void> {
  const creds = getAppleCredentials();
  if (!creds) {
    console.error('FindMy call skipped — missing Apple credentials.');
    return;
  }

  const payload = {
    username: creds.username,
    password: '*****', // do NOT send real password to logs
    targetDeviceName: DEFAULT_DEVICE_NAME,
    maxRetries: 3
  };

  console.log('Posting to FindMy:', FINDMY_URL, payload);

  const res = await fetch(FINDMY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: creds.username,
      password: creds.password,
      targetDeviceName: DEFAULT_DEVICE_NAME,
      maxRetries: 3
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`FindMy call failed: ${res.status} ${res.statusText} — ${text}`);
  } else {
    console.log('FindMy call succeeded.');
  }
}

async function main() {
  const url = process.env.ITEM_URL ?? DEFAULT_ITEM_URL;
  const intervalMinutes = getCheckIntervalMinutes();
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log('Checking stock for:', url);
  console.log(`Check interval: ${intervalMinutes} minute(s)`);

  while (true) {
    try {
      const inStock = await checkStockOnce(url);

      if (inStock) {
        console.log('🎉 Item is IN STOCK! Triggering FindMy...');
        await callFindMy();
        return;
      }

      console.log(
        `Not in stock yet. Waiting ${intervalMinutes} minute(s) before next check...`
      );
      await sleep(intervalMs);
    } catch (err) {
      console.error('checkStockOnce failed:', err);
      console.log('Retrying after delay...');
      await sleep(intervalMs);
    }
  }
}

main().catch(err => {
  console.error('Unhandled error:', err);
});
