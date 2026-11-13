import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useSelector } from "react-redux";
import { Plus, Loader } from "lucide-react";

const Yourdb = () => {
  const { token } = useSelector((state) => state.auth);
  const [connections, setConnections] = useState([]);
  const [newDbFormOpen, setNewDbFormOpen] = useState(false);

  // Form States
  const [dbName, setDbName] = useState("");
  const [dbUrl, setDbUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const fetchConnections = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/connections`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setConnections(response.data);
    } catch (error) {
      console.error("Failed to fetch connections", error);
    }
  };

  useEffect(() => {
    if (token) fetchConnections();
  }, [token]);

  // Submit Handler
  const handleAddDatabase = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/connections`,
        { name: dbName, db_url: dbUrl },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      // Reset form and close modal
      setDbName("");
      setDbUrl("");
      setNewDbFormOpen(false);

      // Refresh the list of connections
      fetchConnections();
    } catch (err) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError("Failed to connect to database.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="w-full h-full flex items-center justify-center">
        {/* --- MOBILE VIEW --- */}
        <div className="overflow-hidden flex flex-col md:flex-row items-center justify-center -mt-10 gap-6 md:gap-0 min-h-[80%] max-h-xl w-[80%] max-w-xs md:max-w-xl rounded-2xl p-3 md:hidden">
          <div className="w-full h-auto">
            <div className="text-[#cdcdcd] forum text-lg px-3">
              Your DataBases -
            </div>
            <div className="overflow-y-auto sleek-scroll h-[280px] forum mt-4 bg-black/10 pl-4 pr-3 pb-3 rounded-2xl">
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  className="px-3 py-1 bg-[#232323] rounded-lg mt-3 text-[#cdcdcd]"
                  onClick={() => navigate(`/chat/${connection.id}`)}
                >
                  {connection.name}
                </div>
              ))}
            </div>
          </div>
          <div
            className="bg-[#cdcdcd] rounded-2xl py-2 px-8 flex flex-row items-center justify-center gap-2 text-[#232323] hover:bg-white max-w-[250px] md:w-full md:h-full cursor-pointer"
            onClick={() => setNewDbFormOpen(true)}
          >
            <Plus size={18} strokeWidth={1.5} />
            <span className="forum">Add new Database</span>
          </div>
        </div>

        {/* --- DESKTOP VIEW --- */}
        <div className="hidden md:flex flex-row min-w-[70%] lg:min-w-[50%] xl:min-w-[40%] max-w-lg overflow-hidden items-center justify-center -mt-10 h-[60%]">
          <div className="flex flex-col w-1/2">
            <div className="text-[#cdcdcd] forum text-lg px-3">
              Your DataBases -
            </div>
            <div className="overflow-y-auto sleek-scroll h-[276px] forum mt-4 bg-black/10 pl-4 pr-3 pb-3 rounded-2xl">
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  className="px-3 py-1 bg-[#232323] rounded-lg mt-3 text-[#cdcdcd] hover:bg-[#181818] duration-300 cursor-pointer"
                  onClick={() => navigate(`/chat/${connection.id}`)}
                >
                  {connection.name}
                </div>
              ))}
            </div>
          </div>
          <div
            className="w-1/2 h-auto flex flex-col items-center justify-center group cursor-pointer duration-300"
            onClick={() => setNewDbFormOpen(true)}
          >
            <img
              src="../src/assets/database.png"
              alt=""
              className="w-20 h-20 group-hover:scale-105 transition-transform"
            />
            <div className="text-xl forum text-[#cdcdcd] group-hover:underline duration-300">
              Add a new Database
            </div>
          </div>
        </div>

        {/* --- ADD DATABASE MODAL --- */}
        <div
          className={`
    fixed top-0 left-0 w-screen h-screen z-50
    flex items-center justify-center
    transition-all duration-500 ease-in-out
    ${
      newDbFormOpen
        ? "opacity-100 backdrop-blur-xl pointer-events-auto translate-y-0"
        : "opacity-0 pointer-events-none backdrop-blur-none -translate-y-[100%]"
    }
  `}
        >
          <div className="w-[90%] max-w-[400px] bg-[#181818] rounded-3xl shadow-xl relative p-6">
            {/* Close Button */}
            <div
              className="p-2 absolute top-2 right-2 hover:bg-black/20 rounded-full duration-300 cursor-pointer"
              onClick={() => setNewDbFormOpen(false)}
            >
              <Plus
                className="h-6 w-6 rotate-45 text-[#cdcdcd]"
                strokeWidth={1}
              />
            </div>

            <div className="w-full mb-14 px-4 text-xl forum text-[#cdcdcd]">
              Enter your Database details -
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 text-red-400 text-sm bg-red-900/20 p-2 rounded-lg text-center">
                {error}
              </div>
            )}

            <form
              onSubmit={handleAddDatabase}
              className="flex flex-col gap-4 forum"
            >
              <div>
                <div className="mb-1 text-[#cdcdcd] px-4">Database Name:</div>
                <input
                  type="text"
                  value={dbName}
                  onChange={(e) => setDbName(e.target.value)}
                  required
                  className="bg-[#000000] px-4 py-2 rounded-xl outline-none w-full text-[#cdcdcd] placeholder-gray-600"
                />
              </div>

              <div>
                <div className="mb-1 text-[#cdcdcd] px-4">Database URL:</div>
                <input
                  type="text"
                  value={dbUrl}
                  onChange={(e) => setDbUrl(e.target.value)}
                  required
                  className="bg-[#000000] px-4 py-2 rounded-xl outline-none w-full text-[#cdcdcd] placeholder-gray-600"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-4 bg-[#cdcdcd] text-black font-bold py-2 rounded-xl hover:bg-white transition-colors flex justify-center items-center disabled:opacity-50"
              >
                {loading ? (
                  <Loader className="animate-spin" size={20} />
                ) : (
                  "Connect Database"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default Yourdb;
