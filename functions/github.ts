import {
  ApplicationFunction,
  Probot,
  createLambdaFunction,
} from "@probot/adapter-aws-lambda-serverless";
import app from "../src/index";

const APP_ID = process.env.APP_ID;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

export const handler = createLambdaFunction(
  app as unknown as ApplicationFunction,
  {
    probot: new Probot({
      appId: APP_ID,
      privateKey: PRIVATE_KEY,
      secret: WEBHOOK_SECRET,
    }),
  }
);
