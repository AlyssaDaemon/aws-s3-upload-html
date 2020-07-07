import boto3
import os
import sys
from flask import Flask, request, jsonify

BUCKET_NAME = os.getenv("BUCKET_NAME", None)
BUCKET_PREFIX = os.getenv("BUCKET_PREFIX", "ingest/")
app = Flask(__name__, static_url_path="")
s3 = boto3.client("s3")


def get_key(key_name):
    return os.path.join(BUCKET_PREFIX, key_name)


@app.route("/")
def root():
    return app.send_static_file("index.html")


@app.route("/s3/upload")
def sign_s3_upload():
    key_name = request.args.get("keyName")
    res = s3.generate_presigned_post(Bucket=BUCKET_NAME,
                                     Key=get_key(key_name))
    return jsonify(res)


@app.route("/s3/start_upload")
def sign_s3_multipart():
    key_name = request.args.get("keyName")
    res = s3.create_multipart_upload(Bucket=BUCKET_NAME, Key=get_key(key_name))
    return jsonify(res)


@app.route("/s3/send_part/<upload_id>/<int:part_no>")
def send_part(upload_id, part_no):
    key_name = request.args.get("keyName")
    part_url = s3.generate_presigned_url(ClientMethod='upload_part',
                                         Params={'Bucket': BUCKET_NAME,
                                                 'Key': get_key(key_name),
                                                 'UploadId': upload_id,
                                                 'PartNumber': part_no})

    return jsonify({"signedUrl": part_url})


@app.route("/s3/complete_part/<upload_id>", methods=["POST"])
def complete_part(upload_id):
    body = request.get_json()
    parts = body["parts"]
    key_name = request.args.get("keyName")

    res = s3.complete_multipart_upload(Bucket=BUCKET_NAME,
                                       Key=get_key(key_name),
                                       MultipartUpload={'Parts': parts},
                                       UploadId=upload_id)

    return jsonify(res)


@app.route("/s3/abort_upload/<upload_id>")
def abort_upload(upload_id):
    key_name = request.args.get("keyName")
    res = s3.abort_multipart_upload(Bucket=BUCKET_NAME,
                                    Key=get_key(key_name),
                                    UploadId=upload_id)
    return jsonify(res)


if __name__ == "__main__":
    if BUCKET_NAME is None:
        print("Please provide a bucket name (via env var BUCKET_NAME)")
        sys.exit(1)
    app.run(port=9876)
