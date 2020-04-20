Introduction

Attempt is to create a micro-service that generated pdf from a given url and apply digital signature

on the generated pdf and return the signed pdf as a response.  

Architecture

Lambdas - We will be using two Lambdas here. 

pdfFromUrl - It is a Lambda function written in node js. It generates a PDF from given url using puppeteer . It then sends the PDF body in payload to another lambda call pdfSign described below. It gets back the signed PDF data from pdfSign which it sends back in response to the gateway.

pdfSign- It is a Lambda function written in python. This applies digital signature to given PDF body and returns signed PDF body. It receives PDF body in events which was sent to it by pdfFromUrl.

Api Gateway - There is an Api Gateway to trigger Lambda. It accepts a get request with two query parameters pageurl and sign. 

pageurl - It is query parameter to mention the url whose page needs PDF Conversion

sign - It is a query parameter which mentions true for applying digital signature otherwise false.

 3. KMS - We are using AWS KMS for encrypting our signature and certificate files. pdfSign uses the key stored in KMS to decrypt these files for processing it. 

4. S3 - We are using S3 bucket to store signature and certificate files  after having them encrypted with KMS CMK key. These are fetched by pdfSign for signature purposes.

Specifications

endpoint ->

https://wabvn4qixh.execute-api.us-east-2.amazonaws.com/default/pdfFromUrl/?pageurl=<doc_url>&sign=<true or false>

