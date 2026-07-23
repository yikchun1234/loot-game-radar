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
 * Fetch Reddit deals via RSS (more stable than JSON API)
 * GET /api/reddit-rss
 */
async function fetchRedditRSS() {
  const subreddits = [
    { name: 'googleplaydeals', platform: 'Android', domain: 'play.google.com' },
    { name: 'FreeGamesOnAndroid', platform: 'Android', domain: 'play.google.com' },
    { name: 'AppHookup', platform: 'iOS', domain: 'apps.apple.com' }
  ];
  const allPosts = [];

  for (const sub of subreddits) {
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub.name}/.rss?limit=50`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        cf: { cacheTtl: 300, cacheEverything: true }, // Cache for 5 min
      });

      if (!res.ok) continue;

      const xml = await res.text();

      // Parse XML entries
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
      let entryMatch;

      while ((entryMatch = entryRegex.exec(xml)) !== null) {
        const entry = entryMatch[1];

        // Extract title
        const titleMatch = entry.match(/<title[^>]*>(.*?)<\/title>/);
        const title = titleMatch ? titleMatch[1].trim() : '';

        // Filter for free games
        if (!/free|100%|giveaway/i.test(title)) continue;

        // Extract link
        const linkMatch = entry.match(/<link[^>]+href="([^"]+)"/);
        const link = linkMatch ? linkMatch[1] : '';

        // STRICT domain check - only accept links matching the platform
        if (!link.includes(sub.domain)) continue;

        // Extract published date
        const dateMatch = entry.match(/<published>(.*?)<\/published>/);
        const published = dateMatch ? dateMatch[1] : new Date().toISOString();

        // Extract image (from media:thumbnail or first image in content)
        let image = 'https://images.unsplash.com/photo-1556438064-2d7646166914?w=400&h=200&fit=crop';
        const thumbMatch = entry.match(/<media:thumbnail[^>]+url="([^"]+)"/);
        if (thumbMatch) {
          image = thumbMatch[1];
        } else {
          const contentMatch = entry.match(/<content[^>]*>([\s\S]*?)<\/content>/);
          if (contentMatch) {
            const imgMatch = contentMatch[1].match(/src="([^"]+\.(?:jpg|png|gif)[^"]*)"/);
            if (imgMatch) image = imgMatch[1];
          }
        }

        // Extract price
        const priceMatch = title.match(/(?:\$|€|£)\s?([0-9.]+)/);
        const worth = priceMatch ? `$${priceMatch[1]}` : 'Free';

        allPosts.push({
          title: title.replace(/\[.*?\]\s*/g, '').trim(),
          image,
          worth,
          platforms: sub.platform,
          open_giveaway: link,
          published_date: published,
          source: `r/${sub.name}`,
        });
      }
    } catch (err) {
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
 *
 * Priority:
 * 1. Reddit RSS (Android + iOS)
 * 2. AppSales (Android fallback if Reddit fails)
 * 3. GamerPower (PC)
 */
async function fetchAllGames(params) {
  const includeReddit = params.get('reddit') !== 'false';
  const includeEpic = params.get('epic') !== 'false';
  const includeGamerPower = params.get('gamerpower') !== 'false';
  const includeAndroid = params.get('android') !== 'false';

  // Step 1: Try Reddit RSS
  let redditData = [];
  let redditSuccess = false;

  if (includeReddit) {
    try {
      redditData = await fetchRedditRSS();
      if (redditData.length > 0) {
        redditSuccess = true;
      }
    } catch (err) {
      // Reddit failed
    }
  }

  // Step 2: If Reddit failed, use AppSales as fallback (Android only)
  let androidData = [];
  if (includeAndroid && !redditSuccess) {
    try {
      androidData = await fetchAndroidFreeApps();
    } catch (err) {
      // AppSales also failed
    }
  }

  // Step 3: Fetch other sources in parallel
  const results = await Promise.allSettled([
    Promise.resolve(redditData),
    Promise.resolve(androidData),
    includeEpic ? fetchEpicFreeGames() : Promise.resolve([]),
    includeGamerPower ? fetchGamerPowerGames() : Promise.resolve([]),
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
      cf: { cacheTtl: 43200, cacheEverything: true }, // Cache for 12 hours
    });

    if (!res.ok) return [];

    const html = await res.text();

    // Parse HTML to extract app data
    const apps = [];

    // Match each sale-list-item block
    // Pattern: <div class="card-panel sale-list-item ">...</div>
    const itemRegex = /<div class="card-panel sale-list-item[^"]*">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
    let match;

    while ((match = itemRegex.exec(html)) !== null) {
      const block = match[1];

      // Extract title from app-name
      const titleMatch = block.match(/<p class="app-name">\s*([^<]+)</);
      const title = titleMatch ? titleMatch[1].trim() : '';

      // Extract price from price-old
      const priceMatch = block.match(/<div class="price-old">([^<]+)</);
      const worth = priceMatch ? priceMatch[1].trim() : 'N/A';

      // Extract Google Play link
      const linkMatch = block.match(/href="(https:\/\/play\.google\.com\/store\/apps\/details\?id=[^"]+)"/);
      const open_giveaway = linkMatch ? linkMatch[1] : '';

      // Extract icon
      const iconMatch = block.match(/<div class="app-icon"><img src="([^"]+)"/);
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

    // Route: GET /api/reddit-rss (more stable)
    if (pathname === '/api/reddit-rss') {
      try {
        const deals = await fetchRedditRSS();
        return new Response(JSON.stringify(deals), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return errorResponse('Failed to fetch Reddit RSS: ' + err.message);
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
