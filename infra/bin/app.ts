import { App } from "aws-cdk-lib";
import { LeagueStack } from "../lib/league-stack";

const app = new App();
new LeagueStack(app, "LeagueSite", {
  // One region for everything keeps billing simple and `cdk destroy` clean.
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION ?? "us-east-1" },
  budgetEmail: app.node.tryGetContext("budgetEmail"),
  monthlyBudgetUsd: Number(app.node.tryGetContext("monthlyBudgetUsd") ?? 5),
  syncHourUtc: Number(app.node.tryGetContext("syncHourUtc") ?? 9),
});
