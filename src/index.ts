import { existsSync } from "fs";
import { writeFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import { initConfig, initDir } from "./utils";
import { createServer } from "./server";
import { router } from "./utils/router";
import { apiKeyAuth } from "./middleware/auth";
import {
  cleanupPidFile,
  isServiceRunning,
  savePid,
} from "./utils/processCheck";
import { CONFIG_FILE } from "./constants";

async function initializeClaudeConfig() {
  const homeDir = homedir();
  const configPath = join(homeDir, ".claude.json");
  if (!existsSync(configPath)) {
    const userID = Array.from(
      { length: 64 },
      () => Math.random().toString(16)[2]
    ).join("");
    const configContent = {
      numStartups: 184,
      autoUpdaterStatus: "enabled",
      userID,
      hasCompletedOnboarding: true,
      lastOnboardingVersion: "1.0.17",
      projects: {},
    };
    await writeFile(configPath, JSON.stringify(configContent, null, 2));
  }
}

interface RunOptions {
  port?: number;
}

async function run(options: RunOptions = {}) {
  // Check if service is already running
  if (isServiceRunning()) {
    console.log("✅ Service is already running in the background.");
    return;
  }

  await initializeClaudeConfig();
  await initDir();
  const config = await initConfig();
  let HOST = config.HOST;

  if (config.HOST && !config.APIKEY) {
    HOST = "127.0.0.1";
    console.warn(
      "⚠️ API key is not set. HOST is forced to 127.0.0.1."
    );
  }

  const port = config.PORT || 3456;

  // Save the PID of the background process
  savePid(process.pid);

  // Handle SIGINT (Ctrl+C) to clean up PID file
  process.on("SIGINT", () => {
    console.log("Received SIGINT, cleaning up...");
    cleanupPidFile();
    process.exit(0);
  });

  // Handle SIGTERM to clean up PID file
  process.on("SIGTERM", () => {
    cleanupPidFile();
    process.exit(0);
  });
  console.log(HOST)

  // Use port from environment variable if set (for background process)
  const servicePort = process.env.SERVICE_PORT
    ? parseInt(process.env.SERVICE_PORT)
    : port;
<<<<<<< HEAD

  const server = await createServer(servicePort);
  server.useMiddleware((req, res, next) => {
    req.config = config;
    next();
  });
  server.useMiddleware(rewriteBody);
  if (
    config.Router?.background &&
    config.Router?.think &&
    config?.Router?.longContext
  ) {
    server.useMiddleware(router);
  } else {
    server.useMiddleware((req, res, next) => {
      req.provider = "default";
      req.body.model = config.OPENAI_MODEL;
      next();
    });
  }
  server.useMiddleware(formatRequest);

  server.app.post("/v1/messages", async (req, res) => {
    try {
      const provider = getProviderInstance(req.provider || "default");
      const stream: any = await provider.responses.create(req.body as any);
      await streamOpenAIResponse(res, stream, req.body.model, req.body);
    } catch (e) {
      log("Error in OpenAI API call:", e);
    }
=======
  const server = createServer({
    jsonPath: CONFIG_FILE,
    initialConfig: {
      // ...config,
      providers: config.Providers || config.providers,
      HOST: HOST,
      PORT: servicePort,
      LOG_FILE: join(
        homedir(),
        ".claude-code-router",
        "claude-code-router.log"
      ),
    },
>>>>>>> main
  });
  server.addHook("preHandler", apiKeyAuth(config));
  server.addHook("preHandler", async (req, reply) =>
    router(req, reply, config)
  );
  server.start();
}

export { run };
// run();
