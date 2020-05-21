'use strict';

const chromium = require('chrome-aws-lambda');
const AWS = require('aws-sdk');
const fs = require('fs');
const http = require("https");

let debug_set = true;

function debug() {
    if (debug_set) {
        console.log(arguments);
    }
}

function makeid(length) {
   var result           = '';
   var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
   var charactersLength = characters.length;
   for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}

function imagesHaveLoaded() {
    return Array.from(document.images).every((i) => i.complete);
}

function get_from_event_qp(event, name, fallback = null){
    if (event.queryStringParameters && event.queryStringParameters[name]) {
        var value = event.queryStringParameters[name];
        debug("Received ", name,  value);
        return value;
    }
    else{
        return fallback;
    }
}


async function upload_s3(bucketName, fileName, pdf){
    const s3 = new AWS.S3();

    var params = {
      Key : fileName,
      Body : pdf,
      Bucket : bucketName
    };
    return s3.putObject(params).promise();
}


async function download_s3(bucketName, fileName){
    const s3 = new AWS.S3();

    var params = { Bucket: bucketName, Key: fileName };

    return s3.getObject(params
          ,
          function (error, data) {
            if (error != null) {
             console.log("Failed to retrieve an object: " + error);
            } else {
              console.log("Loaded " + data.ContentLength + " bytes");
              return data.Body.toString();
            }
          }
        ).promise();
}


async function convert_to_pdf(url, html){
    console.time("puppeteer");

    try {
        debug("before browser");

        var browser = await chromium.puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath,
            headless: chromium.headless
        });
        debug("browser", browser);

        //console.time("page_content")
        const page = await browser.newPage();
        if(url !== null){
            var respons = await page.goto(url);
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
            await page.content();
        }
        else if(html !== null){
            debug("here above setcontent")
            await page.setContent(html);
        }
        else{
            debug("utils.js; convert_to_pdf: neither url nor html is given!");
            throw 'utils.js; convert_to_pdf: neither url nor html is given as parameters!';
        }

        await page.waitForFunction(imagesHaveLoaded);
        await page.evaluateHandle('document.fonts.ready');
        console.timeEnd("page_content")
        debug("page", page);
        // 4. Create pdf file with puppeteer
        var pdf = await page.pdf({
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

        //result = await page.title();
    } catch (error) {
        throw(error);
    } finally {
        if (browser !== null) {
            await browser.close();
            return pdf;
        }
    }

    console.timeEnd("puppeteer")
};

async function sign_pdf(pdf, s3_bucket, fileName){
        console.time("pdf-sign-lambda")
        debug("pdf type", typeof pdf)
        if (s3_bucket !== null)
            var payload_params = {
                "s3_bucket": s3_bucket
                ,"s3_key": fileName
            };
        else{
            var payload_params = {
                "data": pdf.toString('base64')
            };
        }
        var params = {
            FunctionName: 'platform-add-digital-signature-to-pdf',
            Payload: JSON.stringify(payload_params)
        };

//        if (debug_set) {
//            params["LogType"] = "Tail";
//        }

        var lambda = new AWS.Lambda();
        var signed_pdf = null;

        let promise = new Promise((resolve, reject) => {

            lambda.invoke(params).promise().then(
                function(data) {
                    debug("signing data", data);
                    let final_data = data;
                    if (s3_bucket === null){
                        console.log("yes inside if")
                        final_data= JSON.parse(data.Payload)['pdf'];
                    }
//                    const s3 = new AWS.S3();
//                    signed_pdf = download_s3("htmltopdfxbucket", "someshit.pdf")
//                    console.log("signed_pdf promise", signed_pdf);
                    debug("signing final data", final_data);
                    resolve(final_data)
                },
                function(error) {
                    console.log("## Invoke ERROR ##");
                    console.log("error", error);
                    console.log(error.stack);
                    reject(error);
                }
            )
        });
        return  promise;

}


function httpRequest(params, req_data) {
    return new Promise(function(resolve, reject) {
        var req = http.request(params, function(res) {
            // reject on bad status
            if (res.statusCode < 200 || res.statusCode >= 400) {
                return reject(new Error('statusCode=' + res.statusCode));
            }

            // accumulate data
            var data = [];
            res.on('data', function(chunk) {
                data.push(chunk);
            });

            // resolve on end
            res.on('end', function() {
                try {
                    debug("data before", data);
                    let body = JSON.parse(data);
                    let buff = Buffer.from(body.sub_templates[0].rendered_data, 'base64');
                    var html = buff.toString('ascii');
                    debug("html", html);
                    //body = JSON.parse(Buffer.concat(body).toString());
                } catch(e) {
                    reject(e);
                }
                resolve(html);
            });
        });

        // reject on request error
        req.on('error', function(err) {
            // This is not a "Second reject", just a different sort of failure
            console.log("httpRequest - Got error: " + err.message);
            reject(err);
        });

        // IMPORTANT
        req.write(req_data);
        req.end();
    });
}


function error_response(error_code, error_msg){

    let json_body =  {
      success: false,
      error: {msg: error_msg, code: error_code},
      data: {}
    }
    return {
        headers: {
            'Content-type': 'application/json'
        },
        body: JSON.stringify(json_body),
    };
}
async function get_html_for_template(template_name, template_context, template_version){
    const host = process.env.TSHost;
    let url = `/templateservice/api/v1/template/${template_name}/${template_version}/render`;
    console.log("url", url);
    debug("url", url);
    debug("host", host);
    const r_data = JSON.stringify(template_context);
    debug("r_data", r_data);
    var options = {
      host: host,
      port: 443,
      path: url,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': r_data.length
      }
    };
// let data = "";
//    let html = "";
//    https.get(options, function(resp){
////        resp.on('data', res => {
////            data += res;
////        });
//        resp.on('end', () => {
//            var body = JSON.parse(data);
//            console.log("data", data);
//            let buff = new Buffer(body.sub_templates[0].data, 'base64');
//            let html = buff.toString('ascii');
//            console.log("html", html);
//
//        });
//    }).on("error", function(e){
//      console.log("Got error: " + e.message);
//    });

    return httpRequest(options, r_data);
}

exports.convert_to_pdf = convert_to_pdf;
exports.debug = debug;
exports.sign_pdf = sign_pdf;
exports.debug_set = debug_set;
exports.get_from_event_qp = get_from_event_qp;
exports.upload_s3 = upload_s3;
exports.makeid = makeid;
exports.get_html_for_template = get_html_for_template;
exports.error_response = error_response;