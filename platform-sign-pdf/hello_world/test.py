import datetime
import sys
import os
import boto3
import base64
import asn1crypto
print("asn1crypto v, asn1crypto dir", asn1crypto.__version__, asn1crypto.__path__)
#
#
#
from endesive import pdf
import endesive
from OpenSSL.crypto import load_pkcs12
import json
def lambda_handler(event, context):
    path = os.popen("echo $PATH").read()
    py_path = os.popen("echo $PYTHONPATH").read()
    s_path = os.popen("python -m site").read()
    directories = os.popen("find /opt/* -type d -maxdepth 4").read().split("\n")
    return {'path': path,
        'json': json.__path__,
        'pythonpath': py_path,
        'sitepackages': s_path,
        'directories': directories
    }