/**
 * Accessibility audit — loads the running app in headless Chromium, injects axe-core,
 * and reports WCAG 2.1 A/AA violations for the empty state and an active conversation,
 * in both light and dark themes. Manual/dev tool (needs a running server + a browser);
 * not part of CI.
 *
 * Usage:
 *   npm run build && PORT=3127 npm start &   # or any running instance
 *   node scripts/a11y-audit.mjs http://localhost:3127
 */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = process.argv[2] || 'http://localhost:3127';
const EXE =
  process.env.CHROME_BIN || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const axeSource = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
let total = 0;

async function audit(label, { dark, drive }) {
  const ctx = await browser.newContext({ colorScheme: dark ? 'dark' : 'light' });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'));
  if (drive) {
    await page.fill('textarea', 'What is the capital of France?');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
  }
  await page.evaluate(axeSource);
  const results = await page.evaluate(async () => {
    // @ts-ignore — axe is injected above
    return await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] });
  });
  const violations = results.violations;
  total += violations.length;
  console.log(`\n=== ${label} — ${violations.length} violation(s) ===`);
  for (const v of violations) {
    console.log(`  [${v.impact}] ${v.id}: ${v.help}`);
    for (const n of v.nodes.slice(0, 4)) console.log(`      → ${n.target.join(' ')}`);
  }
  await ctx.close();
}

await audit('empty · light', { dark: false, drive: false });
await audit('empty · dark', { dark: true, drive: false });
await audit('conversation · light', { dark: false, drive: true });
await audit('conversation · dark', { dark: true, drive: true });
await browser.close();

console.log(`\n${total === 0 ? '✅ No WCAG A/AA violations found.' : `❌ ${total} total violation(s).`}`);
process.exit(total === 0 ? 0 : 1);
