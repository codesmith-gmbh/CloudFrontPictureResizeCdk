import {S3} from 'aws-sdk';
import * as resize from './resize';

import {CloudFrontResponseEvent, Context} from 'aws-lambda';

const s3 = new S3();

exports.lambdaHandler = async (event: CloudFrontResponseEvent, _: Context) => {
    return await resize.handleEvent(s3, event)
}