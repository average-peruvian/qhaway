#!/bin/bash

aws s3 ls s3://inaturalist-open-data/ --no-sign-request
# Observations.csv, photos.csv, taxa.csv
# photos.csv tiene las URLs directas