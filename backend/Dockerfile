# Stage 1: Build the TypeScript application
FROM node:20-alpine as build
WORKDIR /app

# Copy package management files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Run the application
FROM node:20-alpine
WORKDIR /app

# Create uploads directory
RUN mkdir -p uploads

# Copy built application and dependencies from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json .

# Expose port 3000
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]
