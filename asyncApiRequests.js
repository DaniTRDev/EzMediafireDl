const https = require('node:https');


async function requestResultParser(res, callback)
{
    let data = [];

    if (res.statusCode != 200)
    {
        callback(undefined, `Error in the request; ErrorCode ${res.statusCode}; Message: ${res.statusMessage}`);
        return;
    }

    await res.on('data', chunk => { data.push(chunk); });
    await res.on('end', () => 
    {
        try 
        {
            callback(Buffer.concat(data).toString());
        } 
        catch (err) 
        {
            callback(undefined, err);
        }
        });
}

class apiRequest
{
    constructor(apiUrl)
    {
        this.apiUrl = apiUrl;
        this.endPoint = '';

        this.queryParams = '';
        this.paramCount = 0;

        this.options = 
        {
            port: 443,
            method: '', /*post / get*/
            headers: 
            {
                'User-Agent': https.globalAgent
            }
        };
    }

    addHeader(name, data)
    {
        this.options.headers[name] = data;
    }

    /* temporal, will be cleared after 'get' or 'post' is called */
    addQueryParam(name, data)
    {
        if (this.paramCount > 0)
            this.queryParams += '&';

        this.queryParams += name.concat('=', data);
        this.paramCount++;
    }

    setEndPoint(endpoint)
    {
        let workingEndPoint = '';

        if (endpoint.at(0) != '/')
            workingEndPoint += '/';

        workingEndPoint += endpoint;
        this.endPoint = workingEndPoint;
    }

    async request(data, callback)
    {
        let fullPath = this.apiUrl + this.endPoint;

        if (this.paramCount > 0)
            fullPath += '?' + this.queryParams;

        let request = https
        .request(fullPath, this.options, res => 
            {
                requestResultParser(res, callback);
            })
        .on('error', err => callback(undefined, err));
            
        if (data)
            await request.write(data);
    
        await request.end();

        //console.log(`Submitting a ${this.options.method} request to: \n ${fullPath} 
            //(Content-Type: ${this.options.headers["Content-Type"]}) (Content-Length: ${this.options.headers["Content-Length"]})`);
    }

    async post(data, dataLenght, contentType, callback)
    {
        this.options.method = 'POST';
        this.options.headers['Content-Type'] = contentType;
        this.options.headers['Content-Lenght'] = dataLenght;

        await this.request(data, callback);
    }

    async get(callback)
    {
        this.options.method = 'GET';
        await this.request(undefined, callback);
    }
}

module.exports.apiRequest = apiRequest;