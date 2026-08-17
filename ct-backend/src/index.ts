import "dotenv/config";

import { buildApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { startAnalyticsReportScheduler } from "./modules/analytics-report/analytics-report.scheduler.js";
import { startTrialEndReportScheduler } from "./modules/analytics-report/trial-end-report.scheduler.js";
import { startEveningReminderScheduler } from "./modules/whatsapp/wa-evening-reminder.service.js";

async function main() {
  const env = loadEnv();
  const app = await buildApp(env);

  try {
    startEveningReminderScheduler(env);
    startAnalyticsReportScheduler(env);
    startTrialEndReportScheduler(env);
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`ct-backend running at http://${env.HOST}:${env.PORT}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

main();
