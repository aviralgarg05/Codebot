import { Probot } from "probot";
import { FileType, TrainingFileType } from "./types/File";
import { Commit } from "./types/Commit";
import { getAllCommits } from "./fetch/fetchCommits";
import { calculateRiskScore } from "./services/riskScoreService";
import { JobName, JobStatus } from "./db/models/Job";
import { Job } from "./types/Job";

export function getTimeDifference(date: Date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return 1;
  }
  const currentTime = new Date();
  const difference: number = currentTime.getTime() - date.getTime();
  const scalingFactor = 24 * 60 * 60 * 1000; // 1 day in milliseconds
  const normalizedDifference = difference / scalingFactor;

  return normalizedDifference;
}
/**
 * @param monthsToReduce number of months to reduce from current date
 * @returns returns the time stamp in ISO string
 */
export function getTimeStampOlderThanMonths(monthsToReduce: number): string {
  let currentTime = new Date();
  currentTime.setMonth(currentTime.getMonth() - monthsToReduce);
  return currentTime.toISOString();
}

/**
 * Creates a file object by fetching all the recent commits
 *
 * @param app
 * @param filePath
 * @param installationId
 * @param owner
 * @param repoName
 * @param defaultBranch
 * @returns
 */
export async function createFileTypeObject(
  app: Probot,
  filePath: string,
  installationId: number,
  owner: string,
  repoName: string,
  defaultBranch: string
): Promise<FileType> {
  const commits: Commit[] = await getAllCommits(
    app,
    installationId,
    owner,
    repoName,
    defaultBranch,
    filePath
  );
  const riskScore = calculateRiskScore(app, commits);
  // This score will be updated by the scheduled job
  const predictedRiskScore = 0;

  return {
    installationId,
    owner,
    repoName,
    filePath,
    commits,
    riskScore,
    predictedRiskScore,
  };
}

export function createTrainingFileTypeObject(file: FileType): TrainingFileType {
  return {
    installationId: file.installationId,
    owner: file.owner,
    repoName: file.repoName,
    filePath: file.filePath,
    numberOfCommits: file.commits.length,
    riskScore: file.riskScore,
  };
}

export function createJobTypeObject(
  file: FileType,
  jobName: JobName,
  status: JobStatus
): Job {
  return {
    jobName: jobName,
    parameters: {
      installationId: file.installationId,
      owner: file.owner,
      repoName: file.repoName,
      filePath: file.filePath,
    },
    status: status,
    scheduledAt: new Date(),
  };
}
