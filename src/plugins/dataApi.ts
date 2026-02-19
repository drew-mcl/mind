import type { Plugin } from "vite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const DATA_DIR = path.join(os.homedir(), ".mind");

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

        // GET /api/projects/:id — load a specific project (must be before list-all)
        if (req.method === "GET") {
          const match = req.url!.match(/^\/api\/projects\/([^?/]+)/);
          if (match) {
            const id = decodeURIComponent(match[1]);
            const filePath = path.join(DATA_DIR, `${id}.json`);
            if (fs.existsSync(filePath)) {
              const raw = fs.readFileSync(filePath, "utf-8");
              res.setHeader("Content-Type", "application/json");
              res.end(raw);
              return;
            }
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "Project not found" }));
            return;
          }
        }

        // GET /api/projects — list all projects
        if (req.method === "GET") {
          const url = new URL(req.url!, `http://${req.headers.host}`);
          const isSummary = url.searchParams.get("summary") === "true";

          ensureDataDir();
          const files = fs
            .readdirSync(DATA_DIR)
            .filter((f) => f.endsWith(".json"));

          const projects = files.map((f) => {
            const raw = fs.readFileSync(path.join(DATA_DIR, f), "utf-8");
            const data = JSON.parse(raw);
            if (isSummary) {
              return { id: data.id, name: data.name };
            }
            return data;
          });

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(projects));
          return;
        }

        // PUT /api/projects/:id — save a project with atomic write
        if (req.method === "PUT") {
          const match = req.url.match(/^\/api\/projects\/([^?]+)$/);
          if (!match) return next();

          const id = decodeURIComponent(match[1]);
          let body = "";
          req.on("data", (chunk: Buffer) => {
            body += chunk.toString();
          });
          req.on("end", () => {
            ensureDataDir();
            const filePath = path.join(DATA_DIR, `${id}.json`);
            const tmpPath = path.join(DATA_DIR, `${id}.json.tmp`);

            try {
              // Atomic write: write to temp file then rename
              fs.writeFileSync(tmpPath, body, "utf-8");
              fs.renameSync(tmpPath, filePath);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true }));
            } catch (err) {
              console.error("Save error:", err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: "Failed to save file" }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}
