const colors                = require('colors');
const fs                    = require('fs');
const path                  = require('path');
const crypto                = require('crypto');

const Downloader            = require("nodejs-file-downloader"); /*cache required files*/
const cliProgress           = require('cli-progress');

const crc32                 = require('crc-32');

const { download }          = require('./download.js');

const utils                 = require('./utils.js');

const downloadBarList = new cliProgress.MultiBar(
{
    format: colors.cyan('{fileName} | ') + colors.green('{bar}') + 
        ' | {percentage}% | {downloaded} / {fileSize}',
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
var downloadingFilesNum = 0;
var downloading = false;

var verifyingFiles = false;
var verifyFilesMode = true;
var checkedFiles = 0;
var downloadedFiles = 0;


async function createDownloader(download, dlBar)
{
    return new Downloader(
    {
        url: download.downloadLink,
        directory: path.join(__dirname, 'output/', download.savePath), //Sub directories will also be automatically created if they do not exist.
       
        onProgress: (percentage, chunk, remainingSize) =>
        {
            dlBar.update(parseFloat(percentage), 
            {
                downloaded: utils.getBiggestDataSizeFromSize(parseInt(download.size) - remainingSize)
            });
        },
    
        onError: err => 
        {
            console.log(`Error while downloading ${download.name.cyan} (${err})`)
        }
    });
}

function checkHashesForFile(path, hash, vfCheckBar, onChunkCb, onEndCb, onHashFailCb)
{
    let fileBuff = fs.createReadStream(path, { highWaterMark: maxFileChunkSize });

    var shaHasher = crypto.createHash('sha256'); 
    var md5Hasher = crypto.createHash('md5');
    var currentChunk = 0;
    fileBuff.on('data', chunk =>
    {
            shaHasher.update(chunk);
            md5Hasher.update(chunk);

            currentChunk++;
            onChunkCb(currentChunk, vfCheckBar);
    });

    fileBuff.on('end', () => 
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

        downloadingFilesNum++;
        download.downloading = true;

        const dlBar = downloadBarList.create(100, 0, 
        {
                fileName: download.name,
                downloaded: 0,
                fileSize: utils.getBiggestDataSizeFromSize(download.size)
        });

        const fileDownloader = await createDownloader(download, dlBar);
        await fileDownloader.download();

        dlBar.update(100, { fileName: colors.green(download.name)});
        dlBar.stop();

        download.downloaded = true;
        download.downloading = false;
        downloadedFiles++;
        downloadingFilesNum--;
    };
}
async function verifyFiles()
{
    console.log('\nChecking files....');  
    var checkBar = checkBarList.create(downloadQueue.length, 0, 
    {
        fileName: 'Total progress | ',
        checked: checkedFiles,
        totalToCheck: downloadQueue.length
    });
    
    for(let download of downloadQueue) 
    { 
        /*if file size is lower than 1024 they are bytes, otherwise they are kb*/
        let fileChunks = (download.size > 1024) ? 
        (Math.round(parseInt(download.size) / maxFileChunkSize)) : 
        (Math.round(parseInt(download.size) / (maxFileChunkSize * 1024))); 

        var vfCheckBar = checkBarList.create(fileChunks, 0, 
        {
            fileName: download.name,
            checked: 0,
            totalToCheck: fileChunks + 1
        });

        checkHashesForFile(path.join(__dirname, 'output', download.savePath, download.name), download.hash, vfCheckBar,
        (currentChunk, vfBar) => 
        {
            vfBar.update(currentChunk, 
            { 
                checked: currentChunk, 
                totalToCheck: fileChunks + 1
            });

        },

        (vfCheckBar) => 
        {   
            vfCheckBar.stop(); 
            checkedFiles++;   
            checkBar.increment(1, { checked: checkedFiles}); 
        },

        () => 
        {
            checkBarList.log(`Hash mismatch for file: ${download.name.red}\n`);
        });     
        
        download.checksumed = true;
    };
}

function update()
{
    if (!downloadQueue.length || (!downloading && !verifyingFiles) || downloadingFilesNum == maxDownloadAmount)
        return;

    if (checkedFiles == downloadQueue.length)
    {
        checkBarList.stop();
        console.log(colors.bgMagenta('Finished file checking!'));

        verifyingFiles = false;
        downloadingFilesNum = 0;
        downloadQueue.splice(0, downloadQueue.length);

        return;
    }

    if (downloadedFiles === downloadQueue.length)
    {
        downloadBarList.stop();
        console.log(colors.bgMagenta('Finished file downloading!'));

        if (verifyFilesMode)
        {
            verifyingFiles = true;
            downloading = false;
            downloadedFiles = 0;

            verifyFiles();
        }

        return;
    }

    downloadFiles();
}

function pushDownload(name, savePath, downloadLink, hash, size)
{
    downloadQueue.push(new download(name, savePath, downloadLink, hash, size));
} 
function startDownload()
{
    console.log(`\nStarting download (Queue: ${downloadQueue.length}) (Check files: ${verifyFiles ? "verify" : "no-verify"})`);
    downloading = true;
}
function setFileCheckingMode()
{
    verifyFilesMode = true;
}

module.exports.pushDownload = pushDownload;
module.exports.update = update;
module.exports.startDownload = startDownload;
module.exports.setFileCheckingMode = setFileCheckingMode;