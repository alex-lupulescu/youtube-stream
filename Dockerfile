FROM node:22-alpine

WORKDIR /app

COPY package.json .
COPY api-zerops.js .

EXPOSE 3000

CMD ["node", "api-zerops.js"]

