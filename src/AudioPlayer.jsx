import { useState, useRef, useEffect } from "react";
import ReactHowler from "react-howler";
import { FaPlay, FaPause, FaBackward, FaForward } from "react-icons/fa";
import { MdSpeed } from "react-icons/md";

const AudioPlayer = ({ src, title }) => {
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [seek, setSeek] = useState(0);
  const [rate, setRate] = useState(1);
  const [showSpeedOptions, setShowSpeedOptions] = useState(false);
  const playerRef = useRef(null);
  const rafRef = useRef(null);
  const [audioSrc, setAudioSrc] = useState(null);

  useEffect(() => {
    if (src.startsWith("blob:")) {
      setAudioSrc(src);
    } else {
      setAudioSrc(src.includes(".") ? src : `${src}.mp3`);
    }
  }, [src]);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const togglePlay = () => setPlaying(!playing);

  const handleOnLoad = () => {
    const duration = playerRef.current.duration();
    setDuration(duration);
  };

  const handleOnPlay = () => {
    rafRef.current = requestAnimationFrame(updateSeek);
  };

  const handleOnEnd = () => {
    setPlaying(false);
    setSeek(0);
  };

  const updateSeek = () => {
    setSeek(playerRef.current.seek());
    rafRef.current = requestAnimationFrame(updateSeek);
  };

  const handleSeek = (direction) => {
    const newSeek = playerRef.current.seek() + direction;
    playerRef.current.seek(Math.max(0, Math.min(newSeek, duration)));
  };

  const handleSpeedChange = (newRate) => {
    setRate(newRate);
    if (playerRef.current && playerRef.current.howler) {
      playerRef.current.howler.rate(newRate);
    }
    setShowSpeedOptions(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 text-white p-4">
      <div className="text-center mb-2">{title}</div>
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
        />
      )}
      <div className="flex items-center justify-center space-x-4">
        <button onClick={() => handleSeek(-15)} className="focus:outline-none">
          <FaBackward />
        </button>
        <button onClick={togglePlay} className="focus:outline-none">
          {playing ? <FaPause /> : <FaPlay />}
        </button>
        <button onClick={() => handleSeek(15)} className="focus:outline-none">
          <FaForward />
        </button>
        <div className="relative">
          <button
            onClick={() => setShowSpeedOptions(!showSpeedOptions)}
            className="focus:outline-none"
          >
            <MdSpeed /> {rate}x
          </button>
          {showSpeedOptions && (
            <div className="absolute bottom-full mb-2 bg-gray-700 rounded p-2">
              {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((speed) => (
                <button
                  key={speed}
                  onClick={() => handleSpeedChange(speed)}
                  className={`block w-full text-left px-2 py-1 ${
                    rate === speed ? "bg-gray-600" : ""
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-2">
        <input
          type="range"
          min={0}
          max={duration}
          value={seek}
          onChange={(e) => playerRef.current.seek(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>
    </div>
  );
};

export default AudioPlayer;
