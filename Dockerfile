# Use official Node.js image
FROM node:18

# Create and set working directory
WORKDIR /app

# Copy package.json and package-lock.json first for dependency installation
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy all remaining files to the container
COPY . .

# Expose application port (change 3000 if needed)
EXPOSE 3000

# Run the app
CMD ["npm", "start"]
