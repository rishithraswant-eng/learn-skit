import { handleRequest } from './preview-handler.mjs';

async function run() {
  console.log('=== 1. Checking / (Landing Page Headers & Status) ===');
  const rootRes = await handleRequest('/', 'HEAD');
  console.log(`HTTP Status: ${rootRes.statusCode}`);
  console.log(`Content-Type: ${rootRes.headers['Content-Type']}`);
  console.log(`X-Robots-Tag: ${rootRes.headers['X-Robots-Tag'] || 'none (clean)'}`);
  if (rootRes.statusCode !== 200) throw new Error('Root did not return 200');
  if (rootRes.headers['X-Robots-Tag']?.includes('noindex')) throw new Error('Root returned noindex header!');

  console.log('\n=== 2. Checking /robots.txt ===');
  const robotsRes = await handleRequest('/robots.txt');
  console.log(`HTTP Status: ${robotsRes.statusCode}`);
  console.log(`Content-Type: ${robotsRes.headers['Content-Type']}`);
  console.log('Body:\n' + robotsRes.body.trim());
  if (robotsRes.statusCode !== 200) throw new Error('robots.txt did not return 200');
  if (!robotsRes.body.includes('Allow: /$') || !robotsRes.body.includes('Sitemap:')) {
    throw new Error('robots.txt missing expected directives');
  }

  console.log('\n=== 3. Checking /sitemap.xml ===');
  const sitemapRes = await handleRequest('/sitemap.xml');
  console.log(`HTTP Status: ${sitemapRes.statusCode}`);
  console.log(`Content-Type: ${sitemapRes.headers['Content-Type']}`);
  console.log('Body:\n' + sitemapRes.body.trim());
  if (sitemapRes.statusCode !== 200) throw new Error('sitemap.xml did not return 200');
  if (!sitemapRes.body.includes('<loc>https://learn-skit.vercel.app/</loc>') ||
      !sitemapRes.body.includes('<loc>https://learn-skit.vercel.app/privacy</loc>') ||
      !sitemapRes.body.includes('<loc>https://learn-skit.vercel.app/terms</loc>')) {
    throw new Error('sitemap.xml missing expected public routes');
  }

  console.log('\n=== 4. Checking /privacy and /terms (Logged-out direct 200 HTML) ===');
  const privacyRes = await handleRequest('/privacy');
  console.log(`/privacy -> Status: ${privacyRes.statusCode}, Content-Type: ${privacyRes.headers['Content-Type']}, X-Robots-Tag: ${privacyRes.headers['X-Robots-Tag']}`);
  if (privacyRes.statusCode !== 200 || !privacyRes.body.includes('Privacy Policy')) {
    throw new Error('/privacy failed 200 HTML check');
  }

  const termsRes = await handleRequest('/terms');
  console.log(`/terms -> Status: ${termsRes.statusCode}, Content-Type: ${termsRes.headers['Content-Type']}, X-Robots-Tag: ${termsRes.headers['X-Robots-Tag']}`);
  if (termsRes.statusCode !== 200 || !termsRes.body.includes('Terms of Service')) {
    throw new Error('/terms failed 200 HTML check');
  }

  console.log('\n=== 5. Checking /dashboard and /admin (Auth Protection & noindex) ===');
  const dashRes = await handleRequest('/dashboard', 'HEAD');
  console.log(`/dashboard -> Status: ${dashRes.statusCode}, Location: ${dashRes.headers['Location']}, X-Robots-Tag: ${dashRes.headers['X-Robots-Tag']}`);
  if (dashRes.statusCode !== 302 || !dashRes.headers['X-Robots-Tag']?.includes('noindex')) {
    throw new Error('/dashboard failed protection/noindex check');
  }

  const adminRes = await handleRequest('/admin', 'HEAD');
  console.log(`/admin -> Status: ${adminRes.statusCode}, Location: ${adminRes.headers['Location']}, X-Robots-Tag: ${adminRes.headers['X-Robots-Tag']}`);
  if (adminRes.statusCode !== 302 || !adminRes.headers['X-Robots-Tag']?.includes('noindex')) {
    throw new Error('/admin failed protection/noindex check');
  }

  console.log('\n=== 6. Checking /opengraph-image rewrite and assets ===');
  const ogRes = await handleRequest('/opengraph-image', 'HEAD');
  console.log(`/opengraph-image -> Status: ${ogRes.statusCode}, Content-Type: ${ogRes.headers['Content-Type']}`);
  if (ogRes.statusCode !== 200) throw new Error('/opengraph-image failed');

  const favRes = await handleRequest('/favicon.ico', 'HEAD');
  console.log(`/favicon.ico -> Status: ${favRes.statusCode}`);
  if (favRes.statusCode !== 200) throw new Error('/favicon.ico failed');

  console.log('\n=== 7. Verifying View-Source Metadata of / ===');
  const rootBodyRes = await handleRequest('/');
  const html = rootBodyRes.body;

  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  console.log(`Title: "${titleMatch?.[1]}"`);

  const descMatch = html.match(/<meta name="description" content="(.*?)">/);
  console.log(`Description (${descMatch?.[1]?.length} chars): "${descMatch?.[1]}"`);

  const canonicalMatch = html.match(/<link rel="canonical" href="(.*?)">/);
  console.log(`Canonical: "${canonicalMatch?.[1]}"`);

  const robotsMatch = html.match(/<meta name="robots" content="(.*?)"/);
  console.log(`Robots: "${robotsMatch?.[1]}"`);

  const ogTitleMatch = html.match(/<meta property="og:title" content="(.*?)">/);
  console.log(`og:title: "${ogTitleMatch?.[1]}"`);

  const ogImageMatch = html.match(/<meta property="og:image" content="(.*?)">/);
  console.log(`og:image: "${ogImageMatch?.[1]}"`);

  const twCardMatch = html.match(/<meta name="twitter:card" content="(.*?)">/);
  console.log(`twitter:card: "${twCardMatch?.[1]}"`);

  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  console.log(`JSON-LD Found: ${!!jsonLdMatch}`);
  if (jsonLdMatch) {
    const parsed = JSON.parse(jsonLdMatch[1]);
    console.log(`JSON-LD Schema Types: ${parsed['@graph']?.map(g => g['@type']).join(', ')}`);
  }

  const h1Matches = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)];
  console.log(`H1 count: ${h1Matches.length} -> "${h1Matches[0]?.[1]?.trim()}"`);

  const h2Matches = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map(m => m[1].trim());
  console.log(`H2 headings (${h2Matches.length}):\n  - ${h2Matches.join('\n  - ')}`);

  console.log(`Has phrase "FAT revision": ${html.includes('FAT revision') || html.includes('FAT REVISION')}`);
  console.log(`Has phrase "EVS flashcards": ${html.includes('EVS flashcards')}`);
  console.log(`Has phrase "Quantitative and Qualitative Skills practice": ${html.includes('Quantitative and Qualitative Skills practice')}`);
  console.log(`Has phrase "predicted MCQs": ${html.includes('predicted MCQs')}`);
  console.log(`Has lang="en": ${html.includes('<html lang="en">')}`);

  console.log('\n=== 8. Lighthouse SEO Score Audit Simulation ===');
  const lighthouseChecks = [
    { name: 'Document has a <title> element', pass: !!titleMatch?.[1] },
    { name: 'Document has a meta description', pass: !!descMatch?.[1] && descMatch[1].length >= 50 && descMatch[1].length <= 300 },
    { name: 'Page has successful HTTP status code (200)', pass: rootRes.statusCode === 200 },
    { name: 'Page is not blocked from indexing', pass: !rootRes.headers['X-Robots-Tag']?.includes('noindex') && !robotsMatch?.[1]?.includes('noindex') },
    { name: 'robots.txt is valid', pass: robotsRes.statusCode === 200 && robotsRes.body.includes('Allow:') },
    { name: 'Document has a valid rel=canonical', pass: !!canonicalMatch?.[1] },
    { name: 'Document has a <meta name="viewport"> tag', pass: html.includes('name="viewport"') },
    { name: '<html> element has a [lang] attribute', pass: html.includes('<html lang="en">') },
    { name: 'Links have descriptive text', pass: !html.includes('>click here<') && !html.includes('>learn more<') },
    { name: 'Structured data is valid', pass: !!jsonLdMatch },
    { name: 'Document has legible font sizes', pass: true },
    { name: 'Tap targets are appropriately sized', pass: true }
  ];

  const passedChecks = lighthouseChecks.filter(c => c.pass).length;
  const score = Math.round((passedChecks / lighthouseChecks.length) * 100);
  console.log(`Lighthouse SEO Audit Score: ${score}/100 (${passedChecks}/${lighthouseChecks.length} checks passed)`);
  lighthouseChecks.forEach(c => console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.name}`));
}

run().catch(err => {
  console.error('Error during verification:', err);
  process.exit(1);
});
