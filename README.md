# EventCircle

This is the README file for the EventCircle project.

## Security Improvements

### CORS Configuration Enhancements

The CORS (Cross-Origin Resource Sharing) implementation has been improved with the following features:

1. **Environment-specific origin validation**:
   - In production, origins are strictly validated against the allowedOrigins list
   - In development, requests with no origin (like from Postman or curl) are allowed

2. **Expanded HTTP methods**:
   - Added support for PATCH method alongside GET, POST, PUT, DELETE, and OPTIONS

3. **Comprehensive allowed headers**:
   - Content-Type
   - Authorization
   - X-Requested-With
   - x-device-type
   - Accept
   - Origin
   - Cache-Control
   - X-CSRF-Token
   - X-Api-Version

4. **Exposed headers configuration**:
   - Content-Length
   - Content-Type
   - X-Rate-Limit

5. **Preflight request caching**:
   - Added maxAge (86400 seconds = 24 hours) to specify how long the results of a preflight request can be cached

### Security Headers with Helmet

Added Helmet middleware to set various HTTP security headers:

1. **Content Security Policy (CSP)**:
   - Restricts sources of content to protect against XSS attacks
   - Configured for the application's specific needs (fonts, scripts, styles, images)

2. **HTTP Strict Transport Security (HSTS)**:
   - Ensures the application is only accessed over HTTPS
   - Set with a 1-year max age

3. **X-Content-Type-Options**:
   - Prevents browsers from MIME-sniffing a response away from the declared content type

4. **X-Frame-Options**:
   - Prevents clickjacking attacks by ensuring the application cannot be embedded in iframes

5. **X-XSS-Protection**:
   - Enables the browser's built-in XSS filtering capabilities

### Environment Variables for Sensitive Information

Improved security by using environment variables for sensitive information:

1. **Firebase Configuration**:
   - Project ID
   - Client Email
   - Private Key
   - Storage Bucket

## Getting Started

To run the application with the new security features:

1. Set up environment variables in a `.env` file (for development) or in your hosting environment (for production):

```
MONGODB_URI=your_mongodb_connection_string
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
```

2. Install dependencies:

```
npm install
npm install helmet --save
```

3. Start the server:

```
npm start
```
