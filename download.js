class download
{
    constructor(fileQuickHash, mfFile)
    {
        this.downloading = false;
        this.downloaded = false;
        this.checksumed = false;

        this.fileQuickHash = fileQuickHash;
        this.mfFile = mfFile;
    }
}

module.exports.download = download;