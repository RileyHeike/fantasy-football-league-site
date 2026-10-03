import { join } from "node:path";
import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
  aws_budgets as budgets,
  aws_cloudwatch as cw,
  aws_cloudwatch_actions as cwActions,
  aws_events as events,
  aws_events_targets as targets,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_lambda_nodejs as nodejs,
  aws_logs as logs,
  aws_s3 as s3,
  aws_sns as sns,
  aws_sns_subscriptions as subs,
  aws_ssm as ssm,
} from "aws-cdk-lib";
import type { Construct } from "constructs";

export interface LeagueStackProps extends StackProps {
  budgetEmail: string;
  monthlyBudgetUsd: number;
  syncHourUtc: number;
}

/**
 * Everything except the Amplify app itself (connected to GitHub in the
 * console, then given the build role output below).
 *
 * Cost guardrails baked in: no VPC (so no NAT Gateway), reserved concurrency 1,
 * 30-day log retention, S3 only, a monthly budget with email alerts, and an
 * alarm when the nightly sync fails.
 */
export class LeagueStack extends Stack {
  constructor(scope: Construct, id: string, props: LeagueStackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, "Data", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: RemovalPolicy.RETAIN, // league history is precious
    });

    // Created as a placeholder; paste the Amplify incoming-webhook URL into it
    // after the Amplify app exists (Parameter Store standard tier is free).
    const buildHook = new ssm.StringParameter(this, "BuildHookUrl", {
      parameterName: "/league-site/amplify-build-hook",
      stringValue: "unset",
      description: "Amplify incoming webhook URL that rebuilds the site",
    });

    const logGroup = new logs.LogGroup(this, "SyncLogs", {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const sync = new nodejs.NodejsFunction(this, "Sync", {
      entry: join(import.meta.dirname, "../../apps/sync/src/lambda.ts"),
      projectRoot: join(import.meta.dirname, "../.."),
      depsLockFilePath: join(import.meta.dirname, "../../package-lock.json"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.minutes(10),
      reservedConcurrentExecutions: 1,
      retryAttempts: 0,
      logGroup,
      environment: {
        DATA_BUCKET: bucket.bucketName,
        BUILD_HOOK_PARAM: buildHook.parameterName,
      },
      bundling: { format: nodejs.OutputFormat.ESM, target: "node22", minify: true, sourceMap: true },
    });
    bucket.grantReadWrite(sync);
    buildHook.grantRead(sync);

    // Nightly. The handler itself skips most offseason days.
    new events.Rule(this, "Nightly", {
      schedule: events.Schedule.cron({ minute: "0", hour: String(props.syncHourUtc) }),
      targets: [new targets.LambdaFunction(sync, { retryAttempts: 0 })],
    });

    const alerts = new sns.Topic(this, "Alerts");
    alerts.addSubscription(new subs.EmailSubscription(props.budgetEmail));
    new cw.Alarm(this, "SyncFailed", {
      metric: sync.metricErrors({ period: Duration.days(1) }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cw.TreatMissingData.NOT_BREACHING,
      alarmDescription: "The nightly league sync threw an error",
    }).addAlarmAction(new cwActions.SnsAction(alerts));

    new budgets.CfnBudget(this, "MonthlyBudget", {
      budget: {
        budgetName: "league-site-monthly",
        budgetType: "COST",
        timeUnit: "MONTHLY",
        budgetLimit: { amount: props.monthlyBudgetUsd, unit: "USD" },
      },
      notificationsWithSubscribers: [
        { threshold: 50, notificationType: "ACTUAL" },
        { threshold: 100, notificationType: "ACTUAL" },
        { threshold: 100, notificationType: "FORECASTED" },
      ].map((n) => ({
        notification: { comparisonOperator: "GREATER_THAN", thresholdType: "PERCENTAGE", ...n },
        subscribers: [{ subscriptionType: "EMAIL", address: props.budgetEmail }],
      })),
    });

    // Role the Amplify build assumes to download the latest snapshot.
    const amplifyRole = new iam.Role(this, "AmplifyBuildRole", {
      assumedBy: new iam.ServicePrincipal("amplify.amazonaws.com"),
      description: "Lets the Amplify build read snapshot/latest.json",
    });
    bucket.grantRead(amplifyRole, "snapshot/*");

    new CfnOutput(this, "DataBucketName", { value: bucket.bucketName });
    new CfnOutput(this, "SyncFunctionName", { value: sync.functionName });
    new CfnOutput(this, "AmplifyBuildRoleArn", { value: amplifyRole.roleArn });
    new CfnOutput(this, "BuildHookParameter", { value: buildHook.parameterName });
  }
}
