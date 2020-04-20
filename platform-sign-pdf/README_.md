# Introduction
This is a small tutorial on how to build a simple python function for loading
up on AWS-Lambda .

# Contents 
    I. Put up a python function in AWS-Lambda.

# Prerequisites
    
- python 3.7
- virtualenv
- aws-cli  
    
# Create Python file
Let us make a simple function with an import of 'sortedcontainers' 
to just show the bundling part.

```
import sortedcontainers
import json
print('Loading function')


def lambda_handler(event, context):
    #print("Received event: " + json.dumps(event, indent=2))
    list_ = [ k for k in event]
    sl = sortedcontainers.SortedList(list_)
    return sl[0]  # Echo back the first key value
    #raise Exception('Something went wrong')
```

# Create the bundle for upload

## Virtual Environment
- create 

    `virtualenv -p python3 lamenv`
- activate

    `source lamenv/bin/activate`
    
- configure

    `pip install sortedcontainers`
- deactivate

    `deactivate`
    
- create zip

`cd lamenv/lib/python3.7/site-packages`

`zip -r9 ${OLDPWD}/function.zip .`

`cd $OLDPWD`

`zip -g function.zip lambda_function.py`

## Upload

A simple upload from ui requires size to be less than 50mb but 
if we use s3 bucket we can breach this limit. Lets see that method

- Create bucket  
```
aws s3 mb s3://test-bucket --region us-east-2
```

- populate bucket
```
aws s3 cp ./  s3://test-bucket --recursive --exclude "*" --include "*.zip"
```

- link this to lambda

```
aws lambda update-function-code --function-name PdfSign --region us-east-2 --s3-bucket test-bucket --s3-key function.zip
```

Now You are free to test and trigger!

## AWS SAM
In the tricky case, some module needs to be installed manually in a system but
since we are using lambda we have no access to the server. AWS SAM
can be used for this purpose. Below is a step-by-step guide
of how to use it.

- Install SAM

  `brew install aws-sam-cli`

- Create new bucket

  ```
  aws s3 mb s3://sam-test-bucket --region us-east-2
  ```
- create new project

  `sam init --runtime python3.7`

- build

  `sam build --use-container`

   if above fails due to docker. run 
   
   ```docker container ls -a```
   
  to see if a container is running. if not run 
  
  ```
  docker create --name nginx_base -p 80:80 nginx:alpine
  ```
  and re-run sam build.

- package the application for deployment and upload
  
  ```
  sam package --output-template packaged.yaml --s3-bucket sam-test-bucket
  ```
  
- deploy

    ```
    sam deploy --template-file packaged.yaml --region us-east-2 --capabilities CAPABILITY_IAM --stack-name test
    ```

## Put it up on Lambda



This is mostly written for me to refer it in future.


#### Submit a Patch to API Gateway

- list all Gateways with their info
    ```bash
    aws apigateway get-rest-apis
    ```
- using aws-cli api, update response-integration-proxy
    
    ```bash
      aws apigateway update-integration-response --rest-api-id wabvn4qixh --resource-id yuhe82 --http-method ANY --status-code 200 --patch-operations '[{"op" : "replace", "path" : "/contentHandling", "value" : "CONVERT_TO_BINARY"}]'
    ```

- add '*/*' as a content-type in method's setting and redeploy. resource: [this](https://medium.com/@adil/how-to-send-an-image-as-a-response-via-aws-lambda-and-api-gateway-3820f3d4b6c8)


### Permission

To role of the lambda, add allow-s3-access policy. 

### hundred years
https://wabvn4qixh.execute-api.us-east-2.amazonaws.com/default/pdfFromUrl


Mine AWS

```bash
aws s3 cp ./  s3://signpdfxbucket --recursive --exclude "*" --include "*.zip" 
```

Suppose if build environment is tricky, one might need to package the environment and upload it
that is what SAM is used for but SAM is also very huge. Requires alot permisssions to do alot of unneccessary things.
like creating a stack in cloudformation, creating a new iam role etc.

Suppose all we want is a minimal lambda we can use best of both the worlds.

We can use SAM build to build the environment and package the essentials
and use vanilla upload of aws.

Follow below steps :-

1. configure aws sam in a linux machine. follow [this](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install-linux.html)

2. Build project in linux machine with
    ```bash
    sam build --use-container
    ```
3. go to build folder and 
   ```bash
   cd .aws-sam/build/lambdaFunction/
   zip -r9 ${OLDPWD}/function.zip .
   cd $OLDPWD
   ```

4. upload this code to lambda and that's it.
    
    ```bash
    aws s3 cp ./  s3://signpdfxbucket --recursive --exclude "*" --include "*.zip"
    aws lambda update-function-code --function-name platform-add-digital-signature-to-pdf --s3-bucket signpdfxbucket --s3-key function.zip
    ```
    
### layer implementation

1. make a new layer bucket

```bash
aws s3 mb s3://crypto-layer-bucket --region  ap-south-1
```

2. populate this with layer content
```bash
aws s3 cp ./  s3://crypto-layer-bucket --recursive --exclude "*" --include "crypto_layer.zip"
```

3. create layer
```bash
 aws lambda publish-layer-version --layer-name crypto-layer --description "Layer for python crytographic libraries" --license-info "MIT" \
 --content S3Bucket=crypto-layer-bucket,S3Key=crypto_layer.zip --compatible-runtimes python3.6 python3.7
```

### use layer for module upload
- update lambda to use layer
```bash
aws lambda update-function-configuration --function-name platform-add-digital-signature-to-pdf --layers arn:aws:lambda:ap-south-1:663498825379:layer:crypto-layer:3
```
- The layer is mounted on top of `/opt/` in systems so we need to 
tell lambda to read our layer.so set environment variable

`PYTHONPATH` with `/var/runtime:/opt/`






#### Random



```bash
aws lambda update-function-code --function-name platform-add-digital-signature-to-pdf --zip-file fileb://function.zip
```

```bash
cd hello_world && zip -r9 ../app_function.zip . &&  cd $OLDPWD &&  aws lambda update-function-code --function-name platform-add-digital-signature-to-pdf --zip-file fileb://app_function.zip
```


```bash
aws apigateway update-integration-response --rest-api-id e8y0n6bm23 --resource-id etotho --http-method ANY --status-code 200 --patch-operations '[{"op" : "replace", "path" : "/contentHandling", "value" : "CONVERT_TO_BINARY"}]'
```


```bash
aws s3 cp ./  s3://puppeteerjs-layer-bucket --recursive --exclude "*" --include "puppeteerjs-layer.zip"
```

```bash
aws lambda update-function-configuration --function-name platform-html-to-pdf --layers arn:aws:lambda:ap-south-1:663498825379:layer:puppeteerjs-layer:2
```


aws lambda publish-layer-version --layer-name puppeteerjs-layer  --description "include puppeteer-js" --license-info "MIT" \
 --content S3Bucket=puppeteerjs-layer-bucket, S3Key=puppeteerjs-layer.zip --compatible-runtimes nodejs10.x