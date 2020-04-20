#!/usr/bin/env bash

cd ~/Downloads/
mv  "test ($1).pdf" "test_$1.pdf"
base64 -D "test_$1.pdf" > "test_$1_new.pdf"
cd $OLDPWD

# to run enter `bash conv.sh 9(or whatever)`