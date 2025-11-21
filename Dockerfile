FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
COPY .env /app/
CMD ["npm", "start"]