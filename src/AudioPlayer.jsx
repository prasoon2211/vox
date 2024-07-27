import { useState, useRef, useEffect } from "react";
import ReactHowler from "react-howler";
import { FaPlay, FaPause, FaUndo, FaRedo, FaClock } from "react-icons/fa";

const AudioPlayer = ({ src, title, playing, onTogglePlay }) => {
  const [duration, setDuration] = useState(0);
  const [seek, setSeek] = useState(0);
  const [rate, setRate] = useState(1);
  const [showSpeedOptions, setShowSpeedOptions] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [audioSrc, setAudioSrc] = useState(null);
  const playerRef = useRef(null);
  const rafRef = useRef(null);
  const isLoadedRef = useRef(false);
  // eslint-disable-next-line no-unused-vars
  const [formattedTime, setFormattedTime] = useState("0:00 / 0:00");

  useEffect(() => {
    setAudioSrc(
      src.startsWith("blob:") ? src : src.includes(".") ? src : `${src}.mp3`
    );
    setIsLoaded(false);
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      isLoadedRef.current = false;
    };
  }, [src]);

  const togglePlay = () => onTogglePlay();

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const handleOnLoad = () => {
    const duration = playerRef.current.duration();
    setDuration(duration);
    setIsLoaded(true);
    isLoadedRef.current = true;
  };

  const handleOnPlay = () => {
    if (isLoadedRef.current) {
      rafRef.current = requestAnimationFrame(updateSeek);
    }
  };

  const handleOnEnd = () => {
    setSeek(0);
  };

  const updateSeek = () => {
    if (playerRef.current && isLoadedRef.current) {
      const currentSeek = playerRef.current.seek();
      setSeek(currentSeek);
      setFormattedTime(`${formatTime(currentSeek)} / ${formatTime(duration)}`);
      rafRef.current = requestAnimationFrame(updateSeek);
    }
  };

  const handleSeek = (direction) => {
    if (playerRef.current && isLoaded) {
      const newSeek = playerRef.current.seek() + direction;
      playerRef.current.seek(Math.max(0, Math.min(newSeek, duration)));
    }
  };

  const handleSpeedChange = (newRate) => {
    setRate(newRate);
    if (playerRef.current && playerRef.current.howler) {
      playerRef.current.howler.rate(newRate);
    }
    setShowSpeedOptions(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 text-white p-2 shadow-lg">
      <div className="max-w-3xl mx-auto">
        <div className="text-center font-bold text-sm mb-1 truncate">
          {title}
        </div>
        {audioSrc && (
          <ReactHowler
            src={audioSrc}
            playing={playing}
            ref={playerRef}
            onLoad={handleOnLoad}
            onPlay={handleOnPlay}
            onEnd={handleOnEnd}
            rate={rate}
            format={["mp3"]}
            html5={true}
          />
        )}
        <div className="relative">
          <input
            type="range"
            min={0}
            max={duration}
            value={seek}
            onChange={(e) => {
              if (playerRef.current && isLoaded) {
                const newSeek = parseFloat(e.target.value);
                playerRef.current.seek(newSeek);
                setSeek(newSeek);
              }
            }}
            className="w-full h-1 bg-gray-600 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                (seek / duration) * 100
              }%, #4b5563 ${(seek / duration) * 100}%, #4b5563 100%)`,
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <div className="text-xs">{formatTime(seek)}</div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => handleSeek(-15)}
              className="focus:outline-none hover:text-blue-400 transition-colors duration-200"
            >
              <FaUndo className="w-5 h-5" />
            </button>
            <button
              onClick={togglePlay}
              className="focus:outline-none hover:text-blue-400 transition-colors duration-200"
            >
              {playing ? (
                <FaPause className="w-5 h-5" />
              ) : (
                <FaPlay className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={() => handleSeek(15)}
              className="focus:outline-none hover:text-blue-400 transition-colors duration-200"
            >
              <FaRedo className="w-5 h-5" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowSpeedOptions(!showSpeedOptions)}
                className="focus:outline-none hover:text-blue-400 transition-colors duration-200 flex items-center"
              >
                <FaClock className="w-5 h-5" />
                <span className="ml-1 text-xs">{rate}x</span>
              </button>
              {showSpeedOptions && (
                <div className="absolute bottom-full right-0 mb-2 bg-gray-700 rounded p-1">
                  {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => handleSpeedChange(speed)}
                      className={`block w-full text-left px-2 py-1 text-xs ${
                        rate === speed ? "bg-blue-600" : "hover:bg-gray-600"
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="text-xs">{formatTime(duration)}</div>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;
