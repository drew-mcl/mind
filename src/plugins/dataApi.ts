import type { Plugin } from "vite";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "data");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function dataApi(): Plugin {
  return {
    name: "data-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/api/projects")) return next();

        // GET /api/projects — list all projects
        if (req.method === "GET" && req.url === "/api/projects") {
          ensureDataDir();
          const files = fs
            .readdirSync(DATA_DIR)
            .filter((f) => f.endsWith(".json"));

          const projects = files.map((f) => {
            const raw = fs.readFileSync(path.join(DATA_DIR, f), "utf-8");
            return JSON.parse(raw);
          });

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(projects));
          return;
        }

        // PUT /api/projects/:id — save a project
        if (req.method === "PUT") {
          const match = req.url.match(/^\/api\/projects\/(.+)$/);
          if (!match) return next();

          const id = decodeURIComponent(match[1]);
          let body = "";
          req.on("data", (chunk: Buffer) => {
            body += chunk.toString();
          });
          req.on("end", () => {
            ensureDataDir();
            const filePath = path.join(DATA_DIR, `${id}.json`);
            fs.writeFileSync(filePath, body, "utf-8");
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true }));
          });
          return;
        }

        next();
      });
    },
  };
}
