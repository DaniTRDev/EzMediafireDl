FROM node:current-alpine

# choose a directory inside of the contaire to put our application files
WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install --silent

# copy from our current project directory to most recent WORKDIR
COPY . .

ENTRYPOINT [ "node", "main.js" ]

CMD [ "node", "main.js" ]
