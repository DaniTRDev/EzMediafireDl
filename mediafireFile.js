const colors                = require('colors');
const fs                    = require('fs');
const path                  = require('path');

const { apiRequest }        = require('./asyncApiRequests.js');

const mfApiReq              = new apiRequest('https://www.mediafire.com/api/1.5');

const downloader            = require('./asyncDownloader.js'); /*cache required files*/
const cliProgress           = require('cli-progress');

function setMediafireQueryParams(quickKey)
{
    mfApiReq.addQueryParam("quick_key", quickKey);
    mfApiReq.addQueryParam("response_format", "json");
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

    }

    getFileInfo(onFinishCb)
    {
        mfApiReq.setEndPoint("/file/get_info.php");    
        setMediafireQueryParams(this.key);
        mfApiReq.get((res, err) => 
        {
            if (err)
            {
                console.log(`Error while fetching file info! ${'Key'.underline}: ${this.key.cyan}`);
                console.log(err);

                return;
            }

            let response = JSON.parse(res).response;
            let fileInfo = response.file_info;

            this.name = fileInfo.filename;
            this.hash = fileInfo.hash;
            this.size = fileInfo.size;
            this.passwordProtected = fileInfo.password_protected;
            this.downloadPage = fileInfo.links.normal_download; /*we need to scrap the real download link from the page html*/

            this.getDownloadLink(link => 
            {
                this.downloadLink = link;
                onFinishCb(fileInfo);
            });
        });
    }

    getDownloadLink(onFinishCb)
    {
        let mfDownloadPageReq = new apiRequest(this.downloadPage);
        mfDownloadPageReq.get((res, err) => 
        {

            if (err)
            {
                console.log(`Error while fetching direct download link! ${'Name'.underline}: ${this.name.cyan} / ${'Key'.underline}: ${this.key.cyan}`);
                console.log(err);

                return;
            }

            let splitData = res.toString().split(/[\r\n]+/);

            for (let str of splitData)
            {

                let downloadCode = str.match('href="((http|https)://download[^"]+)');
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
                if (downloadCode)
                {
                    onFinishCb(downloadCode[1]);
                    break;
                }
            }
        });
    }

    log()
    {
        console.log(`\t-- ${this.filePath.cyan}/${this.name.cyan} (${colors.red(Math.trunc(this.size / 1024))}MB)`);
    }

    async queueDownload()
    {
        //if (!fs.existsSync(path.join(__dirname, 'output/', this.filePath)))
            //fs.mkdirSync(path.join(__dirname, 'output/', this.filePath));

        await downloader.pushDownload(this);
    }
}

module.exports.mediafireFile = mediafireFile;