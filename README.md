# Article to Speech Converter

This React application converts web articles to speech using OpenAI's Text-to-Speech API. Users can input article URLs, convert them to audio, and manage their audio history.

## Features

- Convert web articles to speech
- Play, pause, and seek audio
- Adjust playback speed
- Search and manage audio history
- Responsive design with Tailwind CSS

## Getting Started

Use a hosted version here: https://usevox.netlify.app

Or, to use locally:

1. Clone the repository
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`
4. Open `http://localhost:5173` in your browser

## Usage

1. Enter your OpenAI API key
2. Paste an article URL and click "Convert to Speech"
3. Listen to the converted audio using the built-in player
4. Access your conversion history in the "History" tab

Note: This application uses a CORS proxy to fetch article content. You can change the CORS proxy URL in the App.jsx file if needed. However, some websites may still refuse to serve content or block requests from the proxy. If you encounter errors when fetching certain URLs, you can use a different CORS proxy by changing the `CORS_PROXY` variable at the top of the App.jsx file. This is on the roadmap to fix by using a rotation of proxies.

## How to Get an OpenAI API Key

Follow these steps to obtain an OpenAI API key:

### 1. **Create an OpenAI Account**

- Visit the [OpenAI website](https://platform.openai.com/signup).
- Sign up with your email or use your existing Google or Microsoft account.

### 2. **Log in to the OpenAI Platform**

- After signing up, log in at [platform.openai.com](https://platform.openai.com/login).

### 3. **Navigate to the API Keys Section**

- Once logged in, go to the [API keys page](https://platform.openai.com/account/api-keys).
- This page can also be found by clicking on your profile in the top-right corner and selecting "API Keys" from the dropdown menu.

### 4. **Create a New API Key**

- Click the "Create new secret key" button.
- A new API key will be generated and displayed. **Important:** Copy and save this key securely as it will not be shown again.

### 5. **Use the API Key**

- You can now use this key to authenticate requests to OpenAI's API.

### 6. **Secure Your API Key**

- Treat your API key like a password. Do not share it publicly or in code repositories.

For detailed documentation on using the API, refer to [OpenAI's API documentation](https://platform.openai.com/docs).

## License

This project is open-source and available under the MIT License.

## Disclaimer

This software is provided "as-is," without any express or implied warranty. In no event will the authors be held liable for any damages arising from the use of this software. Use at your own risk.

The Article to Speech Converter is an experimental project and may have limitations or unexpected behaviors. It relies on third-party services and APIs, which may change or become unavailable without notice. Users are responsible for ensuring their use of this software complies with all applicable laws and terms of service of the integrated platforms.

By using this software, you agree to indemnify and hold harmless the developers, contributors, and any affiliated parties from any claims, damages, or expenses arising from your use of the Article to Speech Converter.
