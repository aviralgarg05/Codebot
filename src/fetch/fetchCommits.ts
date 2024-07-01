import { Probot } from "probot";
import configs from "../configs/fetch.configs.json";
import { fetchDetails } from "./fetch";
import { Commit } from "../types/Commit";
import { getTimeStampOlderThanMonths } from "../utils";

const bugRegex = new RegExp(
  ".*\\b([Bb]ug(s|gy|ged)?|[Fixf]ix(es|ed|ing)?|[Closec]lose(s|d|ing)?|[ResolveRr]esolve(s|d|ing)?|[AddressAa]ddress(es|ed|ing)?).*",
  "i"
);

export async function getAllCommits(
  app: Probot,
  installationId: number,
  owner: string,
  repoName: string,
  defaultBranch: string,
  filePath: string
): Promise<Commit[]> {
  try {
    const commitAge = getTimeStampOlderThanMonths(
      configs.all_commits.commit_age_in_months
    );
    const pageSize = configs.all_commits.page_size;
    let page = 1;
    let allCommits: Commit[] = [];

    while (true) {
      const response: any = await fetchDetails(
        app,
        configs.all_commits.endpoint,
        {
          owner: owner,
          repo: repoName,
          sha: defaultBranch,
          path: filePath,
          since: commitAge,
          per_page: pageSize,
          page: page,
        }
      );

      const commitsFromGithub = response.data.filter((commitObj: any) =>
        commitObj.commit.message.match(bugRegex)
      );

      const commitList: Commit[] = commitsFromGithub.map((commitObj: any) => ({
        sha: commitObj.sha,
        message: commitObj.commit.message,
        date: commitObj.commit.committer.date,
      }));

      allCommits = allCommits.concat(commitList);

      if (commitList.length < pageSize) {
        break;
      }

      page++;
    }

    const commitArrayLimit = configs.all_commits.commit_array_limit;
    if (allCommits.length > commitArrayLimit) {
      app.log.warn(
        `More than ${commitArrayLimit} commits are fetched, cannot proceed further for [${owner}/${repoName}] with installation id: [${installationId}]`
      );
      return [];
    }

    return allCommits;
  } catch (error: any) {
    app.log.error(
      `Error while fetching all commits for filePath ${filePath} of repository:[${owner}/${repoName}] and installation id: [${installationId}]`
    );
    app.log.error(error);
    throw error;
  }
}
