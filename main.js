const colors                                    = require('colors');
const fs                                        = require('fs');
const path                                      = require('path');

const { mediafireFolder }                       = require('./mediafireFolder.js');
const { mediafireFile }                         = require('./mediafireFile.js');

const downloader                                = require('./asyncDownloader.js');

const readline                                  = require('readline');

require('dotenv').config(); /*load up the .env file*/

const rl = readline.createInterface(
{
    input: process.stdin,
    output: process.stdout
});

function getKeyFromLink(link)
{
    /*parse the link to extract the key & name*/
    let splitString = link.split('/');

    for (let i = 0; i < splitString.length; i++)
    {
        let str = splitString[i];
        if (str.includes('file') ||str.includes('folder'))
            return splitString[i + 1];

    }
}


function recursiveFolderDownloader(parentFolder)
{    
    parentFolder.subFolders.forEach(folder => 
    {
        folder.getFolderInfo(() => 
        {
            folder.getFolders(() => 
            {
                folder.log();
                recursiveFolderDownloader(folder);
            });
        });
    });

    parentFolder.getFiles(files => 
    {
        files.forEach(file => file.getFileInfo( () => 
        {
            file.queueDownload();
        }));
    });
}

async function main()
{
    colors.enable(); /*enable full color support*/

    if (!fs.existsSync(path.join(__dirname, 'output'))) 
        fs.mkdirSync(path.join(__dirname, 'output'));
      

    rl.question("Submit mediafire link: ", link => 
    {

        let isFile = link.includes('file');
        let isFolder = link.includes('folder');

        let key = getKeyFromLink(link);

        if (isFile)
        {
            let file = new mediafireFile(key);
            file.getFileInfo(() => { file.download(); });

            downloader.update();
            return;
        }
        else if (isFolder)
        {
            let folder = new mediafireFolder(key);
            folder.getFolderInfo(folderInfo => 
            {
                downloader.setExpectedDownloads(folder.fileCount); 
                
                console.log(`Fetched folder: ${folderInfo.name.cyan} (Folders: ${folderInfo.total_folders.cyan})` +
                    `(Files: ${folderInfo.total_files.cyan}) (Size: ${folderInfo.total_size.cyan}KB)`);

                folder.getFolders(recursiveFolderDownloader);
            });

            return;
        }

        console.log("It's not a valid mediafire link!");
        main();
    });
    
    rl.question("Do you want to verify downloaded files?", answer => 
    {
        
    });

}

main();

setInterval((async () => 
{   
        downloader.update();
}), 100);
