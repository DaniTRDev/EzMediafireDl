const colors                = require('colors');
const fs                    = require('fs');
const path                  = require('path');
const crypto                = require('crypto');

const Downloader            = require("nodejs-file-downloader"); /*cache required files*/
const cliProgress           = require('cli-progress');

const crc32                 = require('crc-32');

const { download }          = require('./download.js');

const downloadBarList = new cliProgress.MultiBar(
{
    format: colors.cyan('{fileName} | ') + colors.green('{bar}') + 
        ' | {percentage}% | Downloaded: {downloaded} | Total: {fileSize}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
    stopOnComplete: true,
    barsize: 20
}, cliProgress.Presets.shades_classic);

const checkBarList = new cliProgress.MultiBar(
{
    format: colors.cyan('{fileName} ') + colors.green('{bar}') + 
        ' | {percentage}% | {checked} / {totalToCheck}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
    barsize: 20
}, cliProgress.Presets.shades_classic);

const maxDownloadAmount = 4; /*4 files each time*/
const maxFileChunkSize = 100 * 1024; /*100kb*/

var downloadQueue = [];
var currentDownloadAmount = 0;
var expectedDownloads = 0;

var verifyingFiles = false;
var checkedFiles = 0;
var downloadedFiles = 0;


function createDownloaderForFile(mfFile, dlBar)
{
    return new Downloader(
    {
        url: mfFile.downloadLink,
        directory: path.join(__dirname, 'output/', mfFile.filePath), //Sub directories will also be automatically created if they do not exist.
       
        onProgress: (percentage, chunk, remainingSize) =>
        {
            dlBar.update(parseFloat(percentage), 
            {
                downloaded: parseInt(mfFile.size) - remainingSize
            });
        },
    
        onError: err => 
        {
            console.log(`Error while downloading ${mfFile.name.cyan} (${err})`)
        }
    });
}

async function checkHashesForFile(path, hash, vfCheckBar, onChunkCb, onEndCb, onHashFailCb)
{
    let fileBuff = fs.createReadStream(path, { highWaterMark: maxFileChunkSize });

    var shaHasher = crypto.createHash('sha256'); 
    var md5Hasher = crypto.createHash('md5');
    var currentChunk = 0;
    await fileBuff.on('data', chunk =>
    {
            shaHasher.update(chunk);
            md5Hasher.update(chunk);

            currentChunk++;
            onChunkCb(currentChunk, vfCheckBar);
    });

    await fileBuff.on('end', () => 
    {
        let sha = shaHasher.digest('hex');
        let md5 = md5Hasher.digest('hex');

        if (sha != hash) /*the file might be old, let's check its MD5 hash*/
        {
            if (md5 != hash)
                onHashFailCb(vfCheckBar);
            
        }

        fileBuff.close();
        onEndCb(vfCheckBar);
    });
}

async function downloadFiles()
{
    for(let download of downloadQueue)
    {
        if (download.downloading || download.downloaded)
            continue;

        download.downloading = true;

        var dlBar = downloadBarList.create(100, 0, 
        {
                fileName: download.mfFile.name,
                downloaded: 0,
                fileSize: download.mfFile.size
        });
        let fileDownloader = createDownloaderForFile(download.mfFile, dlBar);

        currentDownloadAmount++;
        await fileDownloader.download();

        dlBar.stop();
        download.downloaded = true;
        download.downloading = false;
        downloadedFiles++;
        currentDownloadAmount--;
    };
}
async function verifyFiles()
{
    if (verifyingFiles)
        return;

    console.log('\n');  
    var checkBar = checkBarList.create(downloadQueue.length, 0, 
    {
        fileName: colors.white('Checking downloaded files '),
        checked: checkedFiles,
        totalToCheck: downloadQueue.length
    });
    
    for(let download of downloadQueue) 
    { 
        /*if file size is lower than 1024 they are bytes, otherwise they are kb*/
        let fileChunks = (download.mfFile.size > 1024) ? 
        (Math.round(parseInt(download.mfFile.size) / maxFileChunkSize)) : 
        (Math.round(parseInt(download.mfFile.size) / (maxFileChunkSize * 1024))); 

        var vfCheckBar = checkBarList.create(fileChunks, 0, 
        {
            fileName: download.mfFile.name,
            checked: 0,
            totalToCheck: fileChunks + 1
        });

        checkHashesForFile(path.join(__dirname, 'output', download.mfFile.filePath, download.mfFile.name), download.mfFile.hash, vfCheckBar,
        (currentChunk, vfBar) => 
        {
            vfBar.update(currentChunk, 
            { 
                checked: currentChunk, 
                totalToCheck: fileChunks + 1
            });
            checkBarList.update();   
        },

        (vfCheckBar) => 
        {   
            checkBarList.update();
            vfCheckBar.stop(); 
            checkedFiles++;   
            checkBar.increment(1, { checked: checkedFiles}); 
        },

        () => 
        {
            checkBarList.log(`Hash mismatch for file: ${download.mfFile.name.red}\n`);
        });     
        
        download.checksumed = true;
    };
}

async function pushDownload(mfFile)
{
    let fileQuickHash = parseInt(crc32.str(mfFile.name)) + parseInt(crc32.str(mfFile.filePath));
    let canAddThisFile = true;

    downloadQueue.forEach(download => 
    {
        if (download.fileQuickHash === fileQuickHash)
            canAddThisFile = false;

    });

    if (canAddThisFile)
        downloadQueue.push(new download(fileQuickHash, mfFile));
}
async function update()
{
    if (!downloadQueue.length || currentDownloadAmount == maxDownloadAmount || expectedDownloads != downloadQueue.length)
        return;

    if (checkedFiles == downloadQueue.length)
    {
        checkBarList.log(colors.bgMagenta('Finished file checking!'));
        checkBarList.stop();
        verifyingFiles = false;
        expectedDownloads = 0;
        currentDownloadAmount = 0;
        downloadQueue.splice(0, downloadQueue.length);

        return;
    }

    if (downloadedFiles === downloadQueue.length)
    {
        downloadBarList.log(colors.bgMagenta('Finished file downloading!'));
        downloadBarList.stop();
        verifyFiles();
        verifyingFiles = true;

        return;
    }

    if (!currentDownloadAmount) /*a dirt way of calling this scope once*/
    {
        console.log(`\nStarting download. Expected files: ${expectedDownloads.green}`);
    }

    downloadFiles();
}
function setExpectedDownloads(expectedDownloads0)
{
    expectedDownloads = expectedDownloads0;
}

module.exports.pushDownload = pushDownload;
module.exports.update = update;
module.exports.setExpectedDownloads = setExpectedDownloads;