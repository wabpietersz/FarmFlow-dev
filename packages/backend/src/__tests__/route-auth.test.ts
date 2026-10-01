import fs from 'fs';
import path from 'path';

/**
 * Every API route must require sign-in, except the few that can't (login, health, metrics probe).
 * Reads the route sources: from `router.get(` up to the handler, `authenticate` must appear.
 */
const PUBLIC = new Set(['auth.ts POST /login']);

describe('route authentication', () => {
  const dir = path.join(__dirname, '../routes');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'index.ts');

  const routes: Array<{ id: string; head: string }> = [];
  for (const file of files) {
    const source = fs.readFileSync(path.join(dir, file), 'utf8');
    // Routers that apply authenticate to everything count as protected
    const routerWide = /\brouter\.use\(\s*authenticate\b/.test(source);
    const pattern = /\b(\w+)\.(get|post|put|patch|delete)\(\s*'([^']+)'/g;
    for (const match of source.matchAll(pattern)) {
      if (!/router$/i.test(match[1]) && match[1] !== 'router') continue;
      const start = match.index ?? 0;
      const handler = source.slice(start).search(/async\s*\(|\(\s*_?req\b|=>\s*\{/);
      const head = source.slice(start, start + (handler > 0 ? handler : 400));
      routes.push({ id: `${file} ${match[2].toUpperCase()} ${match[3]}`, head: routerWide ? `authenticate ${head}` : head });
    }
  }

  it('finds the routes', () => {
    expect(routes.length).toBeGreaterThan(250);
  });

  it('requires sign-in on every route that should have it', () => {
    const open = routes.filter((r) => !PUBLIC.has(r.id) && !/\bauthenticate\b/.test(r.head)).map((r) => r.id);
    expect(open).toEqual([]);
  });
});
