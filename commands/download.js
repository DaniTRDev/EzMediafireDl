const { mediafireFile }     = require('./../mediafireFile.js');
const { mediafireFolder }   = require('./../mediafireFolder.js');

const downloader            = require('./../asyncDownloader.js');

const utils                 = require('./../utils.js');

async function downloadFile(key)
{
    const mfFile = new mediafireFile(key);
    await mfFile.queueDownload();

    downloader.setFileCheckingMode();
    downloader.startDownload(); 
}

async function downloadFolder(key)
{
    let mfFolder = new mediafireFolder(key);
    let folderInfo = await mfFolder.getFolderInfo();

    console.log(`Fetched folder info: ${folderInfo.name.cyan} (Folders: ${folderInfo.total_folders.cyan})` +
        `(Files: ${folderInfo.total_files.cyan}) (${utils.getBiggestDataSizeFromSize(folderInfo.total_size)})`);

    console.log('\nFetching folder content...');
    await mfFolder.log();

    await mfFolder.queueDownload();
    downloader.setFileCheckingMode();
    downloader.startDownload(); 
}

module.exports.downloadFile = downloadFile;
module.exports.downloadFolder = downloadFolder;