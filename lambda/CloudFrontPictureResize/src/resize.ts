import {S3} from "aws-sdk";
import {CloudFrontResponseEvent} from "aws-lambda";
import * as sharp from 'sharp';
import {CloudFrontRequest} from "aws-lambda/common/cloudfront";
import {unescape} from "querystring";

export class RequestAnalysis {
    s3Bucket: string
    intrinsicWidth: number
    contentType: string
    unscaledPath: string
}

export function extractBucketNameFromHost(host: string): string | null {
    try {
        let match = host.match(/^(.+)\.s3\.(?:(?:\w+|-)+?\.)?amazonaws\.com$/)
        return match[1]
    } catch (error) {
        console.log(`Could not extract the S3 Bucket name from the host ${host}: ${error}`)
        return null
    }
}

function contentTypeFromExtension(extension: string): string | null {
    extension = extension.toLowerCase()
    if (extension === 'jpg' || extension === 'jpeg') {
        return 'image/jpeg'
    } else if (extension === 'png') {
        return 'image/png'
    } else {
        return null
    }
}

export function analyseRequest(request: CloudFrontRequest): RequestAnalysis | null {
    try {
        let match = request.uri.match('^/scaled/([0-9]+)w/(.+)\\.([a-zA-Z0-9]+)$')
        let intrinsicWidth = parseInt(match[1])
        let unscaledUri = match[2]
        let extension = match[3]
        let contentType = contentTypeFromExtension(extension)
        if (contentType == null) {
            return null
        }
        let s3Bucket = extractBucketNameFromHost(request.headers['host'][0].value)
        return {contentType, intrinsicWidth, unscaledPath: unescape(unscaledUri + "." + extension), s3Bucket}
    } catch (error) {
        console.log(`Could not analyse request ${JSON.stringify(request)}: ${error}`)
        return null
    }
}

export function keyForRequest(request: CloudFrontRequest): string {
    return unescape(request.uri.substring(1))
}

async function fetchImage(s3: S3, requestAnalysis: RequestAnalysis) {
    try {
        return await s3.getObject({
            Bucket: requestAnalysis.s3Bucket,
            Key: requestAnalysis.unscaledPath,
        }).promise()
    } catch (error) {
        console.log("Could not fetch image; " + error)
        throw error
    }
}

async function storeImage(
    s3: S3,
    request: CloudFrontRequest,
    requestAnalysis: RequestAnalysis,
    imageObject: S3.GetObjectOutput,
    resizedImageBuffer: Buffer) {
    let imageKey = keyForRequest(request)
    try {
        await s3.putObject({
            Bucket: requestAnalysis.s3Bucket,
            Key: imageKey,
            ContentType: imageObject.ContentType,
            CacheControl: imageObject.CacheControl,
            Body: resizedImageBuffer,
            StorageClass: imageObject.StorageClass
        }).promise()
    } catch (error) {
        console.log(`Could not store the image under the key ${imageKey}; ${error}`)
        throw error
    }
}

export async function handleEvent(s3: S3, event: CloudFrontResponseEvent) {
    console.log(`Received event ${JSON.stringify(event)}.`)
    let response = event.Records[0].cf.response
    // if the response is not clearly that the object is absent, then
    // we simply forward it.
    if (!(response.status === '404' || response.status === '403')) {
        console.log(`The request has status ${response.status}; skipping`)
        return response
    }
    // if the response is not found, we first analyse the request.
    // 1. do we have an s3 bucket?
    // 2. is it for a scaling path?
    // 3. is it for an image ?
    // if one of the condition is false, we simply return the answer from the origin.
    let request = event.Records[0].cf.request
    let requestAnalysis = analyseRequest(request)
    if (requestAnalysis === null) {
        return response
    }
    // now, we are sure that we have a request for a scaled image that does not exists
    // in the s3 bucket. We fetch it, scaled it, stored it and return it. The next
    // request that does not hit the CF cache will fetch it from S3. If any of these
    // operation fails, we simply return the original response.
    try {
        const imageObject = await fetchImage(s3, requestAnalysis)
        // @ts-ignore // Body will be a buffer is this case (we hope...)
        let imageProcessor = sharp(imageObject.Body).resize(requestAnalysis.intrinsicWidth)
        if (requestAnalysis.contentType === 'image/jpeg') {
            imageProcessor = imageProcessor.jpeg({quality: 90})
        }
        let resizedImageBuffer = await imageProcessor.toBuffer();
        await storeImage(s3, request, requestAnalysis, imageObject, resizedImageBuffer)
        response.status = '200'
        response.headers['content-type'] = [{key: 'Content-Type', value: imageObject.ContentType}]
        // @ts-ignore : we force a body on the response
        response.bodyEncoding = 'base64'
        // @ts-ignore : we force a body on the response
        response.body = resizedImageBuffer.toString('base64')
        return response
    } catch (error) {
        console.log(`Could not process request ${JSON.stringify(requestAnalysis)}; ${error}`)
        return response
    }
}
