
const download                      = require('./download.js');
//const scrapeDownloadLinks           = require('./scrapeDownloadLinks.js');

const utils                         = require('./../utils.js');

function onCommand(command, args)
{
    console.clear(); /*from now on everything in console will be from the command that's being executed*/

    let linkInfo = utils.getInfoFromLink(args[0]);

    if (linkInfo.key === undefined)
    {
        console.log("You've submited an invalid mediafire link!");
        return;
    }

    switch(command)
    {
        case 'download': 
        {
            if (linkInfo.type === 'file')
                download.downloadFile(linkInfo.key);
            
            else 
                download.downloadFolder(linkInfo.key);

            break;
        }
    }
}

module.exports.onCommand = onCommand;