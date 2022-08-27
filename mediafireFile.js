const colors                = require('colors');
const fs                    = require('fs');
const path                  = require('path');

const { apiRequest }        = require('./asyncApiRequests.js');
const mfApiReq              = new apiRequest('https://www.mediafire.com/api/1.5');

const downloader            = require('./asyncDownloader.js'); /*cache required files*/

const utils                 = require('./utils.js');

const mfFileGetInfoParams  = new URLSearchParams(
{
    "quick_key": 'NULL',
    "response_format": 'json'
});
function setMfFileInfoParams(fileKey)
{
    mfFileGetInfoParams.set("quick_key", fileKey);
}

class mediafireFile
{
    constructor(key, filePath)
    {
        this.name = '';
        this.key = key;
        this.hash = '';
        this.size = 0;
        this.passwordProtected = false;
        this.filePath = filePath ? filePath : '';
        this.downloadLink = '';
        this.downloadPage = '';

        this.rawFileInfo = undefined;
    }

    async getFileInfo()
    {

        if (this.rawFileInfo)
            return this.rawFileInfo;

        mfApiReq.setEndPoint("/file/get_info.php");    
        setMfFileInfoParams(this.key);

        const res = await mfApiReq.get(mfFileGetInfoParams)
        .catch(err => 
        { 
            console.log(err);
            return {}; 
        });
 
        if (!res)
            return {};

        let response = (await res.json()).response;
        let fileInfo = response.file_info;

        this.name = fileInfo.filename;
        this.hash = fileInfo.hash;
        this.size = fileInfo.size;
        this.passwordProtected = fileInfo.password_protected;
        this.downloadPage = fileInfo.links.normal_download; /*we need to scrap the real download link from the page html*/
        this.rawFileInfo = fileInfo;

        return fileInfo;
    }

    async getDownloadLink()
    {
        if (!this.rawFileInfo)
            await this.getFileInfo();

        if (this.downloadLink != '')
            return this.downloadLink; /*these checks will save a few resources...*/

        const mfDownloadPageReq = new apiRequest(this.downloadPage);
        const res = await mfDownloadPageReq.get()
        .catch(err => 
        {
            console.log(`Error while fetching downloading link (${'Key'.cyan}: ${this.key.cyan})! Err: ${err}`);
            return {};
        });

        if (!res)
            return '';

        let splitData = (await res.text()).split(/[\r\n]+/);

        for (let str of splitData)
        {
            let downloadCode = str.match('href="((http|https)://download[^"]+)');

            if (downloadCode)
            {
                this.downloadLink = downloadCode[1];
                return downloadCode[1];
            }

            /*download code should have 3 matches in one single line: 
            <a class="input popsok" aria-label="Download file" 
            href="download link..." 
            id="downloadButton">
                Download
            </a> (all of this html code is stored in a single line)

            matches:
                href="download link..." // 0
                downloading link // 1
                https // 2

            */
        }
    }

    log()
    {
        console.log(`Fetched ${this.filePath.yellow}/${this.name.cyan} (${'Key'.underline}: ${this.key.magenta}) ` +
            `(${utils.getBiggestDataSizeFromSize(this.size).red})`);
    }

    async queueDownload()
    {
        if (!this.rawFileInfo)
            await this.getFileInfo();

        downloader.pushDownload(this.name, this.filePath, await this.getDownloadLink(), this.hash, this.size);
    }
}

module.exports.mediafireFile = mediafireFile;