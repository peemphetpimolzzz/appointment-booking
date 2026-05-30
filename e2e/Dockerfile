FROM mcr.microsoft.com/playwright:v1.55.0-noble
WORKDIR /e2e
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
ENTRYPOINT ["npx", "playwright", "test"]
