import 'mocha';
import * as assert from 'assert';
import * as resize from '../src/resize';
import {CloudFrontRequest} from "aws-lambda/common/cloudfront";

function testRequest(path: string): CloudFrontRequest {
    return {
        clientIp: "",
        headers: {'host': [{value: "images.bucket.s3.eu-west-1.amazonaws.com"}]},
        method: "",
        querystring: "",
        uri: path
    }
}

function assertAnalyseRequestCorrectness(path: string, requestAnalysis: resize.RequestAnalysis) {
    it(`correctness ${path}`, function () {
        assert.deepStrictEqual(resize.analyseRequest(testRequest(path)), requestAnalysis)
    })
}

function assertAnalyseRequestCompleteness(path: string) {
    it(`completeness ${path}`, function () {
        assert.strictEqual(resize.analyseRequest(testRequest(path)), null)
    })
}

describe('analyseRequest', function () {
    assertAnalyseRequestCorrectness('/scaled/200w/event/123/test.png',
        {
            intrinsicWidth: 200,
            contentType: 'image/png',
            unscaledPath: 'event/123/test.png',
            s3Bucket: 'images.bucket'
        })
    assertAnalyseRequestCorrectness('/scaled/200w/event/123/test.JpeG',
        {
            intrinsicWidth: 200,
            contentType: 'image/jpeg',
            unscaledPath: 'event/123/test.JpeG',
            s3Bucket: 'images.bucket'
        })
    assertAnalyseRequestCorrectness('/scaled/3200w/event/123/test.jpg',
        {
            intrinsicWidth: 3200,
            contentType: 'image/jpeg',
            unscaledPath: 'event/123/test.jpg',
            s3Bucket: 'images.bucket'
        })
    assertAnalyseRequestCorrectness('/scaled/3200w/test/3ms-framework_%E2%80%93_resources_py.jpg',
        {
            intrinsicWidth: 3200,
            contentType: 'image/jpeg',
            unscaledPath: 'test/3ms-framework_–_resources_py.jpg',
            s3Bucket: 'images.bucket'
        })
    it('correctness test lambda', function () {
        assert.deepStrictEqual(resize.analyseRequest(
            {
                clientIp: "", method: "", querystring: "",
                "uri": "/scaled/200w/events/1234/rounding.jpg",
                "headers":
                    {
                        "host": [
                            {
                                "key": "Host",
                                "value": "imageresizingcdkstack-images3bucket080cc34d-1aotk9hc8wpob.s3.us-east-1.amazonaws.com"
                            }
                        ]
                    }
            }
            ),
            {
                intrinsicWidth: 200,
                contentType: 'image/jpeg',
                unscaledPath: 'events/1234/rounding.jpg',
                s3Bucket: 'imageresizingcdkstack-images3bucket080cc34d-1aotk9hc8wpob'
            })
    })
    assertAnalyseRequestCompleteness('/scaled/200w/test.txt')
    assertAnalyseRequestCompleteness('/scaled/200w/test.tiff')
    assertAnalyseRequestCompleteness('/scaled/200w/test.webp')
    assertAnalyseRequestCompleteness('/event/123/test.png')
    assertAnalyseRequestCompleteness('/scaled/test.png')
    assertAnalyseRequestCompleteness('/scaled/200/test.png')
    assertAnalyseRequestCompleteness('/scaled/w/test.png')
    assertAnalyseRequestCompleteness('/scaled')
    assertAnalyseRequestCompleteness('/scaled/')
    assertAnalyseRequestCompleteness('/scaled/200')
    assertAnalyseRequestCompleteness('/scaled/200/')
    it('completeness no s3 bucket', function () {
        assert.strictEqual(resize.analyseRequest({
            uri: '/scaled/3200w/event/123/test.jpg',
            clientIp: "",
            headers: undefined,
            method: "",
            querystring: ""
        }), null)
    })
})

function assertExtractBucketNameFromHostCorrectness(host: string, bucketName: string) {
    it(`Correctness ${host}`, function () {
        assert.strictEqual(resize.extractBucketNameFromHost(host), bucketName)
    })
}

function assertExtractBucketNameFromHostCompleteness(host: string) {
    it(`Completeness ${host}`, function () {
        assert.strictEqual(resize.extractBucketNameFromHost(host), null)
    })
}

describe('extractBucketNameFromHost', function () {
    assertExtractBucketNameFromHostCorrectness(
        'imageresizingbucket.s3.amazonaws.com',
        'imageresizingbucket'
    )
    assertExtractBucketNameFromHostCorrectness(
        'imageresizingbucket.s3.eu-west-1.amazonaws.com',
        'imageresizingbucket'
    )
    assertExtractBucketNameFromHostCompleteness('codesmith.ch')
    assertExtractBucketNameFromHostCompleteness('imageresizingbucket.amazonaws.com')
    assertExtractBucketNameFromHostCompleteness('imageresizingbucket.eu-west-1.amazonaws.com')
})
