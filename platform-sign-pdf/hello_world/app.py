"""
main program
"""
# -*- coding: utf-8 -*-
import datetime
import os
import boto3
import base64
import kms_utils
import sign_utils
from endesive import pdf
from OpenSSL.crypto import load_pkcs12


# Digital signature on pdf
DSC_ENABLED = True

session_ = boto3.session.Session()


def read_from_s3(file_name):
    """
    read encrypted files from S3, get passphrase from kms, decrypt the file and
    return body as byte string
    :param file_name: S3 key
    :return: byte string
    """
    s3 = boto3.client("s3")
    obj = s3.get_object(Bucket=os.environ["sig_bucket"], Key=file_name)
    body = obj.get("Body").read()
    file_name = "/tmp/" + file_name
    with open(file_name, "wb") as file:
        file.write(body)
    en_pass = os.environ["encrypted_pass"]
    passphrase = kms_utils.decrypt(session_, en_pass)
    d_filename = file_name + ".aesdecrypted"
    sign_utils.decrypt_file(passphrase, file_name, d_filename)

    with open(d_filename, "rb") as file:
        body_d = file.read()
        return body_d


p12_global = load_pkcs12(
    read_from_s3(os.environ["signature_file"]), os.environ["signature_passwd"]
)


# apply digital signature on given pdf using pdf_global variable
def apply_digital_signature(pdf_content):
    """
    get
    :param pdf_content: byte string
    :return:
    """
    s = str(datetime.datetime.now().strftime("%Y%m%d%H%M%S") + "+05'30'")
    time_st = s.encode("ascii")
    dct = {
        b"sigflags": 3,
        b"contact": bytes(os.environ["dsc_email"], "utf-8"),
        b"location": bytes(os.environ["dsc_location"], "utf-8"),
        b"signingdate": time_st,
        b"reason": bytes(os.environ["dsc_reason"], "utf-8"),
    }
    datau = pdf_content
    print("inside ads, ", datau)
    try:
        datas = pdf.cms.sign(
            datau,
            dct,
            p12_global.get_privatekey().to_cryptography_key(),
            p12_global.get_certificate().to_cryptography(),
            [],
            "sha256",
        )
    except Exception as e:
        print("pdf sign err", e)
        raise e

    print("inside ads, datas", type(datas))

    return datau + datas


def verify_pdf(pdf_content):
    """
    verifies pdf
    :param pdf_content: byte string
    :return: tuple of results
    """
    trusted_cert_pems = read_from_s3(os.environ["certificate_file"])
    print("*" * 20, pdf_content)
    data = pdf_content
    (hashok, signatureok, certok) = pdf.verify(data, trusted_cert_pems)
    print("signature ok?", signatureok)
    print("hash ok?", hashok)
    print("cert ok?", certok)
    return signatureok, hashok, certok


def lambda_handler(event, _context):
    """Sample pure Lambda function

    Parameters
    ----------
    event: dict, required
        API Gateway Lambda Proxy Input Format

        Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide
        /set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for
        -lambda-input-format

    _context: object, required
        Lambda Context runtime methods and attributes

        Context doc: https://docs.aws.amazon.com/lambda/latest/dg/
        python-context-object.html

    Returns
    ------
    API Gateway Lambda Proxy Output Format: dict

        Return doc: https://docs.aws.amazon.com/apigateway/latest/
        developerguide/set-up-lambda-proxy-integrations.html
    """

    print("event", event)
    
    pdff = base64.b64decode(event["data"])

    if DSC_ENABLED:
        signed_pdf = apply_digital_signature(pdff)
    else:
        signed_pdf = pdff
    return {"pdf": base64.b64encode(signed_pdf).decode()}
