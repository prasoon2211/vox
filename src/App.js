import React, { useState, useEffect } from "react";
import axios from "axios";
import { Readability } from "@mozilla/readability";
import OpenAI from "openai";
import "./App.css";

function App() {
  const [apiKey, setApiKey] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [url, setUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedApiKey = localStorage.getItem("openaiApiKey");
    if (storedApiKey) {
      setApiKey(storedApiKey);
    }
  }, []);

  const handleApiKeySubmit = (e) => {
    e.preventDefault();
    localStorage.setItem("openaiApiKey", apiKeyInput);
    setApiKey(apiKeyInput);
  };

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setAudioUrl("");

    try {
      // Fetch article
      const response = await axios.get(
        `https://corsproxy.io/?${encodeURIComponent(url)}`
      );
      const doc = new DOMParser().parseFromString(response.data, "text/html");
      const article = new Readability(doc).parse();

      // Convert to speech
      const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
      });
      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice: "alloy",
        input: article.textContent,
      });

      const blob = new Blob([await mp3.arrayBuffer()], { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(blob);
      setAudioUrl(audioUrl);
    } catch (error) {
      console.error("Error:", error);
      setError("An error occurred. Please check the URL and your API key.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="App">
      {!apiKey && (
        <form onSubmit={handleApiKeySubmit}>
          <input
            type="text"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="Enter OpenAI API Key"
          />
          <button type="submit">Save API Key</button>
        </form>
      )}
      {apiKey && (
        <form onSubmit={handleUrlSubmit}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter article URL"
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? "Converting..." : "Convert to Speech"}
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      {audioUrl && (
        <audio controls src={audioUrl}>
          Your browser does not support the audio element.
        </audio>
      )}
    </div>
  );
}

export default App;
