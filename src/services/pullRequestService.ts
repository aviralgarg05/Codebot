import { Probot } from "probot";
import { getAllFilesFromPullRequest } from "../fetch/fetchFiles";
import { GithubResponseFile } from "../types/File";
import { File } from "../db/models/File";
import { FileScoreMap } from "../types/File";
import { FileType } from "../types/File";
import { FileStatus } from "../constants/GithubContants";
import { TrainingFileType } from "../types/File";
import { TrainingFile } from "../db/models/TrainingFile";
import { Job } from "../types/Job";
import { JobModel, JobName, JobStatus } from "../db/models/Job";
import {
  createFileTypeObject,
  createJobTypeObject,
  createTrainingFileTypeObject,
} from "../utils";

export async function processPullRequestOpenEvent(
  app: Probot,
  payload: any
): Promise<FileScoreMap[]> {
  const { responseFiles, installationId, owner, repoName } =
    await extractFileDetailsFromPREventPayload(app, payload);

  app.log.info(
    `Received an pull request opened event from installationId: ${installationId}`
  );

  let fileScoreMap: FileScoreMap[] = await createFileScoreMap(
    responseFiles,
    installationId,
    owner,
    repoName
  );
  app.log.info(`Fetched total ${fileScoreMap.length} files from the DB`);

  // for showing top 10 files sorted in descending order of risk scores
  const files = fileScoreMap.sort((a, b) => b.score - a.score).slice(0, 10);

  return files;
}

export async function updateFilesInDb(
  app: Probot,
  payload: any
): Promise<boolean> {
  try {
    const {
      isMerged,
      responseFiles,
      installationId,
      owner,
      repoName,
      defaultBranch,
      pullNumber,
    } = await extractFileDetailsFromPREventPayload(app, payload);

    app.log.info(
      `Received an pull request closed event from installationId: ${installationId}`
    );

    // isMerged will only be true when a pull request is going to be
    // merged with the default branch
    if (!isMerged) {
      app.log.warn(
        `Files are not updated, because this pull request(ref: [${owner}/${repoName}/pulls/${pullNumber}]) closed event is not being merged into default branch`
      );
      return false;
    }

    if (responseFiles.length === 0) {
      app.log.warn(
        `There are no files modified in the pull request with ref: [${owner}/${repoName}/pulls/${pullNumber}] and installationId: [${installationId}]`
      );
      return false;
    }

    const updateFileStatuses: FileStatus[] = [
      FileStatus.Modified,
      FileStatus.Changed,
    ];

    const addFileStatuses: FileStatus[] = [
      FileStatus.Added,
      FileStatus.Copied,
      FileStatus.Renamed,
    ];

    const removeFileStatuses: FileStatus[] = [FileStatus.Removed];

    responseFiles.forEach((responseFile: GithubResponseFile) => {
      if (updateFileStatuses.includes(responseFile.status)) {
        handleFileUpdates(
          app,
          responseFile.filePath,
          installationId,
          owner,
          repoName,
          defaultBranch
        );
      } else if (addFileStatuses.includes(responseFile.status)) {
        handleFileAdditions(
          app,
          responseFile.filePath,
          installationId,
          owner,
          repoName,
          defaultBranch,
          responseFile.previousFileName
        );
      } else if (removeFileStatuses.includes(responseFile.status)) {
        handleFileDeletions(
          installationId,
          owner,
          repoName,
          responseFile.filePath
        );
      }
    });

    app.log.info(
      `Updated the files coming from pull request with ref: [${owner}/${repoName}/pulls/${pullNumber}] successfully for installation id: [${installationId}]`
    );

    return true;
  } catch (error: any) {
    throw error;
  }
}

