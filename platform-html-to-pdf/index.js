'use strict';
var utils = require('./utils.js');


exports.route = async function(event, context) {
    console.log("event.path: ", event.path);
    console.log("event", event);
    if (event.path === "/v3"){
        return await get_pdf_as_json(event, context);
    }
    else{
        return await get_pdf_as_attachment(event, context);
    }


}


async function get_pdf_as_attachment (event, context) {

    var filename = utils.get_from_event_qp(event, "filename"); // to be added in docs
    var sign = utils.get_from_event_qp(event, "sign", "true");
    var pageUrl = utils.get_from_event_qp(event, "pageurl");

    if(!pageUrl){
        if (utils.debug_set){
            pageUrl ="https://www.acko.com/";
        }
        else{
            console.log("no pageurl");
            return;
        }
    }

    console.log("received parameters", filename, sign, pageUrl);

    var content_disposition = null;
     if (filename) {
        content_disposition = 'attachment; filename=' + filename
    } else {

        content_disposition = 'inline'
    }

    //generate pdf
    try{
        var pdf = await utils.convert_to_pdf(pageUrl, null);
    }
    catch (error) {
        return context.fail(error);
    }
    utils.debug("generated pdf", pdf)


    //upload in s3
    //await utils.upload_s3("htmltopdfxbucket", "someshit.pdf", pdf);


    //sign pdf
    if(sign === "true"){
        try{
            pdf = await utils.sign_pdf(pdf, null, null);
            utils.debug("signed pdf", pdf);
        }
        catch (error) {
            console.log("error found", error)
            return context.fail(error);
        }
    }
    else{
        pdf = pdf.toString('base64');
    }



    //return response
    let result = {
        headers: {
            'Content-type': 'application/pdf',
            'content-disposition': content_disposition
        },
        statusCode: 200,
        body: pdf,
        isBase64Encoded: true
    };
    return context.succeed(result);


}


async function get_pdf_as_json(event, context){
    
    if (event.body){    //read from request body
        let buff = new Buffer(event.body, 'base64');
        var body = JSON.parse(buff);
        var sign =  body.sign;
        var bucket =  body.bucket;
        var filename =  body.filename;
        var template_name = body.template_name;
        var template_context = body.template_context;
        var template_version = body.template_version;

    } else {
        console.log("REQUEST BODY IS MISSING")
        return context.fail("V3: REQUEST BODY IS MISSING ")
    }



    if(!bucket){
        if (utils.debug_set){
            bucket = "htmltopdfxbucket";
        }
        else{
            console.log("no bucket query argument");
            bucket = process.env.BUCKET;
        }
    }
    console.log("received body", body);

    var content_disposition = null;
     if (filename) {
        content_disposition = 'attachment; filename=' + filename
    } else {

        content_disposition = 'inline'
    }

    //call template service
    try{
        var html_s = await utils.get_html_for_template(template_name, template_context, template_version)
        utils.debug("html_s", html_s)
    }
    catch (error){
        let error_msg = `template_service_error error: ${error} ${template_name} ${template_version} ${template_context}`
        console.log("template_service_error", template_name, template_context, template_version)
        return context.succeed(utils.error_response("500", error_msg));
    }


    //generate pdf
    try{
        var pdf = await utils.convert_to_pdf(null, html_s);
    }
    catch (error) {
        return context.fail(error);
    }
    utils.debug("generated pdf", pdf)

    //upload in s3
    if (!filename){
        filename = "media/tmp-pdf-store/" + utils.makeid(32) + ".pdf";
    }

    let success_r = null;
    let error_r = null;
    let data_r = null;


    //sign pdf
    if(sign !== 'false'){
        try{
            console.log("process.env.TEMP_BUCKET", process.env.TEMP_BUCKET);
            await utils.upload_s3(process.env.TEMP_BUCKET, filename, pdf);
            var i_resp = await utils.sign_pdf(null, bucket, filename);
            //console.log("i_resp", i_resp);
            let s3_url = `https://${bucket}.s3.ap-south-1.amazonaws.com/${filename}`
            success_r = true;
            error_r = {};
            data_r = {
                pdf_url: s3_url,
                signed: true
            };

        }
        catch (error) {
            return context.fail(error);
        }
    }
    else{
        var etag = await utils.upload_s3(bucket, filename, pdf);
        console.log("etag", etag);
        let s3_url = `https://${bucket}.s3.ap-south-1.amazonaws.com/${filename}`

        success_r = true;
        error_r = {};
        data_r = {
            pdf_url: s3_url,
            signed: false
        };
        console.log("s3_url", s3_url)
    }
    utils.debug("signed pdf", pdf)

    let json_body = {
      success: success_r,
      error: error_r,
      data: data_r
    }

    let result = {
        headers: {
            'Content-type': 'application/json'
        },
        body: JSON.stringify(json_body),
    };
    return context.succeed(result);

}

// TODO: how to handle