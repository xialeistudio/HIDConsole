import { useEffect, useState, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { message } from "@tauri-apps/plugin-dialog";
import {
  hidListDevices,
  hidOpen,
  hidClose,
  hidWrite,
  getAppInfo,
  DeviceInfo,
  AppInfo,
} from "./bindings";
import "./App.css";

interface LogEntry {
  timestamp: number;
  data: number[];
}

function App() {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [frameSize, setFrameSize] = useState<number>(65);
  const [isConnected, setIsConnected] = useState(false);
  const [showTimestamp, setShowTimestamp] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Get app info
  useEffect(() => {
    try {
      getAppInfo().then(setAppInfo).catch(() => { });
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Scan device list
  const scanDevices = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const list = await hidListDevices(true);
      setDevices(list);
    } catch (e) {
      setDevices([]);
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Initial scan
  useEffect(() => {
    scanDevices();
  }, []);

  // Listen for device response
  useEffect(() => {
    const unlisten = listen<number[]>("response", (event) => {
      setLogs((prev) => [...prev, { timestamp: Date.now(), data: event.payload }]);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Auto-scroll to latest log
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Connect to device
  const handleOpen = async () => {
    if (!selectedDevice) return;
    if (frameSize < 1 || frameSize > 1024) {
      await message("Frame size must be between 1-1024", { title: "Error", kind: "error" });
      return;
    }
    try {
      await hidOpen(selectedDevice, frameSize);
      setIsConnected(true);
      setLogs([]);
    } catch (e) {
      await message(`Failed to open device: ${e}`, { title: "Error", kind: "error" });
    }
  };

  // Disconnect
  const handleClose = async () => {
    try {
      await hidClose();
      setIsConnected(false);
    } catch (e) {
      await message(`Failed to close device: ${e}`, { title: "Error", kind: "error" });
    }
  };

  // Send data
  const handleSend = async () => {
    if (!isConnected) {
      setSendError("Please connect device first");
      return;
    }
    setSendError(null);

    const hex = inputValue.replace(/0x|0X|\s/g, "");
    if (hex.length % 2 !== 0 || hex === "") {
      setSendError("Invalid hex data");
      return;
    }

    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substring(i, i + 2), 16));
    }

    try {
      await hidWrite(new Uint8Array(bytes));
      setInputValue("");
      setSendError(null);
    } catch (e) {
      setSendError("Send failed");
    }
  };

  // Handle input change, allow only hex characters
  const handleInputChange = (value: string) => {
    const hexOnly = value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
    setInputValue(hexOnly);
  };

  // Clear logs
  const handleClearLogs = () => setLogs([]);

  // Format log entry
  const formatLog = (entry: LogEntry) => {
    const hex = entry.data.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
    if (!showTimestamp) return hex;
    const date = new Date(entry.timestamp);
    const time = date.toLocaleTimeString("en-US", { hour12: false });
    const ms = date.getMilliseconds().toString().padStart(3, "0");
    return `[${time}.${ms}] ${hex}`;
  };

  return (
    <div className="h-screen bg-gray-50 p-4 font-sans overflow-hidden">
      <div className="max-w-7xl mx-auto h-full flex">
        {/* Left control panel */}
        <div className="w-[240px] flex flex-col justify-between shrink-0 gap-2">
          {/* Device list */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-600">Device</label>
              <button
                onClick={scanDevices}
                className={`p-1 rounded hover:bg-gray-100 ${isRefreshing ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={isRefreshing || isConnected}
              >
                <svg
                  className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            </div>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent outline-none bg-gray-50"
              disabled={isConnected}
            >
              <option value="">Select</option>
              {devices.map((dev, idx) => (
                <option key={`${dev.path}-${idx}`} value={dev.path}>
                  {dev.product_string}({dev.vendor_id.toString(16).toUpperCase()}, {dev.product_id.toString(16).toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* Frame Size */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Frame Size
            </label>
            <input
              type="number"
              min={1}
              max={1024}
              value={frameSize}
              onChange={(e) => setFrameSize(Number(e.target.value))}
              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent outline-none bg-gray-50"
              disabled={isConnected}
            />
          </div>

          {/* Connect buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleOpen}
              disabled={!selectedDevice || isConnected}
              className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Open
            </button>
            <button
              onClick={handleClose}
              disabled={!isConnected}
              className="flex-1 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Close
            </button>
          </div>

          {/* Options */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showTimestamp}
                onChange={(e) => setShowTimestamp(e.target.checked)}
                className="w-3.5 h-3.5 text-blue-600 rounded"
              />
              <span className="text-xs text-gray-600">Timestamp</span>
            </label>
          </div>

          {/* App info */}
          <div className="mt-auto text-xs text-gray-400 space-y-0.5 shrink-0">
            <div>{appInfo?.name}</div>
            <div>v{appInfo?.version}</div>
          </div>
        </div>

        {/* Right log and send */}
        <div className="flex-1 flex flex-col gap-3 ml-4 min-w-0">
          {/* Log panel */}
          <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <span className="text-xs font-medium text-gray-600">Response</span>
              <span className="text-xs text-gray-400">{logs.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto bg-gray-50 rounded-md p-2 font-mono text-xs">
              {logs.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No data</p>
              ) : (
                logs.map((entry, idx) => (
                  <div key={idx} className="text-gray-700 leading-relaxed break-all">
                    {formatLog(entry)}
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>

          {/* Send area */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600">Send</span>
              <button
                onClick={handleClearLogs}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>

            {sendError && (
              <div className="mb-2 px-2 py-1 bg-red-50 text-red-600 text-xs rounded-md">
                {sendError}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="HEX DATA"
                className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent outline-none bg-gray-50 font-mono uppercase"
              />
              <button
                onClick={handleSend}
                disabled={!isConnected}
                className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-md font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
