import { Probot } from "probot";
import { FileScoreMap } from "../types/File";
import json2md from "json2md";
import {
  errorFallbackCommentForPROpenEvent,
  pullRequestOpenComment,
} from "../constants/Comments";
import fromExponential from "from-exponential";

export async function createCommentOnGithub(
  app: Probot,
  comment: string,
  context: any,
  logParams?: any
) {
  const { installationId, pullRequestNumber, repoName } = logParams;
  const issueComment = context.issue({
    body: comment,
  });
  await context.octokit.issues.createComment(issueComment);
  app.log.info(
    `Added comment on github for installationId: ${installationId}, ref: [${repoName}/${pullRequestNumber}]`
  );
}

export async function constructMarkdownComment(
  app: Probot,
  files: FileScoreMap[]
): Promise<string> {
  const rows: string[][] = files.map((file: FileScoreMap) => {
    const { fileName, score, predictedScore } = fileValidation(app, file);
    return [`${fileName}`, `${score}`, `${predictedScore}`];
  });

  const rawScores = files.map((file: FileScoreMap) => {
    return [`${file.fileName}`, `${file.score}`, `${file.predictedScore}`];
  });

  if (rows.length === 0 || rows === undefined || rows === null) {
    app.log.error("File rows are invalid. cannot construct comment");
    return errorFallbackCommentForPROpenEvent();
  }

  const markdown = json2md(pullRequestOpenComment(rows, rawScores));
  return markdown;
}

export function fileValidation(app: Probot, file: FileScoreMap) {
  let fileName: string | undefined = file.fileName;
  let riskScore: string | undefined = JSON.stringify(file.score);
  let predictedRiskScore: string | undefined = JSON.stringify(
    file.predictedScore
  );
  if (
    fileName === undefined &&
    riskScore === undefined &&
    predictedRiskScore === undefined
  ) {
    app.log.warn(`All three fields are undefined`);
    app.log.warn(file);
    return {
      fileName: "N/A",
      score: "0",
      predictedScore: "0",
    };
  } else if (riskScore === undefined && predictedRiskScore === undefined) {
    app.log.warn(`Two fields are undefined`);
    app.log.warn(file);
    return {
      fileName: fileName,
      score: "0.00",
      predictedScore: "0.00",
    };
  } else if (riskScore === undefined) {
    app.log.warn(`Risk score is undefined`);
    app.log.warn(file);
    return {
      fileName: fileName,
      score: "0.00",
      predictedScore: numberToStringFormatter(file.predictedScore),
    };
  } else if (predictedRiskScore === undefined) {
    app.log.warn(`Predicted score is undefined`);
    app.log.warn(file);
    return {
      fileName: fileName,
      score: numberToStringFormatter(file.score),
      predictedScore: "0.00",
    };
  }

  return {
    fileName: fileName,
    score: file.score === 0 ? "0.00" : numberToStringFormatter(file.score),
    predictedScore:
      file.predictedScore === 0
        ? "0.00"
        : numberToStringFormatter(file.predictedScore),
  };
}

function numberToStringFormatter(number: number) {
  let num: string = fromExponential(number);
  const decimalIndex: number = num.indexOf(".") + 3;
  const formattedNumber: string = num.slice(0, decimalIndex);
  return formattedNumber;
}
