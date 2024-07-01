import MindsDB from "mindsdb-js-sdk";
import { getProbotInstance } from "../../auth";

const app = getProbotInstance();

export async function connectMindsDB() {
  return new Promise(async (resolve, reject) => {
    try {
      await MindsDB.connect({
        user: "",
        password: "",
        host: "http://127.0.0.1:47334",
      });

      resolve(MindsDB);
    } catch (error: any) {
      app.log.error("Error while connecting to mindsdb");
      reject(error);
    }
  });
}

export async function getMindsDBInstance() {
  return await connectMindsDB();
}
