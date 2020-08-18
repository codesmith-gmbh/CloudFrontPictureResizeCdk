import * as cdk from '@aws-cdk/core';
import {DockerVolumeConsistency, Duration} from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import * as path from 'path';

export class CloudFrontPictureResizeCdkStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const staticAssetsBucketName = new cdk.CfnParameter(this, "StaticAssetsBucketName", {
            type: "string",
            description: "The name of s3 bucket holding the static assets (inclusive pictures) of the WebMachine."
        })

        const s3Bucket = s3.Bucket.fromBucketName(this, "StaticAssetBucket", staticAssetsBucketName.valueAsString)

        const lambdaRole = new iam.Role(this, 'AllowLambdaServiceToAssumeRole', {
            assumedBy: new iam.CompositePrincipal(
                new iam.ServicePrincipal('lambda.amazonaws.com'),
                new iam.ServicePrincipal('edgelambda.amazonaws.com'),
            ),
            managedPolicies: [{managedPolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'}]
        });

        s3Bucket.grantRead(lambdaRole)
        s3Bucket.grantReadWrite(lambdaRole, "scaled/*")

        // @ts-ignore
        const resizeLambda = new lambda.Function(this, 'OriginResponseResizer', {
            runtime: lambda.Runtime.NODEJS_12_X,
            code: lambda.Code.fromAsset('lambda/CloudFrontPictureResize/', {
                bundling: {
                    image: cdk.BundlingDockerImage.fromAsset('lambda/CloudFrontPictureResize/tools/bundling'),
                    volumes: [{
                        hostPath: path.join(process.cwd(), 'lambda', 'CloudFrontPictureResize'),
                        containerPath: '/development'
                    }],
                    workingDirectory: '/development'
                }
            }),
            handler: 'index.lambdaHandler',
            timeout: Duration.seconds(30),
            role: lambdaRole,
            memorySize: 512,
            currentVersionOptions: {}
        })

        const version = resizeLambda.currentVersion;
        new cdk.CfnOutput(this, "ResizeFunction", {
            value: version.functionArn
        })

    }
}
