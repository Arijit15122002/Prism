import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import { loginSuccess } from "../store/authSlice";
import { Loader } from "lucide-react";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Get the token from FastAPI (using Form Data)
      const formData = new URLSearchParams();
      formData.append("username", username);
      formData.append("password", password);

      const response = await axios.post(
        "http://127.0.0.1:8000/login",
        formData,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      const token = response.data.access_token;

      // 2. Immediately fetch the user's profile using the new token
      const userResponse = await axios.get("http://127.0.0.1:8000/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      // 3. Save everything to Redux
      dispatch(loginSuccess({ user: userResponse.data, token }));

      // 4. Redirect to the chat page
      navigate("/choose-your-database");
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
        <h1 className="text-3xl font-bold mb-6 forum">Welcome back</h1>
        <div className="bg-black/20 rounded-xl shadow-md p-6">
          <form
            className="p-3 flex flex-col font-forum min-w-[300px]"
            onSubmit={handleLogin}
          >
            <div className="mb-6 text-xl">Log in to Prism</div>

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

            <div className="mb-4">
              <div className="px-3">Enter password: </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-[#000000] px-4 py-2 rounded-xl outline-none w-full placeholder-gray-600"
              />
            </div>

            {/* Show error if there is one */}
            {error && (
              <div className="text-red-500 text-sm mb-2 text-center bg-red-900/20 p-2 rounded-lg">
                {error}
              </div>
            )}

            {/* The Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 bg-[#cdcdcd] text-black font-bold py-2 rounded-xl hover:bg-white transition-colors duration-200 flex justify-center items-center disabled:opacity-50"
            >
              {loading ? (
                <Loader className="animate-spin" size={20} />
              ) : (
                "Log In"
              )}
            </button>
          </form>

          <div className="text-center mt-4 text-xs text-gray-400">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-white cursor-pointer hover:underline"
            >
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
