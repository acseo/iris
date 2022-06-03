#! /bin/bash

#DATASET='2022-04-01'
DATASET='latest'

for i in $(seq -f "%02g" 75 95)
do
  wget "https://cadastre.data.gouv.fr/data/etalab-cadastre/$DATASET/shp/departements/$i/cadastre-$i-parcelles-shp.zip"
done

for i in $(seq -f "%03g" 971 976)
do
  wget "https://cadastre.data.gouv.fr/data/etalab-cadastre/$DATASET/shp/departements/$i/cadastre-$i-parcelles-shp.zip"
done