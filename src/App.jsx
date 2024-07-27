import { useState, useEffect } from "react";
import axios from "axios";
import { Readability } from "@mozilla/readability";
import OpenAI from "openai";
import { openDB } from "idb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import AudioPlayer from "./AudioPlayer";

function App() {
  const [apiKey, setApiKey] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

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
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const db = await openDB("AudioDB", 1, {
        // Increase the version number to trigger upgrade
        upgrade(db) {
          if (!db.objectStoreNames.contains("history")) {
            db.createObjectStore("history"); // Ensure the 'history' store is created
          }
        },
      });
      const storedHistory = (await db.get("history", "audioHistory")) || [];
      const updatedHistory = storedHistory.map((item) => ({
        ...item,
        audioUrl: URL.createObjectURL(item.audioBlob), // Regenerate blob URL
      }));
      setHistory(updatedHistory);
    } catch (error) {
      console.error("Error loading history:", error);
      setError("Failed to load history. Please try refreshing the page.");
    }
  };

  const addToHistory = async (title, audioBlob, pageUrl) => {
    const newEntry = {
      title,
      audioBlob,
      pageUrl,
      date: new Date().toISOString(),
    };
    const updatedHistory = [newEntry, ...history];
    setHistory(updatedHistory);
    try {
      const db = await openDB("AudioDB", 1);
      await db.put("history", updatedHistory, "audioHistory");
    } catch (error) {
      console.error("Error saving history:", error);
      setError("Failed to save to history. Please try again.");
    }
  };

  const deleteHistoryItem = async (index) => {
    const updatedHistory = history.filter((_, i) => i !== index);
    setHistory(updatedHistory);
    try {
      const db = await openDB("AudioDB", 1);
      await db.put("history", updatedHistory, "audioHistory");
    } catch (error) {
      console.error("Error updating history:", error);
      setError("Failed to delete history item. Please try again.");
    }
  };

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
      setCurrentAudio({
        url: audioUrl,
        title: article.title || url,
      });
      addToHistory(article.title, concatenatedBlob, url);
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

  const playHistoryItem = (item) => {
    setUrl(item.pageUrl);
    setCurrentAudio({
      url: item.audioUrl,
      title: item.title,
    });
    setIsPlaying(true); // Start playing when history item is clicked
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Tabs defaultValue="convert" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="convert">Convert</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="convert">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">
              {apiKey ? "Convert URL to Speech" : "Enter API Key"}
            </h2>
            <form
              onSubmit={apiKey ? handleUrlSubmit : handleApiKeySubmit}
              className="space-y-4"
            >
              <Input
                type={apiKey ? "url" : "text"}
                value={apiKey ? url : apiKeyInput}
                onChange={(e) =>
                  apiKey
                    ? setUrl(e.target.value)
                    : setApiKeyInput(e.target.value)
                }
                placeholder={
                  apiKey ? "Enter article URL" : "Enter OpenAI API Key"
                }
                required
                className="w-full"
              />
              <Button
                type="submit"
                disabled={apiKey && isLoading}
                className="w-full"
              >
                {apiKey
                  ? isLoading
                    ? "Converting..."
                    : "Convert to Speech"
                  : "Save API Key"}
              </Button>
            </form>
            {error && <p className="text-red-500 mt-2">{error}</p>}
          </div>
        </TabsContent>
        <TabsContent value="history">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">History</h2>
            {history.length === 0 ? (
              <p>No history available.</p>
            ) : (
              history.map((item, index) => (
                <div key={index} className="bg-gray-100 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <div className="flex space-x-2">
                    <Button onClick={() => playHistoryItem(item)}>Play</Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="destructive">Delete</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Are you sure?</DialogTitle>
                          <DialogDescription>
                            This action cannot be undone. This will permanently
                            delete the audio.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="flex justify-end space-x-2 mt-4">
                          <Button variant="outline" onClick={() => {}}>
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => deleteHistoryItem(index)}
                          >
                            Delete
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
      {currentAudio && (
        <AudioPlayer
          key={currentAudio.url}
          src={currentAudio.url}
          title={currentAudio.title}
          playing={isPlaying}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
        />
      )}
    </div>
  );
}

export default App;
