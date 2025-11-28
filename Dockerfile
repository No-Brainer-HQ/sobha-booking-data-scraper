# Use the official Apify image with Node.js 18
# No Playwright needed - this scraper uses direct API calls
FROM apify/actor-node:18

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy source code
COPY . .

# Run the actor
CMD [ "npm", "start" ]
