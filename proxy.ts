import SmeeClient from "smee-client";

export const smee = new SmeeClient({
  source: "https://smee.io/HQ7QNBCix9HCl6sL",
  target: "http://localhost:3000/github-events",
  logger: console,
});
