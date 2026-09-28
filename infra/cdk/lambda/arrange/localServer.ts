/**
 * Local dev stand-in for the deployed `/arrange` API Gateway + Lambda —
 * lets the frontend (`npm run dev:web`) hit a running arrangement engine
 * without a `cdk deploy` round-trip for every engine change. The real
 * Lambda handler only reads `event.body`, so this wraps it directly with a
 * minimal fake APIGatewayProxyEventV2 rather than pulling in a full local
 * API Gateway emulator (SAM/LocalStack) — this project deliberately has no
 * dev/staging AWS environment (see CLAUDE.md's project_no_dev_env note),
 * and this local server is a pure Node process, not a second AWS stack.
 *
 * Run with `npm run dev:api` (from infra/cdk, or the root's dev:api
 * script), then point apps/web/.env.local's NEXT_PUBLIC_ARRANGE_API_URL at
 * this server's URL (default http://localhost:8787) instead of the
 * deployed prod API Gateway URL.
 */
import { createServer } from "node:http";
import { handler } from "./index";

const PORT = Number(process.env.PORT) || 8787;

const server = createServer((req, res) => {
  // Permissive CORS — this only ever binds to localhost for local
  // development, so there's no real cross-origin risk to guard against.
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST" || req.url !== "/arrange") {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "not found — POST /arrange only" }));
    return;
  }

  const chunks: Buffer[] = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", async () => {
    const body = Buffer.concat(chunks).toString("utf-8");
    try {
      // The handler only reads event.body — every other APIGatewayProxyEventV2
      // field is required by its type but genuinely unused at runtime, so a
      // minimal fake object cast to the expected type is enough here.
      const result = await handler({ body } as Parameters<typeof handler>[0], {} as never, () => {});
      if (!result || typeof result !== "object" || !("statusCode" in result)) {
        throw new Error("handler returned no result");
      }
      res.writeHead(result.statusCode ?? 200, { "content-type": "application/json" });
      res.end(typeof result.body === "string" ? result.body : JSON.stringify(result.body));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("arrange handler error:", err);
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "internal error", detail: String(err) }));
    }
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[driftscore] local /arrange server listening on http://localhost:${PORT}`);
});
