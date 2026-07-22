/**
 * Loot API Worker - Game Data Aggregator
 * 
 * Endpoints:
 * GET  /api/reddit-deals    - Proxy Reddit free game deals
 * GET  /api/epic-free       - Fetch Epic Games free titles
 * GET  /api/all-games       - Aggregate all sources (GamerPower + Reddit + Epic)
 *
 * Deploy to: loot-api.yikchun1234.workers.dev
 */

// CORS headers for browser requests
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle OPTIONS preflight
function handleOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

// Error response
function errorResponse(message, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/**
 * Fetch Reddit deals from multiple subreddits
 * GET /api/reddit-deals
 */
async function fetchRedditDeals() {
  const subreddits = ['googleplaydeals', 'FreeGamesOnAndroid', 'AppHookup'];
  const allPosts = [];

  for (const sub of subreddits) {
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub}/new.json?limit=30`, {
        headers: {
          'User-Agent': 'LootRadar/1.0 (Personal Project)',
        },
        cf: { cacheTtl: 300, cacheEverything: true }, // Cache at edge for 5 min
      });

      if (!res.ok) continue;

      const data = await res.json();
      const posts = data?.data?.children || [];

      for (const post of posts) {
        const title = post.data?.title || '';
        // Filter for free games
        if (!/free|100%|giveaway/i.test(title)) continue;
        // Skip if it's a self-post with no external link
        if (post.data?.is_self) continue;

        // Extract price if present
        const priceMatch = title.match(/(?:\$|€|£)\s?([0-9.]+)/);
        const worth = priceMatch ? `$${priceMatch[1]}` : 'Free';

        // Get image
        let image = 'https://images.unsplash.com/photo-1556438064-2d7646166914?w=400&h=200&fit=crop';
        if (post.data?.preview?.images?.[0]?.source?.url) {
          image = post.data.preview.images[0].source.url.split('?')[0] + '?w=400&h=200&fit=crop';
        } else if (post.data?.thumbnail?.startsWith('http')) {
          image = post.data.thumbnail + '?w=400&h=200&fit=crop';
        }

        // Determine platform
        let platforms = 'Android';
        if (sub === 'AppHookup') platforms = 'iOS/Android';
        if (sub === 'FreeGamesOnAndroid') platforms = 'Android';

        allPosts.push({
          title: title.replace(/\[.*?\]\s*/g, '').trim(), // Remove [Android] tags
          image,
          worth,
          platforms,
          open_giveaway: `https://reddit.com${post.data?.permalink || ''}`,
          published_date: new Date((post.data?.created_utc || 0) * 1000).toISOString(),
          source: `r/${sub}`,
        });
      }
    } catch (err) {
      // Skip failed subreddit
      continue;
    }
  }

  return allPosts;
}

/**
 * Fetch Epic Games free titles
 * GET /api/epic-free
 */
async function fetchEpicFreeGames() {
  try {
    const res = await fetch(
      'https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions',
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'LootRadar/1.0',
        },
        cf: { cacheTtl: 1800, cacheEverything: true }, // Cache for 30 min
      }
    );

    if (!res.ok) return [];

    const data = await res.json();
    const elements = data?.data?.Catalog?.searchStore?.elements || [];

    return elements
      .filter((e) => {
        const promotions = e.promotions?.promotionalOffers || [];
        return promotions.some((p) =>
          p.promotionalOffers?.some((o) => {
            const endDate = new Date(o.endDate);
            return endDate > new Date();
          })
        );
      })
      .map((e) => {
        const activePromo = e.promotions.promotionalOffers
          .flatMap((p) => p.promotionalOffers)
          .find((o) => new Date(o.endDate) > new Date());

        const startDate = activePromo?.startDate || '';
        const endDate = activePromo?.endDate || '';

        return {
          title: e.title,
          image: e.keyImages?.find((k) => k.type === 'OfferImageWide')?.url ||
                 e.keyImages?.[0]?.url || '',
          worth: 'Free',
          platforms: 'PC',
          open_giveaway: `https://store.epicgames.com/product/${e.productSlug || e.slug}`,
          published_date: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          source: 'Epic Games',
        };
      });
  } catch (err) {
    return [];
  }
}

/**
 * Aggregate all game sources
 * GET /api/all-games?reddit=true&epic=true&gamerpower=true&android=true
 */
