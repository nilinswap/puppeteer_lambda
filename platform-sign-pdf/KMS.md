# KMS onboarding and maintainence


- Go to https://docs.aws.amazon.com/kms/latest/developerguide/getting-started.html
and create a key.
- Go to https://aws.amazon.com/kms/getting-started/ and
see how to keep a file in bucket and change encryption to 
kms but this will still download the file in IAM users' account decrypted

- So we want encrypt the file to be uploaded using key generated by
kms and this has to be done using code. Please refer to hello_world/kms_utils.py for below functions
    - encrypt and upload file ( see `encrypt_and_upload(filename)`)
        - run encrypt and upload using
            ```bash
            python hello_world/kms_utils.py --u file_path(without .encrypted extension)
            ```
        - Retrieve CMK key (see `retrieve_cmk(desc)`)
        - upload file in s3 (see `encrypt_and_upload(filename)`)
    
    - download the encrypted file, decrypt it and read
        - see `read_from_s3(file_name, read_byte=False)` from hello_world/app.py

In AWS KMS, add role of lambda as one of the users of the key


#### KMS encyptioncli

```bash
aws-encryption-cli --encrypt --input certificate_file.crt \
                   --master-keys key=0af5b9eb-ec00-4985-aa5a-e5b890f5b12d \
                   --output certificate_file.crt.encrypted \
                   --metadata-output ~/metadata \
                   --encryption-context purpose=test 
```

#### KMS decryptioncli

```bash
aws-encryption-cli --decrypt --input signature_file.pfx.encrypted \
                     --encryption-context purpose=test \
                     --metadata-output ~/metadata \
                     --output signature_file.pfx.encrypted.decrypted
```