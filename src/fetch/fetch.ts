import { RequestParameters } from "@octokit/types";
import { Probot } from "probot";
import { octokitAuthWithAccessToken, octokitAuthWithAppId } from "../auth";

function fetchDetailsWithInstallationId(
  app: Probot,
  installationId: number,
  endpoint: string,
  parameters: RequestParameters
) {
  return new Promise(async (resolve, reject) => {
    try {
      const octokit = octokitAuthWithAppId(installationId);
      const data = await octokit.request(endpoint, parameters);

      resolve(data);
    } catch (err: any) {
      app.log.error(
        `Error while fetching resource details for resource url: [${endpoint}]`
      );
      reject(err);
    }
  });
}

function fetchDetails(
  app: Probot,
  endpoint: string,
  parameters: RequestParameters
) {
  return new Promise(async (resolve, reject) => {
    try {
      const octokit = octokitAuthWithAccessToken();
      const data = await octokit.request(endpoint, parameters);

      resolve(data);
    } catch (err: any) {
      app.log.error(
        `Error while fetching resource details for resource url: [${endpoint}]`
      );
      reject(err);
    }
  });
}

export { fetchDetails, fetchDetailsWithInstallationId };
