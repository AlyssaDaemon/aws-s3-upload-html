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

## Some considerations
