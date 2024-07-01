import { FileStatus } from "../constants/GithubContants";
import { Commit } from "./Commit";

export type FileType = {
  installationId: number;
  owner: string;
  repoName: string;
  filePath: string;
  commits: Commit[];
  riskScore: number;
  predictedRiskScore: number;
};

export type FilePath = {
  path: string;
};

export type FileScoreMap = {
  fileName: string;
  score: number;
  predictedScore: number;
};

/**
 * Previous file name is only used when we have to delete
 * a file name that is renamed and now the DB would have a
 * dead file(file that won't be queried at all). That's why
 * it is optional
 */
export type GithubResponseFile = {
  sha: string;
  filePath: string;
  status: FileStatus;
  previousFileName?: string;
};

export type TrainingFileType = {
  installationId: number;
  owner: string;
  repoName: string;
  filePath: string;
  numberOfCommits: number;
  riskScore: number;
};