async function handleFileUpdates(
  app: Probot,
  filePath: string,
  installationId: number,
  owner: string,
  repoName: string,
  defaultBranch: string
) {
  // update the files
  const file: FileType = await createFileTypeObject(
    app,
    filePath,
    installationId,
    owner,
    repoName,
    defaultBranch
  );

  const filter = {
    installationId: file.installationId,
    owner: file.owner,
    repoName: file.repoName,
    filePath: file.filePath,
  };

  const update = {
    commits: file.commits,
    riskScore: file.riskScore,
    predictedRiskScore: file.predictedRiskScore,
  };

  const trainingFile: TrainingFileType = createTrainingFileTypeObject(file);

  /**
   * Since, a file is updated there is a need to repredict the
   * risk score due to new changes(if any). Hence, the need to
   * create a new job everytime a file has been updated
   */
  const job: Job = createJobTypeObject(
    file,
    JobName.FileUpdationJob,
    JobStatus.Incomplete
  );

  await Promise.all([
    File.updateOne(filter, update),
    TrainingFile.create(trainingFile),
    JobModel.create(job),
  ]);
}

async function handleFileAdditions(
  app: Probot,
  filePath: string,
  installationId: number,
  owner: string,
  repoName: string,
  defaultBranch: string,
  previousFileName?: string
) {
  // create new files in the db
  const file: FileType = await createFileTypeObject(
    app,
    filePath,
    installationId,
    owner,
    repoName,
    defaultBranch
  );

  const trainingFile: TrainingFileType = createTrainingFileTypeObject(file);
  const job: Job = createJobTypeObject(
    file,
    JobName.FileUpdationJob,
    JobStatus.Incomplete
  );

  await Promise.all([
    File.create(file),
    TrainingFile.create(trainingFile),
    JobModel.create(job),
  ]);

  /**
   * It is important to delete the files that are
   * renamed now to avoid unexpected errors during
   * predicted score updations and to keep the DB
   * clean from dead files(files which won't be queried at all)
   */
  app.log.info(`previous file name: ${previousFileName}`);
  const filter = {
    installationId: file.installationId,
    owner: file.owner,
    repoName: file.repoName,
    filePath: previousFileName,
  };
  app.log.info(filter);

  if (previousFileName !== undefined) {
    app.log.info("Deleting old file which is now renamed");
    await File.deleteOne(filter);
  }
}

async function handleFileDeletions(
  installationId: number,
  owner: string,
  repoName: string,
  filePath: string
) {
  const filter = {
    installationId: installationId,
    owner: owner,
    repoName: repoName,
    filePath: filePath,
  };

  await Promise.all([
    File.deleteOne(filter),
    TrainingFile.deleteOne(filter),
    JobModel.deleteOne({ parameters: filter }),
  ]);
}

async function extractFileDetailsFromPREventPayload(app: Probot, payload: any) {
  const { pull_request, installation, repository } = payload;
  const pullNumber: number = pull_request.number;
  const isMerged: boolean = pull_request.merged;
  const defaultBranch: string = repository.default_branch;

  const repoFullName: string = pull_request.base.repo.full_name;
  const installationId: number = installation.id;

  const fullName = repoFullName.split("/");
  const owner = fullName[0];
  const repoName = fullName[1];

  const responseFiles: GithubResponseFile[] = await getAllFilesFromPullRequest(
    app,
    owner,
    repoName,
    installationId,
    pullNumber
  );

  return {
    isMerged,
    responseFiles,
    installationId,
    owner,
    pullNumber,
    repoName,
    defaultBranch,
  };
}

async function createFileScoreMap(
  responseFiles: GithubResponseFile[],
  installationId: number,
  owner: string,
  repoName: string
): Promise<FileScoreMap[]> {
  const fileScoreMap: FileScoreMap[] = await Promise.all(
    responseFiles.map(async (file: GithubResponseFile) => {
      const fileObject: FileType | null = await File.findOne({
        installationId: installationId,
        owner: owner,
        repoName: repoName,
        filePath: file.filePath,
      });

      if (fileObject === null) {
        return {
          fileName: file.filePath,
          score: 0,
          predictedScore: 0,
        };
      }

      return {
        fileName: file.filePath,
        score: fileObject.riskScore,
        predictedScore: fileObject.predictedRiskScore,
      };
    })
  );

  return fileScoreMap;
}
