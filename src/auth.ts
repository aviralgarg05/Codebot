import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";
import { Probot } from "probot";

const { APP_ID, PRIVATE_KEY, WEBHOOK_SECRET, GITHUB_ACCESS_TOKEN } =
  process.env;

export function getProbotInstance() {
  return new Probot({
    appId: APP_ID,
    privateKey: PRIVATE_KEY?.replace(/\\n/g, "\n"),
    secret: WEBHOOK_SECRET,
  });
}

export function octokitAuthWithAccessToken(): Octokit {
  return new Octokit({
    auth: GITHUB_ACCESS_TOKEN,
  });
}

export function octokitAuthWithAppId(installationId: number): Octokit {
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: APP_ID,
      privateKey: PRIVATE_KEY?.replace(/\\n/g, "\n"),
      installationId: installationId,
    },
  });
}
