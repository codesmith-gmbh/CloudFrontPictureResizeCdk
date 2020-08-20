import {expect as expectCDK, matchTemplate, MatchStyle, haveResource} from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as CloudFrontPictureResizeCdk from '../lib/cloud_front_picture_resize_cdk-stack';

const TestStackName = "TestStack"

test('Lambda Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new CloudFrontPictureResizeCdk.CloudFrontPictureResizeCdkStack(app, TestStackName, {staticS3BucketName: "staticS3Bucket"});
    // THEN
    expectCDK(stack).to(haveResource("AWS::Lambda::Function", {
        Timeout: 30
    }))
    expectCDK(stack).to(haveResource("AWS::SSM::Parameter", {
        Name: "/codesmith/webmachine/" + TestStackName + "/" + CloudFrontPictureResizeCdk.ResizeFunctionVersionArn
    }))
});
