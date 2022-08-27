const colors                = require('colors');
const fs                    = require('fs');
const path                  = require('path');


const asyncDownloader       = require('./asyncDownloader.js');
const { mediafireFile }     = require('./mediafireFile.js');
const { apiRequest }        = require('./asyncApiRequests.js');

const mfApiReq              = new apiRequest('https://www.mediafire.com/api/1.5');

const mfFolderGetContentParams  = new URLSearchParams(
{
    "folder_key": 'NULL',
    "content_type": 'NULL',
    "filter": 'all',
    "order_by": 'name',
    "order_direction": 'asc',
    "chunk": 0,
    "details": "yes",
    "response_format": 'json',
    "chunk_size": 1000,

});
function setMfFolderContentParams(folderKey, chunk, getFolders)
{
    mfFolderGetContentParams.set("folder_key", folderKey);
    mfFolderGetContentParams.set("content_type", getFolders ? "folders" : "files");
    mfFolderGetContentParams.set("chunk", chunk);
}

const mfFolderGetInfoParams  = new URLSearchParams(
{
    "folder_key": 'NULL',
    "details": "yes",
    "response_format": 'json'
});
function setMfFolderInfoParams(folderKey)
{
    mfFolderGetInfoParams.set("folder_key", folderKey);
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
        this.foldersChunk = 1;
        this.foldersMoreChunks = true;
        this.filesMoreChunks = true;
        this.filesChunk = 1;
        this.folderPath = (folderPath != undefined) ? folderPath : ''; /*used to create the folder in the computer*/
        this.downloaded = false;

        this.rawFolderInfo = undefined;
    }

    async getFolderInfo()
    {    
        if (this.rawFolderInfo)
            return this.rawFolderInfo;

        mfApiReq.setEndPoint("/folder/get_info.php");
        setMfFolderInfoParams(this.key);
        
        const res = await mfApiReq.get(mfFolderGetInfoParams)
        .catch(err => 
        { 
            console.log(`Error while fetching folder info! (${'Folder key'.underline}: ${this.key.cyan})\n ${err}`);
            return {};
        });

        if (!res)
            return {};

        let response = (await res.json()).response;
        let folderInfo = response.folder_info;

        this.name = folderInfo.name;
        this.folderCount = folderInfo.total_folders;
        this.fileCount = folderInfo.total_files;
        this.folderSize = folderInfo.total_size;
        this.rawFolderInfo = folderInfo;

        if (this.folderPath == '')/*if the folder has not a valid folderPath then it is the root folder*/
            this.folderPath = this.name; 

        return folderInfo;
    }
    async getFolders()
    {
        if (!this.rawFolderInfo)
            await this.getFolderInfo();

        if (!this.foldersMoreChunks)
            return this.subFolders;

        mfApiReq.setEndPoint("/folder/get_content.php");
        setMfFolderContentParams(this.key, this.foldersChunk, true);

        const res = await mfApiReq.get(mfFolderGetContentParams)
        .catch(err => 
        {
            console.log(`Error while fetching sub folders! (${'Folder key'.underline}: ${this.key.magenta})\n ${err}`);
            return {};
        });

        if (!res)
            return [];

        let response = (await res.json()).response;
        let folderContent = response.folder_content;
        let folders = folderContent.folders;

        if (folders) /*we need this check because maybe there arent sub folders in this folder so it will be undefined*/
        {
                for(let folder of folders)
                {
                    const mfFolder = new mediafireFolder(folder.folderkey, this.folderPath.concat('/', folder.name));
                    await mfFolder.getFolders(); /*recursive folder fetcher*/
                    await mfFolder.getFiles();

                    this.subFolders.push(mfFolder);
                }
        }

        this.folderChunk++;
        this.foldersMoreChunks = (folderContent.more_chunks === 'yes');
        return await this.getFolders();
    }
    async getFiles()
    {
        if (!this.rawFolderInfo)
            await this.getFolderInfo();

        if (!this.filesMoreChunks)
            return this.files;

        mfApiReq.setEndPoint("/folder/get_content.php");
        setMfFolderContentParams(this.key, this.filesChunk, false);

        const res = await mfApiReq.get(mfFolderGetContentParams)
        .catch(err => 
        {
            console.log(`Error while fetching files! (${'Folder key'.underline}: ${this.key.magenta})\n ${err}`);
            return {}; 
        }); 
        
        if (!res)
            return [];

        let response = (await res.json()).response;
        let folderContent = response.folder_content;
        let files = folderContent.files;

        if (files) /*we need this check because if there are not files in the folder 'files' will be undefined*/
        {
            for(let file of files)
            {  
                const mfFile = new mediafireFile(file.quickkey, this.folderPath);
                await mfFile.getFileInfo();

                this.files.push(mfFile);
            }
        }
        
           
        this.filesChunk++;
        this.filesMoreChunks = (folderContent.more_chunks === 'yes');
        return await this.getFiles();
    }

    async log()
    {
        console.log(`Fetched ${this.folderPath.yellow} (${'Key'.underline}: ${this.key.magenta}) (${'Folders'.underline}: ${this.folderCount.cyan})` +
        ` (${'Files'.underline}: ${this.fileCount.cyan})`);

        for(let folder of await this.getFolders())
            folder.log();
        
        for (let file of await this.getFiles())
        {
            await file.getFileInfo();
            file.log();
        }
    }

    async queueDownload()
    {
        /*create this directory in the computer*/
        let fullPath = path.join(__dirname, 'output', this.folderPath);

        if (!fs.existsSync(fullPath))
            fs.mkdirSync(fullPath);

        for(let folder of await this.getFolders())
            folder.queueDownload();
    
        for (let file of await this.getFiles())
            file.queueDownload();
    }

}

module.exports.mediafireFolder = mediafireFolder;