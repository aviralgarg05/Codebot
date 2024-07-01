import { Handler } from "@netlify/functions";

export const handler: Handler = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "bot is alive" }),
  };
};
