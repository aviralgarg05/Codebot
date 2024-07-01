import { Probot } from "probot";
import configs from "../configs/fetch.configs.json";
import { fetchDetails } from "./fetch";
import { FilePath } from "../types/File";
import { GithubResponseFile } from "../types/File";

export async function getAllFiles(
  app: Probot,
  installationId: number,
  owner: string,
  repoName: string,
  defaultBranch: string
): Promise<FilePath[]> {
  try {
    const response: any = await fetchDetails(
      app,
      configs.all_files.endpoint_git_tree,
      {
        owner: owner,
        repo: repoName,
        tree_sha: defaultBranch,
        recursive: true,
      }
    );

    const githubResponse: any[] = response.data.tree;
    const files: any[] = githubResponse.filter(
      (file: any) => isValidFilePath(file.path) && file.type === "blob"
    );

    const filePaths: FilePath[] = files.map((file: any) => ({
      path: file.path,
    }));

    app.log.info(
      `Total ${filePaths.length} files are eligible for processing from repository: [${owner}/${repoName}] for installation id: [${installationId}]`
    );

    const filesLimit = configs.all_files.file_array_limit;
    if (filePaths.length > filesLimit) {
      app.log.warn(
        `More than ${filesLimit} files are fetched, cannot proceed further for [${owner}/${repoName}] with installation id: [${installationId}]`
      );
      return [];
    }

    return filePaths;
  } catch (error: any) {
    app.log.error(
      `Error occurred while fetching all files for [${owner}/${repoName}] and installation id: [${installationId}]`
    );
    app.log.error(error);
    return [];
  }
}

export async function getAllFilesFromPullRequest(
  app: Probot,
  owner: string,
  repoName: string,
  installationId: number,
  pullNumber: number
) {
  try {
    const response: any = await fetchDetails(
      app,
      configs.all_files.endpoint_pull_request,
      {
        owner: owner,
        repo: repoName,
        pull_number: pullNumber,
      }
    );

    const data: any[] = response.data;
    const files: GithubResponseFile[] = data.map((file: any) => ({
      sha: file.sha,
      filePath: file.filename,
      status: file.status,
      previousFileName: file.previous_filename,
    }));

    app.log.info(
      `Total ${files.length} files fetched from github for pull request(number:${pullNumber}) of the repository: [${owner}/${repoName}] and installationId: [${installationId}]`
    );

    return files;
  } catch (error: any) {
    app.log.error(
      `Error occurred while fetching all files for repository: [${owner}/${repoName}] and pull request number: [${pullNumber}] and installationId: [${installationId}]`
    );
    app.log.error(error);
    return [];
  }
}

export function isValidFilePath(filePath: string): boolean {
  const excludedPaths = [
    "node_modules",
    "license",
    ".png",
    ".jpg",
    ".jpeg",
    ".ico",
    ".svg",
    ".json",
    ".md",
    ".txt",
    "test",
    "tests",
    ".test",
    "package",
    ".yml",
    "config",
    ".log",
    ".lock",
    ".bak",
    ".map",

    // this returns true for "scr/setupTests.ts"
  ];

  return !excludedPaths.some(
    (path: string) =>
      filePath.includes(path) ||
      filePath.endsWith(`.${path}`) ||
      filePath.startsWith(".") ||
      filePath === path
  );
}
