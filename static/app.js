const MAX_UNIT = 5 * 1024 * 1024 * 1024; //5368709120 or 5GB

init();

function init() {
    let uploadEle = document.querySelector("#fileUploader");
    uploadEle.addEventListener("change", handleFileChange, false);
    console.log("Initialized!");
}

function createProgressBar(fileName, fileSize) {
    let progressBarContainerEle = document.querySelector("#progress-bars");

    let progressBarEle = document.createElement("div");
    progressBarEle.classList.add("progress-bar");
    let nameEle = document.createElement("span");
    nameEle.classList.add("name");
    nameEle.innerText = fileName;

    let sizeEle = document.createElement("span");
    sizeEle.innerText = humanReadableBytes(fileSize);

    let progressEle = document.createElement("progress");
    progressEle.setAttribute("max", "100");
    progressEle.setAttribute("value", "0")

    let closeButtonEle = document.createElement("button");
    closeButtonEle.innerText = "x";
    closeButtonEle.classList.add("close");
    closeButtonEle.addEventListener("click", () => progressBarContainerEle.removeChild(progressBarEle));

    let statusEle = document.createElement("span");

    progressBarEle.appendChild(nameEle);
    progressBarEle.appendChild(sizeEle);
    progressBarEle.appendChild(progressEle);
    progressBarEle.appendChild(statusEle);
    progressBarEle.appendChild(closeButtonEle);
    progressBarContainerEle.appendChild(progressBarEle);


    return {
        "error": (error) => statusEle.innerText = `ERROR: ${error}`,
        "progress": (percentage) => progressEle.setAttribute("value", percentage),
        "complete": () => statusEle.innerText = "Completed!",
    }

}

function humanReadableBytes(bytes) {
    if (Math.abs(bytes) < 1024) {
        return `${bytes} B`;
    }
    let e = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes/Math.pow(1024, e)).toFixed(2)+' '+' KMGTP'.charAt(e)+'B';
}

function handleFileChange(event) {
    event.preventDefault();
    // Required: https://developer.mozilla.org/en-US/docs/Web/API/FileList
    for(let i = 0; i < this.files.length; i++) {
        let file = this.files.item(i);
        console.log(file);
        handleFile(file)
            .then(() => console.log(`${file.name} is finished`))
            .catch(e => console.error(e));
    }
}

async function handleFile(file) {
    console.log(`Processing file: ${file.name}, size ${file.size}`);
    let progressCallbacks = createProgressBar(file.name, file.size);

    if (file.size > MAX_UNIT) {
        return multipart_upload(file, progressCallbacks)
    } else {
        return single_upload(file, progressCallbacks)
    }
}

async function multipart_upload(file, progressCallbacks) {
    console.log(`Performing Multipart PUT upload for ${file.name}`);
    let res = await fetch(`/s3/start_upload?keyName=${file.name}`);
    let metadata = await res.json();
    console.log(metadata);
    let parts = Math.ceil(file.size / MAX_UNIT);
    console.log(`File will be divided into ${parts} parts`);
    let partsDone = 0;

    let requests = [];

    for (let i = 1; i <= parts; i++) {
        let start = (i-1) * MAX_UNIT;
        let end = Math.min(i * MAX_UNIT, file.size);
        console.log(`Generating part ${i}: Start: ${start}, End: ${end}, file.size: ${file.size}`);
        let blob = file.slice(start, start + MAX_UNIT, end);
        let request = upload_part(metadata.UploadId, file.name, i, blob)
            .then(response => {
                partsDone += 1;
                progressCallbacks.progress(partsDone / parts * 100.0);
                return response;
            });

        requests.push(request);
    }

    try {
        let response_parts = await Promise.all(requests);
        console.log("Response Parts", response_parts);
        let complete_res = await fetch(`/s3/complete_part/${metadata.UploadId}?keyName=${file.name}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({"parts": response_parts }),
        });
        console.log(complete_res);
        progressCallbacks.complete();
    } catch (e) {
        console.log("Got an error trying to do multipart uploads", e);
        progressCallbacks.error(e);
        await fetch(`/s3/abort_upload/${metadata.UploadId}?keyName=${file.name}`);
    }
}


async function upload_part(uploadId, fileName, partNo, file, progressCallback) {
    let upres = await fetch(`/s3/send_part/${uploadId}/${partNo}?keyName=${fileName}`);
    let { signedUrl } = await upres.json();
    return await putViaXHR(signedUrl, file, partNo, progressCallback);
}

async function single_upload(file, progressCallbacks) {
    try {
        console.log(`Performing POST upload for ${file.name}`);
        let res = await fetch(`/s3/upload?keyName=${file.name}`);
        let {url, fields} = await res.json();
        let formData = new FormData();
        Object.keys(fields).forEach(key => {
            formData.append(key, fields[key]);
        });
        formData.append("file", file, file.name);

        progressCallbacks.progress(10);
        let upload = await fetch(url, {
            method: "POST",
            mode: "cors",
            body: formData,
        });

        if (upload.ok) {
            progressCallbacks.progress(100);
            progressCallbacks.complete();
        } else {
            progressCallbacks.error(`Got a ${upload.status} from S3`);
        }

    } catch (e) {
        progressCallbacks.error(e);
    }
}


function putViaXHR(url, file, part_no, progressCallback) {
    return new Promise((resolve, reject) => {
        let resolved = false;
        let xhr = new XMLHttpRequest();
        xhr.addEventListener("progress", evt => {
            console.log("Progress Made", evt);
            if (evt.lengthComputable) {
                console.log(`PUT is at ${evt.loaded / evt.total * 100}%`);
                if (progressCallback !== undefined && typeof progressCallback === "function") {
                    progressCallback(evt.loaded / evt.total * 100);
                }
            }
        });
        xhr.addEventListener("load", evt => {
            if (!resolved) {
                console.log("XHR Loaded", xhr.getAllResponseHeaders().includes("etag"));
                resolved = true;
                if (xhr.status === 200) {
                    resolve({"ETag": xhr.getResponseHeader("etag"), "PartNumber": part_no});
                } else {
                    reject(`Got a non 200 from S3: ${xhr.status}`);
                }
            }
        });
        xhr.addEventListener("error", evt => {
            if (!resolved) {
                resolved = true;
                reject(xhr.responseText || "Network Request Failed, check logs");
            }
        });
        xhr.addEventListener("abort", evt => {
            if (!resolved) {
                resolved = true;
                reject(xhr.responseText || "Network Request Failed, check logs");
            }
        });
        xhr.open("PUT", url, true);
        xhr.timeout = 0; //1000 * 60; // 1 minute
        xhr.setRequestHeader("Content-Type", '');
        xhr.setRequestHeader("Accept", '');
        xhr.send(file);
    });
}