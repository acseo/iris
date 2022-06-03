#! /bin/bash

FILES=$(curl -sL https://www.data.gouv.fr/api/1/datasets/5a5f4f6c88ee387da4d252a3 | jq '.resources[].url' -r)
for F in $FILES
do
  wget $F
done