async function fetchAllGames(params) {
  const includeReddit = params.get('reddit') !== 'false';
  const includeEpic = params.get('epic') !== 'false';
  const includeGamerPower = params.get('gamerpower') !== 'false';
  const includeAndroid = params.get('android') !== 'false';

  const results = await Promise.allSettled([
    includeReddit ? fetchRedditDeals() : Promise.resolve([]),
    includeEpic ? fetchEpicFreeGames() : Promise.resolve([]),
    includeGamerPower ? fetchGamerPowerGames() : Promise.resolve([]),
    includeAndroid ? fetchAndroidFreeApps() : Promise.resolve([]),
  ]);

  const allGames = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allGames.push(...result.value);
    }
  }

  // Deduplicate by URL
  const uniqueMap = new Map();
  allGames.forEach((g) => {
    const key = g.open_giveaway;
    if (key && !uniqueMap.has(key)) {
      uniqueMap.set(key, g);
    }
  });

  // Sort by date (newest first)
  const sorted = Array.from(uniqueMap.values()).sort((a, b) => {
    return new Date(b.published_date) - new Date(a.published_date);
  });

  return sorted;
}

/**
 * Fetch GamerPower games (proxy to avoid CORS)
 */
async function fetchGamerPowerGames() {
  try {
    const res = await fetch('https://gamerpower.com/api/giveaways', {
      headers: { 'User-Agent': 'LootRadar/1.0' },
      cf: { cacheTtl: 600, cacheEverything: true }, // Cache for 10 min
    });

    if (!res.ok) return [];

    return await res.json();
  } catch (err) {
    return [];
  }
}

/**
 * Scrape app-sales.net for free Android apps
 * GET /api/android-free
 */
async function fetchAndroidFreeApps() {
  try {
    const res = await fetch('https://www.app-sales.net/nowfree/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      cf: { cacheTtl: 300, cacheEverything: true }, // Cache for 5 min
    });

    if (!res.ok) return [];

    const html = await res.text();

    // Parse HTML to extract app data
    const apps = [];
    const appRegex = /<div class="app-item">(.*?)<\/div>\s*<\/a>/gs;
    let match;

    while ((match = appRegex.exec(html)) !== null) {
      const block = match[1];

      // Extract title
      const titleMatch = block.match(/<h3[^>]*>(.*?)<\/h3>/s);
      const title = titleMatch ? titleMatch[1].trim() : '';

      // Extract original price
      const priceMatch = block.match(/<span class="original-price">([^<]+)</);
      const worth = priceMatch ? priceMatch[1].trim() : 'N/A';

      // Extract Google Play link
      const linkMatch = block.match(/href="([^"]*play\.google\.com[^"]*)"/);
      const open_giveaway = linkMatch ? linkMatch[1] : '';

      // Extract icon
      const iconMatch = block.match(/<img[^>]+src="([^"]+)"/);
      const image = iconMatch ? iconMatch[1] : 'https://images.unsplash.com/photo-1607252654015-f84f1b578d51?w=400&h=200&fit=crop';

      if (title && open_giveaway) {
        apps.push({
          id: 'android_' + title.slice(0, 30),
          title,
          image,
          worth,
          platforms: 'Android',
          open_giveaway,
          published_date: new Date().toISOString(),
          source: 'AppSales',
        });
      }
    }

    return apps;
  } catch (err) {
    return [];
  }
}

// Main request handler
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    // Route: GET /api/reddit-deals
    if (pathname === '/api/reddit-deals') {
      try {
        const deals = await fetchRedditDeals();
        return new Response(JSON.stringify(deals), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return errorResponse('Failed to fetch Reddit deals: ' + err.message);
      }
    }

    // Route: GET /api/epic-free
    if (pathname === '/api/epic-free') {
      try {
        const games = await fetchEpicFreeGames();
        return new Response(JSON.stringify(games), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return errorResponse('Failed to fetch Epic games: ' + err.message);
      }
    }

    // Route: GET /api/android-free
    if (pathname === '/api/android-free') {
      try {
        const apps = await fetchAndroidFreeApps();
        return new Response(JSON.stringify(apps), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return errorResponse('Failed to fetch Android apps: ' + err.message);
      }
    }

    // Route: GET /api/all-games
    if (pathname === '/api/all-games') {
      try {
        const games = await fetchAllGames(url.searchParams);
        return new Response(JSON.stringify(games), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return errorResponse('Failed to fetch all games: ' + err.message);
      }
    }

    // Root path - show API info
    if (pathname === '/') {
      return new Response(
        JSON.stringify({
          name: 'Loot API',
          version: '1.1',
          endpoints: {
            'GET /api/reddit-deals': 'Fetch free game deals from Reddit',
            'GET /api/epic-free': 'Fetch Epic Games free titles',
            'GET /api/android-free': 'Scrape free Android apps from AppSales',
            'GET /api/all-games': 'Aggregate all sources (gamerpower + reddit + epic + android)',
          },
          params: {
            reddit: 'true|false (default: true)',
            epic: 'true|false (default: true)',
            gamerpower: 'true|false (default: true)',
            android: 'true|false (default: true)',
          },
        }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // 404
    return new Response('Not Found', { status: 404 });
  },
};
