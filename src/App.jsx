/* eslint-disable react/no-unescaped-entities */
import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Readability } from "@mozilla/readability";
import OpenAI from "openai";
import { openDB } from "idb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Clipboard, Upload, Globe, FileText as FileTextIcon, BookOpen } from "lucide-react";
import { ExternalLink } from "lucide-react";
import { Search } from "lucide-react";
import { Play, Trash2, Download } from "lucide-react";
import { FileText } from "lucide-react";
import Fuse from "fuse.js";
import { useDropzone } from "react-dropzone";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronUp } from "lucide-react"; // Add these imports
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Add this import
import { Switch } from "@/components/ui/switch"; // Add this import

import AudioPlayer from "./AudioPlayer";

// Configure PDF.js worker - using local worker from package
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const fetchArchiveUrl = async (url) => {
  try {
    const archiveUrl = `https://archive.ph/${encodeURIComponent(url)}`;
    const response = await axios.get(archiveUrl);
    const parser = new DOMParser();
    const doc = parser.parseFromString(response.data, "text/html");
    const linkElement = doc.querySelector(
      '.TEXT-BLOCK a[href^="https://archive.ph/"]'
    );

    if (linkElement) {
      return linkElement.getAttribute("href");
    } else {
      throw new Error("Archive URL not found");
    }
  } catch (error) {
    console.error("Error fetching archive URL:", error);
    throw error;
  }
};

