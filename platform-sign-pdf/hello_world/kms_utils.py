import base64
import boto3
import sys
import getpass
from botocore.exceptions import ClientError
import logging
import sign_utils


def encrypt(session, secret, alias):
    client = session.client('kms')
    ciphertext = client.encrypt(
        KeyId=alias,
        Plaintext=bytes(secret),
    )
    return base64.b64encode(ciphertext["CiphertextBlob"])


def decrypt(session, secret):
    client = session.client('kms')
    plaintext = client.decrypt(
        CiphertextBlob=bytes(base64.b64decode(secret))
    )
    return plaintext["Plaintext"]




en_pass = b''
def get_st(file_name):
    with open(file_name, 'rb') as f:
        s = f.read()
    return s


def e_test():
    filename = "certificate_file.crt"
    passphrase = decrypt(session, en_pass)
    print("encrypting")
    e_filename = "certificate_file.crt.aesencrypted"
    sign_utils.encrypt_file(passphrase, filename, e_filename)
    print("decrypting")
    sign_utils.decrypt_file(passphrase, e_filename, e_filename + ".aesdecrypted")
    assert(get_st(filename) == get_st(e_filename + ".aesdecrypted"))
    
    
def p_test():
    print("enter cmk_id below")
    cmk_id = getpass.getpass()
    print("plaintext pass")
    passphrase = bytes(getpass.getpass(), 'utf-8')
    global en_pass
    en_pass = encrypt(session, passphrase, cmk_id )
    print(en_pass)

def upload_file(file_name, bucket, object_name=None):
    """Upload a file to an S3 bucket
	:param file_name: File to upload
	:param bucket: Bucket to upload to
	:param object_name: S3 object name. If not specified then file_name is used
	:return: True if file was uploaded, else False
	"""
    
    # If S3 object_name was not specified, use file_name
    if object_name is None:
        object_name = file_name
    
    # Upload the file
    s3_client = boto3.client('s3'
                             )
    
    try:
        response = s3_client.upload_file(file_name, bucket, object_name)
    except ClientError as e:
        logging.error(e)
        return False
    return True

session = boto3.session.Session()

def encrypt_upload_and_kmsMemorise(filename, bucket_name):
    e_filename = filename + '.aesencrypted'
    print("enter cmk_id below")
    cmk_id = getpass.getpass()
    print("plaintext pass")
    passphrase = bytes(getpass.getpass(), 'utf-8')
    sign_utils.encrypt_file(passphrase, filename, e_filename)
    if upload_file(filename + ".aesencrypted", bucket_name):
        en_pass = encrypt(session, passphrase, cmk_id)
        with open("kms_pass.txt", "wb") as f:
            f.write(en_pass)
            
    else:
        print("upload failed!")
    
#, "signpdfxbucket"
if __name__ == '__main__':
    args = sys.argv
    if len(args) > 1:
        if args[1].lstrip('-') == 't':
            e_test()
        elif args[1].lstrip('-') == 'u':
            if len(args) > 3:
                filename = args[2]
                bucket_name = args[3]
                encrypt_upload_and_kmsMemorise(filename, bucket_name)
        elif args[1].lstrip('-') == 'r':
            pass
