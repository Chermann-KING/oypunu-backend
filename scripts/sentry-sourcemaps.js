/*
 Cross-platform Sentry sourcemaps uploader.
 - Skips when SENTRY_AUTH_TOKEN is not set.
 - Runs `sentry-cli sourcemaps inject` then `upload` when token exists.
*/
const { execSync } = require("child_process");

const org = process.env.SENTRY_ORG || "chermann-king";
const project = process.env.SENTRY_PROJECT || "oypunu-backend";
const distPath = "./dist";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

function main() {
  const token = process.env.SENTRY_AUTH_TOKEN;
  if (!token) {
    console.log("Sentry sourcemaps: SENTRY_AUTH_TOKEN absent, skipping.");
    return;
  }
  console.log("Sentry sourcemaps: token found, injecting & uploading...");
  run(
    `sentry-cli sourcemaps inject --org ${org} --project ${project} ${distPath}`
  );
  run(
    `sentry-cli sourcemaps upload --org ${org} --project ${project} ${distPath}`
  );
}

main();
