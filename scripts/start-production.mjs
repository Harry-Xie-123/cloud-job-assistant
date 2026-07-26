import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const portArgument = process.argv.find((argument) => argument.startsWith("--port="));
const port = Number(portArgument?.split("=")[1] || process.env.PORT || 8080);

process.env.PUBLIC_DIR ||= resolve(rootDir, "apps", "web", "dist");

const { app } = await import("../apps/api/src/server.js");

app.listen(port, "0.0.0.0", () => {
  console.log(`Cloud Job Assistant production build running at http://localhost:${port}`);
});
