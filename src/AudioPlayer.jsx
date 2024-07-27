import { useState, useRef, useEffect } from "react";
import ReactHowler from "react-howler";
import { FaPlay, FaPause, FaBackward, FaForward } from "react-icons/fa";
// import { MdSpeed } from "react-icons/md";

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
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 text-white p-4 shadow-lg">
      <div className="max-w-3xl mx-auto">
        <div className="text-center font-bold mb-2">{title}</div>
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
        <div className="flex flex-col items-center mb-2">
          <div className="flex items-center justify-center space-x-4 mb-2">
            <button
              onClick={() => handleSeek(-15)}
              className="focus:outline-none hover:text-gray-300"
            >
              <FaBackward />
            </button>
            <button
              onClick={togglePlay}
              className="focus:outline-none hover:text-gray-300 text-2xl"
            >
              {playing ? <FaPause /> : <FaPlay />}
            </button>
            <button
              onClick={() => handleSeek(15)}
              className="focus:outline-none hover:text-gray-300"
            >
              <FaForward />
            </button>
          </div>
          <div className="flex items-center justify-between w-full">
            <div className="text-sm">{formatTime(seek)}</div>
            <div className="relative">
              <button
                onClick={() => setShowSpeedOptions(!showSpeedOptions)}
                className="focus:outline-none hover:text-gray-300 text-sm"
              >
                {rate}x
              </button>
              {showSpeedOptions && (
                <div className="absolute bottom-full right-0 mb-2 bg-gray-700 rounded p-2">
                  {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => handleSpeedChange(speed)}
                      className={`block w-full text-left px-2 py-1 text-sm ${
                        rate === speed ? "bg-gray-600" : ""
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="text-sm">{formatTime(duration)}</div>
          </div>
        </div>
        <div className="relative pt-1">
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
            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;
