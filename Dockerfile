FROM node:20-alpine

WORKDIR /app

# Install openssl for Prisma runtime
RUN apk add --no-cache openssl

# Copy package definitions for npm workspaces
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/
COPY server/prisma ./server/prisma/

# Install dependencies and generate Prisma client
RUN npm install

# Copy all source files
COPY . .

# Build server (tsc) and client (vite)
RUN npm run build

# Cloud Run defaults
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Start application (runs database migrations on start, then launches Express)
CMD ["npm", "start"]
