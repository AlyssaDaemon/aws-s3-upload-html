"use strict";
const express = require('express');
const AWS = require('aws-sdk');
const bodyParser = require('body-parser');
const path = require('path');
const morgan = require('morgan');

const BUCKET_NAME = process.env.BUCKET_NAME;
const BUCKET_PREFIX = process.env.BUCKET_PREFIX || "ingest/";
const PORT = process.env.PORT || "9876"

const REGION = process.env.AWS_REGION || "us-east-1";


const app = express();
const s3 = new AWS.S3({
  region: REGION,
  signatureVersion: 'v4',
});

s3.listBuckets(() => {});

app.use(morgan('dev'));
app.use(express.static("static"));
app.use(bodyParser.json());

app.get("/", (req, res) => {
  return res.redirect("/index.html");
});

app.get("/s3/upload", (req, res) => {
  let params = {
    "Bucket": BUCKET_NAME,
    Fields: {
      Key: getKey(req.query.keyName)
    }
  }

  s3.createPresignedPost(params, (err, data) => {
    if (err) {
      return res.status(500).json({ "err": err.message || err })
    }
    res.json(data);
  });
  
});

app.get("/s3/start_upload", (req, res) => {
  let params = {
    "Bucket": BUCKET_NAME,
    "Key": getKey(req.query.keyName)
  }

  s3.createMultipartUpload(params, (err, data) => {
    if (err) {
      return res.status(500).json({"err": err.message || err });
    }
    res.json(data);
  });
});

app.get("/s3/send_part/:uploadId/:partNo", (req, res) => {
  let params = {
    "Bucket": BUCKET_NAME,
    "Key": getKey(req.query.keyName),
    "UploadId": req.params.uploadId,
    "PartNumber": req.params.partNo
  };

  console.log(`UploadId: ${req.params.uploadId}, PartNo: ${req.params.partNo}`);

  s3.getSignedUrl("uploadPart", params, (err, part_url) => {
    if (err) {
      return res.status(500).json({"err": err.message || err });
    }
    res.json({"signedUrl": part_url});
  });
});


app.post("/s3/complete_part/:uploadId", (req, res) => {
  let params = {
    "Bucket": BUCKET_NAME,
    "Key": getKey(req.query.keyName),
    "UploadId": req.params.uploadId,
    "MultipartUpload": {
      "Parts": req.body.parts
    }
  };

  console.log(`UploadId: ${req.params.uploadId}`);

  s3.completeMultipartUpload(params, (err, data) => {
    if (err) {
      return res.status(500).json({"err": err.message || err });
    }
    res.json(data)
  });
});

app.get("/s3/abort_upload/:uploadId", (req, res) => {
  let params = {
    "Bucket": BUCKET_NAME,
    "Key": getKey(req.query.keyName),
    "UploadId": req.params.uploadId
  }

  console.log(`UploadId: ${req.params.uploadId}`);

  s3.abortMultipartUpload(params, (err, data) => {
    if (err) {
      return res.status(500).json({"err": err.message || err });
    }
    res.json(data)    
  });
});


if (!BUCKET_NAME) {
  console.error("Please provide a bucket name via BUCKET_NAME env var");
  process.exit(1);
}

app.listen(PORT, () => { console.log(`Listening on port ${PORT}...`)});


function getKey(keyName) {
  return path.join(BUCKET_PREFIX, keyName);
}
