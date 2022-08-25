const colors                = require('colors');
const fs                    = require('fs');
const path                  = require('path');


const asyncDownloader    = require('./asyncDownloader.js');
const { mediafireFile }     = require('./mediafireFile.js');
const { apiRequest }        = require('./asyncApiRequests.js');

const mfApiReq              = new apiRequest('https://www.mediafire.com/api/1.5');

function setMediafireQueryParams(chunk, folderKey, getFolder)
{
    mfApiReq.addQueryParam("folder_key", folderKey);
    mfApiReq.addQueryParam("content_type", getFolder ? "folders" : "files");
    mfApiReq.addQueryParam("filter", "all");
    mfApiReq.addQueryParam("order_by", "name");
    mfApiReq.addQueryParam("order_direction", "asc");
    mfApiReq.addQueryParam("chunk", chunk);
    mfApiReq.addQueryParam("details", "yes");
    mfApiReq.addQueryParam("response_format", "json");
    mfApiReq.addQueryParam("chunk_size", 1000);
}

class mediafireFolder
{
    constructor(key, folderPath)
    {
        this.key = key;
        this.name = '';
        this.fileCount = 0;
        this.folderCount = 0;
        this.subFolders = [];
        this.files = [];
        this.folderChunk = 1;
        this.fileChunk = 1;
        this.folderPath = (folderPath != undefined) ? folderPath : ''; /*used to create the folder in the computer*/
        this.downloaded = false;
    }

    getFolderInfo(onFinishCb)
    {        
        mfApiReq.setEndPoint("/folder/get_info.php");
        mfApiReq.addQueryParam('folder_key', this.key);
        mfApiReq.addQueryParam('response_format', 'json');
        mfApiReq.addQueryParam('details', 'yes');

        mfApiReq.get((res, err) => 
        {
            if (err)
            {
                console.log(`Error while fetching folder info! ${'Key'.underline}: ${this.key.cyan}`);
                console.log(err);

                return;
            }

            let response = JSON.parse(res).response;
            let folderInfo = response.folder_info;

            this.name = folderInfo.name;
            this.folderCount = folderInfo.total_folders;
            this.fileCount = folderInfo.total_files;
            this.folderSize = folderInfo.total_size;

            if (this.folderPath == '')/*if the folder has not a valid folderPath then it is the root folder*/
                this.folderPath = this.name; 
            
            onFinishCb(folderInfo);
        });
    }
    getFolders(onFinishCb)
    {
        mfApiReq.setEndPoint("/folder/get_content.php");
        setMediafireQueryParams(this.folderChunk, this.key, true);

        mfApiReq.get((res, err) => 
        {
            if (err)
            {
                console.log(`Error while retrieving subfolders of ${this.name.cyan}`); 
                console.log(err);

                return;
            }

            let response = JSON.parse(res).response;
            let folderContent = response.folder_content;
            let folders = folderContent.folders;

            if (folders) /*we need this check because maybe there arent sub folders in this folder*/
            {
                folders.forEach(folder => 
                {
                    for (let subFolder of this.subFolders)
                    {
                        if (subFolder.key === folder.folderkey) /*it's the same folder, don't add it*/
                            return;
                    }

                    this.subFolders.push(new mediafireFolder(folder.folderkey, this.folderPath.concat('/', folder.name)));
                });
            }

            if (folderContent.more_chunks === 'no')
            {
                onFinishCb(this); 
                return; 
            }
            
            this.folderChunk++;
            this.getFolders(onFinishCb);
        });
    }
    getFiles(onFinishCb)
    {
        mfApiReq.setEndPoint("/folder/get_content.php");
        setMediafireQueryParams(this.fileChunk, this.key, false);

        mfApiReq.get((res, err) => 
        {

            if (err)
            {
                console.log(`Error while files of ${this.name.cyan}`); 
                console.log(err);

                return;
            }

            let response = JSON.parse(res).response;
            let folderContent = response.folder_content;
            let files = folderContent.files;

            if (files)
            {
                files.forEach(file => 
                {
                    this.files.push(new mediafireFile(file.quickkey, this.folderPath));
                });
            }

            if (folderContent.more_chunks === 'no')
            {
                onFinishCb(this.files);
                return; 
            }
            
            this.folderChunk++;
            this.getFiles(onFinishCb);
        });
    }

    log()
    {
        console.log(`Fetched ${this.folderPath.cyan} (${'Key'.underline}: ${this.key.cyan}) (${'Folders'.underline}: ${this.folderCount.cyan}) (${'Files'.underline}: ${this.fileCount.cyan})`);
    }

    logSubFolders(logFolderFiles)
    {
        this.log();
        this.subFolders.forEach(folder => 
        {
            console.log(`\t -- ${this.folderPath.cyan} (${'Key'.underline}: ${this.key.cyan}) (${'Folders'.underline}: ${this.subFolders.length.cyan}) (${'Files'.underline}: ${this.files.length.cyan})`);
        })
    }

    logFiles()
    {
        this.files.forEach(file => file.log());
    }

}

module.exports.mediafireFolder = mediafireFolder;