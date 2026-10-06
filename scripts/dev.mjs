import http from "node:http";
import { createServer as createViteServer } from "vite";
import handler from "../server/portal.js";

export function apiServer(port = 3001) {
  const server = http.createServer(async (req, res) => {
    if (!req.url.startsWith("/api/portal")) {
      res.statusCode = 404;
      res.end();
      return;
    }
    try {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 16000) {
          res.statusCode = 413;
          res.end('{"error":"ข้อมูลมีขนาดใหญ่เกินไป"}');
          return;
        }
      }
      req.body = body ? JSON.parse(body) : {};
      await handler(req, res);
    } catch {
      res.statusCode = 400;
      res.end('{"error":"รูปแบบข้อมูลไม่ถูกต้อง"}');
    }
  });
  server.listen(port, "127.0.0.1");
  return server;
}

if (process.argv[1]?.endsWith("dev.mjs")) {
  const api = apiServer();
  const vite = await createViteServer({
    server: { host: "127.0.0.1", port: 5173, strictPort: true },
  });
  await vite.listen();
  vite.printUrls();
  async function close() {
    await vite.close();
    api.close();
    process.exit();
  }
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
}
