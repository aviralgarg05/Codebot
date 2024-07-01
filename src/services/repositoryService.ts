import { Probot } from "probot";
import { Commit } from "../types/Commit";
import { getAllCommits } from "../fetch/fetchCommits";
import { getAllFiles } from "../fetch/fetchFiles";
import { calculateRiskScore } from "./riskScoreService";
import { FilePath } from "../types/File";
import { File } from "../db/models/File";
import configs from "../configs/fetch.configs.json";
import { fetchDetailsWithInstallationId } from "../fetch/fetch";
import { FileType } from "../types/File";
import { TrainingFile } from "../db/models/TrainingFile";
import { TrainingFileType } from "../types/File";
import { retrainPredictorModel } from "./predictionService";
import { Job } from "../types/Job";
import { JobModel, JobName, JobStatus } from "../db/models/Job";

export async function processRepositories(
  app: Probot,
  response: any
): Promise<void> {
  const batchSize = configs.batch_size.repository_processing_batch_size;

  const { repositories, installation } = response;
  const repos: any[] = repositories;
  const installationId: number = installation.id;
  const owner = installation.account.login;

  app.log.info(
    `Started the processing of repositories for [${installationId}]`
  );

  for (let i = 0; i < repos.length; i += batchSize) {
    const batch = repos.slice(i, i + batchSize);
    await processRepositoryBatch(app, installationId, owner, batch);
  }

  retrainPredictorModel(app);
}

async function processRepositoryBatch(
  app: Probot,
  installationId: number,
  owner: string,
  repositories: any[]
): Promise<void> {
  try {
    await Promise.all(
      repositories.map(async (repo) => {
        app.log.info(`Started processing repository: [${repo.name}]`);

        const defaultBranch = await getDefaultBranch(
          app,
          installationId,
          owner,
          repo.name
        );

        const fileNames: FilePath[] = await getAllFiles(
          app,
          installationId,
          owner,
          repo.name,
          defaultBranch
        );

        app.log.info(
          `Received Total ${fileNames.length} files for processing from repository: [${owner}/${repo.name}] with installation id: [${installationId}]`
        );

        if (fileNames.length === 0) {
          app.log.warn(
            `Cannot proceed further, because files are not available for [${owner}/${repo.name}] with installation id: [${installationId}]`
          );
          return;
        }

        const fileCommitMapPromises = fileNames.map(async (file) => {
          const commits: Commit[] = await getAllCommits(
            app,
            installationId,
            owner,
            repo.name,
            defaultBranch,
            file.path
          );
          return { file, commits };
        });

        const fileCommitMaps = await Promise.all(fileCommitMapPromises);

        if (fileCommitMaps.length === 0) {
          app.log.warn(
            `Cannot proceed to save files, because either file-commit-map is empty or it exceeded the allowed size limit for [${owner}/${repo.name}] with installation id: [${installationId}]`
          );
          return;
        }

        const files: FileType[] = fileCommitMaps.map(({ file, commits }) => ({
          installationId: installationId,
          owner: owner,
          repoName: repo.name,
          filePath: file.path,
          commits: commits,
          riskScore: calculateRiskScore(app, commits),
          predictedRiskScore: 0, // we have no predicted value as of yet, because this file is newly added
        }));

        const trainingFiles: TrainingFileType[] = files.map(
          (file: FileType) => ({
            installationId: file.installationId,
            owner: file.owner,
            repoName: file.repoName,
            filePath: file.filePath,
            riskScore: file.riskScore,
            numberOfCommits: file.commits.length, // FIXME: length is zero in the db. it should not because commits array is not zero in files collection
          })
        );

        /**
         * When a new app installation happen, there will be no predicted scores present
         * for the files in the DB because of incomplete training of the predictor model.
         * once the predictor model generates the scores for all the files that are newly added to
         * the DB, the scheduler will be responsible to update them with the predicted scores
         */
        const jobs: Job[] = files.map((file: FileType) => ({
          jobName: JobName.InstallationJob,
          parameters: {
            installationId: file.installationId,
            owner: file.owner,
            repoName: file.repoName,
            filePath: file.filePath,
          },
          status: JobStatus.Incomplete,
          scheduledAt: new Date(),
        }));

        await Promise.all([
          File.insertMany(files),
          TrainingFile.insertMany(trainingFiles),
          JobModel.insertMany(jobs),
        ]);

        app.log.info(
          `Completed the processing of [${owner}/${repo.name}] repository successfully for installation id: [${installationId}]`
        );
      })
    );
  } catch (error: any) {
    app.log.error(`Error while processing the repository batch`);
    app.log.error(error);
  }
}

async function getDefaultBranch(
  app: Probot,
  installationId: number,
  owner: string,
  repoName: string
): Promise<string> {
  const repositoryResponse: any = await fetchDetailsWithInstallationId(
    app,
    installationId,
    configs.repository.endpoint,
    {
      owner: owner,
      repo: repoName,
    }
  );

  return repositoryResponse.data.default_branch;
}
