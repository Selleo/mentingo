/* eslint-disable no-console */
import fs from "fs";

import Docker from "dockerode";

const CONFIG_FILE = "/tmp/test-containers.json";

export default async function globalTeardown() {
  console.info("🧹 Stopping shared test containers...");

  if (!fs.existsSync(CONFIG_FILE)) {
    console.info("⚠️ No config file found, skipping teardown");
    return;
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  const docker = new Docker();

  try {
    if (config.pgContainerId) {
      const pgContainer = docker.getContainer(config.pgContainerId);
      await pgContainer.stop({ t: 10 });
      await pgContainer.remove();
      console.info("✅ PostgreSQL container stopped");
    }
  } catch (error: any) {
    console.error("Error stopping PostgreSQL container:", error.message);
  }

  try {
    if (config.redisContainerId) {
      const redisContainer = docker.getContainer(config.redisContainerId);
      await redisContainer.stop({ t: 10 });
      await redisContainer.remove();
      console.info("✅ Redis container stopped");
    }
  } catch (error: any) {
    console.error("Error stopping Redis container:", error.message);
  }

  try {
    fs.unlinkSync(CONFIG_FILE);
    console.info("✅ Config file removed");
  } catch {
    // Ignore
  }

  console.info("✅ Global teardown complete");
}
