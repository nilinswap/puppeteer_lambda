'use strict';
const chromium = require('chrome-aws-lambda');
const AWS = require('aws-sdk');
const fs = require('fs');

let debug_set = false;

function debug() {
    if (debug_set) {
        console.log(arguments);
    }
}


function imagesHaveLoaded() {
    return Array.from(document.images).every((i) => i.complete);
}


exports.pdf = async function(event, context) {
    let browser = null;
    let result = null;
    let pageUrl = "https://www.google.com/";
    let sign = 'false';
    let filename = false;
    if (debug_set) {
        sign = true;
    }

    if (
        event.queryStringParameters && event.queryStringParameters.sign) {
        sign = event.queryStringParameters.sign;
        debug("Received sign: " + sign);
    }

    if (event.queryStringParameters && event.queryStringParameters.pageurl) {
        pageUrl = event.queryStringParameters.pageurl;
        debug("Received pageurl: " + pageUrl);
    }

    let content_disposition = null;

    if (filename) {
        content_disposition = 'attachment; filename=' + filename;
    } else {
        content_disposition = 'inline';
    }

    let pdf = null;

    console.time("puppeteer");
    try {
        debug("before browser");

        browser = await chromium.puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath,
            headless: chromium.headless
        });
        debug("browser", browser);



        console.time("page_content");
        const page = await browser.newPage();
        console.log("pageurl:", pageUrl);

        //use sentry
        const preloadFile = fs.readFileSync('./preload.js', 'utf8');
        await page.evaluateOnNewDocument(preloadFile);

        var respons = await page.goto(pageUrl);
        if(respons._status != 200){
            console.log("unable to load page in puppeteer");
            result = {
                headers: {
                    'Content-type': 'text/html; charset=UTF-8'
                },
                statusCode: respons._status,
                body: "Some error occured"
            };
            return context.succeed(result);
        };
        console.log("page status", respons._status);

        await page.content();
        await page.waitForFunction(imagesHaveLoaded);
        await page.evaluateHandle('document.fonts.ready');
        console.timeEnd("page_content");

        // 4. Create pdf file with puppeteer
        pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '1cm',
                right: '1cm',
                bottom: '1cm',
                left: '1cm'
            }
        });
        debug("pdf", pdf);
    } catch (error) {
        return context.fail(error);
    } finally {
        if (browser !== null) {
            await browser.close();
        }
    }
    console.timeEnd("puppeteer")


    if (sign == 'false') {
        result = {
            headers: {
                'Content-type': 'application/pdf',
                'content-disposition': content_disposition
            },
            statusCode: 200,
            body:  pdf.toString('base64'),
            isBase64Encoded: true
        };
        return context.succeed(result);
    } else {

        console.time("pdf-sign-lambda")

        debug("sign", sign);
        debug("pdf type", typeof pdf)
        var params = {
            FunctionName: 'platform-add-digital-signature-to-pdf',
            Payload: JSON.stringify({"data": pdf.toString('base64')}),
        }

        if (debug_set) {
            params["LogType"] = "Tail";
        }

        var lambda = new AWS.Lambda();
        var signed_pdf = null;

        let promise = new Promise((resolve, reject) => {

            lambda.invoke(params).promise().then(
                function(data) {
                    debug("data", data);
                    signed_pdf = JSON.parse(data.Payload)['pdf'];

                    result = {
                        headers: {
                            'Content-type': 'application/pdf',
                            'content-disposition': content_disposition
                        },
                        statusCode: 200,
                        body: signed_pdf,
                        isBase64Encoded: true
                    };
                    resolve(result)

                },
                function(error) {
                    console.log("## ERROR ##");
                    console.log("error", error);
                    console.log(error.stack);
                    reject(error);
                }
            )
        });
        let a_promise = await promise;
        return a_promise;
    }
}
