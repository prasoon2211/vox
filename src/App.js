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
    try {
      const storedApiKey = localStorage.getItem("openaiApiKey");
      if (storedApiKey) {
        setApiKey(storedApiKey);
      }
    } catch (error) {
      console.error("Error accessing localStorage:", error);
      setError(
        "Unable to access local storage. Please check your browser settings."
      );
    }
  }, []);

  const handleApiKeySubmit = (e) => {
    e.preventDefault();
    try {
      localStorage.setItem("openaiApiKey", apiKeyInput);
      setApiKey(apiKeyInput);
    } catch (error) {
      console.error("Error saving API key:", error);
      setError("Unable to save API key. Please check your browser settings.");
    }
  };

  const chunkText = (text, maxLength = 4000) => {
    const chunks = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    let currentChunk = "";

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length <= maxLength) {
        currentChunk += sentence;
      } else {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  };

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setAudioUrl("");

    try {
      if (!url) {
        throw new Error("Please enter a valid URL.");
      }

      // Fetch article
      const response = await axios.get(
        `https://corsproxy.io/?${encodeURIComponent(url)}`
      );
      const doc = new DOMParser().parseFromString(response.data, "text/html");
      const article = new Readability(doc).parse();

      if (!article) {
        throw new Error("Unable to parse the article. Please check the URL.");
      }

      // Construct the full string for OpenAI API
      let fullText = "";
      if (article.title) fullText += `Title: ${article.title}\n\n`;
      if (article.byline) fullText += `Subtitle: ${article.byline}\n\n`;
      if (article.datePublished)
        fullText += `Date: ${article.datePublished}\n\n`;
      fullText += `${article.textContent}`;

      // Chunk the text
      const chunks = chunkText(fullText);

      if (chunks.length === 0) {
        throw new Error("No content found in the article.");
      }

      // Convert to speech in parallel
      const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
      });

      const audioPromises = chunks.map((chunk) =>
        openai.audio.speech.create({
          model: "tts-1",
          voice: "alloy",
          input: chunk,
        })
      );

      const audioResponses = await Promise.all(audioPromises);

      // Concatenate audio
      const audioBlobs = await Promise.all(
        audioResponses.map((response) => response.arrayBuffer())
      );
      const concatenatedBlob = new Blob(audioBlobs, { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(concatenatedBlob);
      setAudioUrl(audioUrl);
    } catch (error) {
      console.error("Error:", error);
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        setError(
          `Server error: ${error.response.status} - ${error.response.data}`
        );
      } else if (error.request) {
        // The request was made but no response was received
        setError(
          "No response received from the server. Please check your internet connection."
        );
      } else {
        // Something happened in setting up the request that triggered an Error
        setError(
          error.message || "An unexpected error occurred. Please try again."
        );
      }
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
            required
          />
          <button type="submit">Save API Key</button>
        </form>
      )}
      {apiKey && (
        <form onSubmit={handleUrlSubmit}>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter article URL"
            required
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
