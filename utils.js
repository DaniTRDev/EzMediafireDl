
const dataSizeTable = ['KB', 'MB', 'GB', 'TB'];

function getBiggestDataSizeFromSize(dataSize)
{
    if (typeof dataSize == 'string')
        dataSize = parseInt(dataSize);
    

    if (dataSize < 1024) /*bytes*/
        return dataSize.toString().concat('B');
    
    let curDataSizeName = dataSizeTable[0];
    for(let i = 0; i < dataSizeTable.length; i++)
    {
        if ((dataSize / 1024) < 1)
            break;

        curDataSizeName = dataSizeTable[i];
        dataSize = (dataSize / 1024);
    }

    return dataSize.toFixed(2).toString().concat(curDataSizeName);
}

function getInfoFromLink(link)
{
    /*parse the link to extract the key & name*/
    let splitString = link.split('/');

    for (let i = 0; i < splitString.length; i++)
    {
        let str = splitString[i];

        let isFile = str.includes('file');
        let isFolder = str.includes('folder');

        if (isFile || isFolder)
            return { type: isFile ? 'file' : 'folder', key: splitString[i + 1]};
        

    }
    return {};
}


module.exports.getInfoFromLink = getInfoFromLink;
module.exports.getBiggestDataSizeFromSize = getBiggestDataSizeFromSize;