const fetchURLContents = async (url) => {
  const corsProxies = [
    "https://corsproxy.io/",
    "https://api.allorigins.win/raw?url=",
    "https://thingproxy.freeboard.io/fetch/",
    "https://api.codetabs.com/v1/proxy?quest=",
  ];

  // First, try without a proxy
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.warn("Error fetching without proxy:", error);
  }

  // If direct request fails, try with proxies
  for (const proxy of corsProxies) {
    const proxyUrl = `${proxy}${encodeURIComponent(url)}`;

    try {
      const response = await axios.get(proxyUrl, {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching with proxy ${proxy}:`, error);
    }
  }

  // If all attempts fail, throw an error
  throw new Error(
    "Failed to fetch the URL content. Please try again later or with a different URL."
  );
};

// const TranscriptView = ({ title, content }) => {
//   return (
//     <div className="max-w-3xl mx-auto p-8">
//       <h1 className="text-3xl font-bold mb-6">{title}</h1>
//       <div className="prose prose-lg">
//         {content.split("\n").map((paragraph, index) => (
//           <p key={index} className="mb-4">
//             {paragraph}
//           </p>
//         ))}
//       </div>
//     </div>
//   );
// };

const openTranscript = (item) => {
  const transcriptWindow = window.open("", "_blank");
  transcriptWindow.document.write(`
    <html>
      <head>
        <title>${item.title} - Transcript</title>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
      </head>
      <body>
        <div id="root" class="max-w-3xl mx-auto p-8">
          <h1 class="text-3xl font-bold mb-6">${item.title}</h1>
          <div class="prose prose-lg" id="content"></div>
        </div>
        <script>
          const content = document.getElementById('content');
          const paragraphs = ${JSON.stringify(item.articleText.split("\n"))};
          paragraphs.forEach(paragraph => {
            if (paragraph.trim()) {
              const p = document.createElement('p');
              p.textContent = paragraph;
              p.className = 'mb-4';
              content.appendChild(p);
            }
          });
        </script>
      </body>
    </html>
  `);
  transcriptWindow.document.close();
};

function App() {
  const [apiKey, setApiKey] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchTerm, setSearchTerm] = useState(""); // Add this state
  const [filteredHistory, setFilteredHistory] = useState([]); // Add this state
  const [deleteIndex, setDeleteIndex] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [voiceOption, setVoiceOption] = useState("alloy");
  const [useArchive, setUseArchive] = useState(false);

  // New states for text and PDF input
  const [inputType, setInputType] = useState("url");
  const [pastedText, setPastedText] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfProcessing, setPdfProcessing] = useState(false);

  // Progress tracking states
  const [progressMessage, setProgressMessage] = useState("");
  const [progressStep, setProgressStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);

  useEffect(() => {
    try {
      const storedApiKey = localStorage.getItem("openaiApiKey");
      const storedVoiceOption = localStorage.getItem("voiceOption");
      if (storedApiKey) {
        setApiKey(storedApiKey);
      }
      if (storedVoiceOption) {
        setVoiceOption(storedVoiceOption);
      }
    } catch (error) {
      console.error("Error accessing localStorage:", error);
      setError(
        "Unable to access local storage. Please check your browser settings."
      );
    }
    loadHistory();
  }, []);

  useEffect(() => {
    // Perform fuzzy search whenever history or searchTerm changes
    if (searchTerm.trim() === "") {
      setFilteredHistory(history);
    } else {
      const fuse = new Fuse(history, {
        keys: [
          "title",
          { name: "pageUrl", getFn: (item) => new URL(item.pageUrl).hostname },
        ],
        threshold: 0.4,
      });
      const result = fuse.search(searchTerm);
      setFilteredHistory(result.map((item) => item.item));
    }
  }, [history, searchTerm]);

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

  const addToHistory = async (
    title,
    audioBlob,
    pageUrl,
    audioUrl,
    duration,
    articleText,
    sourceType = "url"
  ) => {
    const newEntry = {
      title,
      audioBlob,
      audioUrl,
      pageUrl,
      date: new Date().toISOString(),
      duration,
      articleText,
      sourceType,
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

  const handleVoiceOptionChange = (value) => {
    setVoiceOption(value);
    localStorage.setItem("voiceOption", value);
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

  const generateTitle = async (text) => {
    try {
      const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
      });

      const firstChunk = text.slice(0, 2000);
      const response = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [
          {
            role: "user",
            content: `Generate a concise, descriptive title (max 60 characters) for this text:\n\n${firstChunk}`,
          },
        ],
        max_completion_tokens: 50,
      });

      return response.choices[0].message.content.trim().replace(/^["']|["']$/g, "");
    } catch (error) {
      console.error("Error generating title:", error);
      return text.slice(0, 50) + "...";
    }
  };

  const extractTextFromPDF = async (file) => {
    setPdfProcessing(true);
    try {
      setProgressMessage(`Reading PDF (${file.name})...`);
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      // Extract text from all pages using pdf.js (fast, client-side)
      setProgressMessage(`Extracting text from ${pdf.numPages} pages...`);
      let rawText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item) => item.str).join(" ");
        rawText += pageText + "\n\n";

        // Update progress every 5 pages
        if (i % 5 === 0 || i === pdf.numPages) {
          setProgressMessage(`Extracted ${i} of ${pdf.numPages} pages...`);
        }
      }

      if (!rawText.trim()) {
        throw new Error("No text found in PDF. This might be a scanned document.");
      }

      // Send extracted text to GPT-5-mini for cleanup and formatting
      setProgressMessage("Cleaning up text with AI...");
      const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
      });

      const response = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [
          {
            role: "user",
            content: `Clean up and format this extracted PDF text for text-to-speech reading. Remove headers, footers, page numbers, and artifacts. Fix spacing issues and maintain natural paragraph structure. Make it flow naturally for audio narration:\n\n${rawText}`,
          },
        ],
        max_completion_tokens: 16000,
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error("Error extracting PDF text:", error);
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    } finally {
      setPdfProcessing(false);
    }
  };

  const handleTextSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setTotalSteps(3);
    setProgressStep(1);

    try {
      if (!pastedText.trim()) {
        throw new Error("Please enter some text.");
      }

      const fullText = pastedText;

      // Start title generation in background (don't wait for it)
      setProgressMessage("Generating title...");
      const titlePromise = generateTitle(fullText);

      setProgressStep(2);
      setProgressMessage("Preparing text for conversion...");
      const chunks = chunkText(fullText);

      if (chunks.length === 0) {
        throw new Error("No content found after processing.");
      }

      // Convert to speech
      setProgressStep(3);
      setProgressMessage(`Converting to speech (${chunks.length} chunks)...`);
      const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
      });

      const audioPromises = chunks.map((chunk) =>
        openai.audio.speech.create({
          model: "tts-1",
          voice: voiceOption,
          input: chunk,
        })
      );

      const audioResponses = await Promise.all(audioPromises);

      setProgressMessage("Finalizing audio...");
      const audioBlobs = await Promise.all(
        audioResponses.map((response) => response.arrayBuffer())
      );
      const concatenatedBlob = new Blob(audioBlobs, { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(concatenatedBlob);
      const audio = new Audio(audioUrl);

      // Wait for title generation to complete
      const finalTitle = await titlePromise;

      audio.addEventListener("loadedmetadata", () => {
        const duration = audio.duration;
        setCurrentAudio({
          url: audioUrl,
          title: finalTitle,
          duration,
        });
        addToHistory(
          finalTitle,
          concatenatedBlob,
          window.location.href,
          audioUrl,
          duration,
          fullText,
          "text"
        );
        setIsPlaying(true);
        setPastedText("");
      });
    } catch (error) {
      console.error("Error:", error);
      setError(error.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
      setProgressMessage("");
      setProgressStep(0);
    }
  };

  const handlePdfSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setTotalSteps(4);
    setProgressStep(1);

    try {
      if (!pdfFile) {
        throw new Error("Please upload a PDF file.");
      }

      const fullText = await extractTextFromPDF(pdfFile);

      // Start title generation in background (don't wait for it)
      setProgressStep(2);
      setProgressMessage("Generating title...");
      const titlePromise = generateTitle(fullText);

      setProgressMessage("Preparing text for conversion...");
      const chunks = chunkText(fullText);

      if (chunks.length === 0) {
        throw new Error("No content found after processing.");
      }

      // Convert to speech immediately (parallel with title generation)
      setProgressStep(3);
      setProgressMessage(`Converting to speech (${chunks.length} chunks)...`);
      const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
      });

      const audioPromises = chunks.map((chunk) =>
        openai.audio.speech.create({
          model: "tts-1",
          voice: voiceOption,
          input: chunk,
        })
      );

      const [audioResponses, finalTitle] = await Promise.all([
        Promise.all(audioPromises),
        titlePromise,
      ]);

      setProgressStep(4);
      setProgressMessage("Finalizing audio...");
      const audioBlobs = await Promise.all(
        audioResponses.map((response) => response.arrayBuffer())
      );
      const concatenatedBlob = new Blob(audioBlobs, { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(concatenatedBlob);
      const audio = new Audio(audioUrl);

      audio.addEventListener("loadedmetadata", () => {
        const duration = audio.duration;
        setCurrentAudio({
          url: audioUrl,
          title: finalTitle,
          duration,
        });
        addToHistory(
          finalTitle,
          concatenatedBlob,
          pdfFile.name,
          audioUrl,
          duration,
          fullText,
          "pdf"
        );
        setIsPlaying(true);
        setPdfFile(null);
      });
    } catch (error) {
      console.error("Error:", error);
      setError(error.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
      setProgressMessage("");
      setProgressStep(0);
    }
  };

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setTotalSteps(4);
    setProgressStep(1);

    try {
      if (!url) {
        throw new Error("Please enter a valid URL.");
      }

      let finalUrl = url;
      if (useArchive) {
        setProgressMessage("Fetching archived version...");
        try {
          finalUrl = await fetchArchiveUrl(url);
        } catch (archiveError) {
          console.warn(
            "Failed to fetch archive URL, falling back to original URL:",
            archiveError
          );
        }
      }

      // Fetch article
      setProgressMessage("Fetching article content...");
      let htmlResponse;
      try {
        htmlResponse = await fetchURLContents(finalUrl);
      } catch (fetchError) {
        if (fetchError.code === "ECONNABORTED") {
          throw new Error(
            "Request timed out. The proxy server might be overloaded. Please try again later."
          );
        } else if (fetchError.response) {
          throw new Error(
            `Proxy server error: ${fetchError.response.status} - ${fetchError.response.statusText}`
          );
        } else {
          throw new Error(
            "Failed to fetch the article. Please check your internet connection and try again."
          );
        }
      }

      setProgressStep(2);
      setProgressMessage("Extracting article content...");
      const doc = new DOMParser().parseFromString(htmlResponse, "text/html");
      const article = new Readability(doc).parse();

      if (!article || !article.textContent.trim()) {
        throw new Error(
          "Unable to parse the article or no content found. The website might be blocking content extraction."
        );
      }

      // Construct the full string for OpenAI API
      let fullText = "";
      if (article.title) fullText += `Title: ${article.title}\n\n`;
      if (article.byline) fullText += `Subtitle: ${article.byline}\n\n`;
      if (article.datePublished)
        fullText += `Date: ${article.datePublished}\n\n`;
      fullText += `${article.textContent}`;

      // Chunk the text
      setProgressMessage("Preparing text for conversion...");
      const chunks = chunkText(fullText);

      if (chunks.length === 0) {
        throw new Error("No content found in the article after processing.");
      }

      // Convert to speech in parallel
      setProgressStep(3);
      setProgressMessage(`Converting to speech (${chunks.length} chunks)...`);
      const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
      });

      const audioPromises = chunks.map((chunk) =>
        openai.audio.speech.create({
          model: "tts-1",
          voice: voiceOption,
          input: chunk,
        })
      );

      let audioResponses;
      try {
        audioResponses = await Promise.all(audioPromises);
      } catch (openaiError) {
        throw new Error(`OpenAI API error: ${openaiError.message}`);
      }

      // Concatenate audio
      setProgressStep(4);
      setProgressMessage("Finalizing audio...");
      const audioBlobs = await Promise.all(
        audioResponses.map((response) => response.arrayBuffer())
      );
      const concatenatedBlob = new Blob(audioBlobs, { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(concatenatedBlob);
      const audio = new Audio(audioUrl);
      audio.addEventListener("loadedmetadata", () => {
        const duration = audio.duration;
        setCurrentAudio({
          url: audioUrl,
          title: article.title || url,
          duration,
        });
        addToHistory(
          article.title,
          concatenatedBlob,
          url,
          audioUrl,
          duration,
          fullText,
          "url"
        );
        setIsPlaying(true); // Start playing automatically
      });
    } catch (error) {
      console.error("Error:", error);
      setError(
        error.message || "An unexpected error occurred. Please try again."
      );
    } finally {
      setIsLoading(false);
      setProgressMessage("");
      setProgressStep(0);
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteIndex !== null) {
      deleteHistoryItem(deleteIndex);
      setIsDeleteDialogOpen(false);
      setDeleteIndex(null);
    }
  };

  const downloadHistoryItem = (item) => {
    const url = window.URL.createObjectURL(item.audioBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.title || "download"}.mp3`; // Assuming the audio is in mp3 format
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const handlePasteUrl = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (isValidUrl(text)) {
        setUrl(text);
        setError(""); // Clear any existing error
      } else {
        setError("Invalid URL. Please paste a valid URL.");
      }
    } catch (err) {
      console.error("Failed to read clipboard contents: ", err);
      setError(
        "Unable to paste from clipboard. Please check your browser permissions."
      );
    }
  };

  const playHistoryItem = (item) => {
    setCurrentAudio({
      url: item.audioUrl,
      title: item.title,
    });
    setIsPlaying(true); // Start playing when history item is clicked
  };

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError("PDF file size must be less than 10MB");
        return;
      }
      if (file.type !== "application/pdf") {
        setError("Please upload a valid PDF file");
        return;
      }
      setPdfFile(file);
      setError("");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    multiple: false,
  });

  return (
    <div className="container mx-auto p-6 max-w-2xl flex flex-col min-h-screen">
      <Tabs defaultValue="convert" className="flex-grow flex flex-col">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="convert">Convert</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="convert" className="flex-grow">
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-center">
              {apiKey ? "Convert to Audio" : "Enter API Key"}
            </h2>

            {!apiKey ? (
              <>
                <form onSubmit={handleApiKeySubmit} className="space-y-4">
                  <Input
                    type="text"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Enter OpenAI API Key"
                    required
                    className="w-full"
                  />
                  <Button type="submit" className="w-full">
                    Save API Key
                  </Button>
                </form>
                <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                  <h3 className="text-lg font-semibold mb-2">
                    Help Instructions:
                  </h3>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>You need an OpenAI API key to use this app.</li>
                    <li>
                      To get an API key:
                      <ol className="list-decimal pl-5 mt-2 space-y-1">
                        <li>
                          <a
                            href="https://platform.openai.com/signup"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Sign up
                          </a>{" "}
                          or log in to OpenAI.
                        </li>
                        <li>
                          Go to{" "}
                          <a
                            href="https://platform.openai.com/account/api-keys"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            API Keys
                          </a>{" "}
                          page in your profile.
                        </li>
                        <li>Create a new API key and save it securely.</li>
                      </ol>
                    </li>
                    <li>Enter your API key above and click "Save API Key".</li>
                    <li>
                      Your key is stored locally and not sent to any server.
                    </li>
                  </ul>
                </div>
              </>
            ) : (
              <Tabs value={inputType} onValueChange={setInputType} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="url" className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    URL
                  </TabsTrigger>
                  <TabsTrigger value="text" className="flex items-center gap-2">
                    <FileTextIcon className="w-4 h-4" />
                    Text
                  </TabsTrigger>
                  <TabsTrigger value="pdf" className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    PDF
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="url" className="space-y-4 mt-4">
                  <form onSubmit={handleUrlSubmit} className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="Enter article URL"
                        required
                        className="flex-grow"
                      />
                      <Button
                        type="button"
                        onClick={handlePasteUrl}
                        className="flex-shrink-0"
                        variant="outline"
                        size="icon"
                      >
                        <Clipboard className="w-4 h-4" />
                      </Button>
                    </div>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full"
                    >
                      {isLoading ? "Converting..." : "Convert to audio"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="text" className="space-y-4 mt-4">
                  <form onSubmit={handleTextSubmit} className="space-y-4">
                    <div className="relative">
                      <Textarea
                        value={pastedText}
                        onChange={(e) => setPastedText(e.target.value)}
                        placeholder="Paste your text here..."
                        required
                        className="min-h-[200px] resize-y"
                      />
                      <div className="absolute bottom-2 right-2 text-xs text-gray-500">
                        {pastedText.length} characters
                      </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full"
                    >
                      {isLoading ? "Converting..." : "Convert to audio"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="pdf" className="space-y-4 mt-4">
                  <form onSubmit={handlePdfSubmit} className="space-y-4">
                    <div
                      {...getRootProps()}
                      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                        isDragActive
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      <input {...getInputProps()} />
                      <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      {pdfFile ? (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-gray-900">
                            {pdfFile.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                          <p className="text-xs text-blue-600">
                            Click or drag to replace
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-600">
                            {isDragActive
                              ? "Drop the PDF here..."
                              : "Drag & drop a PDF here, or click to select"}
                          </p>
                          <p className="text-xs text-gray-500">
                            Max file size: 10MB
                          </p>
                        </div>
                      )}
                    </div>
                    <Button
                      type="submit"
                      disabled={!pdfFile || isLoading || pdfProcessing}
                      className="w-full"
                    >
                      {pdfProcessing
                        ? "Extracting text..."
                        : isLoading
                        ? "Converting..."
                        : "Convert to audio"}
                    </Button>
                  </form>
                </TabsContent>

                <div className="mt-4 flex flex-col items-center w-full">
                  <Button
                    type="button"
                    onClick={() => setShowOptions(!showOptions)}
                    variant="outline"
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium border-gray-300 shadow-sm"
                  >
                    <span>Options</span>
                    {showOptions ? (
                      <ChevronUp className="w-4 h-4 ml-2" />
                    ) : (
                      <ChevronDown className="w-4 h-4 ml-2" />
                    )}
                  </Button>
                  {showOptions && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg w-full border border-gray-200 shadow-sm">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Narration Voice
                      </label>
                      <Select
                        value={voiceOption}
                        onValueChange={handleVoiceOptionChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a voice" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="alloy">Alloy</SelectItem>
                          <SelectItem value="echo">Echo</SelectItem>
                          <SelectItem value="fable">Fable</SelectItem>
                          <SelectItem value="onyx">Onyx</SelectItem>
                          <SelectItem value="nova">Nova</SelectItem>
                          <SelectItem value="shimmer">Shimmer</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="mt-2 ml-1 text-sm">
                        <a
                          href="https://platform.openai.com/docs/guides/text-to-speech/voice-options"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Listen to samples here
                        </a>
                      </div>
                      {inputType === "url" && (
                        <>
                          <hr className="my-4 border-gray-300" />
                          <div className="flex items-center space-x-2">
                            <Switch
                              id="use-archive"
                              checked={useArchive}
                              onCheckedChange={setUseArchive}
                            />
                            <div className="flex items-center">
                              <label
                                htmlFor="use-archive"
                                className="text-sm font-medium text-gray-700 mr-1"
                              >
                                Use archive.ph
                              </label>
                              <div className="relative group">
                                <span className="text-gray-500 cursor-pointer">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-4a1 1 0 100 2 1 1 0 000-2zm1 4a1 1 0 00-2 0v4a1 1 0 002 0v-4z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </span>
                                <div className="absolute bottom-full mb-1 hidden group-hover:block w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg">
                                  Turn this on if you're having trouble getting the
                                  URL to work. This will use archive.ph to fetch the
                                  article instead of the original URL.
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </Tabs>
            )}

            {error && (
              <p className="text-red-500 text-sm text-center mt-2">{error}</p>
            )}
          </div>
        </TabsContent>{" "}
        <TabsContent
          value="history"
          className={`flex-grow overflow-y-auto ${currentAudio ? "pb-32" : ""}`}
        >
          <div className="space-y-4 pb-4">
            {" "}
            {/* Reduced space-y-6 to space-y-4 */}
            <div className="relative">
              <Input
                type="text"
                placeholder="Search history..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
            {filteredHistory.length === 0 ? (
              <p className="text-center text-gray-500">No history available.</p>
            ) : (
              filteredHistory.map((item, index) => (
                <div
                  key={index}
                  className="bg-gray-50 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-xl flex-shrink-0 mt-0.5">
                        {item.sourceType === "url" ? "🌐" : item.sourceType === "text" ? "📄" : "📕"}
                      </span>
                      <h3 className="text-lg font-semibold line-clamp-2 flex-grow">
                        {item.sourceType === "url" ? (
                          <a
                            href={item.pageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline flex items-start gap-2"
                          >
                            <span className="flex-grow">{item.title}</span>
                            <ExternalLink className="w-4 h-4 flex-shrink-0 mt-1" />
                          </a>
                        ) : (
                          <span className="text-gray-900">{item.title}</span>
                        )}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-2 ml-8">
                      {item.sourceType === "url" ? new URL(item.pageUrl).hostname : item.sourceType === "pdf" ? item.pageUrl : "Pasted text"}
                      {" • "}
                      {Math.floor(item.duration / 3600) > 0
                        ? `${Math.floor(item.duration / 3600)} h ${Math.floor(
                            (item.duration % 3600) / 60
                          )} min`
                        : `${Math.floor(item.duration / 60)} min ${Math.floor(
                            item.duration % 60
                          )} sec`}
                    </p>
                    <div className="flex items-center mt-4 space-x-6 ml-8">
                      <button
                        onClick={() => playHistoryItem(item)}
                        className="text-gray-600 hover:text-blue-600 transition-colors duration-200"
                        aria-label="Play Audio"
                      >
                        <Play className="w-6 h-6" />
                      </button>
                      <button
                        onClick={() => openTranscript(item)}
                        className="text-gray-600 hover:text-purple-600 transition-colors duration-200"
                        aria-label="View Transcript"
                      >
                        <FileText className="w-6 h-6" />
                      </button>
                      <button
                        onClick={() => downloadHistoryItem(item)}
                        className="text-gray-600 hover:text-green-600 transition-colors duration-200"
                        aria-label="Download Audio"
                      >
                        <Download className="w-6 h-6" />
                      </button>
                      <Dialog
                        open={isDeleteDialogOpen}
                        onOpenChange={setIsDeleteDialogOpen}
                      >
                        <DialogTrigger asChild>
                          <button
                            onClick={() => {
                              setDeleteIndex(index);
                              setIsDeleteDialogOpen(true);
                            }}
                            className="text-gray-600 hover:text-red-600 transition-colors duration-200"
                            aria-label="Delete History"
                          >
                            <Trash2 className="w-6 h-6" />
                          </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle>Confirm Deletion</DialogTitle>
                            <DialogDescription>
                              Are you sure you want to delete this item? This
                              action cannot be undone.
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setIsDeleteDialogOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={handleDeleteConfirm}
                            >
                              Delete
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>{" "}
      </Tabs>
      {currentAudio && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <AudioPlayer
            key={currentAudio.url}
            src={currentAudio.url}
            title={currentAudio.title}
            playing={isPlaying}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
          />
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4 transform transition-all">
            {/* Spinner */}
            <div className="flex justify-center mb-6">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
              </div>
            </div>

            {/* Progress Steps */}
            {totalSteps > 0 && (
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  {Array.from({ length: totalSteps }).map((_, index) => (
                    <div key={index} className="flex-1 flex items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                          index + 1 < progressStep
                            ? "bg-green-500 text-white"
                            : index + 1 === progressStep
                            ? "bg-blue-600 text-white animate-pulse"
                            : "bg-gray-200 text-gray-500"
                        }`}
                      >
                        {index + 1 < progressStep ? "✓" : index + 1}
                      </div>
                      {index < totalSteps - 1 && (
                        <div
                          className={`flex-1 h-1 mx-2 rounded transition-all ${
                            index + 1 < progressStep ? "bg-green-500" : "bg-gray-200"
                          }`}
                        ></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Progress Message */}
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Processing...
              </h3>
              <p className="text-gray-600 animate-pulse">
                {progressMessage || "Please wait..."}
              </p>
              <p className="text-sm text-gray-500 mt-4">
                Please don't close this window
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
