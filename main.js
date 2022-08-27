const colors                                    = require('colors');
const fs                                        = require('fs');
const path                                      = require('path');

const readline                                  = require('readline');
const promisify                                 = require('promisify-node');

const { mediafireFolder }                       = require('./mediafireFolder.js');
const { mediafireFile }                         = require('./mediafireFile.js');

const downloader                                = require('./asyncDownloader.js');

const commands                                      = require('./commands/index.js');

require('dotenv').config(); /*load up the .env file*/

const rl = readline.createInterface(
{
    input: process.stdin,
    output: process.stdout
});


async function main()
{
    colors.enable(); /*enable full color support*/

    if (!fs.existsSync(path.join(__dirname, 'output'))) 
        fs.mkdirSync(path.join(__dirname, 'output'));
      
    
    rl.question("Mediafire Link:", link => 
    {
        let isFile = link.includes('file');
        let isFolder = link.includes('folder');
    
        let args = [ link ];

        commands.onCommand('download', args);
    });
}

main();

setInterval((async () => 
{   
        downloader.update();
}), 100);
