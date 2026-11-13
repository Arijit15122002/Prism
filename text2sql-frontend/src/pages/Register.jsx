import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { Loader } from "lucide-react";

const Register = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await axios.post("http://127.0.0.1:8000/register", {
        username: username,
        password: password,
      });

      localStorage.setItem("token", response.data.access_token);
      navigate("/choose-your-database"); // Redirect to chat page
    } catch (err) {
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full flex justify-center items-center text-[#cdcdcd]">
      <div className="h-auto w-auto -mt-20">
        <h1 className="text-3xl font-bold mb-6 forum">Create an account</h1>
        <div className="bg-black/20 rounded-xl shadow-md p-6">
          <form
            onSubmit={handleRegister}
            className="p-3 flex flex-col font-forum min-w-[300px]"
          >
            <div className="mb-6 text-xl">Get started with Prism</div>

            {/* Show error if there is one */}
            {error && (
              <div className="mb-4 text-red-400 text-sm bg-red-900/20 p-2 rounded-lg text-center">
                {error}
              </div>
            )}

            <div className="mb-3">
              <div className="px-3">Enter username: </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="bg-[#000000] px-4 py-2 rounded-xl outline-none w-full placeholder-gray-600"
              />
            </div>
            <div className="mb-6">
              <div className="px-3">Enter password: </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-[#000000] px-4 py-2 rounded-xl outline-none w-full placeholder-gray-600"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 bg-[#cdcdcd] text-black font-bold py-2 rounded-xl hover:bg-white transition-colors duration-200 flex justify-center items-center disabled:opacity-50"
            >
              {loading ? (
                <Loader className="animate-spin" size={20} />
              ) : (
                "Register"
              )}
            </button>
          </form>

          <div className="text-center mt-4 text-xs text-gray-400">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-white cursor-pointer hover:underline"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
