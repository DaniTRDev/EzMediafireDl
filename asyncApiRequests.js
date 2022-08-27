const fetch = require('node-fetch');


class apiRequest
{
    constructor(apiUrl)
    {
        this.apiUrl = apiUrl
        this.endPoint = '';

        this.options = 
        {
            method: '', /*post / get*/
            body: undefined,
            headers: 
            {

            }
        };
    }

    addHeader(name, data)
    {
        this.options.headers[name] = data;
    }

    setEndPoint(endpoint)
    {
        let workingEndPoint = '';

        if (endpoint.at(0) != '/')
            workingEndPoint += '/';

        workingEndPoint += endpoint;
        this.endPoint = workingEndPoint;
    }

    async request(params)
    {
        const url = new URL(this.apiUrl + this.endPoint);

        if (params)
            url.search = params;
            
        if (process.env.LOG_REQUESTS === true)
        {
            console.log(`Submitting a ${this.options.method} request to: \n ${fullPath} \n` + 
                `Headers: \n${JSON.stringify(this.options.headers)}`);
        }

        return await fetch(url, this.options)
        .catch(err => { console.log(err); return {}});
    }

    post(params, data, contentType)
    {
        this.options.method = 'POST';
        this.options.body = data;
        this.options.headers['Content-Type'] = contentType;

        return this.request(params);
    }

    get(params)
    {
        this.options.method = 'GET';
        return this.request(params);
    }
}

module.exports.apiRequest = apiRequest;