import { Probot } from "probot";
import MindsDB, {
  BatchQueryOptions,
  Database,
  JsonValue,
  Model,
  ModelPrediction,
  QueryOptions,
  TrainingOptions,
} from "mindsdb-js-sdk";
import { Job } from "../types/Job";
import { getProbotInstance } from "../auth";
import { FileType } from "../types/File";

const {
  MONGODB_USER,
  MONGODB_PASSWORD,
  MONGODB_PORT,
  MONGODB_CONNECTION_STRING,
  MONGODB_DATABASE,
} = process.env;

const app = getProbotInstance();

const databaseName = `mongo_datasource`;
const projectName = `mindsdb`;
const predictorName = `riskscore_predictor`;
const targetField = `riskScore`;
const aggregationQuery = `test.trainingfiles.find({})`;
const joinQuery = `mongo_datasource.trainingfiles`;
const mindsdbBatchQuerySize = 10;

const regressionTrainingOptions: TrainingOptions = {
  select: aggregationQuery,
  integration: databaseName,
  groupBy: "installationId",
  window: 100, // How many rows in the past to use when making a future prediction.
  horizon: 10, // How many rows in the future to forecast.
};

export async function retrainPredictorModel(app: Probot) {
  await MindsDB.Models.retrainModel(
    predictorName,
    targetField,
    projectName,
    regressionTrainingOptions
  )
    .then(() => {
      app.log.info(`Started [${predictorName}] model retraining successfully`);
    })
    .catch((error: any) => {
      app.log.error(
        `Error occurred while retraining the model [${predictorName}]`
      );
      app.log.error(error);
    });
}

export async function trainPredictorModel() {
  try {
    const models: Model[] = await MindsDB.Models.getAllModels(projectName);
    const modelNames = models.map((model: Model) => model.name);

    if (modelNames.includes(predictorName)) {
      app.log.info(`[${predictorName}] model is already present in mindsdb`);
      return;
    }
    app.log.info(`Started training the model: [${predictorName}]`);
    const dbList: Database[] = await MindsDB.Databases.getAllDatabases();
    const dbNames: string[] = dbList.map((db: Database) => db.name);

    if (!dbNames.includes(databaseName)) {
      const db: Database | undefined = await createDatabase(app);
      app.log.info(`Created database: ${db?.name} in mindsdb successfully`);
    }

    let predictionModel: Model | undefined = await MindsDB.Models.trainModel(
      predictorName,
      targetField,
      projectName,
      regressionTrainingOptions
    );

    const intervalId = setInterval(async () => {
      predictionModel = await MindsDB.Models.getModel(
        predictorName,
        projectName
      );

      if (!predictionModel?.status.match("error")) {
        app.log.info("Prediction model training is complete");
        clearInterval(intervalId);
      }
    }, 2000);

    app.log.info(`training completed for [${predictorName}]`);
  } catch (error: any) {
    app.log.error("Error while training the model");
    app.log.error(error);
  }
}

export async function queryMindDB(app: Probot, model: Model, job: Job) {
  try {
    const queryOptions: QueryOptions = {
      where: [
        `installationId=${job.parameters.installationId}`,
        `owner="${job.parameters.owner}"`,
        `repoName="${job.parameters.repoName}"`,
        `filePath="${job.parameters.filePath}"`,
      ],
    };
    const response: ModelPrediction | undefined = await model.query(
      queryOptions
    );
    if (response === undefined) {
      throw new Error("response is undefined");
    }
    const data: any = response.data;
    const file: FileType = {
      installationId: data.installationid,
      owner: data.owner,
      repoName: data.reponame,
      filePath: data.filepath,
      commits: [], // won't update
      riskScore: data.riskscore_original, // won't update
      predictedRiskScore: data.riskscore,
    };

    return file;
  } catch (error: any) {
    app.log.error(`Error while querying the predictor model: ${error.message}`);
    throw error;
  }
}

export async function batchQueryMindDB(
  app: Probot,
  installationId: number
): Promise<FileType[]> {
  return pollPredictorModelStatus()
    .then(async (model: Model | undefined) => {
      const queryOptions: BatchQueryOptions = {
        join: joinQuery,
        where: [`t.installationId=${installationId}`],
        limit: mindsdbBatchQuerySize,
      };
      const response: ModelPrediction[] | undefined = await model?.batchQuery(
        queryOptions
      );
      if (response === undefined) {
        throw new Error(`response is undefined`);
      }
      const files: FileType[] = response.map((obj: ModelPrediction) => {
        const data: any = obj.data;
        return {
          installationId: data.installationid,
          owner: data.owner,
          repoName: data.reponame,
          filePath: data.filepath,
          commits: [], // won't update in DB
          riskScore: data.riskscore_original, // won't update in DB
          predictedRiskScore: data.predicted, // convert e power to number
        };
      });

      return files;
    })
    .catch((error: any) => {
      app.log.error(
        `Error while polling the predictor model status: ${error.message}`
      );
      throw error;
    });
}

export async function pollPredictorModelStatus() {
  try {
    const model: Model | undefined = await MindsDB.Models.getModel(
      predictorName,
      projectName
    );

    if (model?.status === "complete" || model?.status === "error") {
      app.log.info(`Returning model with status: ${model.status}`);
      return model;
    } else {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return pollPredictorModelStatus();
    }
  } catch (error: any) {
    throw error;
  }
}

async function createDatabase(app: Probot): Promise<Database | undefined> {
  if (
    MONGODB_USER === undefined ||
    MONGODB_PASSWORD === undefined ||
    MONGODB_PORT === undefined ||
    MONGODB_CONNECTION_STRING === undefined ||
    MONGODB_DATABASE === undefined
  ) {
    app.log.error(
      `MindsDB environment values are undefined: DB:${MONGODB_DATABASE}, USER:${MONGODB_USER}, PASSWORD: ${MONGODB_PASSWORD}, PORT: ${MONGODB_PORT}, HOST: ${MONGODB_CONNECTION_STRING}`
    );
    return;
  }

  const connectionParams: Record<string, JsonValue> = {
    username: MONGODB_USER,
    password: MONGODB_PASSWORD,
    port: MONGODB_PORT,
    host: MONGODB_CONNECTION_STRING,
    database: MONGODB_DATABASE,
  };

  try {
    const mongoDB: Database = await MindsDB.Databases.createDatabase(
      databaseName,
      "mongodb",
      connectionParams
    );

    return mongoDB;
  } catch (error: any) {
    app.log.error("Error while creating database in mindsdb");
    throw error;
  }
}
