#! /bin/bash

DATASET='2021-01-01'
BASE_URL='ftp://Iris_GE_ext:eeLoow1gohS1Oot9@ftp3.ign.fr'

# Departements
for i in $(seq -f "%03g" 1 95)
do
  wget "${BASE_URL}/IRIS-GE_2-0__SHP_LAMB93_D${i}_${DATASET}.7z"
done

# DOM TOM COM
wget "${BASE_URL}/IRIS-GE_2-0__SHP_RGAF09UTM20_D972_${DATASET}.7z"
wget "${BASE_URL}/IRIS-GE_2-0__SHP_UTM22RGFG95_D973_${DATASET}.7z"
wget "${BASE_URL}/IRIS-GE_2-0__SHP_RGR92UTM40S_D974_${DATASET}.7z"
wget "${BASE_URL}/IRIS-GE_2-0__SHP_RGSPM06U21_D975_${DATASET}.7z"
wget "${BASE_URL}/IRIS-GE_2-0__SHP_RGM04UTM38S_D976_${DATASET}.7z"
wget "${BASE_URL}/IRIS-GE_2-0__SHP_RGAF09UTM20_D977_${DATASET}.7z"
wget "${BASE_URL}/IRIS-GE_2-0__SHP_RGAF09UTM20_D978_${DATASET}.7z"