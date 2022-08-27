class download
{
    constructor(name, savePath, downloadLink, hash, size)
    {
        this.downloading = false;
        this.downloaded = false;
        this.checksumed = false;

        this.name = name;
        this.savePath = savePath
        this.downloadLink = downloadLink;
        this.hash = hash;
        this.size = size;
    }
}

module.exports.download = download;