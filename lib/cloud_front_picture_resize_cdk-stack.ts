import * as cdk from '@aws-cdk/core';
import {Duration} from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import * as path from 'path';

export interface StackProps {
    staticS3BucketName: string
}

export class CloudFrontPictureResizeCdkStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, stackProps: StackProps, cdkProps?: cdk.StackProps) {
        super(scope, id, cdkProps);

        const s3Bucket = s3.Bucket.fromBucketName(this, "StaticAssetBucket", stackProps.staticS3BucketName)

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
        let lambdaPath = path.join(__dirname, '..', 'lambda', 'CloudFrontPictureResize');
        const resizeLambda = new lambda.Function(this, 'OriginResponseResizer', {
            runtime: lambda.Runtime.NODEJS_12_X,
            code: lambda.Code.fromAsset(lambdaPath, {
                bundling: {
                    image: cdk.BundlingDockerImage.fromAsset(path.join(lambdaPath, 'tools', 'bundling')),
                    volumes: [{
                        hostPath: lambdaPath,
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
