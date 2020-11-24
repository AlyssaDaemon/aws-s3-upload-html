# AWS S3 Upload HTML POC
This was just a fun little project to see if one could support multipart uploads (and single part uploads) in HTML5.

## CORS CONFIG ON AWS Bucket
The XML config I had to use on the bucket to make this work. If/when you go to prod with your own secure code, *please* 
don't leave AllowedOrigin as `*` unless you absolutely need it.

ExposeHeader etag is required so you can grab the etag value from the request.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
<CORSRule>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <MaxAgeSeconds>3000</MaxAgeSeconds>
    <ExposeHeader>x-amz-server-side-encryption</ExposeHeader>
    <ExposeHeader>x-amz-request-id</ExposeHeader>
    <ExposeHeader>x-amz-id-2</ExposeHeader>
    <ExposeHeader>etag</ExposeHeader>
    <AllowedHeader>*</AllowedHeader>
</CORSRule>
</CORSConfiguration>
```

## ENV VARS

* `BUCKET_NAME`: (Required) Bucket to publish to
* `BUCKET_PREFIX`: The path prefix for all objects, defaults to `ingest/`

Standard boto3 AWS env vars apply here too.

## Running
Both the Python and Node code do the same things, so there's no need for a difference. Also make sure that your AWS creds are on the machine / are active before you run the command as both servers require access to AWS and the bucket you wish to upload to.
```bash
$ BUCKET_NAME=some-bucket-name node express.js
# or
$ BUCKET_NAME=some-buekt-name python3 server.py
```
Then navigate your browser to: [http://localhost:9876/](http://localhost:9876/)

## Some considerations
* This is all standard vanilla JS, not a robust and tested library.
* This code is somewhat fragile, *do not let this go to production, I'm not maintaining this*
* Safari seems to choke if the parts are too big (around 500MB) and refuses on CORS (despite FS being fine)
* Web standards move fairly quickly and there are quirks of browsers, the longer this sits unattended the further from optimal it becomes.

## TODOs
* [ ] Finish the CSS so the progress bars at least look better than they do.
* [ ] Find a way to provide better feedback on the upload process, currently it seems FS and Safari don't report till the transaction is done.