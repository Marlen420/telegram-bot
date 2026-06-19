import http from 'http';
import { config } from './config';
import { getAllUsers, getClickTotals, getUserClickMap, getUserStats } from './db';
import { getPaymentStats, getRecentPayments } from './payments/repository';
import { renderStatsPage } from './web/statsPage';
import { fetchStatsExportData, serializeStatsExport } from './web/statsExport';

function isAuthorized(req: http.IncomingMessage): boolean {
  if (!config.statsPassword) {
    return true;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Basic ')) {
    return false;
  }

  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf-8');
  const separator = decoded.indexOf(':');
  if (separator === -1) {
    return false;
  }

  const user = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);
  return user === config.statsUser && password === config.statsPassword;
}

function sendUnauthorized(res: http.ServerResponse): void {
  res.writeHead(401, {
    'WWW-Authenticate': 'Basic realm="Mingle Forum Stats"',
    'Content-Type': 'text/plain; charset=utf-8',
  });
  res.end('Unauthorized');
}

function exportFilename(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `mingle-forum-stats-${date}.json`;
}

export function startStatsServer(): http.Server {
  const server = http.createServer(async (req, res) => {
    const path = req.url?.split('?')[0];

    if (path !== '/' && path !== '/index.html' && path !== '/export.json') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    if (!isAuthorized(req)) {
      sendUnauthorized(res);
      return;
    }

    try {
      if (path === '/export.json') {
        const data = await fetchStatsExportData();
        const json = serializeStatsExport(data);

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${exportFilename()}"`,
        });
        res.end(json);
        return;
      }

      const [stats, users, clickTotals, userClicks, paymentStats, recentPayments] =
        await Promise.all([
          getUserStats(),
          getAllUsers(),
          getClickTotals(),
          getUserClickMap(),
          getPaymentStats(),
          getRecentPayments(30),
        ]);
      const html = renderStatsPage({
        stats,
        users,
        clickTotals,
        userClicks,
        paymentStats,
        recentPayments,
      });

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (err) {
      console.error('Stats page error:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal Server Error');
    }
  });

  server.listen(config.port, () => {
    console.log(`Stats page: http://localhost:${config.port}`);
  });

  return server;
}
