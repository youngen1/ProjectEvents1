FROM node:18-slim

WORKDIR /usr/src/app

COPY package*.json ./
COPY .env ./

RUN npm ci

COPY . .

EXPOSE 4000

CMD [ "node", "index.js" ] 