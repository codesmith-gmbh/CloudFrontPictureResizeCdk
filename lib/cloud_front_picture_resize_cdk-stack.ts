import * as cdk from '@aws-cdk/core';
import {Duration} from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import * as ssm from '@aws-cdk/aws-ssm';
import * as path from 'path';
import * as customresources from '@aws-cdk/custom-resources';
import {AwsCustomResourcePolicy, PhysicalResourceId} from "@aws-cdk/custom-resources";

const packageJson = require('../package.json')

export interface StackProps {
    staticS3BucketName: string
}

export const ResizeFunctionVersionArn = "ResizeFunctionVersionArn"

export class CloudFrontPictureResizeCdkStack extends cdk.Stack {

    public readonly resizeFunctionVersionArnParameter: string

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
                    image: cdk.BundlingDockerImage.fromAsset(lambdaPath),
                    workingDirectory: '/development',
                    environment: {
                        "PACKAGE_VERSION": packageJson.version
                    }
                }
            }),
            handler: 'index.lambdaHandler',
            timeout: Duration.seconds(30),
            role: lambdaRole,
            memorySize: 512,
            currentVersionOptions: {}
        })

        const lambdaVersion = resizeLambda.currentVersion;

        this.resizeFunctionVersionArnParameter = id + ResizeFunctionVersionArn

        const parameter = new ssm.StringParameter(this, ResizeFunctionVersionArn, {
            parameterName: this.resizeFunctionVersionArnParameter,
            stringValue: lambdaVersion.functionArn
        })
    }

    resizeFunctionVersionArnFromParameter(scope: cdk.Construct, id: string) {
        return this.readParameterCustomResource(scope, id, this.resizeFunctionVersionArnParameter)
    }

    readParameterCustomResource(scope: cdk.Construct, id: string, parameterName: string) {
        return new customresources.AwsCustomResource(scope, id, {
            onUpdate: {
                service: 'SSM',
                action: 'getParameter',
                parameters: {
                    Name: parameterName
                },
                region: this.region,
                physicalResourceId: PhysicalResourceId.of(id + Date.now().toString())
            },
            policy: AwsCustomResourcePolicy.fromSdkCalls({
                resources: [this.formatArn({
                    service: 'ssm',
                    resource: 'parameter',
                    sep: '',
                    resourceName: parameterName
                })]
            })
        }).getResponseField("Parameter.Value")
    }

}
