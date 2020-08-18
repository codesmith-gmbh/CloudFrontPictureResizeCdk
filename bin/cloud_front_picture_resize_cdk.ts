#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CloudFrontPictureResizeCdkStack } from '../lib/cloud_front_picture_resize_cdk-stack';

const app = new cdk.App();
new CloudFrontPictureResizeCdkStack(app, 'CloudFrontPictureResizeCdkStack');
