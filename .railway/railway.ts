import {
  defineRailway,
  github,
  postgres,
  project,
  service,
} from "railway/iac";

export default defineRailway((ctx) => {
  const production = ctx.isEnvironment("production");
  const database = postgres("Postgres");

  const web = service("web", {
    source: github("TimMatthew/CaviarCellar", {
      branch: production ? "master" : "railway-deployment",
    }),
    healthcheck: "/health",
    healthcheckTimeout: 300,
    preDeploy: "npm run db:prepare",
    replicas: 1,
    env: {
      NODE_ENV: "production",
      LOG_LEVEL: "info",
      WEB_DIR: "../client",

      DB_HOST: database.env.PGHOST,
      DB_PORT: database.env.PGPORT,
      DB_USER: database.env.PGUSER,
      DB_PASSWORD: database.env.PGPASSWORD,
      DB_NAME: database.env.PGDATABASE,
      DB_POOL_MAX: "10",

      ADMIN_API_KEY: ctx.shared.ADMIN_API_KEY,
      AUTH_SECRET: ctx.shared.AUTH_SECRET,

      SCHEDULER_ENABLED: "false",
      DELIVERY_POLL_CRON: "*/10 * * * *",
      TRACKING_BATCH_SIZE: "50",
      OUTBOX_CRON: "*/1 * * * *",
      OUTBOX_BATCH_SIZE: "25",
      OUTBOX_RETRY_SECONDS: "60",
      OUTBOX_MAX_RETRY_SECONDS: "86400",

      SMTP_HOST: ctx.shared.SMTP_HOST,
      SMTP_PORT: "587",
      SMTP_USER: ctx.shared.SMTP_USER,
      SMTP_PASS: ctx.shared.SMTP_PASS,
      MAIL_FROM: ctx.shared.MAIL_FROM,
    },
  });

  return project("caviar-cellar", {
    resources: [database, web],
  });
});
