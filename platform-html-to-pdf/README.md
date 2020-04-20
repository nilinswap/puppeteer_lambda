# Introduction
This is a small tutorial on how to build a simple node app from scratch and to put that up on AWS-Lambda.

# Contents
    I. Make a Simple Node App
    II. Host the app as a function in AWS-Lambda.

# A Simple Node App

0. Install Node( for Mac)

    `brew install nodejs`
    
    Install node with binary located at
    `/usr/local/opt/node`
1. Create Container
     Create the package folder and get inside it. Say the name is 'puppdf.'

       `mkdir puppdf`
       `cd puppdf`

2. Initialise the project

     Intialization is the creation of 'package.json', a configuration (json) file for our app.
     
     a. Using Terminal Prompt
        Run the following and enter appropriate info on prompt
        
        `npm init`

     b. Manually Create
        Create a package.json file and enter the fields and keys. For template one can pick from below
```       
{
  "name": "puppdf",
  "version": "1.0.0",
  "description": "convert html to pdf using puppeteer",
  "main": "src/pdf.js",
  "directories": {
    "src": "src"
  },
  "files": [
    "src"
  ],
  "scripts": {
    "start:dev": "node src/pdf.js",
    "start:build": "npm install && npm run-script build",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/nilinswap/puppdf.git"
  },
  "engines": {
    "node": ">=10.16.3"
  },
  "keywords": [
    "pdf",
    "node",
    "puppeteer"
  ],
  "author": "Swapnil Sharma <nilinswap@github.com>",
  "license": "ISC",
  "bugs": {
    "url": "https://github.com/nilinswap/puppdf/issues"
  },
  "homepage": "https://github.com/nilinswap/puppdf#readme",
  "dependencies": {
    "puppeteer": "^1.20.0"
  }
}
```

3. create a folder src and add a file named pdf.rs in it. This file takes an url and converts related html to pdf

```
//pdf.rs

const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch()
    const page = await browser.newPage()
    await page.goto('https://www.medium.com')
    await page.pdf({path: 'medium.pdf', format: 'A4'})
    await browser.close()
})()
```

At this point, The app is in running state. Let's try to put it up in AWS-Lambda.

# Put it up on Lambda

1. Install serverless framework

    `npm install -g serverless`
   
2. Create an [AWS](https://aws.amazon.com/) Account.

3. Add a user with programmatic access permission.
    follow [this](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users_create.html) tutorial for it.

## using serverless

4. Configure serverless CLI with your AWS credentials. This is necessary for deployment.

    `serverless config credentials --provider aws --key xxxxxxxxxxxxxx --secret xxxxxxxxxxxxxx`
    
5. create essentials for serverless `serverless.yml` and `handler.js`
    If there is absence of a template file, run `serverless create --template aws-nodejs --path test`
    to generate default files.

6. After reviewing serverless.yml, run `serverless deploy`. Before running this make sure that 
node_modules/ folder is not part of the package as it might not
zip such big content.

## using AWS Console

4. create index.js and write handler functions there.
    add package.json (like mentioned above) and have 'node_modules/' prepared (by running `npm install`)
    and zip up the index.js and node_modules using ```zip -r index.zip index.js node_modules```
    and upload this zip in AWS-lambda create function set.
     
    ```
    exports.helloWorld = function (event, context, callback) {
    let requestBody = JSON.parse(event.body);const response = {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*', // Required for CORS support to work
    },
    body: JSON.stringify({
      message: 'Go Serverless v1.0! Your function executed successfully!',
      input: event
    }),};callback(null, response);};
    ```
     index.js


5. Register a Test Event in Test action and test.

6. Create a Trigger(I used api-endpoint for trigger.) and use your lambda function in production. 

This is mostly written for me to refer it in future.

#### upload the code
```bash
zip -r function.zip index.js preload.js node_modules && date && aws lambda update-function-code --function-name platform-html-to-pdf --zip-file fileb://function.zip && date
```

```bash
zip -r function.zip index.js preload.js node_modules && aws s3 cp ./  s3://htmltopdfxbucket --recursive --exclude "*" --include "*.zip" && aws lambda update-function-code --function-name platform-html-to-pdf --region ap-south-1 --s3-bucket htmltopdfxbucket --s3-key function.zip
```